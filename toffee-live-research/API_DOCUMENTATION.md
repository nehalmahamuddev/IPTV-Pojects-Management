# Toffee Live API Documentation

## Overview

Toffee Live is a streaming platform with a comprehensive API infrastructure for content delivery, authentication, payments, and user management.

**Last Updated:** 2026-10-24

---

## Base URLs

| Service | Base URL | Purpose |
|---------|----------|---------|
| Content API | `https://content-prod.services.toffeelive.com/toffee/BD/DK` | Content catalog, channels, movies, series |
| Entitlement API | `https://entitlement-prod.services.toffeelive.com/toffee/BD/DK` | Playback authorization & stream URLs |
| DRM Gateway | `https://prod-services.toffeelive.com/drmgw/v1` | Digital Rights Management |
| SMS/Auth | `https://prod-services.toffeelive.com/sms/v1` | User authentication & device management |
| Product | `https://prod-services.toffeelive.com/product/v1` | Subscription products & packages |
| Payment | `https://prod-services.toffeelive.com/payment/v2` | Payment processing |
| Subscription | `https://prod-services.toffeelive.com/subscription/v1` | Subscription management |
| Voucher | `https://prod-services.toffeelive.com/voucher/v1` | Promo codes & vouchers |
| Engagement | `https://prod-apigw.toffeelive.com/engagement/v1` | Polls, votes, user history |

---

## Authentication

### Token Types

#### 1. Device Token (Cookie-based)
Used for guest access and device identification.

**Storage:** Cookies
- `device_id` - Unique device identifier
- `device_token` - Bearer token for guest requests
- `device_refresh_token` - Refresh token for device

**Usage:**
```http
Authorization: Bearer {device_token}
```

#### 2. User Access Token (LocalStorage)
Used for authenticated user requests.

**Storage:** localStorage key `auth_session`
```json
{
  "access": "user_access_token",
  "refresh": "user_refresh_token",
  "accessExpiry": 1234567890,
  "refreshExpiry": 1234567890
}
```

**Usage:**
```http
Authorization: Bearer {access_token}
```

### Token Refresh

**Endpoint:** `POST https://prod-services.toffeelive.com/auth/v1/token/refresh`

**Headers:**
```http
Authorization: Bearer {refresh_token}
Content-Type: application/json
```

**Response:**
```json
{
  "access": "new_access_token",
  "refresh": "new_refresh_token",
  "accessExpiry": 1234567890,
  "refreshExpiry": 1234567890
}
```

---

## Content API

### Get Live Channels

**Endpoint:** `GET /web/view/live`

**Full URL:** `https://content-prod.services.toffeelive.com/toffee/BD/DK/web/view/live`

**Headers:**
```http
Authorization: Bearer {device_token}
```

**Query Parameters:**
- `page` (optional) - Page number for pagination

**Response:**
```json
{
  "title": "Live",
  "rails": [
    {
      "title": "Live TV",
      "items": [
        {
          "id": "channel_123",
          "title": "Channel Name",
          "images": {
            "poster": "https://...",
            "thumbnail": "https://..."
          },
          "isLive": true,
          "metadata": {
            "genre": "Sports",
            "language": "Bengali"
          }
        }
      ]
    }
  ]
}
```

### Get Platform Configuration

**Endpoint:** `GET /web`

**Full URL:** `https://content-prod.services.toffeelive.com/toffee/BD/DK/web`

**Response:** Platform-wide configuration and navigation structure.

### Get Single Asset

**Endpoint:** `GET /web/asset/{assetId}`

**Full URL:** `https://content-prod.services.toffeelive.com/toffee/BD/DK/web/asset/{assetId}`

**Response:**
```json
{
  "id": "asset_123",
  "title": "Asset Name",
  "type": "live_channel",
  "images": {},
  "metadata": {}
}
```

### Search Content

**Endpoint:** `GET /web/search`

