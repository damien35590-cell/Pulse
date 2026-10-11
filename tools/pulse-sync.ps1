<#
  Envoie automatiquement vos nouveaux fichiers FIT vers Pulse.
  Laissez cette fenêtre ouverte : toutes les 30 secondes, elle regarde les dossiers indiqués.
#>
param(
  [Parameter(Mandatory = $true)][string]$Url,           # ex. https://pulse-bay-eight.vercel.app
  [Parameter(Mandatory = $true)][string]$Token,         # la valeur de INGEST_TOKEN
  [string[]]$Folders = @("$env:USERPROFILE\Downloads"), # dossiers surveillés
  [int]$SinceDays = 2,                                  # ignore les fichiers plus vieux (pour ne pas tout renvoyer au premier lancement)
  [int]$IntervalSec = 600,
  [switch]$Recurse                                      # regarde aussi les sous-dossiers
)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$endpoint = $Url.TrimEnd('/') + "/api/ingest/fit"
$state = Join-Path $env:LOCALAPPDATA "pulse-sync-state.txt"
$done = @{}
if (Test-Path $state) { Get-Content $state | ForEach-Object { $done[$_] = $true } }
$sizes = @{}

Write-Host "Pulse sync démarrée. Dossiers surveillés :"
$Folders | ForEach-Object { Write-Host "  $_" }
Write-Host "Ctrl + C pour arrêter.`n"

while ($true) {
  foreach ($dir in $Folders) {
    if (-not (Test-Path $dir)) { continue }
    $files = Get-ChildItem -Path $dir -Filter *.fit -File -Recurse:$Recurse -ErrorAction SilentlyContinue |
             Where-Object { $_.LastWriteTime -gt (Get-Date).AddDays(-$SinceDays) }
    foreach ($f in $files) {
      $key = "$($f.FullName)|$($f.Length)|$($f.LastWriteTimeUtc.Ticks)"
      if ($done.ContainsKey($key)) { continue }
      if (((Get-Date) - $f.LastWriteTime).TotalSeconds -lt 20) { continue }          # encore en cours d'écriture
      if ($sizes[$f.FullName] -ne $f.Length) { $sizes[$f.FullName] = $f.Length; continue } # taille pas encore stable
      try {
        $r = Invoke-RestMethod -Method Post -Uri $endpoint -InFile $f.FullName -ContentType "application/octet-stream" `
             -Headers @{ Authorization = "Bearer $Token"; "X-Filename" = $f.Name } -TimeoutSec 120
        Write-Host ("{0:HH:mm:ss}  {1} : {2} enregistrée(s), {3} déjà présente(s)" -f (Get-Date), $f.Name, $r.saved, $r.duplicates)
        $done[$key] = $true; Add-Content -Path $state -Value $key
      } catch {
        $code = 0
        try { $code = [int]$_.Exception.Response.StatusCode } catch {}
        if ($code -eq 422 -or $code -eq 400) {
          Write-Host ("{0:HH:mm:ss}  {1} : ignoré (pas une activité lisible)" -f (Get-Date), $f.Name)
          $done[$key] = $true; Add-Content -Path $state -Value $key
        } elseif ($code -eq 401) {
          Write-Host "Jeton refusé (401) : vérifiez INGEST_TOKEN dans Vercel et dans ce script."
        } else {
          Write-Host ("{0:HH:mm:ss}  {1} : échec, nouvel essai plus tard ({2})" -f (Get-Date), $f.Name, $_.Exception.Message)
        }
      }
    }
  }
  Start-Sleep -Seconds $IntervalSec
}
