$ErrorActionPreference = 'Stop'
$pkg = Join-Path (Get-Location) '.omo\evidence\genspark-legacy-recovery-20260625'
$archive = 'D:\admin\Downloads\trainoracle_genspark_legacy_recovery_20260625'
$outJson = Join-Path (Get-Location) '.omo\evidence\genspark-legacy-recovery-20260625-qa-review-raw.json'
$outMd = Join-Path (Get-Location) '.omo\evidence\genspark-legacy-recovery-20260625-qa-review.md'
$artifactDir = Join-Path $pkg 'qa-review-artifacts'
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

function Add-Art($id,$kind,$desc,$path) {
  $script:artifacts += [ordered]@{ id=$id; kind=$kind; description=$desc; path=$path; length=(Get-LengthOrNull $path) }
}
function Get-LengthOrNull($path) {
  if (Test-Path -LiteralPath $path) { return (Get-Item -LiteralPath $path).Length }
  return $null
}
function Assert-TextArtifact($id,$desc,$content) {
  $p = Join-Path $artifactDir "$id.txt"
  Set-Content -LiteralPath $p -Value $content -Encoding UTF8
  Add-Art $id 'text' $desc $p
  return $p
}
function Get-PngInfo($path) {
  $bytes = [IO.File]::ReadAllBytes($path)
  $sigOk = $bytes.Length -ge 24 -and ($bytes[0..7] -join ',') -eq '137,80,78,71,13,10,26,10'
  $w = [System.Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($bytes,16))
  $h = [System.Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($bytes,20))
  Add-Type -AssemblyName System.Drawing
  $decodeOk = $false; $dw = $null; $dh = $null; $decodeErr = $null
  try { $img = [System.Drawing.Image]::FromFile($path); $decodeOk = $true; $dw=$img.Width; $dh=$img.Height; $img.Dispose() } catch { $decodeErr = $_.Exception.Message }
  [ordered]@{ path=$path; exists=(Test-Path -LiteralPath $path); length=$bytes.Length; signatureOk=$sigOk; ihdrWidth=$w; ihdrHeight=$h; decodeOk=$decodeOk; decodedWidth=$dw; decodedHeight=$dh; decodeError=$decodeErr; dimensionsGt1x1=($decodeOk -and $dw -gt 1 -and $dh -gt 1) }
}
function Get-Json($path) { Get-Content -Raw -LiteralPath $path | ConvertFrom-Json }

$artifacts = @()
$checks = [ordered]@{}
$surfaceEvidence = @()
$adversarialCases = @()

$requiredListPath = Join-Path $pkg 'task-3-required-artifacts.txt'
$requiredNames = @(
  '01-body-text.txt',
  '01-browser-screenshot.png',
  '01-browser-state.md',
  '01-compaction-notices.json',
  '01-link-manifest.json',
  '01-redacted-dom-snapshot.txt',
  '02-agent-response.md',
  '02-agent-response.png',
  '02-download-attempts.json',
  '02-recovered-material-index.json',
  '02-request-prompt.md',
  '03-adversarial-compaction-expiry.md',
  '03-private-name-scan.txt',
  '03-recovery-report.md',
  '03-review-coverage.md',
  '03-sensitive-boundary-audit-scan.txt',
  '03-sensitive-boundary-audit.txt',
  'task-3-required-artifacts.txt'
)
$requiredResults = foreach($name in $requiredNames) {
  $p = Join-Path $pkg $name
  [ordered]@{ name=$name; path=$p; exists=(Test-Path -LiteralPath $p); length=(Get-LengthOrNull $p); nonEmpty=((Test-Path -LiteralPath $p) -and (Get-Item -LiteralPath $p).Length -gt 0) }
}
$checks.requiredArtifacts = $requiredResults
$requiredPass = @($requiredResults | Where-Object { -not $_.nonEmpty }).Count -eq 0
Assert-TextArtifact 'qa-required-artifacts' 'Required artifact presence and non-empty listing' (($requiredResults | ConvertTo-Json -Depth 5)) | Out-Null
$surfaceEvidence += [ordered]@{ scenarioId='S01'; criterionReference='required artifacts present/non-empty'; surface='filesystem'; exactInvocation="PowerShell Test-Path/Get-Item over entries in $requiredListPath"; verdict=($(if($requiredPass){'PASS'}else{'FAIL'})); artifactRefs=@('qa-required-artifacts') }

