@echo off
chcp 65001 > nul
cd /d "%~dp0"
set "PATH=C:\Users\you56\AppData\Local\Programs\Git\cmd;C:\Users\you56\AppData\Local\Programs\Git\ucrt64\bin;%PATH%"

echo ======================================================================
echo   [GitHub Push] 고분자 예측 AI 프로젝트 저장소 업로드
echo   Target: https://github.com/yoondonghyuck/AI-contest-team92.git
echo ======================================================================
echo.
echo 깃허브(GitHub) 계정 인증 창 또는 브라우저가 뜨면 로그인을 승인해 주세요.
echo.

git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ======================================================================
    echo   [성공] 깃허브 업로드가 완벽하게 완료되었습니다!
    echo ======================================================================
) else (
    echo ----------------------------------------------------------------------
    echo   푸시 중 오류가 발생했습니다. 토큰 인증 또는 권한을 확인해 주세요.
    echo ----------------------------------------------------------------------
)
echo.
pause
