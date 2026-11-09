param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 55432
)
$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$expectedDataPath = Join-Path $workspacePath '.tmp\phase2-postgres'
$psqlCommand = (Get-Command psql -ErrorAction Stop).Source

function Invoke-SchemaSql {
  param([string]$Database, [string]$File, [string]$Query)
  $sqlArguments = @('-X','-w','-h','127.0.0.1','-p',"$Port",'-U','postgres',
    '-d',$Database,'-v','ON_ERROR_STOP=1','-q','-A','-t','-c','set client_min_messages = warning;')
  if ($File) { $sqlArguments += @('-f',$File) } else { $sqlArguments += @('-c',$Query) }
  $sqlOutput = & $psqlCommand @sqlArguments
  if ($LASTEXITCODE -ne 0) { throw "SQL check failed in $Database." }
  return ($sqlOutput -join [Environment]::NewLine).Trim()
}

# Refuse to create fixtures on any server except this dedicated local cluster.
$serverDataPath = Invoke-SchemaSql -Database 'postgres' -Query 'show data_directory;'
$resolvedDataPath = [IO.Path]::GetFullPath($serverDataPath.Replace('/','\'))
if ($resolvedDataPath.TrimEnd('\') -ine $expectedDataPath.TrimEnd('\')) {
  throw "Refusing tests outside the dedicated cluster at $expectedDataPath."
}
$schemaPath = Join-Path $workspacePath 'supabase\schema.sql'
$realtimeMigration = Join-Path $workspacePath 'supabase\migrations\20261109141005_add_private_workspace_realtime.sql'
$securityMigration = Join-Path $workspacePath 'supabase\migrations\20261109075450_secure_shared_group_operations.sql'
$conflictMigration = Join-Path $workspacePath 'supabase\migrations\20261109151951_return_revision_conflicts_as_http_409.sql'
$groupMigration = @(Get-ChildItem -LiteralPath (Join-Path $workspacePath 'supabase\migrations') -Filter '*_add_shared_group_foundation.sql')
if ($groupMigration.Count -ne 1) { throw 'Expected one group-foundation migration.' }
$marker = '-- Phase 12: clean shared-group foundation.'
$schemaText = (Get-Content -Raw -Encoding UTF8 -LiteralPath $schemaPath).Replace([string][char]13,'')
$migrationText = (Get-Content -Raw -Encoding UTF8 -LiteralPath $groupMigration[0].FullName).Replace([string][char]13,'')
$position = $migrationText.IndexOf($marker)
if ($position -lt 0) { throw 'Missing group foundation marker.' }
$securityMarker = '-- Phase 13: secure shared-group operations.'
$securityText = (Get-Content -Raw -Encoding UTF8 -LiteralPath $securityMigration).Replace([string][char]13,'')
$schemaFoundationStart = $schemaText.IndexOf($marker)
$schemaSecurityStart = $schemaText.IndexOf($securityMarker)
if ($schemaFoundationStart -lt 0 -or $schemaSecurityStart -lt 0) { throw 'Missing schema checkpoint markers.' }
$foundationBody = $migrationText.Substring($position).Trim()
$foundationBody = $foundationBody.Substring(0,$foundationBody.Length-7).Trim()
if ($schemaText.Substring($schemaFoundationStart,$schemaSecurityStart-$schemaFoundationStart).Trim() -cne $foundationBody) {
  throw 'Fresh and reset foundation SQL differ.'
}
if ($schemaText.Substring($schemaSecurityStart,$schemaText.IndexOf('-- Phase 17:')-$schemaSecurityStart).Trim() -cne $securityText.Substring($securityText.IndexOf($securityMarker),$securityText.IndexOf("notify pgrst")-$securityText.IndexOf($securityMarker)).Trim()) {
  throw 'Fresh and upgrade security SQL differ.'
}

$testRunId = [guid]::NewGuid().ToString('N')
$createdDatabases = @()
$fingerprints = @{}
try {
  foreach ($variant in @('fresh','reset')) {
    $testDatabase = 'northstar_groups_' + $testRunId + '_' + $variant
    if ($testDatabase -notmatch '^northstar_groups_[0-9a-f]{32}_(fresh|reset)$') { throw 'Unexpected database name.' }
    $null = Invoke-SchemaSql -Database 'postgres' -Query "create database $testDatabase;"
    $createdDatabases += $testDatabase
    $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'fixtures\bootstrap.sql')
    $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'fixtures\realtime.sql')
    # Exercise installations whose default table grants would otherwise expose data.
    $null = Invoke-SchemaSql -Database $testDatabase -Query 'alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;'
    if ($variant -eq 'fresh') {
      $null = Invoke-SchemaSql -Database $testDatabase -File $schemaPath
    } else {
      $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'fixtures\baseline.sql')
      $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'groups\legacy-schema.sql')
      $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'fixtures\existing-tasks.sql')
      $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'groups\legacy-data.sql')
      $null = Invoke-SchemaSql -Database $testDatabase -File $groupMigration[0].FullName
      $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $workspacePath 'supabase\verify-phase12.sql')
      $foundationChecks = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'groups\schema.sql')
      Write-Output (($foundationChecks -split '\r?\n' | Where-Object { $_ -match '^\d+ group foundation checks passed$' }) + ' before Phase 13.')
      $null = Invoke-SchemaSql -Database $testDatabase -File $securityMigration
      $null = Invoke-SchemaSql -Database $testDatabase -File $securityMigration
      $null = Invoke-SchemaSql -Database $testDatabase -File $realtimeMigration
      $null = Invoke-SchemaSql -Database $testDatabase -File $realtimeMigration
      $null = Invoke-SchemaSql -Database $testDatabase -File $conflictMigration
      $null = Invoke-SchemaSql -Database $testDatabase -File $conflictMigration
    }
    $fingerprints[$variant] = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'schema-fingerprint.sql')
    $checks = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'groups\access.sql')
    $summary = ($checks -split '\r?\n' | Where-Object { $_ -match '^\d+ group access and mutation checks passed$' })
    if (-not $summary) { throw "No successful check summary for $variant." }
    Write-Output ($variant + ': ' + $summary + '.')
    $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $workspacePath 'supabase\verify-phase13.sql')
    $realtimeChecks = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'groups\realtime.sql')
    Write-Output ($variant + ': ' + (($realtimeChecks -split '\r?\n' | Where-Object { $_ -match '^\d+ realtime security and transaction checks passed$' }) -join '') + '.')
    $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $workspacePath 'supabase\verify-phase17.sql')
    $conflictChecks = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'groups\conflicts.sql')
    Write-Output ($variant + ': ' + (($conflictChecks -split '\r?\n' | Where-Object { $_ -match '^\d+ revision conflict checks passed$' }) -join '') + '.')
    $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $workspacePath 'supabase\verify-phase18.sql')
    if ($variant -eq 'reset') {
      & python (Join-Path $PSScriptRoot 'groups\concurrency.py') $psqlCommand "$Port" $testDatabase
      if ($LASTEXITCODE -ne 0) { throw 'Two-connection concurrency checks failed.' }
      # A full reset after shared operations must also retire their APIs/quotas,
      # rebuild the model, and leave exactly the clean installation's catalog.
      $null = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $workspacePath 'supabase\reset.sql')
      $resetFingerprint = Invoke-SchemaSql -Database $testDatabase -File (Join-Path $PSScriptRoot 'schema-fingerprint.sql')
      if ($resetFingerprint -cne $fingerprints[$variant]) { throw 'A repeat full reset left obsolete catalog objects.' }
      Write-Output 'Complete reset also passes after shared operations; no obsolete API/quotas survive.'
    }
  }
  if ($fingerprints['fresh'] -cne $fingerprints['reset']) { throw 'Fresh and reset catalogs do not match.' }
  Write-Output 'Fresh and populated-reset catalogs match: tables, constraints, indexes, grants, RLS, functions, and triggers.'
} finally {
  foreach ($testDatabase in $createdDatabases) {
    if ($testDatabase -match '^northstar_groups_[0-9a-f]{32}_(fresh|reset)$') {
      $null = Invoke-SchemaSql -Database 'postgres' -Query "drop database if exists $testDatabase;"
    }
  }
}
