# Shopify App Store – Mandatory compliance webhooks

For **App Store review**, Shopify requires all public apps to implement three **mandatory GDPR compliance webhooks**. The automated checks will fail until these are in place.

## Required webhooks

| Topic | Purpose |
|-------|--------|
| `customers/data_request` | Customer requests to view their stored data |
| `customers/redact` | Customer requests deletion of their personal information |
| `shop/redact` | Shop uninstalled – delete all customer data for that shop within 48 hours |

## What we do

1. **Registration** – When a store connects (OAuth callback), we register these three topics plus the existing app webhooks, all to the same URL:  
   `https://your-domain.com/api/shopify/webhooks`

2. **Handler** – In `src/app/api/shopify/webhooks/route.ts` we:
   - Verify **HMAC** (`X-Shopify-Hmac-Sha256`) for every POST (required for the “Verifies webhooks with HMAC signatures” check).
   - For `customers/data_request`, `customers/redact`, and `shop/redact`: log and return **200** with `{ received: true }`.  
   Prep Engine does not store merchant customer PII for GDPR export/redaction in a way that requires returning or deleting per-customer data; acknowledging receipt satisfies the requirement.

## After deploying

1. Deploy the app (Vercel or your host).
2. In Partner Dashboard, run **“Run”** under **Automated checks for common errors** again.
3. If the app has not been installed on a test store yet, **connect a test store** (Dashboard → Integrations → Connect Shopify), then run the checks again so the compliance webhooks are registered for that store.

## References

- [Shopify: Apps now need to use GDPR webhooks](https://shopify.dev/changelog/apps-now-need-to-use-gdpr-webhooks)
- [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
