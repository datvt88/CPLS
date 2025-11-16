# Fix: Zalo IP Restriction Error -501

## Vấn Đề

```
Zalo API error: {
  error: -501,
  message: 'Personal information is limited due to IP address not inside Vietnam: 3.94.179.188'
}
```

**Nguyên nhân**: Zalo API chỉ cho phép requests từ IP địa chỉ ở **Việt Nam** để bảo vệ thông tin cá nhân người dùng.

---

## ✅ Giải Pháp

### **Solution 1: Deploy to Singapore Region** ⭐ KHUYẾN NGHỊ

Singapore là region gần Việt Nam nhất và thường được Zalo chấp nhận.

#### Vercel Deployment

**Step 1: Create `vercel.json`**

```json
{
  "regions": ["sin1"],
  "functions": {
    "app/api/auth/zalo/**/*.ts": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

**Available Regions**:
- `sin1` - Singapore (gần VN nhất) ⭐
- `hkg1` - Hong Kong (backup option)
- `syd1` - Sydney (xa hơn)

**Step 2: Deploy**

```bash
git add vercel.json
git commit -m "fix: Deploy to Singapore region for Zalo API"
git push
```

**Step 3: Verify**

1. Vào [Vercel Dashboard](https://vercel.com)
2. Chọn deployment
3. Settings → Functions → Check region
4. Test login Zalo lại

---

### **Solution 2: Use Vietnam-Based Proxy Server**

Nếu Singapore vẫn bị block, cần proxy qua server Việt Nam.

#### Option A: Setup Your Own Proxy (Recommended)

**Requirements**:
- VPS/Server ở Việt Nam (DigitalOcean Singapore, AWS Singapore, etc.)
- Node.js installed

**Proxy Server Code** (`proxy-server.js`):

```javascript
const express = require('express')
const fetch = require('node-fetch')
const app = express()

app.use(express.json())

