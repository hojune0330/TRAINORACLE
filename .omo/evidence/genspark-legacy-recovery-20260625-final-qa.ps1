$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$package = Join-Path $repo ".omo\evidence\genspark-legacy-recovery-20260625"
$archive = "D:\admin\Downloads\trainoracle_genspark_legacy_recovery_20260625"
$reportPath = Join-Path $repo ".omo\evidence\genspark-legacy-recovery-20260625-qa-review.md"
$rawPath = Join-Path $repo ".omo\evidence\genspark-legacy-recovery-20260625-qa-review-raw.json"

function Add-Artifact {
    param([string]$Id, [string]$Kind, [string]$Description, [string]$Path)
    [ordered]@{ id = $Id; kind = $Kind; description = $Description; path = $Path }
}

function New-Surface {
    param([string]$ScenarioId, [string]$Criterion, [string]$Surface, [string]$Invocation, [bool]$Pass, [string[]]$ArtifactRefs, [string]$Details)
    [ordered]@{
        scenarioId = $ScenarioId
        criterionReference = $Criterion
        surface = $Surface
        exactInvocation = $Invocation
        verdict = $(if ($Pass) { "PASS" } else { "FAIL" })
        artifactRefs = $ArtifactRefs
        details = $Details
    }
}

function New-Adversarial {
    param([string]$ScenarioId, [string]$Criterion, [string]$Class, [string]$Expected, [bool]$Pass, [string[]]$ArtifactRefs, [string]$Details)
    [ordered]@{
        scenarioId = $ScenarioId
        criterionReference = $Criterion
        adversarialClass = $Class
        expectedBehavior = $Expected
        verdict = $(if ($Pass) { "PASS" } else { "FAIL" })
        artifactRefs = $ArtifactRefs
        details = $Details
    }
}

function Get-PngInfo {
    param([string]$Path)
    $bytes = [IO.File]::ReadAllBytes($Path)
    $sigOk = $bytes.Length -ge 24 -and ($bytes[0..7] -join ",") -eq "137,80,78,71,13,10,26,10"
    $w = [System.Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($bytes,16))
    $h = [System.Net.IPAddress]::NetworkToHostOrder([BitConverter]::ToInt32($bytes,20))
    Add-Type -AssemblyName System.Drawing
    $decodeOk = $false
    $decodedWidth = $null
    $decodedHeight = $null
    $decodeError = $null
    try {
        $img = [System.Drawing.Image]::FromFile($Path)
        $decodeOk = $true
        $decodedWidth = $img.Width
        $decodedHeight = $img.Height
        $img.Dispose()
    } catch {
        $decodeError = $_.Exception.Message
    }
    [ordered]@{
        path = $Path
        exists = Test-Path -LiteralPath $Path -PathType Leaf
        length = $bytes.Length
        signatureOk = $sigOk
        ihdrWidth = $w
        ihdrHeight = $h
        decodeOk = $decodeOk
        decodedWidth = $decodedWidth
        decodedHeight = $decodedHeight
        decodeError = $decodeError
        dimensionsGt1x1 = ($decodeOk -and $decodedWidth -gt 1 -and $decodedHeight -gt 1)
    }
}

$artifactRefs = New-Object System.Collections.Generic.List[object]
$surfaceEvidence = New-Object System.Collections.Generic.List[object]
$adversarialCases = New-Object System.Collections.Generic.List[object]

$artifactRefs.Add((Add-Artifact "raw-json" "json" "Machine-readable QA review result." $rawPath))
$artifactRefs.Add((Add-Artifact "qa-report" "markdown" "Human-readable QA review report." $reportPath))
$artifactRefs.Add((Add-Artifact "package-dir" "directory" "Scanned evidence package directory." $package))
$artifactRefs.Add((Add-Artifact "local-archive" "directory" "Scanned local raw archive directory." $archive))

