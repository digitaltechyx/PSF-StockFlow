import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const SCOPES = "read_orders,read_products,write_fulfillments,read_inventory";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
    if (!uid) throw new Error("No uid");
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const code = body.code as string | undefined;
  const shop = (body.shop as string | undefined)?.trim().toLowerCase();
  if (!code || !shop) {
    return NextResponse.json(
      { error: "Missing code or shop" },
      { status: 400 }
    );
  }
  const normalizedShop = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;

  const clientId = process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Shopify app not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`https://${normalizedShop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[Shopify exchange-token]", res.status, text);
      return NextResponse.json(
        { error: "Failed to exchange code with Shopify" },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { access_token?: string };
    const accessToken = data.access_token;
    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token in Shopify response" },
        { status: 502 }
      );
    }

    const db = adminDb();
    const col = db.collection("users").doc(uid).collection("shopifyConnections");
    const snapshot = await col.where("shop", "==", normalizedShop).limit(1).get();
    const connectedAt = new Date();
    const docData = {
      shop: normalizedShop,
      shopName: normalizedShop.replace(".myshopify.com", ""),
      accessToken,
      connectedAt: { seconds: Math.floor(connectedAt.getTime() / 1000), nanoseconds: 0 },
    };
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update(docData);
    } else {
      await col.add(docData);
    }

    return NextResponse.json({ success: true, shop: normalizedShop });
  } catch (err: unknown) {
    console.error("[Shopify exchange-token]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
