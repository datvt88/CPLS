# ⚠️ IMPORTANT: Gemini API Model Migration

## 🔴 Critical Issue Fixed

**Gemini 1.5 models were RETIRED on April 29, 2025**

If you're seeing this error:
```
✗ Gemini model not found
```

**It's because Gemini 1.5 Flash is no longer available.**

---

## ✅ Solution Applied

We've migrated to **Gemini 2.5 Flash**:

```diff
- gemini-1.5-flash ❌ (retired)
- gemini-2.0-flash-exp ✅ (upgraded)
+ gemini-2.5-flash ✅ (active - stable model)
```

---

## 🚀 What Changed

### Files Updated:
1. **app/api/gemini/route.ts** - Main AI analysis endpoint
2. **app/api/gemini/health/route.ts** - Health check endpoint
3. **scripts/test-gemini-api.js** - Test script

### No Action Required:
- ✅ Code already updated
- ✅ Build successful
- ✅ Ready to deploy

---

## 📊 Current Gemini Models (2025)

| Model | Status | Use Case |
|-------|--------|----------|
| `gemini-1.5-flash` | ❌ **RETIRED** | Deprecated |
| `gemini-1.5-pro` | ❌ **RETIRED** | Deprecated |
| `gemini-2.0-flash` | ✅ **ACTIVE** | General use, GA |
| `gemini-2.5-flash` | ✅ **ACTIVE** | Enhanced performance (we use this) |
| `gemini-2.5-flash-lite` | ✅ **ACTIVE** | Fast, low-cost |
| `gemini-2.5-pro` | ✅ **ACTIVE** | Highest intelligence |
| `gemini-2.5-flash-live` | ⚠️ **LIVE API** | Streaming audio/video only |

---

## 🎯 Benefits of Gemini 2.5 Flash

Our new model (`gemini-2.5-flash`) provides:

- ⚡ **Enhanced performance** - Faster and more accurate
- 🧠 **Better reasoning** - Improved analysis quality
- 📝 **Improved accuracy** - Better trading signal generation
- 🔧 **Native tool use** - Advanced capabilities
- 📚 **1M token context** - Can analyze more market data
- 💰 **Cost-effective** - Excellent value
- ✅ **Stable model** - Production-ready, not experimental

---

## 🧪 How to Test

### Option 1: Use Test Script

```bash
GEMINI_API_KEY=your_key node scripts/test-gemini-api.js
```

**Expected output:**
```
Test 1: Using x-goog-api-key header with gemini-2.5-flash
Status: 200 OK
✅ Success! Response: Xin chào thế giới
```

### Option 2: Check Health Endpoint

After deploying to Vercel:
```
GET https://your-app.vercel.app/api/gemini/health
```

**Expected response:**
```json
{
  "status": "success",
  "message": "Gemini API is available",
  "configured": true,
  "available": true,
  "model": "gemini-2.5-flash"
}
```

### Option 3: Check AI Analysis Widget

1. Navigate to `/dashboard`
2. Look at AI Analysis widget
3. Should show: **🟢 ✓ Gemini API is available**

---

## 🔄 Deploy Steps

### 1. Ensure API Key is Set

Vercel Dashboard → Settings → Environment Variables:
- Key: `GEMINI_API_KEY`
- Value: Your Gemini API key
- Applied to: ✓ Production ✓ Preview ✓ Development

### 2. Deploy

**Option A: Auto Deploy**
```bash
git checkout main
git merge claude/fix-stock-chart-latest-data-011CUugksYCpTJMzPV4T7Hce
git push origin main
```

**Option B: Manual Redeploy**
- Vercel Dashboard → Deployments
- Click **Redeploy** on latest

### 3. Verify

After deployment completes:
1. Visit `/dashboard`
2. AI Analysis widget shows: 🟢 **✓ Gemini API is available**
3. Test analysis with "VNINDEX"

---

## 📋 Troubleshooting

### Still seeing "model not found"?

**Check 1: Cached Build**
```bash
# Force clean build
rm -rf .next
npm run build
```

**Check 2: Old API Key**
- Some old API keys may not support new models
- Create new key: https://makersuite.google.com/app/apikey
- Update in Vercel env vars
- Redeploy

**Check 3: Regional Restrictions**
- Gemini 2.0 may have different regional availability
- Check Google AI docs for your region

### API Key Issues

If health check shows `API key is invalid`:
1. Verify key at: https://makersuite.google.com/app/apikey
2. Ensure no extra spaces in Vercel env var
3. Regenerate key if needed
4. **Must redeploy after changing env var**

---

## 📚 Resources

- [Gemini Models Documentation](https://ai.google.dev/gemini-api/docs/models)
- [Migration Guide](https://ai.google.dev/gemini-api/docs/migrate)
- [Release Notes](https://ai.google.dev/gemini-api/docs/changelog)

---

## 💡 Future Considerations

### When to Upgrade Again

Monitor for:
- Gemini 2.5 stable release (currently preview)
- Better pricing on newer models
- Required features only in newer versions

### Easy Migration

Our code is designed for easy model switching:
1. Update model name in 2 files
2. Test with script
3. Deploy

---

## ✅ Summary

- **Problem:** Gemini 1.5 retired → 404 errors
- **Solution:** Migrated to Gemini 2.5 Flash (stable)
- **Status:** ✅ Fixed and upgraded
- **Action:** Deploy to production
- **Result:** AI Analysis with enhanced performance

**Important Note:** `gemini-2.5-flash-live` is NOT a REST API model. It's only for Live API (streaming). Use `gemini-2.5-flash` for standard generateContent API calls.

---

**Last Updated:** November 10, 2025
**Current Model:** `gemini-2.5-flash`
**Status:** ✅ Production Ready
