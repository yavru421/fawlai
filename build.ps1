$projectRoot = $PSScriptRoot
$publishTemp = Join-Path $projectRoot "publish_temp"
$dist = Join-Path $projectRoot "dist"

if (Test-Path $publishTemp) { Remove-Item -Recurse -Force $publishTemp }
dotnet publish $projectRoot -c Release -o $publishTemp
if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Path $dist | Out-Null
Copy-Item -Recurse "$publishTemp\wwwroot\*" $dist
