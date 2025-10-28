import { NextRequest, NextResponse } from 'next/server';

const WISE_API_BASE = 'https://api.transferwise.com/v4';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currency = (searchParams.get('currency') || 'USD').toUpperCase();

    const apiKey = process.env.WISE_API_KEY;
    const profileId = process.env.WISE_PROFILE_ID;

    if (!apiKey || !profileId) {
      return NextResponse.json({ error: 'Wise API not configured' }, { status: 500 });
    }

    // 1) Get balances for the profile
    const balancesRes = await fetch(`${WISE_API_BASE}/profiles/${profileId}/balances?types=STANDARD`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!balancesRes.ok) {
      const text = await balancesRes.text();
      return NextResponse.json({ error: 'Failed to fetch balances', details: text }, { status: 500 });
    }
    const balances = await balancesRes.json();
    const balance = (Array.isArray(balances) ? balances : []).find((b: any) => b.currency === currency);
    if (!balance) {
      return NextResponse.json({ error: `No ${currency} balance found` }, { status: 404 });
    }

    // 2) Get bank details for the balance
    const bankRes = await fetch(`${WISE_API_BASE}/profiles/${profileId}/balances/${balance.id}/bank-details`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    if (!bankRes.ok) {
      const text = await bankRes.text();
      return NextResponse.json({ error: 'Failed to fetch bank details', details: text }, { status: 500 });
    }
    const bankDetails = await bankRes.json();

    // Normalize fields for UI
    const details = {
      accountHolderName: bankDetails?.accountHolderName || null,
      bankName: bankDetails?.bankName || null,
      accountNumber: bankDetails?.accountNumber || bankDetails?.accountNumberType || null,
      routingNumber: bankDetails?.routingNumber || bankDetails?.achRoutingNumber || null,
      iban: bankDetails?.IBAN || bankDetails?.iban || null,
      sortCode: bankDetails?.sortCode || null,
      swift: bankDetails?.swift || bankDetails?.bic || null,
      currency,
    };

    return NextResponse.json({ details });
  } catch (error: any) {
    console.error('Wise deposit details error:', error);
    return NextResponse.json({ error: 'Failed to fetch deposit details' }, { status: 500 });
  }
}


