import { NextRequest, NextResponse } from 'next/server';

const SHIPPO_API_BASE = 'https://api.goshippo.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromAddress, toAddress, parcel } = body;

    // Validate required fields
    if (!fromAddress || !toAddress || !parcel) {
      return NextResponse.json(
        { error: 'Missing required fields: fromAddress, toAddress, parcel' },
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

    // Prepare Shippo address format
    const shippoFromAddress = {
      name: fromAddress.name,
      street1: fromAddress.street1,
      street2: fromAddress.street2 || '',
      city: fromAddress.city,
      state: fromAddress.state,
      zip: fromAddress.zip,
      country: fromAddress.country,
      phone: fromAddress.phone || '',
      email: fromAddress.email || '',
    };

    const shippoToAddress = {
      name: toAddress.name,
      street1: toAddress.street1,
      street2: toAddress.street2 || '',
      city: toAddress.city,
      state: toAddress.state,
      zip: toAddress.zip,
      country: toAddress.country,
      phone: toAddress.phone || '',
      email: toAddress.email || '',
    };

    // Prepare parcel dimensions
    const shippoParcel = {
      length: parcel.length.toString(),
      width: parcel.width.toString(),
      height: parcel.height.toString(),
      distance_unit: parcel.distanceUnit,
      weight: parcel.weight.toString(),
      mass_unit: parcel.weightUnit,
    };

    // Create shipment in Shippo
    const shipmentResponse = await fetch(`${SHIPPO_API_BASE}/shipments/`, {
      method: 'POST',
      headers: {
        'Authorization': `ShippoToken ${process.env.SHIPPO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address_from: shippoFromAddress,
        address_to: shippoToAddress,
        parcels: [shippoParcel],
        async: false,
      }),
    });

    if (!shipmentResponse.ok) {
      const errorData = await shipmentResponse.json();
      console.error('Shippo shipment creation error:', errorData);
      return NextResponse.json(
        { 
          error: 'Failed to create shipment',
          details: errorData.detail || errorData.message || 'Unknown error'
        },
        { status: shipmentResponse.status }
      );
    }

    const shipment = await shipmentResponse.json();

    // Get rates for the shipment
    const ratesResponse = await fetch(`${SHIPPO_API_BASE}/shipments/${shipment.object_id}/rates/`, {
      method: 'GET',
      headers: {
        'Authorization': `ShippoToken ${process.env.SHIPPO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!ratesResponse.ok) {
      const errorData = await ratesResponse.json();
      console.error('Shippo rates error:', errorData);
      return NextResponse.json(
        { 
          error: 'Failed to get rates',
          details: errorData.detail || errorData.message || 'Unknown error'
        },
        { status: ratesResponse.status }
      );
    }

    const ratesData = await ratesResponse.json();
    const rates = Array.isArray(ratesData.results) ? ratesData.results : ratesData;

    // Format rates for frontend and add 15 cents admin markup
    const ADMIN_MARKUP = 0.15; // 15 cents admin profit
    const formattedRates = rates.map((rate: any) => {
      const baseAmount = parseFloat(rate.amount) || 0;
      const markedUpAmount = (baseAmount + ADMIN_MARKUP).toFixed(2);
      
      return {
        object_id: rate.object_id,
        amount: markedUpAmount, // Amount with 10 cents markup
        originalAmount: rate.amount, // Store original amount for Shippo purchase
        currency: rate.currency,
        provider: rate.provider,
        servicelevel: {
          name: rate.servicelevel?.name || rate.servicelevel_name || 'Standard',
          token: rate.servicelevel?.token || rate.servicelevel_token || '',
        },
        estimated_days: rate.estimated_days,
        shipment: shipment.object_id, // Store shipment ID for label purchase
      };
    });

    return NextResponse.json({
      rates: formattedRates,
      shipment_id: shipment.object_id,
    });

  } catch (error: any) {
    console.error('Error getting shipping rates:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get shipping rates',
        details: error.message 
      },
      { status: 500 }
    );
  }
}


