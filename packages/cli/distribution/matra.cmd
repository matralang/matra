@echo off
setlocal
"%~dp0runtime\node.exe" "%~dp0app\node_modules\@matra\cli\src\cli.mjs" %*
exit /b %errorlevel%
