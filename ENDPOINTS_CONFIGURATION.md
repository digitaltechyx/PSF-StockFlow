# API Endpoints Configuration Guide

Complete list of endpoints you need to configure for Stripe and Shippo integration.

---

## 🌐 Your Domain
**Production Domain**: `ims.prepservicesfba.com`

---

## 📍 Stripe Webhook Endpoint

### Production Webhook URL
```
https://ims.prepservicesfba.com/api/stripe/webhook
```

### How to Configure in Stripe Dashboard

1. **Go to Stripe Dashboard**
   - Visit: https://dashboard.stripe.com/
   - Navigate to: **Developers** → **Webhooks**

2. **Add Endpoint**
   - Click **Add endpoint** button
   - Enter the endpoint URL: `https://ims.prepservicesfba.com/api/stripe/webhook`
   - Click **Add endpoint**

3. **Select Events to Listen For**
   - Click **Select events** or **Add events**
   - Select these events:
     - ✅ `payment_intent.succeeded` (Required)
     - ✅ `payment_intent.payment_failed` (Required)
     - ✅ `payment_intent.canceled` (Required)
     - ✅ `charge.succeeded` (Optional - for additional confirmation)
     - ✅ `charge.failed` (Optional - for additional confirmation)

4. **Save and Get Webhook Secret**
   - Click **Add endpoint** to save
   - Copy the **Signing secret** (starts with `whsec_...`)
   - ⚠️ **IMPORTANT**: Save this secret immediately - you can only see it once!
   - Add it to your environment variables as `STRIPE_WEBHOOK_SECRET`

---

## 🔌 All API Endpoints in Your Application

### 1. Stripe Payment Intent Creation
**Endpoint**: `POST /api/stripe/create-payment`
- **URL**: `https://ims.prepservicesfba.com/api/stripe/create-payment`
- **Purpose**: Creates a Stripe payment intent for label purchase
- **Authentication**: Handled internally (user must be logged in)
- **No external configuration needed** - This is your internal API

### 2. Stripe Webhook Handler
**Endpoint**: `POST /api/stripe/webhook`
- **URL**: `https://ims.prepservicesfba.com/api/stripe/webhook`
- **Purpose**: Receives webhook events from Stripe
- **Configuration Required**: ✅ **YES** - Add this URL in Stripe Dashboard
- **Events to Select**:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`
  - `charge.succeeded` (optional)
  - `charge.failed` (optional)

### 3. Shippo Rates API
**Endpoint**: `POST /api/shippo/rates`
- **URL**: `https://ims.prepservicesfba.com/api/shippo/rates`
- **Purpose**: Gets shipping rates from Shippo
- **No external configuration needed** - This is your internal API
- **Note**: Currently needs Shippo API key to be implemented

---

## 📋 Quick Configuration Checklist

### Stripe Configuration

- [ ] **Deploy your application** to production (Vercel/hosting)
- [ ] **Get production URL**: `https://ims.prepservicesfba.com`
- [ ] **Go to Stripe Dashboard** → Developers → Webhooks
- [ ] **Add webhook endpoint**: `https://ims.prepservicesfba.com/api/stripe/webhook`
- [ ] **Select events**:
  - [ ] `payment_intent.succeeded`
  - [ ] `payment_intent.payment_failed`
  - [ ] `payment_intent.canceled`
- [ ] **Copy webhook signing secret** (starts with `whsec_...`)
- [ ] **Add to environment variables**:
  - `STRIPE_WEBHOOK_SECRET=whsec_...`
- [ ] **Test webhook** using Stripe Dashboard test webhook feature

### Shippo Configuration

- [ ] **No webhook endpoints needed** for Shippo
- [ ] **Shippo uses API calls** (not webhooks)
- [ ] **Just need API key** in environment variables:
  - `SHIPPO_API_KEY=shippo_live_...`

---

## 🧪 Testing Endpoints

### Test Stripe Webhook Locally (Development)

If you want to test webhooks locally before deploying:

1. **Install Stripe CLI**
   ```bash
   # Windows: Download from https://github.com/stripe/stripe-cli/releases
   # Mac: brew install stripe/stripe-cli/stripe
   ```

2. **Login to Stripe**
   ```bash
   stripe login
   ```

3. **Forward Webhooks to Local Server**
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   - This will give you a webhook signing secret (different from production)
   - Use this in your `.env.local` as `STRIPE_WEBHOOK_SECRET`

### Test Production Webhook

1. **Go to Stripe Dashboard** → Developers → Webhooks
2. **Click on your webhook endpoint**
3. **Click "Send test webhook"**
4. **Select event**: `payment_intent.succeeded`
5. **Check your application logs** to verify it was received

---

## 🔐 Environment Variables Summary

### Production Environment Variables Needed

```env
# Stripe (Live Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...  # From webhook endpoint configuration

# Shippo (Live Mode)
SHIPPO_API_KEY=shippo_live_...
```

### Development Environment Variables

```env
# Stripe (Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # From Stripe CLI (local testing)

# Shippo (Test Mode)
SHIPPO_API_KEY=shippo_test_...
```

---

## 📝 Summary

### Endpoints You Need to Configure Externally:

1. **Stripe Webhook** (Only one!)
   - **URL**: `https://ims.prepservicesfba.com/api/stripe/webhook`
   - **Where**: Stripe Dashboard → Developers → Webhooks
   - **Events**: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`

### Endpoints That Are Internal (No External Config Needed):

- `/api/stripe/create-payment` - Your internal API
- `/api/shippo/rates` - Your internal API

---

## 🚨 Important Notes

1. **Deploy First**: You must deploy your application before setting up the Stripe webhook
2. **HTTPS Required**: Webhooks only work with HTTPS (production)
3. **Webhook Secret**: Save the webhook signing secret immediately - you can only see it once!
4. **Test Mode vs Live Mode**: Use test keys for development, live keys for production
5. **No Shippo Webhooks**: Shippo doesn't use webhooks - it uses direct API calls

---

**Last Updated**: [Current Date]
**Domain**: ims.prepservicesfba.com

