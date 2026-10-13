@echo off
chcp 65001 >nul
rem Расчёт флопов TexasSolver на компьютере владельца (подготовлено Claude, 2026-10-13).
rem Папка poker должна лежать ВНУТРИ папки TexasSolver-v0.2.0-Windows.
cd /d "%~dp0"
if not exist "..\console_solver.exe" (
  echo Не нашёл console_solver.exe. Положи папку poker внутрь папки TexasSolver-v0.2.0-Windows.
  pause
  exit /b
)
echo Считаю флопы по одному. Окно не закрывай. Компьютер можно не трогать до утра.
for %%F in (tasks\*.txt) do (
  if exist "results\%%~nF.json" (
    echo Уже готово: %%~nF
  ) else (
    echo Считаю %%~nF ...
    "..\console_solver.exe" -i "%%F" -r "..\resources" > "logs\%%~nF.log" 2>&1
    if exist "results\%%~nF.json" (echo Готово: %%~nF) else (echo НЕ получилось: %%~nF — смотри logs)
  )
)
echo.
echo ВСЁ. Утром перетащи папку results в VS Code (в poker-bot/data-build/solver/pc-flops/poker/) и напиши Claude.
pause
