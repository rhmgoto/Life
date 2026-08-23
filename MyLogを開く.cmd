@echo off
chcp 65001 > nul
title MyLog
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-mylog.ps1"