$required = @(
    "01-body-text.txt",
    "01-compaction-notices.json",
    "01-browser-screenshot.png",
    "02-agent-response.png",
    "01-redacted-dom-snapshot.txt",
    "01-link-manifest.json",
    "02-recovered-material-index.json",
    "03-recovery-report.md",
    "03-adversarial-compaction-expiry.md"
)

$packageExists = Test-Path -LiteralPath $package -PathType Container
$requiredResults = @()
foreach ($name in $required) {
    $p = Join-Path $package $name
    $item = if (Test-Path -LiteralPath $p -PathType Leaf) { Get-Item -LiteralPath $p } else { $null }
    $requiredResults += [ordered]@{
        name = $name
        exists = $null -ne $item
        length = if ($item) { [int64]$item.Length } else { 0 }
        nonEmpty = ($null -ne $item -and $item.Length -gt 0)
    }
}
$requiredPass = $packageExists -and (($requiredResults | Where-Object { -not $_.nonEmpty }).Count -eq 0)
$surfaceEvidence.Add((New-Surface "S01" "required package artifacts are present/non-empty" "filesystem" "Get-ChildItem -Force -Recurse .omo\evidence\genspark-legacy-recovery-20260625" $requiredPass @("package-dir","raw-json") "Required artifact count: $($required.Count); missing/empty count: $(($requiredResults | Where-Object { -not $_.nonEmpty }).Count)."))

$archiveExists = Test-Path -LiteralPath $archive -PathType Container
$archiveFiles = if ($archiveExists) { @(Get-ChildItem -LiteralPath $archive -Force -File -Recurse) } else { @() }
$archivePass = $archiveExists -and $archiveFiles.Count -gt 0 -and (@($archiveFiles | Where-Object { $_.Length -le 0 }).Count -eq 0)
$surfaceEvidence.Add((New-Surface "S02" "local archive present" "filesystem" "Get-ChildItem -Force -Recurse 'D:\admin\Downloads\trainoracle_genspark_legacy_recovery_20260625'" $archivePass @("local-archive","raw-json") "Archive files: $($archiveFiles.Count); empty files: $(@($archiveFiles | Where-Object { $_.Length -le 0 }).Count)."))

$bodyPath = Join-Path $package "01-body-text.txt"
$bodyLength = if (Test-Path -LiteralPath $bodyPath -PathType Leaf) { (Get-Item -LiteralPath $bodyPath).Length } else { 0 }
$surfaceEvidence.Add((New-Surface "S03" "01-body-text.txt is greater than 400000 bytes" "filesystem" "(Get-Item .omo\evidence\genspark-legacy-recovery-20260625\01-body-text.txt).Length" ($bodyLength -gt 400000) @("package-dir","raw-json") "Observed byte length: $bodyLength."))

$pngPaths = @(
    (Join-Path $package "01-browser-screenshot.png"),
    (Join-Path $package "02-agent-response.png")
)
$pngInfos = @($pngPaths | ForEach-Object { Get-PngInfo $_ })
$pngPass = (($pngInfos | Where-Object { -not ($_.exists -and $_.length -gt 0 -and $_.signatureOk -and $_.decodeOk -and $_.dimensionsGt1x1) }).Count -eq 0)
$surfaceEvidence.Add((New-Surface "S04" "browser and agent-response PNG artifacts decode and have meaningful dimensions" "filesystem + System.Drawing decoder" "ReadAllBytes + System.Drawing.Image::FromFile for 01-browser-screenshot.png and 02-agent-response.png" $pngPass @("package-dir","raw-json") "Observed PNG dimensions: $($pngInfos[0].decodedWidth)x$($pngInfos[0].decodedHeight), $($pngInfos[1].decodedWidth)x$($pngInfos[1].decodedHeight)."))

