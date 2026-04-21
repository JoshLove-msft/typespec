#Requires -Version 7.0

<#
.SYNOPSIS
    Updates TypeSpec dependencies in package.json to the latest @next versions.

.DESCRIPTION
    Uses @azure-tools/typespec-bump-deps to update all TypeSpec-related dependencies
    in the specified package.json file(s) to their latest @next versions. This script
    only mutates the package manifest(s) — it does NOT run npm install.

    The caller (typically Initialize-Repository.ps1) is responsible for running
    npm install after this script completes.

.PARAMETER PackageJsonPaths
    One or more paths to package.json files to update. Paths are relative to the
    current working directory.

.EXAMPLE
    ./Update-TypeSpecNext.ps1 -PackageJsonPaths "package.json"

.EXAMPLE
    ./Update-TypeSpecNext.ps1 -PackageJsonPaths "package.json", "emitter/package.json"
#>

param(
    [Parameter(Mandatory = $true)]
    [string[]] $PackageJsonPaths
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

. "$PSScriptRoot/CommandInvocation-Helpers.ps1"

Write-Host "Updating TypeSpec dependencies to @next versions..."

# Build the argument list from the provided paths
$pathArgs = ($PackageJsonPaths | ForEach-Object { "`"$_`"" }) -join " "

Invoke-LoggedCommand "npx -y @azure-tools/typespec-bump-deps@latest --use-peer-ranges $pathArgs"

Write-Host "TypeSpec dependencies updated to @next versions."
