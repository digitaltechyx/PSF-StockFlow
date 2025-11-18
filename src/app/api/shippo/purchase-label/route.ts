import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminFieldValue } from '@/lib/firebase-admin';

const SHIPPO_API_BASE = 'https://api.goshippo.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rateId, shipmentId, labelPurchaseId, userId } = body;

    // Validate required fields
    if (!rateId || !shipmentId || !labelPurchaseId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: rateId, shipmentId, labelPurchaseId, userId' },
        { status: 400 }
      );
    }

    if (!process.env.SHIPPO_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Shippo API key not configured',
          hint: 'Please add SHIPPO_API_KEY to your environment variables'
        },
        { status: 500 }
      );
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
      const labelPurchaseRef = adminDb()
        .collection(`users/${userId}/labelPurchases`)
        .doc(labelPurchaseId);
      await labelPurchaseRef.update({
        status: 'label_failed',
        errorMessage: errorData.detail || errorData.message || 'Failed to purchase label',
      });

      return NextResponse.json(
        { 
          error: 'Failed to purchase label',
          details: errorData.detail || errorData.message || 'Unknown error'
        },
        { status: transactionResponse.status }
      );
    }

    const transaction = await transactionResponse.json();

    // Update label purchase record with Shippo transaction details
    const labelPurchaseRef = adminDb()
      .collection(`users/${userId}/labelPurchases`)
      .doc(labelPurchaseId);
    await labelPurchaseRef.update({
      status: 'label_purchased',
      shippoTransactionId: transaction.object_id,
      trackingNumber: transaction.tracking_number || null,
      labelUrl: transaction.label_url || null,
      labelPurchasedAt: adminFieldValue().serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      transaction_id: transaction.object_id,
      tracking_number: transaction.tracking_number,
      label_url: transaction.label_url,
      status: transaction.status,
    });

  } catch (error: any) {
    console.error('Error purchasing label:', error);
    return NextResponse.json(
      { 
        error: 'Failed to purchase label',
        details: error.message 
      },
      { status: 500 }
    );
  }
}



