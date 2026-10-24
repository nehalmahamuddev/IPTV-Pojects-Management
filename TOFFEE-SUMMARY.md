# Toffee Live API - Key Findings Summary

> Scraped: 2026-10-23T17:52:51Z  
> Channel: Somoy TV (Xi_Ga5oBNnOkwJLWkhKP)

## 🎯 Critical API Endpoints Discovered

### 1. **Main API Base**
```
https://bff.toffeelive.com
```

### 2. **Content Management API**
```
GET https://bff.toffeelive.com/content-management-service/v1/
```

### 3. **Authentication (Firebase)**
```
POST https://identitytoolkit.googleapis.com/v1/accounts:signUp
POST https://identitytoolkit.googleapis.com/v1/accounts:lookup
Key: AIzaSyCv82eHAx0LaNvcJqOwumExKJen0_CzT1M
```

### 4. **Streaming CDN**
```
Base: https://prod-linear-media.toffeelive.com
HLS Playlist: /cdn/live/{channel_slug}/playlist.m3u8
Quality Specific: /cdn/live/{channel_slug}/{quality}/{quality}.m3u8
Segments: /cdn/live/{channel_slug}/{quality}/{timestamp}.ts
Encryption Keys: /cdn/live/{channel_slug}/{quality}/keys/{timestamp}.key
```

### 5. **Assets CDN**
```
https://assets-prod.services.toffeelive.com
Format: /w_{width},q_{quality},f_{format}/{channel_id}/posters/{uuid}.{ext}
```

## 🔑 Actual Streaming URLs Captured

### Somoy TV Channel (Xi_Ga5oBNnOkwJLWkhKP)

**Master Playlist:**
```
https://prod-linear-media.toffeelive.com/cdn/live/somoy_tv/playlist.m3u8
```

**1080p Stream:**
```
https://prod-linear-media.toffeelive.com/cdn/live/somoy_tv/1080/1080.m3u8
```

**URL Signing Parameters:**
- `edge-cache-token` or `hdntl` (HDNTL = HTTP Distributed Network Token)
- `Expires` - Token expiry timestamp
- `URLPrefix` - Base64 encoded URL prefix
- `Data` - Base64 encoded subscriber info: `{"subscriber_id":"..."}`
- `Signature` - HMAC signature for validation

**Example Token:**
```
?hdntl=Expires=1792864407~_GO=Generated~
URLPrefix=aHR0cHM6Ly9wcm9kLWxpbmVhci1tZWRpYS50b2ZmZWVsaXZlLmNvbQ~
Data=eyJzdWJzY3JpYmVyX2lkIjoiYTk4M2E2Y2MtZWI3Zi00ZDZjLWExNGEtODIyNTcyOWQzOTUxIn0~
Signature=AbYP0Ef9N3TlZ10x5-uf2TvS3TWlSvyuMCe5Ry1nEdE7IQQprXeB2OE0x--j9pHTjZLJska...
```

## 📊 Analytics & Tracking

**Mixpanel:** `https://api-js.mixpanel.com/track/`  
**Google Analytics:** `G-02M4D9SN5F`  
**Firebase:** Project `prj-tof-analytics`  
**CleverTap:** `https://eu1.clevertap-prod.com/`  
**Sentry:** `https://o4511211351048192.ingest.us.sentry.io/`

## 🔐 Authentication Flow

1. **Anonymous Sign-Up (Firebase)**
   ```http
   POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyCv82eHAx0LaNvcJqOwumExKJen0_CzT1M
   Body: {"returnSecureToken":true}
   ```

2. **Get Subscriber ID**
   - Returns anonymous user ID
   - Example: `a983a6cc-eb7f-4d6c-a14a-82257299d3951`

3. **Request Stream Token**
   - Token includes subscriber_id in base64 encoded Data field
   - Tokens expire after ~24 hours (86400 seconds)

## 🎬 Channel Data Structure

**Channel ID Format:** Base64-like encoding
- Example: `Xi_Ga5oBNnOkwJLWkhKP` (Somoy TV)
- Pattern: Mixed case alphanumeric with underscores

**Available Qualities:**
- 1080p (Full HD)
- 720p (HD)
- 480p (SD)
- 360p (SD)
- 240p (Low)

## 🛡️ Security & DRM

**URL Protection:**
- Time-limited tokens
- HMAC-based signatures
- Subscriber ID binding
- Referrer validation

**HLS Encryption:**
- AES-128 encryption keys
- Key URLs with HDNTL tokens
- Per-segment encryption

## 📱 Integration Code

### Get Anonymous Token
```javascript
const auth = await fetch(
  'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyCv82eHAx0LaNvcJqOwumExKJen0_CzT1M',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  }
);
const { idToken, localId } = await auth.json();
```

### Get Channel Stream
```javascript
// Use the BFF API to get stream URL
const stream = await fetch(
  `https://bff.toffeelive.com/content-management-service/v1/channels/${channelId}/stream`,
  {
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Origin': 'https://toffeelive.com',
      'Referer': 'https://toffeelive.com/'
    }
  }
);
const { streamUrl } = await stream.json();
```

### Play with HLS.js
```javascript
const video = document.querySelector('video');
if (Hls.isSupported()) {
  const hls = new Hls({
    xhrSetup: function(xhr, url) {
      xhr.setRequestHeader('Referer', 'https://toffeelive.com/');
      xhr.setRequestHeader('Origin', 'https://toffeelive.com');
    }
  });
  hls.loadSource(streamUrl);
  hls.attachMedia(video);
}
```

## 📂 Files Generated

1. **`toffee-api-data.json`** (2,672 lines)
   - Complete API call log
   - All headers and parameters
   - Streaming URLs with tokens
   - Response data

2. **`toffee-context.md`** (1,701 lines)
   - Formatted API documentation
   - All discovered endpoints
   - Header requirements

3. **`scrape-toffee.js`**
   - Reusable scraper script
   - Can be run again: `npm run scrape:toffee`

## 🎓 Key Insights

1. **Architecture:** Modern Next.js app with Firebase backend
2. **CDN:** Dedicated media CDN with token-based access control
3. **Auth:** Firebase Anonymous Auth for guest users
4. **Tokens:** HDNTL (HTTP Distributed Network Token) for URL signing
5. **Encryption:** AES-128 HLS encryption with rotating keys
6. **Analytics:** Multi-platform tracking (Mixpanel, GA4, CleverTap)

## ⚠️ Legal Notice

This documentation is for educational and research purposes. Always:
- Respect Toffee Live's Terms of Service
- Obtain proper licenses for content use
- Comply with copyright laws
- Use only as authorized

---

**Full data available in:**
- `/toffee-api-data.json` - Raw captured data
- `/toffee-context.md` - Generated documentation
- Run `npm run scrape:toffee` for updated data
