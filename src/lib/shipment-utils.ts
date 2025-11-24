import type { ShippedItem, ShipmentProductItem } from "@/types";

export interface NormalizedShipmentItem extends ShipmentProductItem {
  productName: string;
  boxesShipped: number;
  shippedQty: number;
  packOf: number;
}

function coerceNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeShipmentItems(shipment: ShippedItem): NormalizedShipmentItem[] {
  if (shipment.items && shipment.items.length > 0) {
    return shipment.items.map((item) => ({
      productId: item.productId,
      productName: item.productName || "Unknown Item",
      boxesShipped: coerceNumber(item.boxesShipped),
      shippedQty: coerceNumber(item.shippedQty),
      packOf: coerceNumber(item.packOf, 1),
      unitPrice: item.unitPrice,
      remainingQty: item.remainingQty,
    }));
  }

  const fallbackBoxes =
    coerceNumber((shipment as any)?.boxesShipped) ||
    coerceNumber(shipment.unitsForPricing) ||
    coerceNumber(shipment.shippedQty);
  const fallbackUnits = coerceNumber(shipment.shippedQty, fallbackBoxes);

  return [
    {
      productName: shipment.productName || "Unknown Item",
      boxesShipped: fallbackBoxes,
      shippedQty: fallbackUnits,
      packOf: coerceNumber(shipment.packOf, 1),
      unitPrice: shipment.unitPrice,
      remainingQty: shipment.remainingQty,
    },
  ];
}

export function getShipmentSummary(shipment: ShippedItem) {
  const items = normalizeShipmentItems(shipment);
  const totalBoxes = items.reduce((sum, item) => sum + (item.boxesShipped || 0), 0);
  const totalUnits = items.reduce((sum, item) => sum + (item.shippedQty || 0), 0);
  const totalSkus = items.length;

  const title =
    totalSkus <= 1
      ? items[0]?.productName || shipment.productName || "Shipment"
      : `${items[0]?.productName || "Shipment"} + ${totalSkus - 1} more`;

  return {
    items,
    totalBoxes,
    totalUnits,
    totalSkus,
    title,
    primaryPackOf: totalSkus === 1 ? items[0]?.packOf : undefined,
  };
}

