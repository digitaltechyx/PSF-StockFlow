# Stripe Integration Setup Guide

## ✅ What's Been Implemented

### 1. **Stripe SDK Installation**
- ✅ Installed `stripe` and `@stripe/stripe-js` packages

### 2. **API Routes Created**
- ✅ `/api/stripe/create-payment` - Creates payment intent for label purchase
- ✅ `/api/stripe/webhook` - Handles Stripe webhook events (payment success/failure)

### 3. **UI Components**
- ✅ "Buy Labels" added to dashboard navigation
- ✅ Buy Labels page created at `/dashboard/buy-labels`
- ✅ Buy Labels form component with:
  - From/To address forms
  - Parcel details (weight, dimensions)
  - Rate selection (ready for Shippo integration)
  - Payment integration (ready for Stripe Elements)

### 4. **Database Schema**
- ✅ `LabelPurchase` type added to TypeScript definitions
- ✅ Firestore security rules updated for `labelPurchases` collection

### 5. **Placeholder Routes**
- ✅ `/api/shippo/rates` - Placeholder (needs Shippo API key)

---

## 🔧 Setup Steps

### Step 1: Get Stripe API Keys

1. **Create/Login to Stripe Account**
   - Go to https://dashboard.stripe.com/
   - Sign up or log in

2. **Get API Keys**
   - Go to **Developers** → **API keys**
   - Copy your **Publishable key** (starts with `pk_test_...` or `pk_live_...`)
   - Copy your **Secret key** (starts with `sk_test_...` or `sk_live_...`)
   - ⚠️ **Important**: Use test keys for development, live keys for production

3. **Add to Environment Variables**

   **Local Development (`.env.local`):**
   ```env
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   ```

   **Production (Vercel/Your Hosting):**
   - Go to your hosting platform's environment variables
   - Add:
     - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`
     - `STRIPE_SECRET_KEY` = `sk_live_...`

---

### Step 2: Set Up Stripe Webhook

**⚠️ Important**: You need to deploy the app first before setting up the webhook!

1. **Deploy Your Application**
   - Deploy to production (Vercel, etc.)
   - Get your production URL (e.g., `https://ims.prepservicesfba.com`)

2. **Create Webhook Endpoint in Stripe**
   - Go to Stripe Dashboard → **Developers** → **Webhooks**
   - Click **Add endpoint**
   - Enter endpoint URL: `https://yourdomain.com/api/stripe/webhook`
   - Select events to listen to:
     - ✅ `payment_intent.succeeded`
     - ✅ `payment_intent.payment_failed`
     - ✅ `payment_intent.canceled`
     - ✅ `charge.succeeded` (optional)
     - ✅ `charge.failed` (optional)
   - Click **Add endpoint**

3. **Get Webhook Secret**
   - After creating the endpoint, click on it
   - Copy the **Signing secret** (starts with `whsec_...`)
   - Add to environment variables:
     ```env
     STRIPE_WEBHOOK_SECRET=whsec_...
     ```

4. **For Local Development (Testing)**
   - Use Stripe CLI:
     ```bash
     stripe listen --forward-to localhost:3000/api/stripe/webhook
     ```
   - This will give you a webhook secret for local testing

---

### Step 3: Test the Integration

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Test Payment Flow**
   - Go to `/dashboard/buy-labels`
   - Fill in the form
   - Click "Get Shipping Rates" (will show placeholder until Shippo is set up)
   - Test payment with Stripe test card: `4242 4242 4242 4242`
   - Use any future expiry date, any CVC, any ZIP

3. **Check Webhook Events**
   - Go to Stripe Dashboard → **Developers** → **Webhooks**
   - Click on your webhook endpoint
   - View event logs to see if webhooks are being received

---

## 📋 Current Status

### ✅ Completed
- Stripe SDK installed
- Payment API routes created
- Webhook handler implemented
- UI components created
- Database schema defined
- Security rules updated

### ⏳ Pending (After Stripe Setup)
- [ ] Add Stripe API keys to environment variables
- [ ] Deploy application
- [ ] Set up webhook endpoint in Stripe
- [ ] Test payment flow
- [ ] Integrate Stripe Elements for card input (currently using basic payment)

### 🔜 Next Steps (Shippo Integration)
- [ ] Get Shippo API key
- [ ] Implement Shippo rates API
- [ ] Implement Shippo label purchase API
- [ ] Connect payment success → Shippo label purchase
- [ ] Add label download functionality

---

## 🔍 Important Notes

1. **Payment Flow**:
   - User fills form → Gets rates → Selects rate → Pays via Stripe
   - Payment success triggers webhook → System purchases label from Shippo
   - Label PDF is stored and available for download

2. **Webhook Security**:
   - Webhook signature is verified to ensure requests are from Stripe
   - Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in client-side code

3. **Test vs Live Mode**:
   - Use test keys for development
   - Switch to live keys only after thorough testing
   - Test webhooks work in both modes

4. **Error Handling**:
   - Payment failures are logged and user is notified
   - Failed payments don't trigger label purchase
   - Refund logic can be added if needed

---

## 🐛 Troubleshooting

### "Stripe failed to load"
- Check that `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set correctly
- Ensure it starts with `pk_test_` or `pk_live_`

### "Webhook signature verification failed"
- Check that `STRIPE_WEBHOOK_SECRET` is correct
- Ensure webhook URL matches exactly in Stripe dashboard
- For local testing, use Stripe CLI

### "Payment intent creation failed"
- Check that `STRIPE_SECRET_KEY` is set correctly
- Ensure it starts with `sk_test_` or `sk_live_`
- Verify API key has correct permissions

---

## 📞 Next Steps

Once Stripe is set up:
1. Test the payment flow
2. Verify webhooks are working
3. Then proceed with Shippo integration

---

**Ready to set up Stripe?** Follow the steps above and let me know when you have the API keys!


