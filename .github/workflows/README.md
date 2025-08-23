# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the DivvyUp application.

## Workflows Overview

### 🔄 `full-deploy.yml` (Recommended)
**Triggers**: Push to main/master, Pull Requests  
**Purpose**: Complete application deployment with testing

**What it does**:
1. **Backend**: Tests → Build → Deploy to Render
2. **Frontend**: Type check → Build → Deploy to Vercel  
3. **Health checks** and deployment summaries
4. **Preview deployments** for pull requests

### 🎨 `deploy-frontend.yml`
**Triggers**: Changes to frontend files  
**Purpose**: Frontend-only deployment to Vercel

**Features**:
- Build and deploy frontend independently
- Preview URLs for pull requests
- Optimized for frontend-only changes

### 🔧 `deploy-backend.yml`
**Triggers**: Changes to backend files  
**Purpose**: Backend-only deployment to Render

**Features**:
- Full test suite execution
- Production deployment with health checks
- Automatic database migrations

### 🧪 `backend-tests.yml` (Existing)
**Purpose**: Continuous testing for backend changes

## Required GitHub Secrets

Set these in your repository: **Settings → Secrets and variables → Actions**

### Vercel Secrets
```
VERCEL_TOKEN          # Your Vercel API token
VERCEL_ORG_ID         # Your Vercel organization ID  
VERCEL_PROJECT_ID     # Your Vercel project ID
VITE_API_BASE         # Backend URL (e.g., https://your-app.onrender.com)
VERCEL_PROJECT_URL    # Your Vercel app URL (e.g., https://divvyup.vercel.app)
```

### Render Secrets
```
RENDER_API_KEY        # Your Render API key
RENDER_SERVICE_ID     # Your backend service ID on Render
RENDER_SERVICE_URL    # Your backend service URL (e.g., https://your-app.onrender.com)
```

## Setup Instructions

### 1. Get Vercel Credentials

**Vercel Token**:
```bash
# Install Vercel CLI
npm i -g vercel

# Login and get token
vercel login
# Go to: https://vercel.com/account/tokens
# Create new token → Copy value
```

**Project IDs**:
```bash
# In your project directory
vercel link
# This creates .vercel/project.json with your IDs
cat .vercel/project.json
```

### 2. Get Render Credentials

**API Key**:
1. Go to [Render Account Settings](https://dashboard.render.com/account)
2. **API Keys** → **Create API Key**
3. Copy the key

**Service ID**:
1. Go to your backend service in Render Dashboard
2. URL will be: `https://dashboard.render.com/web/srv-XXXXX`
3. The `srv-XXXXX` part is your service ID

### 3. Add Secrets to GitHub

1. Go to your repository on GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** for each required secret

Example values:
```
VERCEL_TOKEN=your_vercel_token_here
VERCEL_ORG_ID=team_XXXXX  
VERCEL_PROJECT_ID=prj_XXXXX
VITE_API_BASE=https://divvyup-backend.onrender.com
VERCEL_PROJECT_URL=https://divvyup.vercel.app

RENDER_API_KEY=rnd_XXXXX
RENDER_SERVICE_ID=srv_XXXXX  
RENDER_SERVICE_URL=https://divvyup-backend.onrender.com
```

## Workflow Behavior

### 🚀 Production Deployments
**Trigger**: Push to `main` or `master` branch

1. **Backend tests run** (all must pass)
2. **Backend deploys** to Render production
3. **Frontend builds** and deploys to Vercel production
4. **Health checks** verify deployments
5. **Deployment summary** posted to GitHub

### 🔍 Pull Request Previews
**Trigger**: Pull request opened/updated

1. **Tests run** for both backend and frontend
2. **Preview frontend** deployed to Vercel
3. **Preview URL** commented on the PR
4. Backend runs tests but doesn't deploy

### ⚡ Individual Deployments
**Triggers**: 
- `deploy-frontend.yml`: Changes to `frontend/` directory
- `deploy-backend.yml`: Changes to `backend/` directory

Use these for targeted deployments when you know only one part changed.

## Troubleshooting

### Common Issues

**❌ "Secret not found"**
- Verify secret names match exactly (case-sensitive)
- Check that secrets are set in the correct repository

**❌ "Vercel deployment failed"**
- Verify `VERCEL_TOKEN` has correct permissions
- Check that `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are correct
- Ensure `VITE_API_BASE` points to your backend URL

**❌ "Render deployment failed"**
- Verify `RENDER_API_KEY` is valid and has deployment permissions
- Check that `RENDER_SERVICE_ID` matches your service
- Ensure your `render.yaml` is properly configured

**❌ "Health check failed"**
- Backend might be starting up (Render free tier takes time)
- Check if `RENDER_SERVICE_URL` is correct
- Verify backend is responding to `/health` endpoint

### Debug Steps

1. **Check workflow logs** in the Actions tab
2. **Verify secrets** are set correctly
3. **Test manual deployment** to isolate issues
4. **Check service logs** in Vercel/Render dashboards

### Manual Deployment (Fallback)

If workflows fail, you can deploy manually:

```bash
# Frontend (Vercel)
cd frontend
npm run build
vercel --prod

# Backend (Render)
# Push to main branch, or use Render dashboard "Manual Deploy"
```

## Monitoring

- **GitHub Actions**: Repository → Actions tab
- **Vercel Deployments**: [Vercel Dashboard](https://vercel.com/dashboard)
- **Render Deployments**: [Render Dashboard](https://dashboard.render.com)

Each workflow provides detailed logs and deployment summaries to help track the status of your deployments.
