import { NextRequest, NextResponse } from 'next/server';

// NOTE: Wise does not provide a hosted checkout link API.
// For receiving payments, typical approach is to expose your account/balance bank details
// and reconcile inbound payments via webhooks. This endpoint is a placeholder to return a
// deep-link to a payment instructions page within the app.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceId, amount, currency = 'USD' } = body || {};

    if (!invoiceId || !amount) {
      return NextResponse.json({ error: 'Missing invoiceId or amount' }, { status: 400 });
    }

    // Return a link to our in-app payment instructions page
    const url = `/dashboard/invoice/${encodeURIComponent(invoiceId)}/pay?amount=${encodeURIComponent(amount)}&currency=${encodeURIComponent(currency)}`;
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 });
  }
}


