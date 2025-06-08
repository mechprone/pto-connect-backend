# PTO Connect Backend - Railway Migration Guide

## Overview
This guide covers migrating the PTO Connect backend from Render to Railway while maintaining the api.ptoconnect.com domain and ensuring zero downtime.

## Pre-Migration Checklist

### 1. Environment Variables (Required)
Ensure you have all these environment variables from your current Render deployment:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Server Configuration
PORT=3000
NODE_ENV=production

# API URLs
CLIENT_URL=https://app.ptoconnect.com

# OpenAI
OPENAI_API_KEY=sk-your_openai_api_key_here

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

# Meta Graph API
META_ACCESS_TOKEN=your_meta_access_token_here
META_APP_ID=your_meta_app_id_here
META_APP_SECRET=your_meta_app_secret_here
```

### 2. Domain Configuration
- Current domain: `api.ptoconnect.com` (pointing to Render)
- Target: Same domain pointing to Railway
- DNS TTL: Check current TTL for faster propagation

## Migration Steps

### Step 1: Deploy to Railway

1. **Create Railway Project**
   ```bash
   # Install Railway CLI if not already installed
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Navigate to backend directory
   cd pto-connect-backend
   
   # Initialize Railway project
   railway init
   ```

2. **Configure Environment Variables**
   ```bash
   # Set all environment variables in Railway dashboard
   # Or use CLI (example):
   railway variables set SUPABASE_URL="your_url_here"
   railway variables set SUPABASE_SERVICE_ROLE_KEY="your_key_here"
   # ... repeat for all variables
   ```

3. **Deploy to Railway**
   ```bash
   # Deploy the backend
   railway up
   ```

### Step 2: Test Railway Deployment

1. **Get Railway URL**
   - Note the Railway-generated URL (e.g., `https://pto-connect-backend-production.up.railway.app`)

2. **Test API Endpoints**
   ```bash
   # Test health check
   curl https://your-railway-url.up.railway.app/
   
   # Test a protected endpoint
   curl https://your-railway-url.up.railway.app/api/auth/health
   ```

3. **Update Frontend Temporarily**
   - Temporarily update frontend API URL to test Railway backend
   - Verify all functionality works

### Step 3: Configure Custom Domain

1. **Add Custom Domain in Railway**
   - Go to Railway dashboard → Your project → Settings → Domains
   - Add `api.ptoconnect.com`
   - Note the CNAME target provided by Railway

2. **Prepare DNS Change**
   - Don't change DNS yet - prepare the change in your DNS provider
   - Set up the CNAME record pointing to Railway's target
   - Keep it ready but don't activate

### Step 4: Zero-Downtime Migration

1. **Lower DNS TTL (24 hours before migration)**
   ```
   # Change TTL to 300 seconds (5 minutes) for faster propagation
   api.ptoconnect.com → Current Render IP (TTL: 300)
   ```

2. **Execute Migration**
   ```bash
   # 1. Verify Railway deployment is working
   curl https://your-railway-url.up.railway.app/api/auth/health
   
   # 2. Update DNS to point to Railway
   # Change CNAME from Render to Railway target
   
   # 3. Monitor both endpoints during transition
   # Old: Current Render URL
   # New: api.ptoconnect.com (should start pointing to Railway)
   ```

3. **Verify Migration**
   ```bash
   # Test the custom domain
   curl https://api.ptoconnect.com/
   
   # Test API functionality
   curl https://api.ptoconnect.com/api/auth/health
   
   # Monitor Railway logs
   railway logs
   ```

### Step 5: Post-Migration Cleanup

1. **Update Webhook URLs**
   - Stripe webhooks: Update to `https://api.ptoconnect.com/api/stripe/webhook`
   - Any other external services pointing to the old URL

2. **Monitor Performance**
   - Check Railway metrics
   - Monitor error rates
   - Verify all integrations work

3. **Clean Up Render**
   - Keep Render deployment running for 24-48 hours as backup
   - After confirming everything works, delete Render service

## GitHub Integration Setup

### Step 1: Connect Repository

1. **Link GitHub Repository**
   ```bash
   # In Railway dashboard
   # Go to Settings → Source → Connect GitHub
   # Select your repository and branch (main)
   ```

2. **Configure Auto-Deploy**
   ```json
   // railway.json already configured for:
   {
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "npm start",
       "healthcheckPath": "/",
       "restartPolicyType": "ON_FAILURE"
     }
   }
   ```

### Step 2: Set Up Branch Protection

1. **Main Branch Protection**
   - Require pull request reviews
   - Require status checks to pass
   - Include Railway deployment status

2. **Preview Environments**
   - Railway automatically creates preview deployments for PRs
   - Each PR gets its own URL for testing

### Step 3: CI/CD Pipeline

```yaml
# .github/workflows/backend-ci.yml (optional)
name: Backend CI
on:
  pull_request:
    paths:
      - 'pto-connect-backend/**'
  push:
    branches: [main]
    paths:
      - 'pto-connect-backend/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd pto-connect-backend && npm ci
      - run: cd pto-connect-backend && npm run lint
```

## Configuration Files

### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### nixpacks.toml
```toml
[phases.setup]
nixPkgs = ['nodejs_20', 'npm']

[phases.install]
cmds = ['npm ci --only=production']

[phases.build]
cmds = ['echo "Build phase - no build step needed for Express API"']

[start]
cmd = 'npm start'

[variables]
NODE_ENV = 'production'
```

## Monitoring & Troubleshooting

### Health Checks
- Railway health check: `GET /`
- Custom health endpoint: `GET /api/health` (if needed)

### Logging
```bash
# View Railway logs
railway logs

# Follow logs in real-time
railway logs --follow
```

### Common Issues

1. **Environment Variables Missing**
   ```bash
   # Check all variables are set
   railway variables
   ```

2. **CORS Issues**
   - Verify CORS configuration includes Railway domains
   - Check browser network tab for CORS errors

3. **Database Connection**
   - Verify Supabase credentials
   - Check network connectivity from Railway

### Rollback Plan

If issues occur:

1. **Immediate Rollback**
   ```bash
   # Change DNS back to Render
   api.ptoconnect.com → Render CNAME
   ```

2. **Investigate Issues**
   - Check Railway logs
   - Verify environment variables
   - Test individual endpoints

3. **Re-attempt Migration**
   - Fix identified issues
   - Test thoroughly on Railway URL
   - Retry DNS switch

## Success Criteria

✅ Backend deployed to Railway  
✅ Custom domain `api.ptoconnect.com` working  
✅ All API endpoints responding correctly  
✅ Frontend can communicate with backend  
✅ Database connections working  
✅ External integrations (Stripe, Twilio) working  
✅ GitHub auto-deploy configured  
✅ Monitoring and logging set up  

## Next Steps After Migration

1. **Performance Optimization**
   - Monitor Railway metrics
   - Optimize for Railway's infrastructure

2. **Scaling Configuration**
   - Configure auto-scaling if needed
   - Set up resource limits

3. **Backup Strategy**
   - Ensure database backups are working
   - Document recovery procedures

4. **Team Access**
   - Add team members to Railway project
   - Set up appropriate permissions
