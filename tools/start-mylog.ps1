param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$siteRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\docs'))
$basePort = 8765

if (-not (Test-Path -LiteralPath (Join-Path $siteRoot 'index.html'))) {
  Write-Host 'MyLog files were not found. Run pnpm build:pages first.' -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
}

function Test-MyLogEndpoint([string]$Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -like '*<div id="root"></div>*'
  } catch {
    return $false
  }
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

$listener = $null
$port = $basePort
try {
  for ($candidatePort = $basePort; $candidatePort -le ($basePort + 20); $candidatePort++) {
    $candidateUrl = "http://127.0.0.1:$candidatePort/"
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidatePort)
      $listener.Start()
      $port = $candidatePort
      break
    } catch [System.Net.Sockets.SocketException] {
      if ($listener) {
        $listener.Stop()
        $listener = $null
      }
      if (Test-MyLogEndpoint $candidateUrl) {
        Write-Host "MyLog is already running at $candidateUrl" -ForegroundColor Green
        if (-not $NoBrowser) { Start-Process $candidateUrl }
        exit 0
      }
    }
  }

  if (-not $listener) {
    throw "Ports $basePort-$($basePort + 20) are already in use."
  }

  $url = "http://127.0.0.1:$port/"
  Write-Host "MyLog is running at $url" -ForegroundColor Green
  Write-Host 'Keep this window open while using MyLog.'
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
  Write-Host "MyLog could not start. Port $port may already be in use." -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
} catch {
  Write-Host "MyLog could not start: $($_.Exception.Message)" -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
} finally {
  if ($listener) { $listener.Stop() }
}
