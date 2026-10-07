param([Parameter(Mandatory=$true)][string]$Emcc)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$buildTemp = Join-Path $root '.rodent-build'
New-Item -ItemType Directory -Force -Path $buildTemp | Out-Null
$env:EMCC_TEMP_DIR = $buildTemp
$env:TEMP = $buildTemp
$env:TMP = $buildTemp
$sources = @(Get-ChildItem -LiteralPath (Join-Path $root 'vendor/rodent') -Filter '*.cpp' | ForEach-Object { $_.FullName })
$output = Join-Path $root 'public/rodent/rodent.js'
New-Item -ItemType Directory -Force -Path (Split-Path $output -Parent) | Out-Null
& $Emcc @sources '-std=c++14' '-O2' '-DNDEBUG' '-DNO_THREADS' '-DANDROID' '-Dmain=rodent_native_main' '--no-entry' '-sMODULARIZE=1' '-sEXPORT_NAME=RodentModule' '-sENVIRONMENT=web,worker,node' '-sALLOW_MEMORY_GROWTH=1' '-sINITIAL_MEMORY=33554432' '-sSTACK_SIZE=5242880' '-sMAXIMUM_MEMORY=134217728' '-sEXPORTED_FUNCTIONS=["_rodent_init","_rodent_command"]' '-sEXPORTED_RUNTIME_METHODS=["ccall"]' '-o' $output
if ($LASTEXITCODE -ne 0) { throw 'Rodent compilation failed' }
Copy-Item -LiteralPath (Join-Path $root 'vendor/rodent/LICENSE') -Destination (Join-Path $root 'public/rodent/LICENSE')