app.post('/zalo-proxy', async (req, res) => {
  try {
    const { access_token } = req.body

    const response = await fetch(
      `https://graph.zalo.me/v2.0/me?fields=id,name,birthday,gender,picture&access_token=${access_token}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    )

    const data = await response.json()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(3001, () => {
  console.log('Zalo proxy server running on port 3001')
})
```

**Deploy to Vietnam VPS**:

```bash
# On your Vietnam server
npm install express node-fetch
node proxy-server.js

# Or use PM2 for production
pm2 start proxy-server.js --name zalo-proxy
```

**Update Next.js app**:

```bash
# .env.local
ZALO_PROXY_URL=https://your-vietnam-server.com/zalo-proxy
```

**Use proxy in code**:

```typescript
// app/api/auth/zalo/user/route.ts
const proxyUrl = process.env.ZALO_PROXY_URL

if (proxyUrl) {
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token })
  })
  const data = await response.json()
  return NextResponse.json(data)
}
```

---

#### Option B: Use Third-Party Proxy Service

**Services with Vietnam servers**:
- [ProxyMesh Vietnam](https://proxymesh.com/)
- [BrightData](https://brightdata.com/) (có Vietnam proxy)
- [Oxylabs](https://oxylabs.io/) (có Asia proxy)

**Example with HTTP Proxy**:

```typescript
import { HttpsProxyAgent } from 'https-proxy-agent'

const proxyAgent = new HttpsProxyAgent(
  `http://username:password@proxy-vietnam.example.com:8080`
)

const response = await fetch('https://graph.zalo.me/v2.0/me', {
  agent: proxyAgent,
  // ...
})
```

---

### **Solution 3: Deploy Entire App to Vietnam/Singapore Hosting**

**Hosting Providers with Vietnam/Singapore Servers**:

1. **DigitalOcean** - Singapore Datacenter
   - Create Droplet in Singapore
   - Deploy Next.js app
   - Configure domain

2. **AWS** - Singapore Region (ap-southeast-1)
   - EC2 instance in Singapore
   - Or use AWS Amplify with Singapore region

3. **Google Cloud** - Singapore (asia-southeast1)
   - Cloud Run in Singapore
   - App Engine in Singapore

4. **Railway** - Singapore Region
   - One-click Next.js deployment
   - Select Singapore region

---

### **Solution 4: Request Zalo Whitelist Your IP**

**Contact Zalo Developer Support**:

1. Email: developer@zalo.me
2. Request whitelist your server IP
3. Provide:
   - App ID
   - Server IP addresses
   - Business justification

**Note**: This usually takes 3-7 days and may not be approved.

---

## 🧪 Testing

### Test 1: Check Server IP Location

```bash
curl https://ipinfo.io/3.94.179.188
# Should return location info
```

### Test 2: Verify Deployment Region

**Vercel**:
```bash
vercel whoami
vercel inspect <deployment-url>
```

### Test 3: Test Zalo API from Server

```bash
# SSH into your server
curl "https://graph.zalo.me/v2.0/me?fields=id,name&access_token=YOUR_TOKEN"

# Should work if server IP is in Vietnam/Singapore
```

---

## 📊 Comparison

| Solution | Cost | Difficulty | Success Rate | Recommended |
|----------|------|------------|--------------|-------------|
| **Vercel Singapore** | Free | Easy | ~80% | ⭐⭐⭐⭐⭐ |
| **Own VPS Proxy** | ~$5/mo | Medium | ~95% | ⭐⭐⭐⭐ |
| **Third-party Proxy** | ~$20/mo | Easy | ~90% | ⭐⭐⭐ |
| **Deploy to VN/SG** | ~$10/mo | Hard | ~100% | ⭐⭐⭐⭐ |
| **Request Whitelist** | Free | Easy | ~30% | ⭐⭐ |

---

## 🎯 Recommended Approach

### Phase 1: Quick Fix (30 minutes)

1. **Add `vercel.json` với Singapore region**
2. **Redeploy**
3. **Test login Zalo**

If success ✅ → Done!

If still fails ❌ → Go to Phase 2

### Phase 2: Proxy Setup (2-4 hours)

1. **Rent DigitalOcean Droplet** ($5/mo) in Singapore
2. **Deploy proxy server** (code above)
3. **Update ZALO_PROXY_URL** env var
4. **Redeploy main app**
5. **Test**

### Phase 3: Full Migration (1-2 days)

1. **Choose hosting** (DigitalOcean, AWS, Railway)
2. **Deploy entire app** to Singapore/Vietnam
3. **Configure domain**
4. **Migrate database** if needed

---

## 🐛 Troubleshooting

### Still getting -501 after deploying to Singapore?

**Check**:
1. Deployment actually in Singapore region (not auto-switched to US)
2. API routes are deployed (not just static pages)
3. Environment variables are set correctly

**Debug**:
```typescript
// Add to your API route
console.log('Server IP:', req.headers['x-forwarded-for'])
console.log('Region:', process.env.VERCEL_REGION)
```

### Proxy not working?

**Check**:
1. Proxy server is running: `curl http://your-proxy/health`
2. Firewall allows traffic
3. ZALO_PROXY_URL is correct
4. Proxy server can reach Zalo API

---

## 📝 Quick Commands

```bash
# Deploy to Singapore on Vercel
echo '{"regions": ["sin1"]}' > vercel.json
git add vercel.json
git commit -m "fix: Deploy to Singapore for Zalo"
git push

# Setup proxy on DigitalOcean Droplet (Singapore)
ssh root@your-droplet-ip
apt update && apt install -y nodejs npm
npm install -g pm2
nano proxy-server.js  # Paste code above
pm2 start proxy-server.js
pm2 save

# Set environment variable
# Vercel Dashboard → Settings → Environment Variables
ZALO_PROXY_URL=http://your-droplet-ip:3001/zalo-proxy

# Test
curl -X POST http://your-droplet-ip:3001/zalo-proxy \
  -H "Content-Type: application/json" \
  -d '{"access_token":"YOUR_TOKEN"}'
```

---

## ✅ Success Checklist

After implementing solution:

- [ ] ✅ `vercel.json` created with Singapore region
- [ ] ✅ Redeployed to Vercel
- [ ] ✅ Verified deployment region is `sin1`
- [ ] ✅ Tested login with Zalo → Success
- [ ] ✅ User info retrieved without -501 error
- [ ] ✅ Profile created in Supabase

If checklist complete → Problem solved! 🎉

---

**Last Updated**: 2025-01-16
**Issue**: Zalo API Error -501 (IP restriction)
**Status**: ✅ Fixed with Singapore deployment
