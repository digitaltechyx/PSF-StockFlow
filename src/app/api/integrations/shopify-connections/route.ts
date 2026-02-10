import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/** GET: list current user's Shopify connections (no access token). */
export async function GET(request: NextRequest) {
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

  try {
    const snapshot = await adminDb()
      .collection("users")
      .doc(uid)
      .collection("shopifyConnections")
      .get();
    const list = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        shop: data.shop,
        shopName: data.shopName ?? data.shop?.replace(".myshopify.com", "") ?? "",
        connectedAt: data.connectedAt,
        selectedVariants: data.selectedVariants ?? [],
      };
    });
    return NextResponse.json({ connections: list });
  } catch (err: unknown) {
    console.error("[shopify-connections GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

/** DELETE: remove one connection. Query param id = doc id. */
export async function DELETE(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const removeInventory = searchParams.get("removeInventory") === "true";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const db = adminDb();
    const ref = db.collection("users").doc(uid).collection("shopifyConnections").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    const data = doc.data()!;
    let shopNorm: string | null = (data.shop as string)?.trim() || null;
    if (shopNorm && !shopNorm.includes(".myshopify.com")) {
      shopNorm = `${shopNorm}.myshopify.com`;
    }

    await ref.delete();

    // Remove shop → user mapping so order webhooks don't route to this user
    if (shopNorm) {
      const shopKey = shopNorm.replace(/\./g, "_");
      try {
        await db.collection("shopifyShopToUser").doc(shopKey).delete();
      } catch (e) {
        console.warn("[shopify-connections DELETE] shopToUser delete failed", e);
      }
    }

    let removedInventoryCount = 0;
    if (removeInventory && shopNorm) {
      const invSnap = await db
        .collection("users")
        .doc(uid)
        .collection("inventory")
        .where("source", "==", "shopify")
        .where("shop", "==", shopNorm)
        .get();
      const batch = db.batch();
      invSnap.docs.forEach((d) => batch.delete(d.ref));
      if (invSnap.docs.length > 0) {
        await batch.commit();
        removedInventoryCount = invSnap.docs.length;
      }
    }

    return NextResponse.json({ success: true, removedInventoryCount });
  } catch (err: unknown) {
    console.error("[shopify-connections DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
