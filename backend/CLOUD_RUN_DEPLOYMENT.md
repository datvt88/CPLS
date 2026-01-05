# Cloud Run Deployment Guide

## Prerequisites

1. Google Cloud Project with billing enabled
2. Cloud Run API enabled
3. Container Registry or Artifact Registry enabled
4. gcloud CLI installed and configured

## Step-by-Step Deployment

### 1. Set Project Variables

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=asia-southeast1
export SERVICE_NAME=cpls-crawler
```

### 2. Build and Push Docker Image

```bash
# Navigate to backend directory
cd backend

# Build the Docker image
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Alternative: Build locally and push
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME .
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME
```

### 3. Deploy to Cloud Run

```bash
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority" \
  --set-env-vars MONGODB_DATABASE="cpls_trading" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 5
```

### 4. Get Service URL

```bash
gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --format 'value(status.url)'
```

## Using Secret Manager (Recommended)

For better security, store MongoDB URI in Secret Manager:

### 1. Create Secret

```bash
# Create secret
echo -n "mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority" | \
  gcloud secrets create mongodb-uri --data-file=-

# Grant Cloud Run access to secret
gcloud secrets add-iam-policy-binding mongodb-uri \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 2. Deploy with Secret

```bash
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-secrets MONGODB_URI=mongodb-uri:latest \
  --set-env-vars MONGODB_DATABASE="cpls_trading" \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 5
```

## MongoDB Atlas Configuration

### 1. Network Access

In MongoDB Atlas Dashboard → Network Access:
- Add IP: `0.0.0.0/0` (Allow from anywhere)
- Or use Cloud Run's static outbound IP if available

### 2. Database User

Create a database user with read/write permissions:
- Username: your_username
- Password: strong_password
- Database: cpls_trading

### 3. Connection String

Get connection string from MongoDB Atlas:
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
```

## Testing the Deployment

### 1. Test Health Endpoint

```bash
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --format 'value(status.url)')

curl $SERVICE_URL/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "CPLS Market Data Crawler",
  "version": "1.0.0"
}
```

### 2. Trigger Crawler

```bash
curl -X POST $SERVICE_URL/api/crawler/start
```

Expected response:
```json
{
  "status": "success",
  "message": "Crawling started in background. This process may take several minutes.",
  "note": "Check the status endpoint to monitor progress"
}
```

### 3. Check Status

```bash
curl $SERVICE_URL/api/crawler/status
```

Expected response:
```json
{
  "status": "success",
  "data": {
    "total_stocks": 2000,
    "total_price_buckets": 15000,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Continuous Deployment with Cloud Build

Create `cloudbuild.yaml` in backend directory:

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/cpls-crawler', '.']
  
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/cpls-crawler']
  
  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'cpls-crawler'
      - '--image'
      - 'gcr.io/$PROJECT_ID/cpls-crawler'
      - '--region'
      - 'asia-southeast1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

images:
  - 'gcr.io/$PROJECT_ID/cpls-crawler'
```

Then trigger build:
```bash
gcloud builds submit --config cloudbuild.yaml
```

## Scheduling Crawler (Optional)

Use Cloud Scheduler to trigger crawler periodically:

```bash
# Create scheduler job (runs daily at 6 PM Vietnam time)
gcloud scheduler jobs create http crawler-daily \
  --location=$REGION \
  --schedule="0 18 * * *" \
  --time-zone="Asia/Ho_Chi_Minh" \
  --uri="$SERVICE_URL/api/crawler/start" \
  --http-method=POST \
  --oidc-service-account-email=PROJECT_NUMBER-compute@developer.gserviceaccount.com
```

## Monitoring and Logs

### View Logs

```bash
gcloud run services logs read $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --limit 50
```

### View Metrics

Go to Cloud Console → Cloud Run → Select Service → Metrics

Monitor:
- Request count
- Request latency
- Container instance count
- Container CPU utilization
- Container memory utilization

## Cost Optimization

### Free Tier Limits

Cloud Run free tier includes:
- 2 million requests per month
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds

### Recommendations

1. **Set max instances**: Limit to 5 to control costs
2. **Use min instances**: Set to 0 to avoid charges when idle
3. **Optimize memory**: 512Mi is sufficient for this service
4. **Timeout**: 300s allows crawler to complete
5. **Concurrency**: Default (80) is fine

### Estimate Costs

With default settings and 1 crawl per day:
- ~30 requests/month
- ~10 minutes compute time/month
- **Cost: ~$0** (within free tier)

## Troubleshooting

### Connection Timeout to MongoDB

**Problem**: Cloud Run can't connect to MongoDB Atlas

**Solution**:
1. Check MongoDB Atlas IP whitelist (use 0.0.0.0/0)
2. Verify MONGODB_URI is correct
3. Check secret permissions if using Secret Manager

### Crawler Times Out

**Problem**: Request timeout before crawler finishes

**Solution**:
- This is expected! Crawler runs in background
- API returns immediately with "Crawling started" message
- Crawler continues running in goroutine
- Check status endpoint to verify progress

### Out of Memory

**Problem**: Container exceeds memory limit

**Solution**:
1. Increase memory: `--memory 1Gi`
2. Reduce worker pool size in code
3. Optimize data processing

### API Rate Limiting

**Problem**: VNDirect blocks requests

**Solution**:
1. Increase `requestDelay` in crawler_service.go
2. Reduce `numWorkers` count
3. Add exponential backoff

## Security Best Practices

1. **Use Secret Manager** for sensitive credentials
2. **Enable VPC** for private MongoDB access (if needed)
3. **Set up IAM** to restrict access to API
4. **Enable Cloud Armor** for DDoS protection
5. **Rotate credentials** regularly
6. **Monitor logs** for suspicious activity

## Rollback

If deployment fails, rollback to previous version:

```bash
# List revisions
gcloud run revisions list --service=$SERVICE_NAME --region=$REGION

# Rollback to specific revision
gcloud run services update-traffic $SERVICE_NAME \
  --to-revisions=REVISION_NAME=100 \
  --region=$REGION
```

## Clean Up

Delete service and resources:

```bash
# Delete Cloud Run service
gcloud run services delete $SERVICE_NAME --region=$REGION

# Delete container image
gcloud container images delete gcr.io/$PROJECT_ID/$SERVICE_NAME

# Delete secret
gcloud secrets delete mongodb-uri

# Delete scheduler job (if created)
gcloud scheduler jobs delete crawler-daily --location=$REGION
```
