@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 24，再启动 Hairroom。
  pause
  exit /b 1
)
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 exit /b 1
)
if exist inpaint-service\.venv\Scripts\python.exe if exist inpaint-service\models (
  echo 正在启动本机 AI 补全服务：最小化窗口「Hairroom AI 补全」，请保持打开，模型加载约需十几秒…
  start "Hairroom AI 补全" /min cmd /k inpaint-service\.venv\Scripts\python.exe inpaint-service\server.py
)
echo.
echo Hairroom 本地网页：http://127.0.0.1:4318
echo 服务运行时请保留此窗口。按 Ctrl+C 停止。
echo.
node server.mjs
pause
