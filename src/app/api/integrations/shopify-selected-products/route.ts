import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { ShopifySelectedVariant } from "@/types";

export const dynamic = "force-dynamic";

/** PUT: Save selected variants for a connected store. Body: { shop: string, selectedVariants: ShopifySelectedVariant[] } */
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
    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("shopifyConnections")
      .where("shop", "==", shop)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "Store not connected" }, { status: 404 });
    }

    await snapshot.docs[0].ref.update({ selectedVariants });
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
