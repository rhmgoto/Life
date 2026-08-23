param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$siteRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\docs'))
$port = 8765
$url = "http://127.0.0.1:$port/"

if (-not (Test-Path -LiteralPath (Join-Path $siteRoot 'index.html'))) {
  Write-Host 'MyLog の公開ファイルが見つかりません。先に pnpm build:pages を実行してください。' -ForegroundColor Red
  Read-Host 'Enterキーで閉じる'
  exit 1
}

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.ico' = 'image/x-icon'
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
try {
  $listener.Start()
  Write-Host "MyLog を $url で起動しました。" -ForegroundColor Green
  Write-Host 'このウィンドウを閉じるとMyLogを終了します。'
  if (-not $NoBrowser) { Start-Process $url }

  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      while ($reader.ReadLine()) { }

      $parts = $requestLine -split ' '
      $method = $parts[0]
      $requestPath = if ($parts.Count -gt 1) { ($parts[1] -split '\?')[0] } else { '/' }
      $relativePath = [System.Uri]::UnescapeDataString($requestPath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = 'index.html' }
      $filePath = [System.IO.Path]::GetFullPath((Join-Path $siteRoot $relativePath.Replace('/', '\')))
      $isSafe = $filePath.StartsWith($siteRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)

      if ($method -ne 'GET') {
        $status = '405 Method Not Allowed'
        $body = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
        $contentType = 'text/plain; charset=utf-8'
      } elseif (-not $isSafe -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $status = '404 Not Found'
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $contentType = 'text/plain; charset=utf-8'
      } else {
        $status = '200 OK'
        $body = [System.IO.File]::ReadAllBytes($filePath)
        $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
        $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
      }

      $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      $stream.Flush()
    } finally {
      $client.Close()
    }
  }
} catch [System.Net.Sockets.SocketException] {
  Write-Host "MyLogを起動できませんでした。ポート $port が使用中の可能性があります。" -ForegroundColor Red
  Read-Host 'Enterキーで閉じる'
  exit 1
} finally {
  $listener.Stop()
}
