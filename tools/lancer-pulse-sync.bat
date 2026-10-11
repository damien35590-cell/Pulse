@echo off
rem 1) Remplacez COLLEZ_LE_JETON_ICI par la valeur de INGEST_TOKEN (sans espace).
rem 2) Ajoutez à la fin de la ligne le dossier MyWhoosh si vous le connaissez : -Folders "%USERPROFILE%\Downloads","C:\le\dossier\mywhoosh"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pulse-sync.ps1" -Url "https://pulse-bay-eight.vercel.app" -Token "COLLEZ_LE_JETON_ICI"
pause
