/**
 * API Route: Generate Monthly Storage Invoices
 * Generates storage invoices for all users with storage pricing configured
 * Should be called monthly (e.g., on the 1st of each month)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { format } from "date-fns";
import { generateInvoiceNumber } from "@/lib/invoice-utils";

const CRON_SECRET = process.env.INVOICE_CRON_SECRET || process.env.CRON_SECRET;

function isAuthorized(request: NextRequest): boolean {
  if (!CRON_SECRET) return true;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${CRON_SECRET}`) return true;

  const url = new URL(request.url);
  const secretParam = url.searchParams.get("secret");
  return secretParam === CRON_SECRET;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Handle both GET (for testing) and POST (for cron)
export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = adminDb();
    const url = new URL(request.url);
    const userIdParam = url.searchParams.get("userId") || undefined;
    const monthParam = url.searchParams.get("month") || undefined; // YYYY-MM
    const isTest = ["1", "true", "yes"].includes((url.searchParams.get("test") || "").toLowerCase());
    const force = ["1", "true", "yes"].includes((url.searchParams.get("force") || "").toLowerCase());

    const now = new Date();
    let monthDate = now;
    let invoiceMonthBase = format(now, "yyyy-MM");
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map((v) => Number(v));
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        monthDate = new Date(y, m - 1, 1);
        invoiceMonthBase = monthParam;
      }
    }

    const invoiceMonthForDoc = isTest
      ? `${invoiceMonthBase}-test-${format(now, "yyyyMMdd-HHmmss")}`
      : invoiceMonthBase;

    const usersSnapshot = userIdParam
      ? await db.collection("users").where("__name__", "==", userIdParam).get()
      : await db.collection("users").get();
    const results: Array<Record<string, unknown>> = [];
    const today = now;
    const firstDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const lastDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data() || {};

      // Skip if user is deleted or not approved
      if (userData.status === "deleted" || (userData.status && userData.status !== "approved")) {
        results.push({ userId, status: "skipped_user_not_approved" });
        continue;
      }

      // Get user's storage type
      const storageType = userData.storageType;
      if (!storageType) {
        results.push({ userId, status: "skipped_no_storage_type" });
        continue;
      }

      // Get user's storage pricing
      const storagePricingSnapshot = await db
        .collection(`users/${userId}/storagePricing`)
        .limit(1)
        .get();

      if (storagePricingSnapshot.empty) {
        results.push({ userId, status: "skipped_no_storage_pricing" });
        continue;
      }

      const storagePricing = storagePricingSnapshot.docs[0].data();
      const price = storagePricing.price;

      if (!price || price <= 0) {
        results.push({ userId, status: "skipped_invalid_price" });
        continue;
      }

      // Check if invoice already exists for this month
      if (!force && !isTest) {
        const existingInvoicesSnapshot = await db
          .collection(`users/${userId}/invoices`)
          .where("type", "==", "storage")
          .where("invoiceMonth", "==", invoiceMonthForDoc)
          .get();

        if (!existingInvoicesSnapshot.empty) {
          results.push({ userId, status: "skipped_invoice_exists", invoiceMonth: invoiceMonthForDoc });
          continue;
        }
      }

      let totalAmount = 0;
      let itemCount = 0;
      const invoiceItems: any[] = [];

      if (storageType === "product_base") {
        // Product Base Storage: Count "In Stock" items, exclude items added this month (first month free)
        const inventorySnapshot = await db
          .collection(`users/${userId}/inventory`)
          .where("status", "==", "In Stock")
          .get();

        for (const inventoryDoc of inventorySnapshot.docs) {
          const inventoryData = inventoryDoc.data();
          const dateAdded = inventoryData.dateAdded;

          // Check if item was added this month (first month free)
          let itemDateAdded: Date;
          if (dateAdded && typeof dateAdded === "object" && "seconds" in dateAdded) {
            itemDateAdded = new Date(dateAdded.seconds * 1000);
          } else if (typeof dateAdded === "string") {
            itemDateAdded = new Date(dateAdded);
          } else {
            itemDateAdded = new Date();
          }

          // Skip items added this month (first month free)
          if (
            itemDateAdded >= firstDayOfMonth &&
            itemDateAdded <= lastDayOfMonth
          ) {
            continue;
          }

          // Count this item
          const quantity = inventoryData.quantity || 0;
          itemCount += quantity;
        }

        totalAmount = itemCount * price;

        invoiceItems.push({
          quantity: itemCount,
          productName: `Storage - Product Base (${itemCount} items)`,
          shipDate: currentMonth,
          shipTo: "N/A",
          packaging: "Storage",
          unitPrice: price,
          amount: totalAmount,
        });
      } else if (storageType === "pallet_base") {
        // Pallet Base Storage: Number of pallets × price per pallet
        const palletCount = storagePricing.palletCount || 1;
        totalAmount = palletCount * price;
        itemCount = palletCount;

        invoiceItems.push({
          quantity: palletCount,
          productName: `Storage - Pallet Base (${palletCount} pallet${palletCount > 1 ? "s" : ""})`,
          shipDate: currentMonth,
          shipTo: "N/A",
          packaging: "Storage",
          unitPrice: price,
          amount: totalAmount,
        });
      }

      // Only create invoice if there's an amount
      if (totalAmount <= 0) {
        results.push({ userId, status: "skipped_no_charge", itemCount });
        continue;
      }

      // Generate invoice
      const invoiceNumber = generateInvoiceNumber(today);
      const orderNumber = `STOR-${format(today, "yyyyMMdd")}-${Date.now().toString().slice(-4)}`;

      const invoiceDoc = {
        invoiceNumber,
        date: format(today, "yyyy-MM-dd"),
        orderNumber,
        soldTo: {
          name: userData.name || userData.companyName || "Client",
          email: userData.email || "",
          phone: userData.phone || "",
          address: userData.address || "",
        },
        fbm: "Storage Fee",
        items: invoiceItems,
        subtotal: totalAmount,
        grandTotal: totalAmount,
        status: "pending",
        createdAt: new Date(),
        userId,
        type: "storage",
        invoiceMonth: invoiceMonthForDoc,
        autoGenerated: true,
        autoGeneratedAt: new Date(),
        storageType,
        itemCount,
        ...(storageType === "pallet_base" && { palletCount: storagePricing.palletCount || 1 }),
        ...(isTest && { isTest: true, testRunAt: new Date(), testOfInvoiceMonth: invoiceMonthBase }),
      };

      await db.collection(`users/${userId}/invoices`).add(invoiceDoc);

      results.push({
        userId,
        status: "invoice_created",
        invoiceNumber,
        storageType,
        itemCount,
        total: totalAmount,
        invoiceMonth: invoiceMonthForDoc,
        ...(isTest && { isTest: true }),
      });
    }

    return NextResponse.json({
      success: true,
      invoiceMonth: invoiceMonthForDoc,
      results,
    });
  } catch (error: any) {
    console.error("Monthly storage invoice generation failed:", error);
    return NextResponse.json(
      {
        error: "Monthly storage invoice generation failed",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

