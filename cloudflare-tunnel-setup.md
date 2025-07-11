# Cloudflare Tunnel Setup for Code Analyzer

## 🎯 Quick Setup Guide

### **Step 1: Install Cloudflare Tunnel**
```bash
# Windows
winget install --id Cloudflare.cloudflared

# macOS
brew install cloudflared

# Linux
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

### **Step 2: Login to Cloudflare**
```bash
cloudflared tunnel login
```

### **Step 3: Create a Tunnel**
```bash
cloudflared tunnel create code-analyzer
```

### **Step 4: Create Configuration File**
Create `config.yml` in your `.cloudflared` folder:
```yaml
tunnel: code-analyzer
credentials-file: /path/to/your/credentials.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3000
  - hostname: api.your-domain.com
    service: http://localhost:5000
  - service: http_status:404
```

### **Step 5: Start the Tunnel**
```bash
cloudflared tunnel run code-analyzer
```

### **Step 6: Add DNS Records**
```bash
cloudflared tunnel route dns code-analyzer your-domain.com
cloudflared tunnel route dns code-analyzer api.your-domain.com
```

## 🌐 Alternative: Quick Share (No Domain Required)

### **Quick Tunnel Command**
```bash
# Share frontend
cloudflared tunnel --url http://localhost:3000

# Share backend
cloudflared tunnel --url http://localhost:5000
```

This gives you instant URLs like:
- `https://random-name.trycloudflare.com` (frontend)
- `https://another-random-name.trycloudflare.com` (backend)

## 🔧 Update Your Frontend Config

Update your Angular frontend to use the Cloudflare tunnel URL:

```typescript
// src/app/services/code-analyzer.service.ts
export class CodeAnalyzerService {
  private apiUrl = 'https://your-api-tunnel.trycloudflare.com/api';
  // or your custom domain: 'https://api.your-domain.com/api'
}
```

## 📋 Complete Sharing Steps

### **1. Start Your Applications**
```bash
# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Start frontend
cd frontend
ng serve

# Terminal 3: Start tunnels
cloudflared tunnel --url http://localhost:3000
cloudflared tunnel --url http://localhost:5000
```

### **2. Share the Frontend URL**
Give people the frontend tunnel URL (e.g., `https://abc123.trycloudflare.com`)

### **3. Update Frontend to Use Backend Tunnel**
Update your service to point to the backend tunnel URL.

## 🔒 Security Considerations

### **For Public Sharing:**
- Remove sensitive endpoints
- Add rate limiting
- Consider authentication
- Monitor usage

### **Add Basic Rate Limiting:**
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

## 🎯 Pro Tips

1. **Custom Domain**: Use your own domain for professional appearance
2. **Environment Variables**: Set different configs for sharing vs local
3. **HTTPS Only**: Cloudflare automatically provides HTTPS
4. **Monitoring**: Use Cloudflare Analytics to track usage
5. **Access Control**: Use Cloudflare Access for private sharing

## 🚀 One-Command Setup Script

Create `share.sh`:
```bash
#!/bin/bash
echo "Starting Code Analyzer sharing..."

# Start backend
cd backend && npm start &
BACKEND_PID=$!

# Start frontend  
cd ../frontend && ng serve &
FRONTEND_PID=$!

# Wait for servers to start
sleep 5

# Start tunnels
cloudflared tunnel --url http://localhost:3000 &
cloudflared tunnel --url http://localhost:5000 &

echo "Sharing URLs will appear above!"
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap 'kill $BACKEND_PID $FRONTEND_PID; exit' INT
wait
```

Make executable and run:
```bash
chmod +x share.sh
./share.sh
```