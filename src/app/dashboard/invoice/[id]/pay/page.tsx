"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PayInvoicePage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const [details, setDetails] = useState<any>(null);
  const amount = search.get('amount');
  const currency = (search.get('currency') || 'USD').toUpperCase();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/wise/deposit-details?currency=${currency}`);
        const json = await res.json();
        setDetails(json.details || null);
      } catch (e) {
        setDetails(null);
      }
    };
    load();
  }, [currency]);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Pay Invoice {params.id}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Amount Due: <strong>{amount} {currency}</strong></p>
          {!details ? (
            <Alert>
              <AlertDescription>
                Payment instructions unavailable. Please try again later or contact support.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">Send a bank transfer to the following account:</p>
              <ul className="text-sm list-disc list-inside space-y-1">
                {details.bankName && <li>Bank: {details.bankName}</li>}
                {details.accountHolderName && <li>Account Holder: {details.accountHolderName}</li>}
                {details.accountNumber && <li>Account Number: {details.accountNumber}</li>}
                {details.routingNumber && <li>Routing Number: {details.routingNumber}</li>}
                {details.iban && <li>IBAN: {details.iban}</li>}
                {details.swift && <li>SWIFT/BIC: {details.swift}</li>}
              </ul>
              <Alert>
                <AlertDescription>
                  Include reference "INV-{params.id}" in your transfer so we can match your payment automatically.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


