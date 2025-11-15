import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import Stripe from 'stripe';

// Disable body parsing, need raw body for webhook signature verification
export const runtime = 'nodejs';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables');
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(paymentIntent);
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentCanceled(paymentIntent);
        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object as Stripe.Charge;
        // Additional confirmation, but payment_intent.succeeded is primary
        break;
      }

      case 'charge.failed': {
        const charge = event.data.object as Stripe.Charge;
        // Additional confirmation, but payment_intent.payment_failed is primary
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  const userId = paymentIntent.metadata?.userId;

  if (!userId) {
    console.error('No userId in payment intent metadata');
    return;
  }

  // Find the label purchase record
  const labelPurchasesRef = collection(db, `users/${userId}/labelPurchases`);
  const q = query(
    labelPurchasesRef,
    where('stripePaymentIntentId', '==', paymentIntentId)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.error(`No label purchase found for payment intent: ${paymentIntentId}`);
    return;
  }

  const labelPurchaseDoc = snapshot.docs[0];
  const labelPurchaseRef = doc(db, `users/${userId}/labelPurchases`, labelPurchaseDoc.id);

  // Update label purchase with payment success
  await updateDoc(labelPurchaseRef, {
    paymentStatus: 'succeeded',
    status: 'payment_succeeded',
    stripeChargeId: paymentIntent.latest_charge as string,
    paymentCompletedAt: new Date(),
  });

  // TODO: After Shippo integration, trigger label purchase here
  // For now, we'll mark it as ready for label purchase
  console.log(`Payment succeeded for label purchase: ${labelPurchaseDoc.id}`);
  console.log('Ready to purchase label from Shippo');
  
  // Note: We'll add Shippo label purchase logic after Shippo setup
  // This will be called from the webhook or a separate API endpoint
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  const userId = paymentIntent.metadata?.userId;

  if (!userId) {
    console.error('No userId in payment intent metadata');
    return;
  }

  // Find the label purchase record
  const labelPurchasesRef = collection(db, `users/${userId}/labelPurchases`);
  const q = query(
    labelPurchasesRef,
    where('stripePaymentIntentId', '==', paymentIntentId)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.error(`No label purchase found for payment intent: ${paymentIntentId}`);
    return;
  }

  const labelPurchaseDoc = snapshot.docs[0];
  const labelPurchaseRef = doc(db, `users/${userId}/labelPurchases`, labelPurchaseDoc.id);

  // Update label purchase with payment failure
  await updateDoc(labelPurchaseRef, {
    paymentStatus: 'failed',
    status: 'payment_pending', // Keep as pending so user can retry
    errorMessage: paymentIntent.last_payment_error?.message || 'Payment failed',
  });

  console.log(`Payment failed for label purchase: ${labelPurchaseDoc.id}`);
}

async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;
  const userId = paymentIntent.metadata?.userId;

  if (!userId) {
    console.error('No userId in payment intent metadata');
    return;
  }

  // Find the label purchase record
  const labelPurchasesRef = collection(db, `users/${userId}/labelPurchases`);
  const q = query(
    labelPurchasesRef,
    where('stripePaymentIntentId', '==', paymentIntentId)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.error(`No label purchase found for payment intent: ${paymentIntentId}`);
    return;
  }

  const labelPurchaseDoc = snapshot.docs[0];
  const labelPurchaseRef = doc(db, `users/${userId}/labelPurchases`, labelPurchaseDoc.id);

  // Update label purchase with payment canceled
  await updateDoc(labelPurchaseRef, {
    paymentStatus: 'canceled',
    status: 'payment_pending', // Keep as pending so user can retry
    errorMessage: 'Payment was canceled',
  });

  console.log(`Payment canceled for label purchase: ${labelPurchaseDoc.id}`);
}


