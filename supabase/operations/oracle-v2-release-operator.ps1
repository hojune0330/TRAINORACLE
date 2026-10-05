param(
  [Parameter(Mandatory)][ValidateSet('inventory','apply','verify','provision-key')][string]$Action,
  [Parameter(Mandatory)][string]$Config,
  [Parameter(Mandatory)][string]$ProjectRef,
  [Parameter(Mandatory)][string]$Destination,
  [switch]$ConfirmFirstProvision,
  [switch]$ConfirmSqlApply,
  [string]$Node = 'C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
)
$ErrorActionPreference = 'Stop'
if ($Action -eq 'apply' -and -not $ConfirmSqlApply) { throw 'SQL application requires -ConfirmSqlApply.' }
if ($Action -eq 'provision-key' -and -not $ConfirmFirstProvision) {
  throw 'New comparison key registration requires -ConfirmFirstProvision. Existing keys are never replaced.'
}
$password = Read-Host 'Database password (private input; not a command argument)' -AsSecureString
$token = $null
if ($Action -eq 'provision-key') {
  $token = Read-Host 'Supabase management access token (private input)' -AsSecureString
}
$passwordPtr = [IntPtr]::Zero
$tokenPtr = [IntPtr]::Zero
try {
  $passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
  $inputObject = @{password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)}
  if ($null -ne $token) {
    $tokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
    $inputObject.managementToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPtr)
  }
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $Node
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardInput = $true
  $start.ArgumentList.Add((Join-Path $PSScriptRoot 'oracle-v2-release.mjs'))
  foreach ($argument in @($Action,$Config,$ProjectRef,$Destination)) { $start.ArgumentList.Add($argument) }
  if ($Action -eq 'provision-key') { $start.ArgumentList.Add('CONFIRM_FIRST_PROVISION') }
  if ($Action -eq 'apply') { $start.ArgumentList.Add('CONFIRM_SQL_APPLY') }
  $process = [Diagnostics.Process]::Start($start)
  $process.StandardInput.Write(($inputObject | ConvertTo-Json -Compress))
  $process.StandardInput.Close()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw 'Oracle release operation refused. See sanitized status above.' }
} finally {
  if ($passwordPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr) }
  if ($tokenPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPtr) }
  $inputObject = $null
  $password.Dispose()
  if ($null -ne $token) { $token.Dispose() }
}
