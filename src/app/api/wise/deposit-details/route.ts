import { NextRequest, NextResponse } from 'next/server';

const WISE_API_BASE = 'https://api.transferwise.com/v4';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currency = (searchParams.get('currency') || 'USD').toUpperCase();

    const apiKey = process.env.WISE_API_KEY;
    let profileId = process.env.WISE_PROFILE_ID;
    const fallback = {
      accountHolderName: process.env.WISE_FALLBACK_ACCOUNT_HOLDER || null,
      bankName: process.env.WISE_FALLBACK_BANK_NAME || null,
      accountNumber: process.env.WISE_FALLBACK_ACCOUNT_NUMBER || null,
      routingNumber: process.env.WISE_FALLBACK_ROUTING_NUMBER || null,
      iban: process.env.WISE_FALLBACK_IBAN || null,
      sortCode: process.env.WISE_FALLBACK_SORT_CODE || null,
      swift: process.env.WISE_FALLBACK_SWIFT || null,
      currency,
    };

    if (!apiKey) {
      if (Object.values(fallback).some(Boolean)) {
        return NextResponse.json({ details: fallback });
      }
      return NextResponse.json({ error: 'Wise API not configured' }, { status: 500 });
    }

    // Resolve profile id automatically when not provided or not numeric
    if (!profileId || !/^\d+$/.test(profileId)) {
      const profilesRes = await fetch(`${WISE_API_BASE.replace('/v4','')}/v1/profiles`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (profilesRes.ok) {
        const profiles = await profilesRes.json();
        const business = Array.isArray(profiles) ? profiles.find((p: any) => p.type === 'business') : null;
        const chosen = business || (Array.isArray(profiles) ? profiles[0] : null);
        if (chosen?.id) profileId = String(chosen.id);
      }
      if (!profileId) {
        if (Object.values(fallback).some(Boolean)) {
          return NextResponse.json({ details: fallback });
        }
        return NextResponse.json({ error: 'Unable to resolve Wise profile id' }, { status: 500 });
      }
    }

    // 1) Get balances for the profile
    const balancesRes = await fetch(`${WISE_API_BASE}/profiles/${profileId}/balances?types=STANDARD`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!balancesRes.ok) {
      if (Object.values(fallback).some(Boolean)) {
        return NextResponse.json({ details: fallback });
      }
      const text = await balancesRes.text();
      return NextResponse.json({ error: 'Failed to fetch balances', details: text }, { status: 500 });
    }
    const balances = await balancesRes.json();
    const balance = (Array.isArray(balances) ? balances : []).find((b: any) => b.currency === currency);
    if (!balance) {
      if (Object.values(fallback).some(Boolean)) {
        return NextResponse.json({ details: fallback });
      }
      return NextResponse.json({ error: `No ${currency} balance found` }, { status: 404 });
    }

    // 2) Get bank details for the balance
    const bankRes = await fetch(`${WISE_API_BASE}/profiles/${profileId}/balances/${balance.id}/bank-details`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!bankRes.ok) {
      if (Object.values(fallback).some(Boolean)) {
        return NextResponse.json({ details: fallback });
      }
      const text = await bankRes.text();
      return NextResponse.json({ error: 'Failed to fetch bank details', details: text }, { status: 500 });
    }
    const bankDetails = await bankRes.json();

    // Wise may return details nested under `details` or `bankDetails`
    const d = bankDetails?.details || bankDetails?.bankDetails || bankDetails || {};

    // Normalize fields for UI
    const details = {
      accountHolderName: d.accountHolderName || bankDetails?.accountHolderName || null,
      bankName: d.bankName || bankDetails?.bankName || null,
      accountNumber: d.accountNumber || d.account || d.clabe || null,
      routingNumber: d.routingNumber || d.achRoutingNumber || d.routing || null,
      iban: d.IBAN || d.iban || null,
      sortCode: d.sortCode || null,
      swift: d.swift || d.bic || d.swiftCode || null,
      currency,
    };

    return NextResponse.json({ details });
  } catch (error: any) {
    console.error('Wise deposit details error:', error);
    const currency = 'USD';
    const fallback = {
      accountHolderName: process.env.WISE_FALLBACK_ACCOUNT_HOLDER || null,
      bankName: process.env.WISE_FALLBACK_BANK_NAME || null,
      accountNumber: process.env.WISE_FALLBACK_ACCOUNT_NUMBER || null,
      routingNumber: process.env.WISE_FALLBACK_ROUTING_NUMBER || null,
      iban: process.env.WISE_FALLBACK_IBAN || null,
      sortCode: process.env.WISE_FALLBACK_SORT_CODE || null,
      swift: process.env.WISE_FALLBACK_SWIFT || null,
      currency,
    };
    if (Object.values(fallback).some(Boolean)) {
      return NextResponse.json({ details: fallback });
    }
    return NextResponse.json({ error: 'Failed to fetch deposit details' }, { status: 500 });
  }
}


