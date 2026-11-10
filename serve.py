"""Static server for LS 特輯 (street football) with no-cache headers.

Two things this has to get right, both learned the hard way:

1. No-cache headers. Plain `python -m http.server` lets Safari cache the JS
   modules, so after an update the browser keeps running the OLD code even on
   refresh. This sends `no-store` on every response.

2. Listen on BOTH IPv4 and IPv6. cloudflared dials the tunnel origin as
   `localhost:8000` and Windows resolves that to `::1` (IPv6) first, so an
   IPv4-only `0.0.0.0` bind makes the tunnel fail intermittently with
   `dial tcp [::1]:8000: connectex: ... actively refused it` — the iPad then
   loads the page but a module (weapons.js / styles.css ...) 502s, which looks
   like "the game is broken / my change didn't work". Two separate sockets,
   IPv6 kept V6ONLY so it never fights the IPv4 socket for the port.
"""
import http.server
import json
import socket
import socketserver
import threading
import os

PORT = 8200   # 點球大戰專用埠（足球 8100、槍戰 8000，三個可同時開）
os.chdir(os.path.dirname(os.path.abspath(__file__)))

SAVE_FILE = "save.json"      # 存檔就放在專案資料夾（跟著 PC，不怕 tunnel 網址換掉）


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the console quiet

    # ---------------- 存檔 API ----------------
    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/save":
            try:
                with open(SAVE_FILE, "r", encoding="utf-8") as f:
                    return self._json({"ok": True, "save": json.load(f)})
            except Exception:
                return self._json({"ok": True, "save": None})   # 還沒存過
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] == "/api/save":
            try:
                n = int(self.headers.get("Content-Length") or 0)
                data = json.loads((self.rfile.read(n) if n else b"{}").decode("utf-8"))
                if isinstance(data, dict) and data.get("clear"):
                    try:
                        os.remove(SAVE_FILE)
                    except FileNotFoundError:
                        pass
                    return self._json({"ok": True, "cleared": True})
                tmp = SAVE_FILE + ".tmp"
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=1)
                os.replace(tmp, SAVE_FILE)      # 原子寫入：不會存到一半壞掉
                return self._json({"ok": True})
            except Exception as e:
                return self._json({"ok": False, "error": str(e)}, 400)
        self.send_error(404)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


class Server6(Server):
    address_family = socket.AF_INET6

    def server_bind(self):
        # keep IPv6 socket separate from the IPv4 one (Windows defaults to v6only anyway)
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
        super().server_bind()


def serve(server):
    server.serve_forever(poll_interval=0.5)


if __name__ == "__main__":
    v4 = Server(("0.0.0.0", PORT), Handler)           # LAN + 127.0.0.1
    print(f"POINT PENALTY serving on 0.0.0.0:{PORT} (no-cache)")

    v6 = None
    try:
        v6 = Server6(("::", PORT), Handler)           # ::1 (what cloudflared dials first)
        print(f"POINT PENALTY serving on [::]:{PORT} (no-cache)")
    except OSError as e:
        print(f"(IPv6 listener unavailable: {e})")

    if v6 is not None:
        threading.Thread(target=serve, args=(v6,), daemon=True).start()
    serve(v4)
