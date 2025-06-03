$basePath = "C:\Dev\pto-connect-backend\routes"

# Root-level file renames
$rootRenames = @(
    @{ old = "notifications.js";             new = "notification.js" },
    @{ old = "requireActiveSubscription.js"; new = "requireSubscription.js" },
    @{ old = "sharedLibrary.js";             new = "sharedTemplate.js" }
)

# Event file move + rename
$eventRename = @{
    from = "ai\generateEventIdeas.js"
    to   = "event\generateEventIdea.js"
}

# Rename root-level files
foreach ($rename in $rootRenames) {
    $oldPath = Join-Path $basePath $rename.old
    $newPath = Join-Path $basePath $rename.new

    if (Test-Path $oldPath) {
        Rename-Item -Path $oldPath -NewName $rename.new
        Write-Host "Renamed: $($rename.old) -> $($rename.new)"
    } else {
        Write-Warning "File not found: $($rename.old)"
    }
}

# Move + rename generateEventIdeas.js -> generateEventIdea.js
$srcPath = Join-Path $basePath $eventRename.from
$dstDir = Join-Path $basePath ([System.IO.Path]::GetDirectoryName($eventRename.to))
$dstPath = Join-Path $basePath $eventRename.to

if (Test-Path $srcPath) {
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Path $dstDir | Out-Null
        Write-Host "Created folder: $dstDir"
    }
    Move-Item -Path $srcPath -Destination $dstPath -Force
    Write-Host "Moved and renamed: $($eventRename.from) -> $($eventRename.to)"
} else {
    Write-Warning "File not found: $($eventRename.from)"
}
