#!/bin/bash

# PTO Connect Backend - Railway Deployment Script
# This script helps automate the Railway deployment process

set -e  # Exit on any error

echo "🚀 PTO Connect Backend - Railway Deployment"
echo "============================================"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
    echo "✅ Railway CLI installed"
else
    echo "✅ Railway CLI found"
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Please log in to Railway..."
    railway login
else
    echo "✅ Already logged in to Railway"
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the pto-connect-backend directory."
    exit 1
fi

echo ""
echo "📋 Pre-deployment checklist:"
echo "1. Environment variables ready? (Check .env.example for required vars)"
echo "2. Render deployment still running? (For rollback if needed)"
echo "3. DNS TTL lowered? (For faster domain switching)"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🏗️  Initializing Railway project..."

# Initialize Railway project if not already done
if [ ! -f ".railway" ]; then
    railway init
else
    echo "✅ Railway project already initialized"
fi

echo ""
echo "🔧 Setting up environment variables..."
echo "Please set these environment variables in Railway dashboard:"
echo ""
echo "Required variables:"
echo "- SUPABASE_URL"
echo "- SUPABASE_SERVICE_ROLE_KEY"
echo "- NODE_ENV=production"
echo "- CLIENT_URL=https://app.ptoconnect.com"
echo "- OPENAI_API_KEY"
echo "- STRIPE_SECRET_KEY"
echo "- STRIPE_WEBHOOK_SECRET"
echo "- TWILIO_ACCOUNT_SID"
echo "- TWILIO_AUTH_TOKEN"
echo "- TWILIO_PHONE_NUMBER"
echo "- META_ACCESS_TOKEN"
echo "- META_APP_ID"
echo "- META_APP_SECRET"
echo ""

read -p "Have you set all environment variables in Railway dashboard? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please set environment variables first"
    echo "💡 Go to Railway dashboard → Your project → Variables"
    exit 1
fi

echo ""
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "⏳ Waiting for deployment to complete..."
sleep 30

echo ""
echo "🔍 Getting Railway URL..."
RAILWAY_URL=$(railway domain)

if [ -z "$RAILWAY_URL" ]; then
    echo "⚠️  Could not get Railway URL automatically"
    echo "Please check Railway dashboard for your deployment URL"
else
    echo "✅ Railway URL: $RAILWAY_URL"
    
    echo ""
    echo "🧪 Testing deployment..."
    
    if curl -f -s "$RAILWAY_URL" > /dev/null; then
        echo "✅ Health check passed!"
        
        # Test API response
        response=$(curl -s "$RAILWAY_URL")
        if [[ "$response" == *"PTO Connect API is running"* ]]; then
            echo "✅ API response check passed!"
        else
            echo "⚠️  API response unexpected: $response"
        fi
    else
        echo "❌ Health check failed"
        echo "Please check Railway logs: railway logs"
        exit 1
    fi
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Add custom domain 'api.ptoconnect.com' in Railway dashboard"
echo "2. Update DNS to point to Railway"
echo "3. Test with custom domain"
echo "4. Update webhook URLs (Stripe, etc.)"
echo "5. Monitor for 24-48 hours before removing Render"
echo ""
echo "📊 Monitor deployment:"
echo "- Railway dashboard: https://railway.app"
echo "- View logs: railway logs"
echo "- View metrics: railway status"
echo ""
echo "🔄 Rollback plan:"
echo "- Change DNS back to Render if issues occur"
echo "- Keep Render running as backup for 48 hours"
