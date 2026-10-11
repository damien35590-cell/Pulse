# Cherche les fichiers .fit modifiés ces 3 dernières heures : lancez-le juste après une séance MyWhoosh.
# Le dossier affiché est celui où MyWhoosh enregistre ses fichiers. (Peut prendre quelques minutes.)
Get-ChildItem -Path $env:USERPROFILE, $env:ProgramData -Filter *.fit -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-3) } |
  Select-Object LastWriteTime, Length, FullName | Sort-Object LastWriteTime -Descending | Format-Table -AutoSize -Wrap
Write-Host "`nSi la liste est vide, MyWhoosh n'enregistre pas de fichier local : téléchargez le FIT depuis votre compte MyWhoosh (il ira dans Téléchargements, déjà surveillé)."
