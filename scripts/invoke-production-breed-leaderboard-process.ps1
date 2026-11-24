# Manually invokes exactly one bounded PROCESS request. It never publishes or retries.
$endpoint = "https://show-ring-game.vercel.app/api/jobs/process-breed-kennel-prestige-leaderboard"
$secureSecret = Read-Host -Prompt "SHOWRING_JOBS_SECRET or CRON_SECRET" -AsSecureString
$secretBstr = [IntPtr]::Zero
$plainTextSecret = $null
$headers = $null
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $secretBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
    $plainTextSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretBstr)
    $headers = @{ Authorization = "Bearer $plainTextSecret" }

    $response = Invoke-WebRequest -Uri $endpoint -Method Post -Headers $headers -ContentType "application/json" -Body '{"action":"process"}' -UseBasicParsing -ErrorAction Stop
    $stopwatch.Stop()

    Write-Host "HTTP status: $($response.StatusCode)"
    Write-Host "Response JSON:"
    try {
        $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 20
    } catch {
        $response.Content
    }
} catch {
    if ($stopwatch.IsRunning) { $stopwatch.Stop() }
    $httpResponse = $_.Exception.Response
    if ($null -ne $httpResponse) {
        Write-Host "HTTP status: $([int]$httpResponse.StatusCode)"
        $reader = New-Object System.IO.StreamReader($httpResponse.GetResponseStream())
        try {
            $responseBody = $reader.ReadToEnd()
            if ($responseBody) {
                Write-Host "Response body:"
                try {
                    $responseBody | ConvertFrom-Json | ConvertTo-Json -Depth 20
                } catch {
                    $responseBody
                }
            }
        } finally {
            $reader.Dispose()
        }
    } else {
        Write-Host "Request failed before an HTTP response was received."
    }
    exit 1
} finally {
    Write-Host "Total request duration: $($stopwatch.Elapsed.TotalMilliseconds.ToString('F0')) ms"
    if ($secretBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretBstr)
    }
    $plainTextSecret = $null
    $headers = $null
    $secureSecret = $null
}
