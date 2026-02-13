# Shopify integration – checklist verification

Re-check of the five items often required for app review / diagnostics.

---

## 1. app/uninstalled webhook

| Status | Implementation |
|--------|----------------|
| ✅ | **Registered** in `exchange-token/route.ts` when a store connects (topic `app/uninstalled` in the webhooks list). |
| ✅ | **Handled** in `webhooks/route.ts`: on `app/uninstalled` we log, delete `shopifyShopToUser` for that shop (so the shop is no longer mapped to a user), and return **200** `{ received: true }`. |
| ✅ | HMAC is verified for all POSTs before handling (see below). |

---

## 2. GDPR webhooks

| Status | Implementation |
|--------|----------------|
| ✅ | **Topics:** `customers/data_request`, `customers/redact`, `shop/redact` – all three registered in `exchange-token` and declared in `shopify.app.toml`. |
| ✅ | **Handler** in `webhooks/route.ts`: for these topics we log and return **200** `{ received: true }`. No customer data returned or deleted in app logic; ack is sufficient. |

---

## 3. HMAC verification

| Status | Implementation |
|--------|----------------|
| ✅ | **Header:** `X-Shopify-Hmac-Sha256` read via `request.headers.get("x-shopify-hmac-sha256")` (HTTP headers are case-insensitive). |
| ✅ | **Secret:** `process.env.SHOPIFY_CLIENT_SECRET` – must be set in Vercel (or host) for the deployed app. |
| ✅ | **Computation:** `createHmac("sha256", secret).update(rawBody, "utf8").digest("base64")` and compared to the header value. |
| ✅ | **Invalid/missing:** If HMAC is missing or does not match, we return **401 Unauthorized**. |

---

## 4. OAuth redirect

| Status | Implementation |
|--------|----------------|
| ✅ | **Redirect URL in Partner Dashboard:** `https://dev.prepservicesfba.com/dashboard/integrations/shopify/callback` (must match exactly). |
| ✅ | **Callback page:** `src/app/dashboard/integrations/shopify/callback/page.tsx` – reads `code` and `shop` from query, calls `POST /api/shopify/exchange-token` with auth, then redirects. |
| ✅ | **Token exchange:** `exchange-token/route.ts` calls Shopify `POST /admin/oauth/access_token` with client_id, client_secret, code; stores connection and registers webhooks. |

---

## 5. HTTPS valid

| Status | Notes |
|--------|--------|
| ✅ | App is served at `https://dev.prepservicesfba.com` (TLS provided by Vercel/host). Confirmed via GET to `https://dev.prepservicesfba.com/api/shopify/webhooks` returning JSON. |

---

## Summary

| Check              | Code/Config status |
|--------------------|--------------------|
| app/uninstalled    | ✅ Registered + handled |
| GDPR webhooks      | ✅ All 3 topics registered + handled |
| HMAC verification | ✅ All POSTs verified; 401 on invalid |
| OAuth redirect     | ✅ Callback route + exchange-token |
| HTTPS valid       | ✅ Deployed on HTTPS |

**Env:** Ensure `SHOPIFY_CLIENT_SECRET` and `NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`) are set in the deployment environment.
