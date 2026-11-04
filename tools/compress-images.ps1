Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path

$targets = @(
  @{ p = 'assets\img\columbina-photo.jpg'; w = 1100; q = 82 },
  @{ p = 'assets\img\taiga-photo.jpg';     w = 1000; q = 82 },
  @{ p = 'assets\img\feature-cover.jpg';   w = 1600; q = 80 },
  @{ p = 'assets\img\posts\feature-cover.jpg'; w = 1600; q = 80 },
  @{ p = 'assets\img\hero-night.jpg';      w = 1600; q = 80 },
  @{ p = 'assets\img\hero-room.jpg';       w = 1600; q = 80 }
)

$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

foreach ($t in $targets) {
  $path = Join-Path $root $t.p
  if (-not (Test-Path $path)) { Write-Output ("skip " + $t.p); continue }
  $before = (Get-Item $path).Length

  $img = [System.Drawing.Image]::FromFile($path)
  $scale = [Math]::Min(1.0, $t.w / $img.Width)
  $nw = [int][Math]::Max(1, [Math]::Round($img.Width * $scale))
  $nh = [int][Math]::Max(1, [Math]::Round($img.Height * $scale))

  $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, 0, 0, $nw, $nh)
  $g.Dispose()

  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$t.q)

  $tmp = $path + '.tmp.jpg'
  $bmp.Save($tmp, $jpeg, $ep)
  $bmp.Dispose()
  $img.Dispose()
  Move-Item -Force $tmp $path

  $after = (Get-Item $path).Length
  Write-Output ("{0}: {1:N0}KB -> {2:N0}KB  {3}x{4}" -f $t.p, ($before / 1KB), ($after / 1KB), $nw, $nh)
}