$pngPaths = @('01-browser-screenshot.png','02-agent-response.png') | ForEach-Object { Join-Path $pkg $_ }
$pngInfos = @($pngPaths | ForEach-Object { Get-PngInfo $_ })
$checks.pngs = $pngInfos
$pngPass = @($pngInfos | Where-Object { -not ($_.exists -and $_.length -gt 0 -and $_.signatureOk -and $_.decodeOk -and $_.dimensionsGt1x1) }).Count -eq 0
Assert-TextArtifact 'qa-png-decode' 'PNG signature/decode/dimensions evidence' (($pngInfos | ConvertTo-Json -Depth 5)) | Out-Null
$surfaceEvidence += [ordered]@{ scenarioId='S02'; criterionReference='PNG signatures/decode and dimensions >1x1'; surface='filesystem + System.Drawing decoder'; exactInvocation="PowerShell ReadAllBytes signature check and System.Drawing.Image::FromFile for $($pngPaths -join ', ')"; verdict=($(if($pngPass){'PASS'}else{'FAIL'})); artifactRefs=@('qa-png-decode') }

$bodyPath = Join-Path $pkg '01-body-text.txt'
$bodyLength = (Get-Item -LiteralPath $bodyPath).Length
$checks.bodyText = [ordered]@{ path=$bodyPath; length=$bodyLength; gt400000=($bodyLength -gt 400000) }
Assert-TextArtifact 'qa-body-text-size' '01-body-text.txt byte length evidence' ($checks.bodyText | ConvertTo-Json -Depth 3) | Out-Null
$surfaceEvidence += [ordered]@{ scenarioId='S03'; criterionReference='01-body-text.txt >400000 bytes'; surface='filesystem'; exactInvocation="PowerShell Get-Item Length $bodyPath"; verdict=($(if($bodyLength -gt 400000){'PASS'}else{'FAIL'})); artifactRefs=@('qa-body-text-size') }

$linkPath = Join-Path $pkg '01-link-manifest.json'
$linkManifest = Get-Json $linkPath
$links = @($linkManifest.links)
$markerCount = ([regex]::Matches((Get-Content -Raw -LiteralPath $linkPath), 'credential-query-removed')).Count
$textFilesPkg = Get-ChildItem -LiteralPath $pkg -Recurse -File -Include *.txt,*.json,*.md,*.csv |
  Where-Object { $_.FullName -notlike '*\qa-review-artifacts\*' -and $_.FullName -notlike '*genspark-legacy-recovery-20260625-qa-review*' }
$allPkgText = ($textFilesPkg | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName }) -join "`n"
$markerCountAllPkgText = ([regex]::Matches($allPkgText, 'credential-query-removed')).Count
$linkCounts = [ordered]@{ totalLinks=$linkManifest.totalLinks; linksLength=$links.Count; credentialQueryRemovedLinks=$linkManifest.credentialQueryRemovedLinks; derivedMarkerCountInManifest=$markerCount; derivedMarkerCountAllPackageText=$markerCountAllPkgText }
$evidencePaths = @()
foreach($item in @($links + @($linkManifest.compactionNotices))) {
  if ($null -ne $item.evidencePath -and "$($item.evidencePath)".Trim() -ne '') {
    $rel = "$($item.evidencePath)"
    $resolved = Join-Path $pkg $rel
    $evidencePaths += [ordered]@{ evidencePath=$rel; resolved=$resolved; exists=(Test-Path -LiteralPath $resolved); length=(Get-LengthOrNull $resolved); nonEmpty=((Test-Path -LiteralPath $resolved) -and (Get-Item -LiteralPath $resolved).Length -gt 0) }
  }
}
$checks.linkCounts = $linkCounts
$checks.evidencePaths = $evidencePaths
$linkPass = ($linkManifest.totalLinks -eq 64 -and $links.Count -eq 64 -and $linkManifest.credentialQueryRemovedLinks -eq 21 -and $markerCount -eq 21)
$evidencePathPass = @($evidencePaths | Where-Object { -not $_.nonEmpty }).Count -eq 0
Assert-TextArtifact 'qa-link-counts-evidencepaths' 'Link count, marker count, and material evidencePath resolution evidence' ([ordered]@{ linkCounts=$linkCounts; evidencePaths=$evidencePaths } | ConvertTo-Json -Depth 8) | Out-Null
$surfaceEvidence += [ordered]@{ scenarioId='S04'; criterionReference='root credentialQueryRemovedLinks=21 equals derived marker count; totalLinks=links.length=64; every material evidencePath resolves'; surface='JSON manifest + filesystem'; exactInvocation="PowerShell ConvertFrom-Json $linkPath; regex marker count over manifest; Test-Path evidencePath values"; verdict=($(if($linkPass -and $evidencePathPass){'PASS'}else{'FAIL'})); artifactRefs=@('qa-link-counts-evidencepaths') }

