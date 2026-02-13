# Shopify webhook & OAuth – verification checklist

Use this to confirm everything is aligned for App Store review and Connect flow.

---

## 1. Partner Dashboard (your screenshot)

| Item | Expected | Your config |
|------|----------|-------------|
| **Redirect URL** | Must match the app’s callback path | `https://dev.prepservicesfba.com/dashboard/integrations/shopify/callback` ✓ |
| **Required scopes** | Include at least: read_orders, read_products, write_products, read_inventory, write_inventory, read_locations, write_fulfillments | Present ✓ |
| **Legacy install flow** | Unchecked for current OAuth | Unchecked ✓ |

---

## 2. App code – callback flow

| Item | Location | Status |
|------|----------|--------|
| Callback page | `src/app/dashboard/integrations/shopify/callback/page.tsx` | Exists; reads `code` & `shop`, calls `POST /api/shopify/exchange-token` ✓ |
| Exchange token API | `src/app/api/shopify/exchange-token/route.ts` | Exchanges code for token; registers webhooks to `baseUrl/api/shopify/webhooks` ✓ |
| Base URL for webhooks | From `NEXT_PUBLIC_APP_URL` or `VERCEL_URL` | Must be set in Vercel (e.g. `https://dev.prepservicesfba.com`) so webhook URL is `https://dev.prepservicesfba.com/api/shopify/webhooks` |

---

## 3. Compliance webhooks (mandatory for App Store)

| Item | Location | Status |
|------|----------|--------|
| **shopify.app.toml** | Project root | `uri = "https://dev.prepservicesfba.com/api/shopify/webhooks"` ✓ (change if you use another domain) |
| **Topics in TOML** | `shopify.app.toml` | `customers/data_request`, `customers/redact`, `shop/redact` ✓ |
| **Registration on connect** | `exchange-token/route.ts` | Same 3 topics registered with other webhooks ✓ |
| **Handler** | `src/app/api/shopify/webhooks/route.ts` | For these topics: verify HMAC → return 200 `{ received: true }` ✓ |
| **HMAC verification** | Same route | All POSTs: validate `X-Shopify-Hmac-Sha256`; invalid → 401 ✓ |
| **SHOPIFY_CLIENT_SECRET** | Vercel (or host) env | **Must be set** in the environment that serves `dev.prepservicesfba.com`. If missing, HMAC fails → 401 and “Verifies webhooks with HMAC signatures” fails. |

---

## 4. URLs summary

| Purpose | URL |
|---------|-----|
| OAuth redirect (Partner Dashboard) | `https://dev.prepservicesfba.com/dashboard/integrations/shopify/callback` |
| Webhook endpoint (compliance + app) | `https://dev.prepservicesfba.com/api/shopify/webhooks` |
| Test in browser (GET) | `https://dev.prepservicesfba.com/api/shopify/webhooks` → should return `{"ok":true,...}` |

---

## 5. If automated checks still fail

1. **Deploy** – Latest code (with compliance handlers and `shopify.app.toml`) is deployed to `dev.prepservicesfba.com`.
2. **Env on Vercel** – `SHOPIFY_CLIENT_SECRET` and `NEXT_PUBLIC_APP_URL` (or rely on `VERCEL_URL`) are set for that deployment.
3. **No trailing slash** – Redirect URL and webhook URI use no trailing slash.
4. **Install on test store** – Connect a test store from the app, then run the automated checks again.
5. **Vercel Deployment Protection** – If enabled, ensure the webhook URL is allowed (or turn off for the deployment Shopify uses), or Shopify’s POST will not reach your app.
