@echo off
REM PTO Connect Backend - Railway Deployment Script (Windows)
REM This script helps automate the Railway deployment process

echo 🚀 PTO Connect Backend - Railway Deployment
echo ============================================

REM Check if Railway CLI is installed
railway --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Railway CLI not found. Installing...
    npm install -g @railway/cli
    echo ✅ Railway CLI installed
) else (
    echo ✅ Railway CLI found
)

REM Check if user is logged in
railway whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔐 Please log in to Railway...
    railway login
) else (
    echo ✅ Already logged in to Railway
)

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the pto-connect-backend directory.
    pause
    exit /b 1
)

echo.
echo 📋 Pre-deployment checklist:
echo 1. Environment variables ready? (Check .env.example for required vars)
echo 2. Render deployment still running? (For rollback if needed)
echo 3. DNS TTL lowered? (For faster domain switching)
echo.

set /p continue="Continue with deployment? (y/N): "
if /i not "%continue%"=="y" (
    echo ❌ Deployment cancelled
    pause
    exit /b 1
)

echo.
echo 🏗️  Initializing Railway project...

REM Initialize Railway project if not already done
if not exist ".railway" (
    railway init
) else (
    echo ✅ Railway project already initialized
)

echo.
echo 🔧 Setting up environment variables...
echo Please set these environment variables in Railway dashboard:
echo.
echo Required variables:
echo - SUPABASE_URL
echo - SUPABASE_SERVICE_ROLE_KEY
echo - NODE_ENV=production
echo - CLIENT_URL=https://app.ptoconnect.com
echo - OPENAI_API_KEY
echo - STRIPE_SECRET_KEY
echo - STRIPE_WEBHOOK_SECRET
echo - TWILIO_ACCOUNT_SID
echo - TWILIO_AUTH_TOKEN
echo - TWILIO_PHONE_NUMBER
echo - META_ACCESS_TOKEN
echo - META_APP_ID
echo - META_APP_SECRET
echo.

set /p envvars="Have you set all environment variables in Railway dashboard? (y/N): "
if /i not "%envvars%"=="y" (
    echo ❌ Please set environment variables first
    echo 💡 Go to Railway dashboard → Your project → Variables
    pause
    exit /b 1
)

echo.
echo 🚀 Deploying to Railway...
railway up

echo.
echo ⏳ Waiting for deployment to complete...
timeout /t 30 /nobreak >nul

echo.
echo 🔍 Getting Railway URL...
for /f "tokens=*" %%i in ('railway domain 2^>nul') do set RAILWAY_URL=%%i

if "%RAILWAY_URL%"=="" (
    echo ⚠️  Could not get Railway URL automatically
    echo Please check Railway dashboard for your deployment URL
) else (
    echo ✅ Railway URL: %RAILWAY_URL%
    
    echo.
    echo 🧪 Testing deployment...
    
    REM Test health check using curl if available, otherwise skip
    curl -f -s "%RAILWAY_URL%" >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Health check passed!
        
        REM Test API response
        for /f "tokens=*" %%i in ('curl -s "%RAILWAY_URL%" 2^>nul') do set response=%%i
        echo %response% | findstr /C:"PTO Connect API is running" >nul
        if %errorlevel% equ 0 (
            echo ✅ API response check passed!
        ) else (
            echo ⚠️  API response unexpected: %response%
        )
    ) else (
        echo ❌ Health check failed or curl not available
        echo Please check Railway logs: railway logs
    )
)

echo.
echo 🎉 Deployment completed successfully!
echo.
echo Next steps:
echo 1. Add custom domain 'api.ptoconnect.com' in Railway dashboard
echo 2. Update DNS to point to Railway
echo 3. Test with custom domain
echo 4. Update webhook URLs (Stripe, etc.)
echo 5. Monitor for 24-48 hours before removing Render
echo.
echo 📊 Monitor deployment:
echo - Railway dashboard: https://railway.app
echo - View logs: railway logs
echo - View metrics: railway status
echo.
echo 🔄 Rollback plan:
echo - Change DNS back to Render if issues occur
echo - Keep Render running as backup for 48 hours

pause
