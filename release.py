"""發佈一個新版本：產生差異檔 → 寫入 CHANGELOG → 更新版本號 → git commit + tag。

用法：
    python release.py 1.1 "敵人臉換成照片"              # 一般更新
    python release.py 1.1 "敵人臉換成照片" --deploy     # 順便打包＋上傳到 GitHub Pages

它會做這幾件事（全部自動）：
  1. `git diff v<上一個版本>..HEAD` 存成 `versions/v<新版本>.diff`（每一版改了什麼都留一份）
  2. `git diff --stat` 的檔案／行數統計寫進 CHANGELOG
  3. 更新 `VERSION` 與 `js/version.js`（遊戲右上會顯示版本號）
  4. `git add -A` → `git commit -m "v<版本>: <說明>"` → `git tag v<版本>`

之後要看某版改了什麼：
    git show v1.1            # 那一版的 commit 與檔案差異
    git diff v1.0 v1.1       # 兩版之間的完整差異
    versions/v1.1.diff       # 同一份差異的文字檔（可以直接傳給人看）
"""
import os
import re
import subprocess
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
VERSIONS_DIR = os.path.join(HERE, "versions")
CHANGELOG = os.path.join(HERE, "CHANGELOG.md")


def run(args, check=True):
    r = subprocess.run(args, cwd=HERE, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        print(f"指令失敗：{' '.join(args)}\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return (r.stdout or "").strip()


def current_version():
    try:
        with open(os.path.join(HERE, "VERSION"), encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        return "0.0"


def bump_files(version):
    with open(os.path.join(HERE, "VERSION"), "w", encoding="utf-8") as f:
        f.write(version + "\n")
    with open(os.path.join(HERE, "js", "version.js"), "w", encoding="utf-8") as f:
        f.write(f"// 遊戲版本（由 release.py 自動更新，勿手改）\nexport const VERSION = '{version}';\n")


def prepend_changelog(version, prev, note, stat_lines, diff_name):
    today = datetime.now().strftime("%Y-%m-%d")
    entry = [f"## v{version} — {today}", "", f"**{note}**", "", "### 這一版改了哪些檔案", ""]
    entry += [f"- {line}" for line in stat_lines] or ["- （沒有檔案變動）"]
    entry += ["", f"### 完整差異", f"- `versions/{diff_name}`（＝ `git diff v{prev} v{version}`）", "", "---", ""]

    old = ""
    if os.path.exists(CHANGELOG):
        with open(CHANGELOG, encoding="utf-8") as f:
            old = f.read()

    header = "# 版本紀錄 CHANGELOG\n\n> 每次更新都有一個版本號、一段說明，以及一份完整差異檔（`versions/`）。\n> 遊戲畫面上的版本號來自 `js/version.js`，由 `python release.py <版本> \"<說明>\"` 自動產生。\n\n"
    if old.startswith("# 版本紀錄"):
        # 插在第一個 "## v" 之前，最新版本永遠在最上面
        idx = old.find("\n## v")
        old = old[:idx] + "\n" + "\n".join(entry) + old[idx:] if idx > 0 else old.rstrip() + "\n\n" + "\n".join(entry) + "\n"
    else:
        old = header + "\n".join(entry) + "\n"

    with open(CHANGELOG, "w", encoding="utf-8") as f:
        f.write(old)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    version = sys.argv[1].lstrip("v")
    note = sys.argv[2]
    deploy = "--deploy" in sys.argv[3:]

    if not re.fullmatch(r"\d+\.\d+(\.\d+)?", version):
        print("版本號格式請用 1.1 或 1.1.2")
        sys.exit(1)

    prev = current_version()
    if prev == version:
        print(f"版本號跟現在一樣（{version}），請換一個")
        sys.exit(1)

    print(f"目前版本 v{prev} → 新版本 v{version}")

    # 1) 先更新版本檔，讓差異檔裡也包含版本號變更
    bump_files(version)

    # 2) 差異統計 + 完整 diff
    stat = run(["git", "diff", "--stat"], check=False)
    full = run(["git", "diff"], check=False)
    untracked = run(["git", "ls-files", "--others", "--exclude-standard"], check=False)

    os.makedirs(VERSIONS_DIR, exist_ok=True)
    diff_name = f"v{version}.diff"
    with open(os.path.join(VERSIONS_DIR, diff_name), "w", encoding="utf-8") as f:
        f.write(f"# v{prev} → v{version}　{note}\n# 產生時間 {datetime.now():%Y-%m-%d %H:%M}\n\n")
        if full:
            f.write(full + "\n")
        if untracked:
            f.write("\n# 這一版新增的檔案：\n")
            f.write("\n".join(f"# + {p}" for p in untracked.splitlines()) + "\n")

    stat_lines = [l for l in stat.splitlines() if l.strip() and "changed" not in l]
    print(f"差異統計：{len(stat_lines)} 個檔案；新增檔案 {len(untracked.splitlines()) if untracked else 0} 個")

    # 3) CHANGELOG
    prepend_changelog(version, prev, note, stat_lines, diff_name)

    # 4) commit + tag
    run(["git", "add", "-A"])
    run(["git", "commit", "-m", f"v{version}: {note}"], check=False)
    run(["git", "tag", "-f", f"v{version}"])

    print(f"\n✅ 完成 v{version}")
    print(f"   差異檔：versions/{diff_name}")
    print(f"   看這一版做了什麼：git show v{version}")

    if deploy:
        print("\n打包並上傳 GitHub Pages…")
        run([sys.executable, os.path.join(HERE, "share_export.py")])
        share = os.path.join(os.path.dirname(HERE), "voxel-fps-share")
        run(["git", "add", "-A"], check=False)
        for args in (["git", "-C", share, "add", "-A"],
                     ["git", "-C", share, "commit", "-m", f"v{version}: {note}"],
                     ["git", "-C", share, "push"]):
            print("  $", " ".join(args))
            r = subprocess.run(args, cwd=HERE, capture_output=True, text=True, encoding="utf-8", errors="replace")
            print("   ", (r.stdout or r.stderr or "").strip()[:200])
    else:
        print("\n（要一起更新網頁版：加 --deploy，或雙擊 deploy_github.bat）")


if __name__ == "__main__":
    main()
