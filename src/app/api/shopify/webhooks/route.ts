import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/** GET: Test that the webhook URL is reachable (e.g. open in browser). Shopify sends POST only. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Shopify webhook endpoint. POST only (inventory_levels/update, products/update, products/delete).",
  });
}

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
    console.log("[Shopify webhooks] received inventory_levels/update", { shop: shopNorm });
    const raw = payload as Record<string, unknown>;
    const data = (raw?.inventory_level as Record<string, unknown>) ?? raw;
    const available = data.available != null ? Number(data.available) : 0;
    // Prefer extracting inventory_item_id from raw body as string to avoid JS number precision loss (Shopify IDs can be > 2^53)
    let idStr: string | null = null;
    const idMatch = rawBody.match(/"inventory_item_id"\s*:\s*"?(\d+)"?/);
    if (idMatch) idStr = idMatch[1];
    if (!idStr) {
      const fromPayload = data.inventory_item_id;
      if (fromPayload != null) idStr = String(fromPayload);
    }
    if (!idStr) {
      console.warn("[Shopify webhooks] inventory_levels/update missing inventory_item_id", { shop: shopNorm });
      return NextResponse.json({ error: "Missing inventory_item_id" }, { status: 400 });
    }

    try {
      const db = adminDb();
      const lookupRef = db.collection("shopifyInventoryLookup");
      const status = available > 0 ? "In Stock" : "Out of Stock";

      const lookupId = `${shopNorm.replace(/\./g, "_")}_${idStr}`;
      let lookupSnap = await lookupRef.doc(lookupId).get();
      if (!lookupSnap.exists) {
        const roundedId = String(Number(idStr));
        if (roundedId !== idStr) {
          const altLookupId = `${shopNorm.replace(/\./g, "_")}_${roundedId}`;
          lookupSnap = await lookupRef.doc(altLookupId).get();
        }
      }

      if (!lookupSnap.exists) {
        console.warn("[Shopify webhooks] inventory_levels/update no lookup doc — re-save product selection in Integrations → Manage products", {
          shop: shopNorm,
          shopifyInventoryItemId: idStr,
          available,
        });
      } else {
        const lookup = lookupSnap.data()!;
        const path = lookup.inventoryPath as string;
        if (path) {
          await db.doc(path).update({ quantity: available, status });
          console.log("[Shopify webhooks] inventory_levels/update OK", {
            shop: shopNorm,
            shopifyInventoryItemId: idStr,
            available,
          });
        } else {
          console.warn("[Shopify webhooks] lookup doc missing inventoryPath", { lookupId });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Shopify webhooks inventory_levels/update]", msg, err);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  if (topic === "products/delete") {
    const raw = payload as Record<string, unknown>;
    const productObj = raw?.product as Record<string, unknown> | undefined;
    const productId = (productObj?.id ?? raw?.id) != null ? String(productObj?.id ?? raw?.id) : null;
    if (!productId) {
      console.warn("[Shopify webhooks] products/delete missing id", { shop: shopNorm });
      return NextResponse.json({ received: true });
    }
    try {
      const db = adminDb();
      const productLookupRef = db.collection("shopifyProductLookup");
      const lookupRef = db.collection("shopifyInventoryLookup");
      const plId = `${shopNorm.replace(/\./g, "_")}_${productId}`;
      const plSnap = await productLookupRef.doc(plId).get();
      if (!plSnap.exists) {
        console.log("[Shopify webhooks] products/delete no product lookup", { shop: shopNorm, productId });
        return NextResponse.json({ received: true });
      }
      const pl = plSnap.data()!;
      const paths = (pl.paths as string[]) || [];
      const lookupIds = (pl.lookupIds as string[]) || [];
      for (const path of paths) {
        try {
          await db.doc(path).delete();
        } catch (e) {
          console.warn("[Shopify webhooks] products/delete could not delete doc", path, e);
        }
      }
      for (const lid of lookupIds) {
        try {
          await lookupRef.doc(lid).delete();
        } catch (e) {
          console.warn("[Shopify webhooks] products/delete could not delete lookup", lid, e);
        }
      }
      await productLookupRef.doc(plId).delete();
      console.log("[Shopify webhooks] products/delete OK", { shop: shopNorm, productId, removed: paths.length });
    } catch (err: unknown) {
      console.error("[Shopify webhooks products/delete]", err);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  if (topic === "products/update") {
    const raw = payload as Record<string, unknown>;
    const product = (raw?.product as Record<string, unknown>) ?? raw;
    const productId = product?.id != null ? String(product.id) : null;
    const title = typeof product?.title === "string" ? product.title.trim() : null;
    if (!productId) {
      console.warn("[Shopify webhooks] products/update missing product id", { shop: shopNorm });
      return NextResponse.json({ received: true });
    }
    if (!title) return NextResponse.json({ received: true });
    try {
      const db = adminDb();
      const productLookupRef = db.collection("shopifyProductLookup");
      const plId = `${shopNorm.replace(/\./g, "_")}_${productId}`;
      const plSnap = await productLookupRef.doc(plId).get();
      if (!plSnap.exists) {
        console.log("[Shopify webhooks] products/update no product lookup", { shop: shopNorm, productId });
        return NextResponse.json({ received: true });
      }
      const pl = plSnap.data()!;
      const paths = (pl.paths as string[]) || [];
      for (const path of paths) {
        try {
          await db.doc(path).update({ productName: title });
        } catch (e) {
          console.warn("[Shopify webhooks] products/update could not update doc", path, e);
        }
      }
      console.log("[Shopify webhooks] products/update OK", { shop: shopNorm, productId, title, updated: paths.length });
    } catch (err: unknown) {
      console.error("[Shopify webhooks products/update]", err);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