$compactionPath = Join-Path $pkg '01-compaction-notices.json'
$compaction = Get-Json $compactionPath
$compactionNotices = @($compaction.notices)
$compactionPass = ((Test-Path -LiteralPath $compactionPath) -and (Get-Item -LiteralPath $compactionPath).Length -gt 0 -and $compactionNotices.Count -gt 0)
$checks.compactionNotices = [ordered]@{ path=$compactionPath; length=(Get-Item -LiteralPath $compactionPath).Length; noticeCount=$compactionNotices.Count; sampleKinds=@($compactionNotices | Select-Object -ExpandProperty kind -ErrorAction SilentlyContinue) }
Assert-TextArtifact 'qa-compaction-notices' 'Compaction notice presence evidence' ($checks.compactionNotices | ConvertTo-Json -Depth 5) | Out-Null
$surfaceEvidence += [ordered]@{ scenarioId='S05'; criterionReference='compaction notices present'; surface='JSON artifact'; exactInvocation="PowerShell ConvertFrom-Json $compactionPath; count notices"; verdict=($(if($compactionPass){'PASS'}else{'FAIL'})); artifactRefs=@('qa-compaction-notices') }

$reportPath = Join-Path $pkg '03-recovery-report.md'
$reportLines = Get-Content -LiteralPath $reportPath
$requiredPhrases = @(
  'Report limit: compacted history is represented by available compaction notices and recoverable transcript/body text only.',
  'Report limit: expired or unavailable links are recorded as unavailable rather than reconstructed as fetched content.',
  'Report limit: agent-generated reconstructions are labeled as reconstructions and are not substituted for unavailable source artifacts.',
  'Report limit: sensitive/session-boundary exclusions are intentionally omitted from recovered material.'
)
$phraseResults = foreach($phrase in $requiredPhrases) { [ordered]@{ phrase=$phrase; presentAsLiteralLine=($reportLines -contains $phrase) } }
$phrasePass = @($phraseResults | Where-Object { -not $_.presentAsLiteralLine }).Count -eq 0
$checks.reportPhrases = $phraseResults
Assert-TextArtifact 'qa-report-limit-phrases' 'Required literal report limit phrase line evidence' ($phraseResults | ConvertTo-Json -Depth 4) | Out-Null
$surfaceEvidence += [ordered]@{ scenarioId='S06'; criterionReference='03-recovery-report.md contains literal report limit phrase lines'; surface='markdown file'; exactInvocation="PowerShell Get-Content line membership check $reportPath"; verdict=($(if($phrasePass){'PASS'}else{'FAIL'})); artifactRefs=@('qa-report-limit-phrases') }