**Query Parameters:**
- `q` - Search keyword
- `cast` (optional) - Cast member name
- `page` (optional) - Page number

**Example:**
```
GET /web/search?q=cricket&page=1
```

---

## Entitlement API (Stream URLs)

### Get Playback Token & Stream URL

**Endpoint:** `POST /web/playback/{contentId}`

**Full URL:** `https://entitlement-prod.services.toffeelive.com/toffee/BD/DK/web/playback/{contentId}`

**Headers:**
```http
Authorization: Bearer {device_token_or_access_token}
Content-Type: application/json
Credentials: include
```

**Body:**
```json
{}
```

**Response:**
```json
{
  "playbackUrl": "https://stream-url.com/playlist.m3u8",
  "drmToken": "drm_token_if_protected",
  "expiresAt": 1234567890
}
```

**Note:** This is the key endpoint for getting M3U8/HLS stream URLs!

---

## Authentication Flow

### 1. Device Registration

**Endpoint:** `POST /device/register`

**Full URL:** `https://prod-services.toffeelive.com/sms/v1/device/register?nonce={nonce}&hash={hash}`

**Body:**
```json
{
  "deviceId": "unique_device_id",
  "platform": "web",
  "model": "browser"
}
```

### 2. Send OTP

**Endpoint:** `POST /subscriber/otp`

**Full URL:** `https://prod-services.toffeelive.com/sms/v1/subscriber/otp`

**Headers:**
```http
Authorization: Bearer {device_token}
Content-Type: application/json
```

**Body:**
```json
{
  "target": "+8801234567890",
  "resend": false
}
```

**Response:**
```json
{
  "verifyToken": "verify_token_here"
}
```

### 3. Verify OTP

**Endpoint:** `POST /subscriber/otp/verify`

**Full URL:** `https://prod-services.toffeelive.com/sms/v1/subscriber/otp/verify`

**Headers:**
```http
Authorization: Bearer {device_token}
x-verify-token: {verify_token}
Content-Type: application/json
```

**Body:**
```json
{
  "otp": "123456"
}
```

**Response:**
```json
{
  "loginToken": "login_token_here"
}
```

### 4. Login

**Endpoint:** `POST /subscriber/login`

**Full URL:** `https://prod-services.toffeelive.com/sms/v1/subscriber/login`

**Headers:**
```http
Authorization: Bearer {device_token}
x-login-token: {login_token}
Content-Type: application/json
```

**Body:**
```json
{}
```

**Response:**
```json
{
  "access": "user_access_token",
  "refresh": "user_refresh_token",
  "accessExpiry": 1234567890,
  "refreshExpiry": 1234567890,
  "subscriber": {
    "id": "subscriber_id",
    "name": "User Name",
    "email": "user@example.com"
  }
}
```

---

## Product & Subscription APIs

### Get All Products

**Endpoint:** `GET /subscriber/product`

**Full URL:** `https://prod-services.toffeelive.com/product/v1/subscriber/product`

**Query Parameters:**
- `codes` (optional) - Product codes filter
- `location` - Country code (e.g., BD)
- `offset` - Pagination offset
- `limit` - Results per page

**Example:**
```
GET /subscriber/product?location=BD&offset=1&limit=100
```

### Get Subscriptions

**Endpoint:** `GET /subscriber/{subscriberId}/subscription`

**Full URL:** `https://prod-services.toffeelive.com/subscription/v1/subscriber/{subscriberId}/subscription`

**Headers:**
```http
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `offset` - Pagination offset
- `limit` - Results per page
- `multi_status` (optional) - Filter by status
- `include_cancelled_recurring` - Include cancelled subscriptions (true/false)

---

## Payment APIs

### Initialize Payment

**Endpoint:** `POST /init`

**Full URL:** `https://prod-services.toffeelive.com/payment/v2/init`

**Headers:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Get Payment Methods

**Endpoint:** `GET /list`

**Full URL:** `https://prod-services.toffeelive.com/payment/v2/list`

