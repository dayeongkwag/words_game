@echo off
REM ===================================================================
REM  Vite dev server (TCP 5174) inbound firewall rule
REM
REM  HOW TO RUN: right-click this file, choose "Run as administrator".
REM
REM  Scope: TCP port 5174, local subnet only.
REM         Not reachable from the internet.
REM  Undo:  run remove-firewall.bat the same way.
REM
REM  IMPORTANT: this file must stay pure ASCII.
REM  cmd.exe reads .bat files using the console code page (949 here),
REM  so UTF-8 Korean bytes turn into garbage that can contain "|" or "&"
REM  and break the whole script - even inside REM comments.
REM ===================================================================

net session >nul 2>&1
if %errorlevel% neq 0 goto NOADMIN

echo.
echo   Adding firewall rule: Vite dev (5174)
echo.

REM Remove any previous copy so re-running stays clean.
netsh advfirewall firewall delete rule name="Vite dev (5174)" >nul 2>&1

netsh advfirewall firewall add rule name="Vite dev (5174)" dir=in action=allow protocol=TCP localport=5174 profile=any remoteip=localsubnet
if %errorlevel% neq 0 goto FAILED

echo.
echo   [OK] Rule added.
echo.
echo   ------------------------------------------------------------
echo   On your phone (same Wi-Fi), open port 5174 at the IPv4 shown:
echo.
ipconfig | findstr /i "IPv4"
echo.
echo   Example:  http://172.30.1.49:5174/
echo   ------------------------------------------------------------
echo.
pause
exit /b 0

:NOADMIN
echo.
echo   [!] Administrator permission is required.
echo.
echo   Close this window. Then RIGHT-CLICK this file and pick
echo   "Run as administrator" - the second PowerShell-style entry.
echo.
pause
exit /b 1

:FAILED
echo.
echo   [X] FAILED. Copy the message above and send it back.
echo.
pause
exit /b 1
