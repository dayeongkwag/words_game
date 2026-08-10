@echo off
REM ===================================================================
REM  Makes the Vite dev server reachable from a phone on the same Wi-Fi.
REM
REM  HOW TO RUN: right-click this file, choose "Run as administrator".
REM
REM  What it does:
REM    1) Adds an inbound allow rule for TCP 5174 (local subnet only).
REM    2) Marks the current Wi-Fi network as Private.
REM
REM  Why step 2 matters:
REM    Windows has pre-existing BLOCK rules for node.exe scoped to the
REM    Public profile, and block rules beat allow rules. Those rules do
REM    not apply on a Private network, so node stays blocked on real
REM    public Wi-Fi (cafes) but works at home.
REM
REM  Undo: run remove-firewall.bat, and set the network back to Public
REM        in Windows Settings if you want.
REM
REM  IMPORTANT: this file must stay pure ASCII. cmd.exe reads .bat files
REM  with the console code page, so UTF-8 Korean bytes break the parser.
REM ===================================================================

net session >nul 2>&1
if %errorlevel% neq 0 goto NOADMIN

echo.
echo   [1/2] Firewall rule for TCP 5174
netsh advfirewall firewall delete rule name="Vite dev (5174)" >nul 2>&1
netsh advfirewall firewall add rule name="Vite dev (5174)" dir=in action=allow protocol=TCP localport=5174 profile=any remoteip=localsubnet
if %errorlevel% neq 0 goto FAILED

echo.
echo   [2/2] Set current Wi-Fi network to Private
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' -and $_.IPv4Connectivity -ne 'Disconnected' } | ForEach-Object { Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private; Write-Host ('      ' + $_.Name + ' -> Private') }"

echo.
echo   ------------------------------------------------------------
echo   Current state:
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetConnectionProfile | Select-Object Name, NetworkCategory | Format-Table -AutoSize | Out-String -Width 60"
echo   Open this on your phone (same Wi-Fi), port 5174:
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
echo   RIGHT-CLICK this file and pick "Run as administrator".
echo.
pause
exit /b 1

:FAILED
echo.
echo   [X] FAILED. Copy the message above and send it back.
echo.
pause
exit /b 1
