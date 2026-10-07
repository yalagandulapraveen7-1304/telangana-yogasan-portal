Add-Type -AssemblyName System.Drawing

$root = "C:\Users\ammul\.gemini\antigravity\scratch\yogasana-portal"
$galleryDir = Join-Path $root "static\images\gallery"
$thumbsDir = Join-Path $galleryDir "thumbs"
$webDir = Join-Path $galleryDir "web"

if (!(Test-Path $thumbsDir)) {
    New-Item -ItemType Directory -Path $thumbsDir -Force | Out-Null
}
if (!(Test-Path $webDir)) {
    New-Item -ItemType Directory -Path $webDir -Force | Out-Null
}

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

$encParamsWeb = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParamsWeb.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)

$encParamsThumb = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParamsThumb.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]78)

$files = Get-ChildItem -Path $galleryDir -File | Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' }
Write-Output "Found $($files.Count) gallery images to optimize..."

$processed = 0
foreach ($file in $files) {
    # Skip any file with (1) duplicate if base already exists or clean up name
    $cleanName = $file.Name -replace '\s+\(1\)', ''
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($cleanName)
    
    $webOut = Join-Path $webDir ($baseName + ".jpg")
    $thumbOut = Join-Path $thumbsDir ($baseName + ".jpg")
    
    # Don't recreate if already exists and newer
    if ((Test-Path $webOut) -and (Test-Path $thumbOut)) {
        continue
    }

    try {
        $img = [System.Drawing.Image]::FromFile($file.FullName)

        # 1. Web version (max 1400px on long edge)
        $maxWeb = 1400.0
        $scaleWeb = [Math]::Min(1.0, $maxWeb / [Math]::Max($img.Width, $img.Height))
        $wWeb = [Math]::Max(1, [int]($img.Width * $scaleWeb))
        $hWeb = [Math]::Max(1, [int]($img.Height * $scaleWeb))

        $bmpWeb = New-Object System.Drawing.Bitmap($wWeb, $hWeb)
        $gWeb = [System.Drawing.Graphics]::FromImage($bmpWeb)
        $gWeb.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gWeb.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $gWeb.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $gWeb.DrawImage($img, 0, 0, $wWeb, $hWeb)
        $bmpWeb.Save($webOut, $codec, $encParamsWeb)
        $gWeb.Dispose()
        $bmpWeb.Dispose()

        # 2. Thumbnail version (max 600px on long edge)
        $maxThumb = 600.0
        $scaleThumb = [Math]::Min(1.0, $maxThumb / [Math]::Max($img.Width, $img.Height))
        $wThumb = [Math]::Max(1, [int]($img.Width * $scaleThumb))
        $hThumb = [Math]::Max(1, [int]($img.Height * $scaleThumb))

        $bmpThumb = New-Object System.Drawing.Bitmap($wThumb, $hThumb)
        $gThumb = [System.Drawing.Graphics]::FromImage($bmpThumb)
        $gThumb.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gThumb.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $gThumb.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $gThumb.DrawImage($img, 0, 0, $wThumb, $hThumb)
        $bmpThumb.Save($thumbOut, $codec, $encParamsThumb)
        $gThumb.Dispose()
        $bmpThumb.Dispose()

        $img.Dispose()
        $processed++
        Write-Output "Optimized: $($file.Name) -> $baseName.jpg"
    }
    catch {
        Write-Warning "Failed on $($file.Name): $($_.Exception.Message)"
    }
}

Write-Output "Optimization completed! Processed $processed images."