**Query Parameters:**
- `offset` - Pagination offset
- `limit` - Results per page

---

## Voucher APIs

### Validate Voucher

**Endpoint:** `GET /subscriber/validate/{voucherId}/{subscriberId}`

**Full URL:** `https://prod-services.toffeelive.com/voucher/v1/subscriber/validate/{voucherId}/{subscriberId}`

**Headers:**
```http
Authorization: Bearer {access_token}
```

### Get All Vouchers

**Endpoint:** `GET /subscriber/coupon/list`

**Full URL:** `https://prod-services.toffeelive.com/voucher/v1/subscriber/coupon/list`

**Query Parameters:**
- `couponType` - Type of coupon (e.g., STATIC)
- `campaign_type` - Campaign type (e.g., DISCOUNT)
- `productCode` (optional) - Product code filter
- `offset` - Pagination offset
- `limit` - Results per page

---

## Request Configuration

### Standard Headers
```http
Content-Type: application/json
Authorization: Bearer {token}
```

### Timeouts & Retries
- **Timeout:** 15 seconds
- **Retries:** 3 attempts
- **Backoff:** Exponential (500ms base delay)
- **Retry on:** HTTP 5xx, 429 (Too Many Requests)

### CORS & Credentials
- **Credentials:** include (for cookie-based auth)
- **Mode:** cors

---

## Error Responses

### Common Error Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized (invalid/expired token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## Rate Limiting

The API implements rate limiting. When rate limited:
- HTTP Status: `429 Too Many Requests`
- Response includes `Retry-After` header
- Automatic retry with exponential backoff

---

## M3U Playlist Generation

### Workflow

1. **Get Live Channels:**
   ```
   GET https://content-prod.services.toffeelive.com/toffee/BD/DK/web/view/live
   ```

2. **For Each Channel, Get Stream URL:**
   ```
   POST https://entitlement-prod.services.toffeelive.com/toffee/BD/DK/web/playback/{channelId}
   ```

3. **Build M3U Playlist:**
   ```m3u
   #EXTM3U
   #EXTINF:-1 tvg-id="channel_id" tvg-name="Channel Name" tvg-logo="logo_url",Channel Name
   https://stream-url.com/playlist.m3u8
   ```

### Example M3U Entry
```m3u
#EXTM3U
#EXTINF:-1 tvg-id="sports_hd_1" tvg-name="Sports HD" tvg-logo="https://images.toffeelive.com/sports.png" group-title="Sports",Sports HD
https://entitlement-prod.services.toffeelive.com/stream/sports_hd_1.m3u8
```

---

## Best Practices

1. **Token Management:**
   - Refresh tokens before expiry
   - Handle 401 responses by refreshing tokens
   - Store tokens securely

2. **Rate Limiting:**
   - Implement exponential backoff
   - Respect `Retry-After` headers
   - Cache responses when appropriate

3. **Error Handling:**
   - Retry on 5xx and 429 errors
   - Log errors with context
   - Provide user-friendly error messages

4. **Content Requests:**
   - Use pagination for large result sets
   - Cache channel lists (refresh periodically)
   - Batch requests when possible

---

## Testing Endpoints

### Quick Test - Get Live Channels
```bash
curl -X GET \
  'https://content-prod.services.toffeelive.com/toffee/BD/DK/web/view/live' \
  -H 'Authorization: Bearer YOUR_DEVICE_TOKEN'
```

### Quick Test - Get Stream URL
```bash
curl -X POST \
  'https://entitlement-prod.services.toffeelive.com/toffee/BD/DK/web/playback/CHANNEL_ID' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

---

## Security Notes

- All API requests use HTTPS
- Tokens expire and must be refreshed
- Device tokens are cookie-based (httpOnly)
- User tokens stored in localStorage
- DRM protected content requires additional authorization
- Rate limiting prevents abuse

---

## Support

For API issues or questions, contact the Toffee Live development team.

**API Version:** Production (2026-10-24)
