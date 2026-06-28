param([string]$Token)

$sql = Get-Content "sql_storage_policies.sql" -Raw

# Escape quotes and newlines for JSON
$sql = $sql -replace "`r`n", " " -replace "`n", " " -replace '"', '\"'
$json = "{ `"query`": `"$sql`" }"

Write-Host "Sending query..."

try {
  $result = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/jpzkumgndqsdwimbvjku/database/query" -Method Post -Headers @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" } -Body $json -ErrorAction Stop
  Write-Host "OK"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "Status: $code"
  try {
    $s = $_.Exception.Response.GetResponseStream()
    $r = New-Object System.IO.StreamReader($s)
    Write-Host "Body: $($r.ReadToEnd())"
  } catch {
    Write-Host "Error: $_"
  }
}
