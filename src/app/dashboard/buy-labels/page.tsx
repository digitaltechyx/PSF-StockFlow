"use client";

import { BuyLabelsForm } from "@/components/dashboard/buy-labels-form";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import Link from "next/link";

export default function BuyLabelsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buy Shipping Labels</h1>
          <p className="text-muted-foreground mt-2">
            Purchase shipping labels for your packages. Enter shipment details, select a carrier, and complete payment.
          </p>
        </div>
        <Link href="/dashboard/purchased-labels">
          <Button variant="default" size="lg" className="shadow-md hover:shadow-lg transition-shadow">
            <Package className="h-5 w-5 mr-2" />
            View Purchased Labels
          </Button>
        </Link>
      </div>
      <BuyLabelsForm />
    </div>
  );
}