$manifestPath = Join-Path $package "01-link-manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$rootFields = @("totalLinks","activeLinks","expiredLinks","downloadableLinks","credentialQueryRemovedLinks")
$manifestRootFieldsPresent = (@($rootFields | Where-Object { -not ($manifest.PSObject.Properties.Name -contains $_) }).Count -eq 0)
$linksCount = @($manifest.links).Count
$derivedCredentialRemoved = @($manifest.links | Where-Object { [string]$_.hrefRedacted -match "credential-query-removed" }).Count
$manifestPass = $manifestRootFieldsPresent -and ([int]$manifest.totalLinks -eq $linksCount) -and ([int]$manifest.credentialQueryRemovedLinks -eq $derivedCredentialRemoved)
$surfaceEvidence.Add((New-Surface "S05" "01-link-manifest.json root counts and derived credential marker count" "JSON parse" "Get-Content -Raw .omo\evidence\genspark-legacy-recovery-20260625\01-link-manifest.json | ConvertFrom-Json" $manifestPass @("package-dir","raw-json") "totalLinks=$($manifest.totalLinks); links.length=$linksCount; credentialQueryRemovedLinks=$($manifest.credentialQueryRemovedLinks); derivedMarkerCount=$derivedCredentialRemoved."))

$materialPath = Join-Path $package "02-recovered-material-index.json"
$material = Get-Content -LiteralPath $materialPath -Raw | ConvertFrom-Json
$materialFields = @("name","sourceLayer","classification","recoveryStatus","sensitivityAction","evidencePath")
$materialMissing = @()
$materialEvidencePathResults = @()
foreach ($entry in @($material.materials)) {
    foreach ($field in $materialFields) {
        if (-not ($entry.PSObject.Properties.Name -contains $field) -or [string]::IsNullOrWhiteSpace([string]$entry.$field)) {
            $materialMissing += "$($entry.name):$field"
        }
    }
    if ($entry.PSObject.Properties.Name -contains "evidencePath" -and -not [string]::IsNullOrWhiteSpace([string]$entry.evidencePath)) {
        $resolved = Join-Path $package ([string]$entry.evidencePath)
        $item = if (Test-Path -LiteralPath $resolved -PathType Leaf) { Get-Item -LiteralPath $resolved } else { $null }
        $materialEvidencePathResults += [ordered]@{
            name = [string]$entry.name
            evidencePath = [string]$entry.evidencePath
            resolvedPath = $resolved
            exists = $null -ne $item
            length = if ($item) { [int64]$item.Length } else { 0 }
            nonEmpty = ($null -ne $item -and $item.Length -gt 0)
        }
    }
}
$materialUnresolved = @($materialEvidencePathResults | Where-Object { -not $_.nonEmpty })
$materialPass = ($material.PSObject.Properties.Name -contains "materials") -and @($material.materials).Count -gt 0 -and $materialMissing.Count -eq 0 -and $materialUnresolved.Count -eq 0
$surfaceEvidence.Add((New-Surface "S06" "material index fields present and evidencePath values resolve to non-empty package artifacts" "JSON parse + filesystem" "ConvertFrom-Json 02-recovered-material-index.json; Test-Path each materials[].evidencePath" $materialPass @("package-dir","raw-json") "Material entries: $(@($material.materials).Count); missing field instances: $($materialMissing.Count); unresolved evidencePath count: $($materialUnresolved.Count)."))

$recoveryReportPath = Join-Path $package "03-recovery-report.md"
$recoveryText = Get-Content -LiteralPath $recoveryReportPath -Raw
$limitPhrases = @(
    "COUNT_DELTA",
    "compacted history is not treated as recovered",
    "expired/unavailable links are not treated as downloaded source files",
    "agent-generated reconstructions are reference only and cannot prove local file existence",
    "sensitive/session-boundary exclusions remain active for handoff artifacts"
)
$missingLimitPhrases = @($limitPhrases | Where-Object { $recoveryText -notlike "*$_*" })
$limitsPass = $missingLimitPhrases.Count -eq 0
$surfaceEvidence.Add((New-Surface "S07" "COUNT_DELTA and exact limit phrases are present in 03-recovery-report.md" "text file" "Select-String -Path .omo\evidence\genspark-legacy-recovery-20260625\03-recovery-report.md -Pattern <required literal phrases>" $limitsPass @("package-dir","raw-json") "Required phrases: $($limitPhrases.Count); missing phrases: $($missingLimitPhrases.Count)."))

