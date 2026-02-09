import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminFieldValue } from "@/lib/firebase-admin";
import type { ShopifySelectedVariant } from "@/types";

export const dynamic = "force-dynamic";

type ShopifyVariant = {
  id: number;
  product_id: number;
  title: string;
  sku?: string | null;
  inventory_quantity?: number;
  inventory_item_id?: number;
};

type ShopifyProduct = {
  id: number;
  title: string;
  variants: ShopifyVariant[];
};

/** PUT: Save selected variants for a connected store and sync them into user inventory. */
export async function PUT(request: NextRequest) {
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
  let shop = (body.shop as string)?.trim();
  const raw = body.selectedVariants;
  if (!shop) {
    return NextResponse.json({ error: "Missing shop" }, { status: 400 });
  }
  shop = shop.toLowerCase();
  if (!shop.includes(".myshopify.com")) {
    shop = `${shop}.myshopify.com`;
  }

  const selectedVariants: ShopifySelectedVariant[] = Array.isArray(raw)
    ? raw
        .filter(
          (v: unknown) =>
            v &&
            typeof v === "object" &&
            typeof (v as { variantId?: unknown }).variantId === "string" &&
            typeof (v as { productId?: unknown }).productId === "string" &&
            typeof (v as { title?: unknown }).title === "string"
        )
        .map((v: { variantId: string; productId: string; title: string; sku?: string }) => {
          const item: ShopifySelectedVariant = {
            variantId: v.variantId,
            productId: v.productId,
            title: v.title,
          };
          if (v.sku != null && v.sku !== "") item.sku = v.sku;
          return item;
        })
    : [];

  try {
    const db = adminDb();
    const connSnap = await db
      .collection("users")
      .doc(uid)
      .collection("shopifyConnections")
      .where("shop", "==", shop)
      .limit(1)
      .get();

    if (connSnap.empty) {
      return NextResponse.json({ error: "Store not connected" }, { status: 404 });
    }

    const accessToken = connSnap.docs[0].data().accessToken as string;
    await connSnap.docs[0].ref.update({ selectedVariants });

    const selectedIds = new Set(selectedVariants.map((v) => v.variantId));
    const FieldValue = adminFieldValue();
    const invRef = db.collection("users").doc(uid).collection("inventory");

    if (selectedVariants.length > 0 && accessToken) {
      const productsRes = await fetch(
        `https://${shop}/admin/api/2024-01/products.json?limit=250`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );
      const variantQtyMap: Record<string, { quantity: number; sku: string | null; inventoryItemId: string | null }> = {};
      if (productsRes.ok) {
        const data = (await productsRes.json()) as { products?: ShopifyProduct[] };
        for (const p of data.products ?? []) {
          for (const v of p.variants ?? []) {
            variantQtyMap[String(v.id)] = {
              quantity: typeof v.inventory_quantity === "number" ? v.inventory_quantity : 0,
              sku: v.sku ?? null,
              inventoryItemId: v.inventory_item_id != null ? String(v.inventory_item_id) : null,
            };
          }
        }
      }

      for (const v of selectedVariants) {
        const info = variantQtyMap[v.variantId] ?? { quantity: 0, sku: null, inventoryItemId: null };
        const quantity = info.quantity;
        const status = quantity > 0 ? "In Stock" : "Out of Stock";
        const docId = `shopify_${shop.replace(/\./g, "_")}_${v.variantId}`;
        const docData: Record<string, unknown> = {
          productName: v.title,
          quantity,
          status,
          dateAdded: FieldValue.serverTimestamp(),
          source: "shopify",
          shopifyVariantId: v.variantId,
          shopifyProductId: v.productId,
          shop,
        };
        if (info.inventoryItemId) docData.shopifyInventoryItemId = info.inventoryItemId;
        if (v.sku != null && v.sku !== "") docData.sku = v.sku;
        else if (info.sku) docData.sku = info.sku;
        await invRef.doc(docId).set(docData, { merge: true });
      }
    }

    const toRemove = await invRef.where("source", "==", "shopify").where("shop", "==", shop).get();
    for (const d of toRemove.docs) {
      const data = d.data();
      const vid = data.shopifyVariantId as string | undefined;
      if (vid && !selectedIds.has(vid)) await d.ref.delete();
    }

    return NextResponse.json({ success: true, count: selectedVariants.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("[shopify-selected-products PUT]", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
