import { NextResponse } from 'next/server';

const WISE_API_BASE_V1 = 'https://api.transferwise.com/v1';

export async function GET() {
  const hasApiKey = !!process.env.WISE_API_KEY;
  const hasProfile = !!process.env.WISE_PROFILE_ID;
  const fallback = {
    accountHolderName: !!process.env.WISE_FALLBACK_ACCOUNT_HOLDER,
    bankName: !!process.env.WISE_FALLBACK_BANK_NAME,
    accountNumber: !!process.env.WISE_FALLBACK_ACCOUNT_NUMBER,
    routingNumber: !!process.env.WISE_FALLBACK_ROUTING_NUMBER,
    iban: !!process.env.WISE_FALLBACK_IBAN,
    sortCode: !!process.env.WISE_FALLBACK_SORT_CODE,
    swift: !!process.env.WISE_FALLBACK_SWIFT,
  };

  let apiReachable = false;
  let profiles: any = null;
  if (hasApiKey) {
    try {
      const res = await fetch(`${WISE_API_BASE_V1}/profiles`, {
        headers: { Authorization: `Bearer ${process.env.WISE_API_KEY}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      apiReachable = res.ok;
      if (res.ok) {
        profiles = await res.json();
      }
    } catch (_) {}
  }

  return NextResponse.json({
    hasApiKey,
    hasProfileId: hasProfile,
    fallback,
    apiReachable,
    profileCount: Array.isArray(profiles) ? profiles.length : null,
    businessProfileFound: Array.isArray(profiles) ? !!profiles.find((p: any) => p.type === 'business') : null,
  });
}