$adversarialPath = Join-Path $package "03-adversarial-compaction-expiry.md"
$adversarialText = Get-Content -LiteralPath $adversarialPath -Raw
$labels = @(
    "Compaction check",
    "Expiry check",
    "Compacted notice check",
    "Expired link check",
    "Generated recollection check",
    "Sensitive boundary check"
)
$missingLabels = @($labels | Where-Object { $adversarialText -notlike "*$_*" })
$labelsPass = $missingLabels.Count -eq 0
$surfaceEvidence.Add((New-Surface "S08" "adversarial labels present" "text file" "Select-String -Path .omo\evidence\genspark-legacy-recovery-20260625\03-adversarial-compaction-expiry.md -Pattern <required labels>" $labelsPass @("package-dir","raw-json") "Required labels: $($labels.Count); missing labels: $($missingLabels.Count)."))

$textExtensions = @(".txt",".md",".json",".csv",".log",".html",".htm",".xml",".yaml",".yml")
$scanFiles = @()
if ($packageExists) {
    $scanFiles += Get-ChildItem -LiteralPath $package -File -Recurse -Force | Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() }
}
if ($archiveExists) {
    $scanFiles += Get-ChildItem -LiteralPath $archive -File -Recurse -Force | Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() }
}
$patterns = [ordered]@{
    privateKeyBlock = "-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"
    bearerToken = "(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{16,}"
    awsAccessKey = "\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"
    openAiKey = "\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"
    githubToken = "\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b"
    slackToken = "\bxox[baprs]-[A-Za-z0-9-]{20,}\b"
    googleApiKey = "\bAIza[0-9A-Za-z_-]{30,}\b"
    sensitiveAssignment = "(?i)\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token|client[_-]?secret|authorization)\b\s*[:=]\s*['""]?(?!redacted\b|removed\b|none\b|null\b|false\b|true\b)[^'""\s,;<>]{8,}"
    signedQuery = "(?i)[?&](?:X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|Signature|sig|token|access_token|secret|key|Expires|Policy)=((?!REDACTED|redacted|removed)[^&\s]{8,})"
    unsafeControl = "[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]"
}
$scanHits = @()
foreach ($file in $scanFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
    foreach ($key in $patterns.Keys) {
        $matches = [regex]::Matches($content, $patterns[$key])
        if ($matches.Count -gt 0) {
            $scanHits += [ordered]@{
                file = $file.FullName
                class = $key
                count = $matches.Count
            }
        }
    }
}
$scanPass = $scanHits.Count -eq 0
$adversarialCases.Add((New-Adversarial "A01" "broad sensitive/credential/control scan has zero exposed hits" "credential material exposure" "No exposed bearer/API/secret/private-key/signed-query values appear in package or local archive text files." $scanPass @("package-dir","local-archive","raw-json") "Scanned text files: $($scanFiles.Count); hit records: $($scanHits.Count); matched values intentionally omitted."))
$adversarialCases.Add((New-Adversarial "A02" "compacted history not over-claimed" "compaction boundary" "Report preserves the exact compacted-history limit phrase." ($recoveryText -like "*compacted history is not treated as recovered*") @("package-dir","raw-json") "Exact phrase check only."))
$adversarialCases.Add((New-Adversarial "A03" "expired links not over-claimed" "expiry boundary" "Report preserves the exact expired/unavailable-link limit phrase." ($recoveryText -like "*expired/unavailable links are not treated as downloaded source files*") @("package-dir","raw-json") "Exact phrase check only."))
$adversarialCases.Add((New-Adversarial "A04" "agent-generated reconstruction not canonical" "generated recollection boundary" "Report preserves the exact generated-reconstruction limit phrase." ($recoveryText -like "*agent-generated reconstructions are reference only and cannot prove local file existence*") @("package-dir","raw-json") "Exact phrase check only."))

$overallPass = (($surfaceEvidence | Where-Object { $_.verdict -ne "PASS" }).Count -eq 0) -and (($adversarialCases | Where-Object { $_.verdict -ne "PASS" }).Count -eq 0)