$scanRoots = @($pkg,$archive)
$scanFiles = foreach($root in $scanRoots) { Get-ChildItem -LiteralPath $root -Recurse -File }
$scanFiles = @($scanFiles | Where-Object { $_.FullName -notlike '*genspark-legacy-recovery-20260625-qa-review*' -and $_.FullName -notlike '*qa-review-artifacts*' })
$scanFiles = @($scanFiles | Where-Object { $_.Extension.ToLowerInvariant() -in @('.txt','.json','.md','.csv') })
$patterns = [ordered]@{
  'aws_access_key_id' = 'AKIA[0-9A-Z]{16}'
  'github_pat' = 'ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}'
  'slack_token' = 'xox[baprs]-[A-Za-z0-9-]{10,}'
  'openai_api_key' = 'sk-[A-Za-z0-9]{20,}'
  'google_api_key' = 'AIza[0-9A-Za-z_-]{20,}'
  'private_key_block' = '-----BEGIN (RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----'
  'password_assignment' = '(?i)\b(password|passwd|pwd|secret|token|api[_-]?key|credential)\b\s*[:=]\s*[''\"]?[^\s''\",]{8,}'
  'control_chars_except_tab_cr_lf' = '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
}
$scanFindings = @()
foreach($file in $scanFiles) {
  $text = Get-Content -Raw -LiteralPath $file.FullName
  foreach($key in $patterns.Keys) {
    $matches = [regex]::Matches($text, $patterns[$key])
    if ($matches.Count -gt 0) { $scanFindings += [ordered]@{ file=$file.FullName; class=$key; count=$matches.Count } }
  }
}
$scanPass = $scanFindings.Count -eq 0
$checks.scan = [ordered]@{ roots=$scanRoots; fileCount=$scanFiles.Count; findingCount=$scanFindings.Count; findingsNoValues=$scanFindings }
Assert-TextArtifact 'qa-sensitive-control-scan' 'Sensitive credential and control character scan counts without matched values' ($checks.scan | ConvertTo-Json -Depth 6) | Out-Null
$adversarialCases += [ordered]@{ scenarioId='A01'; criterionReference='text sensitive/credential/control scan over .txt/.json/.md/.csv in package plus local archive has zero hits; do not scan PNG as text'; adversarialClass='credential/control-byte leakage'; expectedBehavior='No matches in text-shaped artifacts, binary PNGs excluded'; verdict=($(if($scanPass){'PASS'}else{'FAIL'})); artifactRefs=@('qa-sensitive-control-scan') }

$archiveFiles = @(Get-ChildItem -LiteralPath $archive -Recurse -File)
$archiveNonEmpty = @($archiveFiles | Where-Object { $_.Length -gt 0 }).Count -eq $archiveFiles.Count -and $archiveFiles.Count -gt 0
$checks.archive = [ordered]@{ path=$archive; fileCount=$archiveFiles.Count; allNonEmpty=$archiveNonEmpty }
Assert-TextArtifact 'qa-local-archive-inventory' 'Local archive inventory count evidence' ($checks.archive | ConvertTo-Json -Depth 4) | Out-Null
$adversarialCases += [ordered]@{ scenarioId='A02'; criterionReference='local archive included in scan scope'; adversarialClass='archive omission'; expectedBehavior='Archive exists and all archived files are non-empty before scan result is accepted'; verdict=($(if($archiveNonEmpty){'PASS'}else{'FAIL'})); artifactRefs=@('qa-local-archive-inventory') }

$allVerdicts = @($surfaceEvidence.verdict + $adversarialCases.verdict)
$overall = if(@($allVerdicts | Where-Object { $_ -ne 'PASS' }).Count -eq 0){'PASS'}else{'FAIL'}
$raw = [ordered]@{
  verdict=$overall
  generatedAt=(Get-Date).ToString('o')
  surfaceEvidence=$surfaceEvidence
  adversarialCases=$adversarialCases
  artifactRefs=$artifacts
  checks=$checks
  cleanupState='No runtime resources spawned by QA review.'
}
$raw | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $outJson -Encoding UTF8

$md = @()
$md += '# QA Review: genspark legacy recovery 20260625'
$md += ''
$md += "Verdict: **$overall**"
$md += ''
$md += ('Surface/invocation: filesystem and JSON/PNG decoder checks over package `' + $pkg + '`; local archive scan over `' + $archive + '`. No runtime resources spawned.')
$md += ''
$md += '## manualQa'
$md += ''
$md += '### surfaceEvidence'
foreach($s in $surfaceEvidence){ $md += "- $($s.scenarioId) [$($s.criterionReference)] $($s.verdict) - surface: $($s.surface); invocation: $($s.exactInvocation); artifacts: $($s.artifactRefs -join ', ')" }
$md += ''
$md += '### adversarialCases'
foreach($a in $adversarialCases){ $md += "- $($a.scenarioId) [$($a.criterionReference)] $($a.verdict) - class: $($a.adversarialClass); expected: $($a.expectedBehavior); artifacts: $($a.artifactRefs -join ', ')" }
$md += ''
$md += '### artifactRefs'
foreach($ar in $artifacts){ $md += "- $($ar.id) ($($ar.kind), $($ar.length) bytes): $($ar.description) - $($ar.path)" }
$md += ''
$md += ('Raw result: `' + $outJson + '`')
$md | Set-Content -LiteralPath $outMd -Encoding UTF8

Write-Output ($raw | ConvertTo-Json -Depth 12)
