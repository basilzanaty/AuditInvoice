@echo off
chcp 65001 > nul
echo ========================================================
echo    DocuAudit AI - تشغيل المساعد الذكي لتدقيق الفواتير
echo ========================================================
echo.

:: Detect Node.js or Antigravity Node
set NODE_CMD=node
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
        set NODE_CMD="%APPDATA%\Antigravity\bin\agy-node.cmd"
    ) else (
        echo [!] لم يتم العثور على Node.js في النظام.
        pause
        exit /b 1
    )
)

echo [1/2] جاري تشغيل الخادم المحلي...
start "" http://localhost:3000

echo [2/2] تم فتح المتصفح على: http://localhost:3000
echo.
echo الخادم يعمل الآن... لإيقاف الخادم اضغط Ctrl+C
echo.
%NODE_CMD% server.js
pause
