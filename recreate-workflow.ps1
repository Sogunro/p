# n8n Workflow Deployment Script
# Set N8N_API_KEY environment variable before running:
#   $env:N8N_API_KEY = "your-api-key"

$apiKey = $env:N8N_API_KEY
if (-not $apiKey) {
    Write-Host "ERROR: N8N_API_KEY environment variable not set" -ForegroundColor Red
    Write-Host "Run: `$env:N8N_API_KEY = 'your-api-key'" -ForegroundColor Yellow
    exit 1
}

$baseUrl = "https://toluwase94.app.n8n.cloud/api/v1"
$workflowId = "jxaVJOByDXGbe8Kv"

$headers = @{
    "X-N8N-API-KEY" = $apiKey
    "Content-Type" = "application/json"
}

Write-Host "=== Deleting current workflow ===" -ForegroundColor Yellow

try {
    $deleteResponse = Invoke-RestMethod -Uri "$baseUrl/workflows/$workflowId" -Headers $headers -Method Delete
    Write-Host "Workflow deleted!" -ForegroundColor Green
} catch {
    Write-Host "Delete error: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Creating updated workflow ===" -ForegroundColor Yellow

$workflowJson = Get-Content -Path "c:\Users\sogun\product-discovery-tool\n8n-workflow-minimal.json" -Raw

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/workflows" -Headers $headers -Method Post -Body $workflowJson
    Write-Host "Workflow created!" -ForegroundColor Green
    Write-Host "Workflow ID: $($response.id)"

    $newWorkflowId = $response.id

    Write-Host ""
    Write-Host "=== Activating workflow ===" -ForegroundColor Yellow

    try {
        $activateResponse = Invoke-RestMethod -Uri "$baseUrl/workflows/$newWorkflowId/activate" -Headers $headers -Method Post
        Write-Host "Workflow activated!" -ForegroundColor Green
        Write-Host ""
        Write-Host "=== SUCCESS ===" -ForegroundColor Green
        Write-Host "New Workflow ID: $newWorkflowId"
        Write-Host "Webhook URL: https://toluwase94.app.n8n.cloud/webhook/evidence-fetch"
    } catch {
        Write-Host "Activation error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Manual activation required at: https://toluwase94.app.n8n.cloud"
    }

} catch {
    Write-Host "Create error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
}
