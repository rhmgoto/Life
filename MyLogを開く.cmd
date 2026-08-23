@echo off
setlocal
title MyLog
set "MYLOG_ARGS="
if defined MYLOG_NO_BROWSER set "MYLOG_ARGS=-NoBrowser"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-mylog.ps1" %MYLOG_ARGS%
if errorlevel 1 (
  echo.
  echo MyLog could not start. See the message above.
  pause
)
endlocal
