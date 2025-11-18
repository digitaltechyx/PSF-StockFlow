import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import Stripe from 'stripe';

const SHIPPO_API_BASE = 'https://api.goshippo.com';

async function purchaseLabelFromShippo({
  rateId,
  shipmentId,
  labelPurchaseId,
  userId,
}: {
  rateId: string;
  shipmentId: string;
  labelPurchaseId: string;
  userId: string;
}) {
  try {
    if (!process.env.SHIPPO_API_KEY) {
      throw new Error('Shippo API key not configured');
    }

    // Purchase label from Shippo
    const transactionResponse = await fetch(`${SHIPPO_API_BASE}/transactions/`, {
      method: 'POST',
      headers: {
        'Authorization': `ShippoToken ${process.env.SHIPPO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rate: rateId,
        async: false,
      }),
    });

    if (!transactionResponse.ok) {
      const errorData = await transactionResponse.json();
      console.error('Shippo label purchase error:', errorData);
      
      // Update label purchase record with error
      const labelPurchaseRef = doc(db, `users/${userId}/labelPurchases`, labelPurchaseId);
      await updateDoc(labelPurchaseRef, {
        status: 'label_failed',
        errorMessage: errorData.detail || errorData.message || 'Failed to purchase label',
      });
      return;
    }

    const transaction = await transactionResponse.json();

    // Update label purchase record with Shippo transaction details
    const labelPurchaseRef = doc(db, `users/${userId}/labelPurchases`, labelPurchaseId);
    await updateDoc(labelPurchaseRef, {
      status: 'label_purchased',
      shippoTransactionId: transaction.object_id,
      trackingNumber: transaction.tracking_number || null,
      labelUrl: transaction.label_url || null,
      labelPurchasedAt: new Date(),
    });

    console.log(`Label purchased successfully: ${transaction.object_id}`);
  } catch (error: any) {
    console.error('Error purchasing label:', error);
    const labelPurchaseRef = doc(db, `users/${userId}/labelPurchases`, labelPurchaseId);
    await updateDoc(labelPurchaseRef, {
      status: 'label_failed',
      errorMessage: error.message || 'Error purchasing label',
    });
  }
}

// Disable body parsing, need raw body for webhook signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set in environment variables');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  // Get Stripe instance (lazy initialization)
  const stripe = getStripe();

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

  const labelPurchaseData = labelPurchaseDoc.data();
  const selectedRate = labelPurchaseData.selectedRate;

  // Purchase label from Shippo
  if (selectedRate?.objectId) {
    try {
      // Get shipment ID from metadata or from the rate
      const shipmentId = paymentIntent.metadata?.shipmentId || selectedRate.shipmentId;
      
      if (!shipmentId) {
        console.error('No shipment ID found for label purchase');
        await updateDoc(labelPurchaseRef, {
          status: 'label_failed',
          errorMessage: 'Shipment ID not found',
        });
        return;
      }

      // Purchase label from Shippo directly
      await purchaseLabelFromShippo({
        rateId: selectedRate.objectId,
        shipmentId: shipmentId,
        labelPurchaseId: labelPurchaseDoc.id,
        userId: userId,
      });
    } catch (error: any) {
      console.error('Error purchasing label:', error);
      await updateDoc(labelPurchaseRef, {
        status: 'label_failed',
        errorMessage: error.message || 'Error purchasing label',
      });
    }
  } else {
    console.error('No rate ID found in label purchase data');
    await updateDoc(labelPurchaseRef, {
      status: 'label_failed',
      errorMessage: 'Rate ID not found',
    });
  }
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


