param(
  [string]$ExampleFile = "./.env.example",
  [string]$TargetFile = "./.env"
)

if (Test-Path $TargetFile) {
  Write-Host "$TargetFile already exists. Openning for edit..."
  notepad $TargetFile
  exit 0
}

if (-Not (Test-Path $ExampleFile)) {
  Write-Host "Example file $ExampleFile not found."
  exit 1
}

Copy-Item $ExampleFile $TargetFile
Write-Host "Created $TargetFile from $ExampleFile. Opening for edit..."
notepad $TargetFile
