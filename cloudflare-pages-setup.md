# Cloudflare Pages Setup for Code Analyzer Frontend

## 🎯 Deploy Frontend to Cloudflare Pages

### **Step 1: Build Your Angular App**
```bash
cd frontend
ng build --prod
# This creates a 'dist' folder with your built app
```

### **Step 2: Deploy to Cloudflare Pages**

#### **Option A: Through Cloudflare Dashboard**
1. Go to [Cloudflare Pages](https://pages.cloudflare.com)
2. Click "Create a project"
3. Connect your Git repository OR
4. Upload your `dist` folder directly

#### **Option B: Using Wrangler CLI**
```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy your app
wrangler pages publish dist/your-app-name --project-name=code-analyzer
```

### **Step 3: Configure Build Settings**
If using Git integration:
```yaml
# Build settings in Cloudflare Pages
Build command: ng build --prod
Build output directory: dist/your-app-name
Node.js version: 18
```

### **Step 4: Set Environment Variables**
In Cloudflare Pages dashboard:
```
API_URL = https://your-backend-tunnel.trycloudflare.com/api
```

### **Step 5: Update Angular Environment**
```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://your-backend-tunnel.trycloudflare.com/api'
};
```

## 🌐 Your App URLs
- **Frontend**: `https://code-analyzer.pages.dev`
- **Backend**: `https://your-tunnel.trycloudflare.com` (via tunnel)

## 🔧 Custom Domain (Optional)
1. Add your domain to Cloudflare Pages
2. Update DNS settings
3. Get free SSL certificate automatically