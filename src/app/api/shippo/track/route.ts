import { NextRequest, NextResponse } from "next/server";

const SHIPPO_API_BASE = "https://api.goshippo.com";

export async function POST(request: NextRequest) {
  // Handle CORS for WordPress site
  const origin = request.headers.get("origin");
  const allowedOrigins = [
    "https://prepservicesfba.com",
    "https://www.prepservicesfba.com",
    "http://localhost:3000", // For local testing
  ];
  
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (origin && allowedOrigins.includes(origin)) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
  }

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { trackingNumber, carrier } = body;

    if (!trackingNumber) {
      return NextResponse.json(
        { error: "Missing required field: trackingNumber" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!process.env.SHIPPO_API_KEY) {
      return NextResponse.json(
        {
          error: "Shippo API key not configured",
          hint: "Please add SHIPPO_API_KEY to your environment variables",
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Map carrier to Shippo carrier code when provided
    let carrierCode: string | undefined;
    if (carrier) {
      switch (carrier.toLowerCase()) {
        case "usps":
          carrierCode = "usps";
          break;
        case "ups":
          carrierCode = "ups";
          break;
        case "fedex":
          carrierCode = "fedex";
          break;
        case "dhl":
          carrierCode = "dhl_express";
          break;
        default:
          carrierCode = undefined;
      }
    }

    // Shippo tracking endpoint format: /tracks/{carrier}/{tracking_number}/
    // Carrier is required for this endpoint, so fall back to usps if not provided
    const effectiveCarrier = carrierCode || "usps";

    const url = `${SHIPPO_API_BASE}/tracks/${encodeURIComponent(
      effectiveCarrier
    )}/${encodeURIComponent(trackingNumber)}/`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Shippo tracking error:", errorData);
      return NextResponse.json(
        {
          error: "Failed to get tracking information",
          details:
            (errorData as any).detail ||
            (errorData as any).message ||
            "Unknown error",
        },
        { status: response.status, headers: corsHeaders }
      );
    }

    const trackingData = await response.json();

    return NextResponse.json(
      {
        success: true,
        tracking: trackingData,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Error getting tracking info:", error);
    return NextResponse.json(
      {
        error: "Failed to get tracking information",
        details: error.message || "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}