$raw = [ordered]@{
    verdict = $(if ($overallPass) { "PASS" } else { "FAIL" })
    generatedAt = (Get-Date).ToString("o")
    surface = "local filesystem"
    invocation = "powershell -NoProfile -ExecutionPolicy Bypass -File .omo\evidence\genspark-legacy-recovery-20260625-final-qa.ps1"
    scannedPackage = $package
    scannedArchive = $archive
    cleanupState = "no runtime resources spawned"
    checks = [ordered]@{
        requiredArtifacts = $requiredResults
        archive = [ordered]@{ exists = $archiveExists; fileCount = $archiveFiles.Count; emptyFileCount = @($archiveFiles | Where-Object { $_.Length -le 0 }).Count }
        bodyLength = $bodyLength
        pngArtifacts = $pngInfos
        manifest = [ordered]@{ rootFieldsPresent = $manifestRootFieldsPresent; totalLinks = [int]$manifest.totalLinks; linksLength = $linksCount; credentialQueryRemovedLinks = [int]$manifest.credentialQueryRemovedLinks; derivedCredentialMarkerCount = $derivedCredentialRemoved }
        materialIndex = [ordered]@{ materialCount = @($material.materials).Count; missingRequiredFields = $materialMissing; evidencePathResults = $materialEvidencePathResults; unresolvedEvidencePaths = $materialUnresolved }
        recoveryReport = [ordered]@{ missingRequiredPhrases = $missingLimitPhrases }
        adversarialLabels = [ordered]@{ missingLabels = $missingLabels }
        sensitiveScan = [ordered]@{ scannedTextFileCount = $scanFiles.Count; hitRecordCount = $scanHits.Count; hitRecordsWithoutValues = $scanHits }
    }
    manualQa = [ordered]@{
        surfaceEvidence = $surfaceEvidence
        adversarialCases = $adversarialCases
        artifactRefs = $artifactRefs
    }
}

$rawJson = $raw | ConvertTo-Json -Depth 10
Set-Content -LiteralPath $rawPath -Value $rawJson -Encoding UTF8

$surfaceRows = ($surfaceEvidence | ForEach-Object { "| $($_.scenarioId) | $($_.criterionReference) | $($_.surface) | $($_.exactInvocation -replace '\|','/') | $($_.verdict) | $([string]::Join(", ", $_.artifactRefs)) |" }) -join "`n"
$advRows = ($adversarialCases | ForEach-Object { "| $($_.scenarioId) | $($_.criterionReference) | $($_.adversarialClass) | $($_.expectedBehavior -replace '\|','/') | $($_.verdict) | $([string]::Join(", ", $_.artifactRefs)) |" }) -join "`n"
$artifactRows = ($artifactRefs | ForEach-Object { "| $($_.id) | $($_.kind) | $($_.description -replace '\|','/') | $($_.path -replace '\|','/') |" }) -join "`n"

$markdown = @"
# Genspark Legacy Recovery QA Review

Verdict: $($(if ($overallPass) { "PASS" } else { "FAIL" }))

Surface: local filesystem

Invocation: ``powershell -NoProfile -ExecutionPolicy Bypass -File .omo\evidence\genspark-legacy-recovery-20260625-final-qa.ps1``

Cleanup state: no runtime resources spawned.

## manualQa.surfaceEvidence
| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
$surfaceRows

## manualQa.adversarialCases
| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
$advRows

## manualQa.artifactRefs
| id | kind | description | path |
|---|---|---|---|
$artifactRows

## Notes
- Sensitive scan matched values are not printed.
- Manifest observed: totalLinks=$($manifest.totalLinks), links.length=$linksCount, credentialQueryRemovedLinks=$($manifest.credentialQueryRemovedLinks), derived marker count=$derivedCredentialRemoved.
- Body text observed byte length: $bodyLength.
"@

Set-Content -LiteralPath $reportPath -Value $markdown -Encoding UTF8

$raw.verdict
