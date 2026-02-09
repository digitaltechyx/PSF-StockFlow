import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * POST: Shopify webhooks (e.g. inventory_levels/update).
 * Verify X-Shopify-Hmac-Sha256, then update PSF inventory for matching docs.
 * Register this URL in Shopify admin: https://your-domain.com/api/shopify/webhooks
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const topic = request.headers.get("x-shopify-topic");
  const shop = request.headers.get("x-shopify-shop-domain")?.toLowerCase();

  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) {
    console.error("[Shopify webhooks] SHOPIFY_CLIENT_SECRET not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (!hmac || !shop) {
    return NextResponse.json({ error: "Missing headers" }, { status: 401 });
  }

  const computed = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  if (computed !== hmac) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const shopNorm = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;

  if (topic === "inventory_levels/update") {
    const raw = payload as Record<string, unknown>;
    const data = (raw?.inventory_level as Record<string, unknown>) ?? raw;
    const inventoryItemId = data.inventory_item_id;
    const available = data.available != null ? Number(data.available) : 0;
    if (inventoryItemId == null) {
      return NextResponse.json({ error: "Missing inventory_item_id" }, { status: 400 });
    }
    const idStr = String(inventoryItemId);

    try {
      const db = adminDb();
      const invSnap = await db
        .collectionGroup("inventory")
        .where("source", "==", "shopify")
        .where("shop", "==", shopNorm)
        .where("shopifyInventoryItemId", "==", idStr)
        .get();
      const status = available > 0 ? "In Stock" : "Out of Stock";
      for (const doc of invSnap.docs) {
        await doc.ref.update({ quantity: available, status });
      }
    } catch (err: unknown) {
      console.error("[Shopify webhooks inventory_levels/update]", err);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
