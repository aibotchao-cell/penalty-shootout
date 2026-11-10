@echo off
chcp 65001 >nul
REM ============================================================
REM  LS 點球大戰 — 一鍵更新網頁版（GitHub Pages）
REM  網址：https://aibotchao-cell.github.io/penalty-shootout/
REM  版本紀錄：先跑  python release.py <版本> "<說明>"  再雙擊這個
REM ============================================================
cd /d "%~dp0"
echo.
echo === 1) 檢查版本 ===
type js\version.js
echo.
echo === 2) 上傳到 GitHub ===
git add -A
git commit -m "更新 %DATE% %TIME%"
git push
echo.
echo === 完成 ===
echo 約 1 分鐘後生效： https://aibotchao-cell.github.io/penalty-shootout/
echo （可以按 Ctrl+Shift+R 強制重新整理）
echo.
pause
