@echo off
REM ===================================================================
REM  Removes the firewall rule added by allow-firewall.bat
REM
REM  HOW TO RUN: right-click this file, choose "Run as administrator".
REM
REM  IMPORTANT: this file must stay pure ASCII. See allow-firewall.bat.
REM ===================================================================

net session >nul 2>&1
if %errorlevel% neq 0 goto NOADMIN

netsh advfirewall firewall delete rule name="Vite dev (5174)"
echo.
echo   [OK] Rule removed.
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
