@echo off
REM DbWorld - build / publish the Android release APK (interactive). Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0release\publish-android.ps1" %*
pause
