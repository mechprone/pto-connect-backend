# 🚀 PTO Connect Backend Migration Checklist

## Pre-Migration Requirements

### ✅ Environment Setup
- [ ] Railway CLI installed (`npm install -g @railway/cli`)
- [ ] Railway account created and logged in
- [ ] GitHub repository access confirmed
- [ ] Current Render environment variables documented

### ✅ Environment Variables Required
Copy these from your current Render deployment:

**Core Configuration:**
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NODE_ENV=production`
- [ ] `CLIENT_URL=https://app.ptoconnect.com`

**API Keys:**
- [ ] `OPENAI_API_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`

**Twilio Configuration:**
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_PHONE_NUMBER`

**Meta/Facebook Integration:**
- [ ] `META_ACCESS_TOKEN`
- [ ] `META_APP_ID`
- [ ] `META_APP_SECRET`

### ✅ DNS Preparation
- [ ] Current DNS TTL noted (for rollback timing)
- [ ] DNS TTL reduced to 300 seconds (5 minutes) 24 hours before migration
- [ ] DNS provider access confirmed
- [ ] Backup of current DNS settings taken

## Migration Process

### Step 1: Deploy to Railway
- [ ] Run deployment script: `./deploy-to-railway.bat` (Windows) or `./deploy-to-railway.sh` (Linux/Mac)
- [ ] Verify Railway project created
- [ ] All environment variables set in Railway dashboard
- [ ] Initial deployment successful
- [ ] Railway-generated URL working

### Step 2: Test Railway Deployment
- [ ] Health check endpoint responding: `GET /`
- [ ] API endpoints functional
- [ ] Database connectivity verified
- [ ] External integrations working (Stripe, Twilio, etc.)
- [ ] CORS configuration working with frontend

### Step 3: Configure Custom Domain
- [ ] Custom domain `api.ptoconnect.com` added in Railway
- [ ] Railway CNAME target noted
- [ ] SSL certificate provisioned by Railway
- [ ] Domain verification completed

### Step 4: Execute Migration
- [ ] Final verification of Railway deployment
- [ ] DNS updated to point to Railway
- [ ] Custom domain responding correctly
- [ ] All API endpoints working on custom domain
- [ ] Frontend successfully communicating with new backend

### Step 5: Post-Migration
- [ ] Webhook URLs updated:
  - [ ] Stripe webhook: `https://api.ptoconnect.com/api/stripe/webhook`
  - [ ] Other external services updated
- [ ] Performance monitoring active
- [ ] Error rates normal
- [ ] All integrations verified

## GitHub Integration Setup

### Repository Connection
- [ ] GitHub repository connected to Railway
- [ ] Auto-deploy on main branch enabled
- [ ] Preview deployments for PRs configured
- [ ] Branch protection rules set up

### CI/CD Pipeline
- [ ] GitHub Actions workflow active
- [ ] Linting passing
- [ ] Security audit passing
- [ ] Health checks working

## Monitoring & Verification

### Health Checks
- [ ] `curl https://api.ptoconnect.com/` returns "PTO Connect API is running"
- [ ] All API endpoints responding correctly
- [ ] Response times acceptable
- [ ] Error rates normal

### Integration Tests
- [ ] Frontend login working
- [ ] Database operations successful
- [ ] Stripe payments processing
- [ ] Email notifications sending
- [ ] SMS notifications working (if enabled)

### Performance Metrics
- [ ] Response times < 500ms for most endpoints
- [ ] Memory usage stable
- [ ] CPU usage normal
- [ ] No memory leaks detected

## Rollback Plan

### If Issues Occur:
1. **Immediate Rollback:**
   - [ ] Change DNS back to Render CNAME
   - [ ] Verify Render is still operational
   - [ ] Monitor for traffic restoration

2. **Investigation:**
   - [ ] Check Railway logs: `railway logs`
   - [ ] Verify environment variables
   - [ ] Test individual endpoints
   - [ ] Check external service connectivity

3. **Fix and Retry:**
   - [ ] Address identified issues
   - [ ] Test thoroughly on Railway URL
   - [ ] Re-attempt DNS migration

## Success Criteria

### ✅ Technical Requirements
- [ ] All API endpoints responding correctly
- [ ] Database connectivity stable
- [ ] External integrations working
- [ ] Performance metrics acceptable
- [ ] Error rates < 1%

### ✅ Business Requirements
- [ ] Zero downtime achieved
- [ ] All user functionality working
- [ ] Payment processing operational
- [ ] Notifications sending correctly
- [ ] Admin functions accessible

### ✅ Operational Requirements
- [ ] Monitoring and alerting active
- [ ] Logs accessible and useful
- [ ] Deployment pipeline working
- [ ] Team access configured
- [ ] Documentation updated

## Post-Migration Cleanup

### 24-48 Hours After Migration:
- [ ] Verify stability over time
- [ ] Monitor error rates and performance
- [ ] Confirm all integrations stable
- [ ] User feedback collected

### 1 Week After Migration:
- [ ] Remove Render service (if everything stable)
- [ ] Update documentation
- [ ] Archive old deployment configs
- [ ] Celebrate successful migration! 🎉

## Emergency Contacts

**Railway Support:**
- Dashboard: https://railway.app
- Discord: https://discord.gg/railway
- Docs: https://docs.railway.app

**DNS Provider:**
- Provider: [Your DNS Provider]
- Support: [Support Contact]
- Account: [Account Details]

**Team Contacts:**
- Technical Lead: [Contact Info]
- DevOps: [Contact Info]
- On-call: [Contact Info]

---

## Quick Commands Reference

```bash
# Railway CLI Commands
railway login                    # Login to Railway
railway init                     # Initialize project
railway up                       # Deploy
railway logs                     # View logs
railway logs --follow           # Follow logs
railway domain                  # Get domain
railway variables               # List variables
railway variables set KEY=value # Set variable

# Health Check Commands
curl https://api.ptoconnect.com/
curl -I https://api.ptoconnect.com/api/auth/health

# DNS Check Commands
nslookup api.ptoconnect.com
dig api.ptoconnect.com
```

---

**Migration Date:** _______________  
**Completed By:** _______________  
**Verified By:** _______________  
**Notes:** _______________
