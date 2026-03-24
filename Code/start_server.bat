@echo off
REM Start StudentHub server on the local network
cd /d "%~dp0"

REM Set the port (change if needed)
set PORT=3000

REM Start the Node.js server
REM If you want to use a different Node version, adjust the command below
start "StudentHub Server" cmd /k "node server1.js --port %PORT%"

echo Server started on port %PORT%. Press Ctrl+C in the server window to stop.
pause
