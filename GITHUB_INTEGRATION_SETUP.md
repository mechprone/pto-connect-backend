# GitHub Integration Setup Guide

## Overview
This guide sets up automatic deployments to Railway when code is pushed to the main branch.

## Required GitHub Secrets

You need to add these secrets to your GitHub repository:

### 1. Get Railway Token
```bash
# Run this command to get your Railway token
railway login
railway whoami
```

### 2. Add GitHub Secrets
Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

**RAILWAY_TOKEN**
- Value: Your Railway CLI token (from `railway whoami`)

**RAILWAY_SERVICE_ID** 
- Value: `9e0dd35b-cab5-4787-9769-ba3bc97c9274`

## How to Add Secrets

1. Go to: https://github.com/[your-username]/[your-repo]/settings/secrets/actions
2. Click "New repository secret"
3. Add each secret:
   - Name: `RAILWAY_TOKEN`
   - Value: [Your Railway token]
   - Click "Add secret"
   
   - Name: `RAILWAY_SERVICE_ID`
   - Value: `9e0dd35b-cab5-4787-9769-ba3bc97c9274`
   - Click "Add secret"

## Workflow Features

The GitHub Actions workflow (`.github/workflows/railway-deploy.yml`) will:

✅ **Trigger on**:
- Push to `main` branch (when backend files change)
- Pull requests to `main` branch

✅ **Build Process**:
- Install Node.js 20
- Install dependencies with `npm ci`
- Run tests (if any exist)
- Deploy to Railway

✅ **Path Filtering**:
- Only runs when files in `pto-connect-backend/` change
- Saves CI/CD resources

## Testing the Setup

1. Add the GitHub secrets (above)
2. Push a small change to the backend
3. Check the Actions tab in GitHub
4. Verify deployment in Railway dashboard

## Benefits

- 🚀 **Auto-deployment** on every push to main
- 🔍 **PR previews** (can be configured)
- 📊 **Build status** visible in GitHub
- ⚡ **Fast deployments** using Railway CLI
- 🛡️ **Secure** using GitHub secrets

## Next Steps

After setting up GitHub integration:
1. Test with a small commit
2. Configure PR preview environments (optional)
3. Add deployment notifications (optional)
4. Set up staging environment (optional)

## Troubleshooting

**If deployment fails:**
1. Check GitHub Actions logs
2. Verify Railway token is valid: `railway whoami`
3. Ensure service ID is correct
4. Check Railway dashboard for errors

**Common Issues:**
- Invalid Railway token → Re-login and update secret
- Wrong service ID → Check `railway variables | findstr RAILWAY_SERVICE_ID`
- Path issues → Ensure workflow paths match your repo structure
