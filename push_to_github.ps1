[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PATH = "C:\Users\you56\AppData\Local\Programs\Git\cmd;C:\Users\you56\AppData\Local\Programs\Git\ucrt64\bin;" + $env:PATH

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  [GitHub Push] Polymer Prediction AI Repository" -ForegroundColor Cyan
Write-Host "  Target: https://github.com/yoondonghyuck/AI-contest-team92.git" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1단계] 깃허브 계정 인증을 확인합니다..." -ForegroundColor Yellow
git credential-manager github login

Write-Host "`n[2단계] 깃허브 원격 저장소(origin main)로 푸시합니다..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n======================================================================" -ForegroundColor Green
    Write-Host "  [성공] 깃허브 푸시가 완벽하게 완료되었습니다!" -ForegroundColor Green
    Write-Host "  저장소: https://github.com/yoondonghyuck/AI-contest-team92" -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
} else {
    Write-Host "`n======================================================================" -ForegroundColor Red
    Write-Host "  [오류] 푸시에 실패했습니다." -ForegroundColor Red
    Write-Host "  개인 액세스 토큰(PAT)을 발급받아 푸시할 수도 있습니다." -ForegroundColor Red
    Write-Host "======================================================================" -ForegroundColor Red
}
