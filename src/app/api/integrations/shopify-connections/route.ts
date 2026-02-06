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
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const ref = adminDb()
      .collection("users")
      .doc(uid)
      .collection("shopifyConnections")
      .doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[shopify-connections DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
