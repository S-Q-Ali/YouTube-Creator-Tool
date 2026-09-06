@echo off
title Niche-Scope One-Click Start
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
if errorlevel 1 (
  echo.
  echo Launch failed. Details: %TEMP%\niche-scope-start.log
  pause
)