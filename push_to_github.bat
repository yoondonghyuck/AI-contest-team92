@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Users\you56\AppData\Local\Programs\Git\cmd;C:\Users\you56\AppData\Local\Programs\Git\ucrt64\bin;%PATH%"

echo ======================================================================
echo   [GitHub Push] Polymer Prediction AI Repository
echo   Target: https://github.com/yoondonghyuck/AI-contest-team92.git
echo ======================================================================
echo.

echo [Step 1] GitHub Authentication...
echo Opening browser for login authorization if needed...
git credential-manager github login

echo.
echo [Step 2] Pushing main branch to GitHub...
git push -u origin main

if %ERRORLEVEL% equ 0 goto SUCCESS
goto FAILED

:SUCCESS
echo.
echo ======================================================================
echo   [SUCCESS] GitHub push completed successfully!
echo   https://github.com/yoondonghyuck/AI-contest-team92
echo ======================================================================
goto END

:FAILED
echo.
echo ======================================================================
echo   [FAILED] Push failed. Please check permissions or token.
echo ======================================================================
goto END

:END
echo.
pause
