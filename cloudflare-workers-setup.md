# Cloudflare Workers Setup for Code Analyzer Backend

## ⚠️ Important Limitations

**Cloudflare Workers have limitations for your use case:**
- No file system access (affects image processing)
- Limited memory (affects large image processing)
- No persistent storage
- Limited to 128MB memory

## 🔧 Alternative: Hybrid Approach

### **Recommended Architecture:**
1. **Frontend**: Cloudflare Pages
2. **Backend**: Cloudflare Tunnel (keeps your local server)
3. **Static Assets**: Cloudflare R2 (optional)

### **Why This Works Better:**
- ✅ Keep your powerful local processing (OCR, image analysis)
- ✅ Get global CDN for frontend
- ✅ Secure tunneling for backend
- ✅ No architecture changes needed

## 🚀 Quick Deployment Commands

### **Deploy Frontend to Pages:**
```bash
cd frontend
ng build --prod
wrangler pages publish dist/frontend --project-name=code-analyzer-frontend
```

### **Share Backend via Tunnel:**
```bash
cd backend
npm start &
cloudflared tunnel --url http://localhost:5000
```

## 🌐 Final URLs
- **Frontend**: `https://code-analyzer-frontend.pages.dev`
- **Backend**: `https://random-name.trycloudflare.com`

## 🔄 Update Frontend Config
```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://your-backend-tunnel.trycloudflare.com/api'
};
```

This gives you the best of both worlds: fast global frontend + powerful local backend!