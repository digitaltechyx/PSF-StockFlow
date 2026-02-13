# Shopify App Store – Mandatory compliance webhooks

For **App Store review**, Shopify requires all public apps to implement three **mandatory GDPR compliance webhooks**. The automated checks will fail until these are in place.

**Official doc:** [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)

## Required webhooks

| Topic | Purpose |
|-------|--------|
| `customers/data_request` | Customer requests to view their stored data |
| `customers/redact` | Customer requests deletion of their personal information |
| `shop/redact` | Shop uninstalled – delete all customer data for that shop within 48 hours |

## What this app does

1. **Config** – `shopify.app.toml` in the project root declares the compliance webhook URI so Shopify's checker can find it. Update the `uri` there if your live URL is different.

2. **Registration** – When a store connects (OAuth callback), we register these three topics plus the existing app webhooks, all to the same URL:  
   `https://your-domain.com/api/shopify/webhooks`

3. **Handler** – In `src/app/api/shopify/webhooks/route.ts` we:
   - Verify **HMAC** (`X-Shopify-Hmac-Sha256`) for every POST (required for the “Verifies webhooks with HMAC signatures” check).
   - For `customers/data_request`, `customers/redact`, and `shop/redact`: log and return **200** with `{ received: true }`.  
   Prep Engine does not store merchant customer PII for GDPR export/redaction in a way that requires returning or deleting per-customer data; acknowledging receipt satisfies the requirement.

## After deploying

1. Deploy the app (Vercel or your host).
2. In Partner Dashboard, run **“Run”** under **Automated checks for common errors** again.
3. If the app has not been installed on a test store yet, **connect a test store** (Dashboard → Integrations → Connect Shopify), then run the checks again so the compliance webhooks are registered for that store.

## If "Webhook error" or automated checks still fail

1. **Deploy** – Ensure the latest code (compliance handlers + HMAC) is deployed to the URL used in Partner Dashboard and in `shopify.app.toml`.
2. **Env** – In production, set **`SHOPIFY_CLIENT_SECRET`** (Client secret from Partner Dashboard). Without it, HMAC verification fails and "Verifies webhooks with HMAC signatures" can fail.
3. **`shopify.app.toml`** – In the project root we added this file so review tools can find the compliance webhook URL. If your app URL is not `https://dev.prepservicesfba.com`, edit `uri` in that file to your real webhook URL.
4. **Partner Dashboard** – If your platform has an "Event subscriptions" or "Webhooks" config for the app, add the same compliance webhook URL there if required.
5. **Test store** – Install the app on a test store (Connect Shopify in your app), then run the automated checks again so webhooks are registered and the checker can send test requests.

## References

- [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance) (official checklist)
- [Shopify: Apps now need to use GDPR webhooks](https://shopify.dev/changelog/apps-now-need-to-use-gdpr-webhooks)
- [Verify webhooks](https://shopify.dev/docs/apps/build/webhooks/subscribe/verify)
