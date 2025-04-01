@echo off
echo Starting Start Ichi Full Development Environment...
echo.

set START_ICHI_PASSWORD=admin
set FLASK_SECRET_KEY=dev

echo Starting Flask backend in a new window...
start cmd /k "run_dev.bat"

echo Starting React frontend...
call run_react_dev.bat 