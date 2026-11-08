param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 55432
)

$ErrorActionPreference = 'Stop'
$workspacePath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$expectedDataPath = Join-Path $workspacePath '.tmp\phase2-postgres'
$psqlCommand = (Get-Command psql -ErrorAction Stop).Source

function Invoke-SchemaSql {
  param(
    [string]$Database,
    [string]$File,
    [string]$Query
  )

  $sqlArguments = @(
    '-X', '-w', '-h', '127.0.0.1', '-p', "$Port", '-U', 'postgres',
    '-d', $Database, '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
    '-c', 'set client_min_messages = warning;'
  )
  if ($File) { $sqlArguments += @('-f', $File) }
  else { $sqlArguments += @('-c', $Query) }

  $sqlOutput = & $psqlCommand @sqlArguments
  if ($LASTEXITCODE -ne 0) { throw "SQL check failed in $Database." }
  return ($sqlOutput -join "`n").Trim()
}

# Refuse to create fixtures on an arbitrary local server, even on the same port.
# No connection string, remote hostname, or hosted credential is accepted.
$serverDataPath = Invoke-SchemaSql -Database 'postgres' -Query 'show data_directory;'
$resolvedServerDataPath = [System.IO.Path]::GetFullPath($serverDataPath.Replace('/', '\'))
if ($resolvedServerDataPath.TrimEnd('\') -ine $expectedDataPath.TrimEnd('\')) {
  throw "Refusing schema tests: expected the dedicated cluster at $expectedDataPath."
}

$schemaPath = Join-Path $workspacePath 'supabase\schema.sql'
$baselinePath = Join-Path $PSScriptRoot 'fixtures\baseline.sql'
$bootstrapPath = Join-Path $PSScriptRoot 'fixtures\bootstrap.sql'
$existingDataPath = Join-Path $PSScriptRoot 'fixtures\existing-tasks.sql'
$migrationFiles = @(Get-ChildItem -LiteralPath (Join-Path $workspacePath 'supabase\migrations') -Filter '*_add_workspace_enhancements.sql')
if ($migrationFiles.Count -ne 1) { throw 'Expected exactly one workspace-enhancement migration.' }

$marker = '-- Phase 2: additive workspace data model.'
$schemaText = Get-Content -Raw -Encoding UTF8 -LiteralPath $schemaPath
$migrationText = Get-Content -Raw -Encoding UTF8 -LiteralPath $migrationFiles[0].FullName
$schemaMarker = $schemaText.IndexOf($marker)
$migrationMarker = $migrationText.IndexOf($marker)
if ($schemaMarker -lt 0 -or $migrationMarker -lt 0) { throw 'Missing enhancement SQL marker.' }
if ($schemaText.Substring($schemaMarker).Trim() -cne $migrationText.Substring($migrationMarker).Trim()) {
  throw 'Clean-install and upgrade enhancement SQL differ.'
}

$testRunId = [guid]::NewGuid().ToString('N')
$createdDatabases = @()
$fingerprints = @{}

try {
  foreach ($variant in @('fresh', 'upgrade')) {
    $testDatabase = "northstar_phase2_${testRunId}_${variant}"
    if ($testDatabase -notmatch '^northstar_phase2_[0-9a-f]{32}_(fresh|upgrade)$') {
      throw 'Unexpected test database name.'
    }

    $null = Invoke-SchemaSql -Database 'postgres' -Query "create database $testDatabase;"
    $createdDatabases += $testDatabase
    $null = Invoke-SchemaSql -Database $testDatabase -File $bootstrapPath

    if ($variant -eq 'fresh') {
      $null = Invoke-SchemaSql -Database $testDatabase -File $schemaPath
      $null = Invoke-SchemaSql -Database $testDatabase -File $existingDataPath
      $null = Invoke-SchemaSql -Database $testDatabase -File $schemaPath
    }
    else {
      $null = Invoke-SchemaSql -Database $testDatabase -File $baselinePath
      $null = Invoke-SchemaSql -Database $testDatabase -File $existingDataPath
      $null = Invoke-SchemaSql -Database $testDatabase -File $migrationFiles[0].FullName
      $null = Invoke-SchemaSql -Database $testDatabase -File $migrationFiles[0].FullName
    }

    $fingerprints[$variant] = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'schema-fingerprint.sql')
    $checkOutput = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'schema.sql')
    $summary = ($checkOutput -split "`n" | Where-Object { $_ -match '^\d+ schema checks passed$' })
    if (-not $summary) { throw "No successful test summary for $variant." }
    Write-Output "${variant}: $summary; repeat application preserved existing tasks."
  }

  if ($fingerprints['fresh'] -cne $fingerprints['upgrade']) {
    throw 'Fresh-install and upgrade catalogs do not match.'
  }
  Write-Output 'Fresh-install and upgrade tables, columns, constraints, indexes, grants, RLS, functions, and triggers match.'
}
finally {
  foreach ($testDatabase in $createdDatabases) {
    if ($testDatabase -match '^northstar_phase2_[0-9a-f]{32}_(fresh|upgrade)$') {
      $null = Invoke-SchemaSql -Database 'postgres' -Query "drop database if exists $testDatabase;"
    }
  }
}
