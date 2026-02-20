param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$MavenArgs
)

$ErrorActionPreference = 'Stop'
$RepoRoot = $PSScriptRoot
Set-Location -Path $RepoRoot

function Assert-Command([string]$Name, [string]$Message) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw $Message
    }
}

function Assert-PathExists([string]$Path, [string]$Message) {
    if (-not (Test-Path -Path $Path)) {
        throw $Message
    }
}

Assert-Command -Name 'java' -Message 'Java is not installed or not on PATH.'
Assert-Command -Name 'mvn' -Message 'Maven (mvn) is not installed or not on PATH.'

Assert-PathExists -Path 'api-server\pom.xml' -Message 'Cannot find api-server\pom.xml. Run this script from the HedgeLab repository root.'
Assert-PathExists -Path 'api-server\src\main\java\com\hedgelab\api\ApiServerApplication.java' -Message 'Expected api-server implementation files are missing (ApiServerApplication.java).'
Assert-PathExists -Path 'api-server\src\main\resources\static\index.html' -Message 'Expected dashboard file is missing (api-server\src\main\resources\static\index.html).'

Write-Host "Starting HedgeLab API server on http://localhost:8080 ..."
Write-Host "After startup, test these URLs in a second terminal:"
Write-Host "  - http://localhost:8080/api/pricing/health"
Write-Host "  - http://localhost:8080/api/masterdata/health"
Write-Host "  - http://localhost:8080/api/position/health"
Write-Host "  - http://localhost:8080/api/workflow/health"
Write-Host "Then open http://localhost:8080/ in a browser."

$mvnCommand = @(
    '-f', 'api-server/pom.xml',
    'org.springframework.boot:spring-boot-maven-plugin:3.3.5:run'
) + $MavenArgs

& mvn @mvnCommand
