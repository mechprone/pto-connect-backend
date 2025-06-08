# Manual Railway Project Setup Guide

## Create Railway Project Manually

### 1. Go to Railway Dashboard
- Visit: https://railway.app/dashboard
- Click "New Project"

### 2. Project Settings
**Project Name:** `pto-connect-backend`

**Source:** Choose "Deploy from GitHub repo"
- Select your repository (likely `mechprone/pto-connect` or similar)
- **Root Directory:** `pto-connect-backend`
- **Branch:** `main`

### 3. Build Settings (Railway should auto-detect, but verify):
- **Build Command:** `npm ci`
- **Start Command:** `npm start`
- **Port:** `3000` (or leave auto-detect)

### 4. Environment Variables
Add these environment variables (copy from your current Render deployment):

**Required Variables:**
- `NODE_ENV` = `production`
- `CLIENT_URL` = `https://app.ptoconnect.com`
- `SUPABASE_URL` = `[your Supabase URL]`
- `SUPABASE_SERVICE_ROLE_KEY` = `[your Supabase service role key]`
- `OPENAI_API_KEY` = `[your OpenAI key]`
- `STRIPE_SECRET_KEY` = `[your Stripe secret key]`
- `STRIPE_WEBHOOK_SECRET` = `[your Stripe webhook secret]`
- `TWILIO_ACCOUNT_SID` = `[your Twilio SID]`
- `TWILIO_AUTH_TOKEN` = `[your Twilio token]`
- `TWILIO_PHONE_NUMBER` = `[your Twilio phone]`
- `META_ACCESS_TOKEN` = `[your Meta token]`
- `META_APP_ID` = `[your Meta app ID]`
- `META_APP_SECRET` = `[your Meta app secret]`

### 5. Deploy
Click "Deploy" and Railway will build and deploy your backend.

### 6. After Creation
Once the project is created and deployed:
1. Note the Railway-generated URL
2. Test the health endpoint: `https://your-railway-url.up.railway.app/`
3. Add custom domain `api.ptoconnect.com` in Railway settings
4. Update DNS to point to Railway

### 7. Link Local Directory
After creating the project, run in your local terminal:
```bash
cd pto-connect-backend
railway link
# Select the pto-connect-backend project you just created
```

This approach bypasses CLI issues and gives you full control over the setup process.
