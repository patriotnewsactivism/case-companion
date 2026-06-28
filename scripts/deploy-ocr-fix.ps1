# Deploy fixed ocr-document function
# Requires SUPABASE_ACCESS_TOKEN set in environment
# Get token at https://supabase.com/dashboard/account/tokens

param(
  [Parameter(Mandatory=$false)]
  [string]$AccessToken = $env:SUPABASE_ACCESS_TOKEN,

  [Parameter(Mandatory=$false)]
  [string]$ProjectRef = "jpzkumgndqsdwimbvjku"
)

if (-not $AccessToken) {
  Write-Error "SUPABASE_ACCESS_TOKEN not set. Generate one at https://supabase.com/dashboard/account/tokens then run:"
  Write-Error "  `$env:SUPABASE_ACCESS_TOKEN='your_token_here'"
  Write-Error "  .\scripts\deploy-ocr-fix.ps1"
  exit 1
}

# Step 1: Build the function bundle
Write-Host "Bundling ocr-document function..." -ForegroundColor Cyan
$bundleDir = "supabase\.temp\func-bundle"
if (Test-Path $bundleDir) { Remove-Item -Recurse -Force $bundleDir }
New-Item -ItemType Directory -Path "$bundleDir" -Force | Out-Null

# Copy function files
Copy-Item "supabase\functions\ocr-document\index.ts" "$bundleDir\index.ts"
Copy-Item "supabase\functions\ocr-document\deno.json" "$bundleDir\deno.json" -ErrorAction SilentlyContinue

# Copy _shared/ dependencies
$sharedDir = "supabase\.temp\func-bundle-shared"
if (Test-Path $sharedDir) { Remove-Item -Recurse -Force $sharedDir }
New-Item -ItemType Directory -Path "$sharedDir" -Force | Out-Null
Copy-Item "supabase\functions\_shared\*.ts" "$sharedDir\" -ErrorAction SilentlyContinue

# Step 2: Deploy via Supabase API
Write-Host "Deploying ocr-document function..." -ForegroundColor Cyan
$funcBody = Get-Content "$bundleDir\index.ts" -Raw

$headers = @{
  "Authorization" = "Bearer $AccessToken"
  "Content-Type" = "application/octet-stream"
  "x-region" = "auto"
}

try {
  $response = Invoke-RestMethod -Method Post `
    -Uri "https://api.supabase.com/v1/projects/$ProjectRef/functions/ocr-document/deploy" `
    -Headers $headers `
    -Body $funcBody `
    -ContentType "application/octet-stream"

  Write-Host "✅ ocr-document deployed: $($response.id)" -ForegroundColor Green
}
catch {
  $statusCode = $_.Exception.Response.StatusCode.value__
  if ($statusCode -eq 201) {
    Write-Host "✅ ocr-document deployed successfully (created new)" -ForegroundColor Green
  } elseif ($statusCode -eq 200) {
    Write-Host "✅ ocr-document deployed successfully (updated)" -ForegroundColor Green
  } else {
    Write-Error "Deploy failed (HTTP $statusCode): $_"
    exit 1
  }
}

Write-Host ""
Write-Host "To deploy ALL edge functions, run: npm run fix:all" -ForegroundColor Yellow
