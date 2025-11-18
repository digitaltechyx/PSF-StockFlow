import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { adminDb, adminFieldValue } from '@/lib/firebase-admin';
import type { LabelPurchase } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      amount, // Amount in cents
      currency = 'usd',
      fromAddress,
      toAddress,
      parcel,
      selectedRate,
      shippedItemId,
    } = body;

    // Validate required fields
    if (!userId || !amount || !fromAddress || !toAddress || !parcel || !selectedRate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate amount (must be positive)
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Get Stripe instance (lazy initialization)
    const stripe = getStripe();

    // Create payment intent in Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Ensure it's an integer (cents)
      currency: currency.toLowerCase(),
      metadata: {
        userId,
        fromAddress: JSON.stringify(fromAddress),
        toAddress: JSON.stringify(toAddress),
        parcel: JSON.stringify(parcel),
        selectedRate: JSON.stringify(selectedRate),
        shipmentId: selectedRate.shipmentId || '',
        shippedItemId: shippedItemId || '',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create label purchase record in Firestore
    const labelPurchaseData: Omit<LabelPurchase, 'id' | 'createdAt'> = {
      userId,
      purchasedBy: userId,
      fromAddress,
      toAddress,
      parcel,
      selectedRate,
      stripePaymentIntentId: paymentIntent.id,
      paymentStatus: 'pending',
      paymentAmount: amount,
      paymentCurrency: currency,
      status: 'payment_pending',
      ...(shippedItemId && { shippedItemId }),
    };

    const docRef = await adminDb()
      .collection(`users/${userId}/labelPurchases`)
      .add({
        ...labelPurchaseData,
        createdAt: adminFieldValue().serverTimestamp(),
      });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      labelPurchaseId: docRef.id,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create payment intent',
        details: error.message 
      },
      { status: 500 }
    );
  }
}


