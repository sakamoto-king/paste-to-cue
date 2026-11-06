param([int]$Port = 5329, [string]$HostAddress = '127.0.0.1', [string]$Provider = 'cpu')
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$venv = Join-Path $root '.venv'
$pythonExe = Join-Path $venv 'Scripts/python.exe'
if (!(Test-Path -LiteralPath $pythonExe)) {
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        & uv venv $venv
    } else {
        & python -m venv $venv
    }
    if ($LASTEXITCODE -ne 0) { throw 'Could not create Python environment' }
}
if (Get-Command uv -ErrorAction SilentlyContinue) {
    & uv pip install --python $pythonExe -r (Join-Path $root 'requirements.txt')
} else {
    & $pythonExe -m pip install -r (Join-Path $root 'requirements.txt')
}
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
$model = 'sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20'
$modelDir = Join-Path $root "models/$model"
New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
$files = @('tokens.txt', 'bpe.vocab', 'bpe.model', 'encoder-epoch-99-avg-1.int8.onnx', 'decoder-epoch-99-avg-1.onnx', 'joiner-epoch-99-avg-1.int8.onnx')
foreach ($file in $files) {
    $target = Join-Path $modelDir $file
    if ((Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).Length -gt 0) { continue }
    $partial = "$target.download"
    $downloaded = $false
    foreach ($domain in @('huggingface.co', 'hf-mirror.com')) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri "https://$domain/csukuangfj/$model/resolve/main/$file" -OutFile $partial
            if ((Get-Item -LiteralPath $partial).Length -eq 0) { throw 'Empty download' }
            Move-Item -LiteralPath $partial -Destination $target
            $downloaded = $true
            break
        } catch { Write-Warning "Download failed from $domain for $file" }
    }
    if (!$downloaded) { throw "Could not download $file. Re-run this launcher to retry." }
}
& $pythonExe (Join-Path $root 'server.py') --host $HostAddress --port $Port --model-dir $modelDir --provider $Provider
exit $LASTEXITCODE
