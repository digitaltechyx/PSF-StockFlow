"use client";

import { useState, useEffect } from "react";
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string;
  amount: number;
  currency: string;
  onSuccess: () => void;
}

const cardElementOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#424770",
      "::placeholder": {
        color: "#aab7c4",
      },
    },
    invalid: {
      color: "#9e2146",
    },
  },
};

export function PaymentDialog({
  open,
  onOpenChange,
  clientSecret,
  amount,
  currency,
  onSuccess,
}: PaymentDialogProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  useEffect(() => {
    if (!open) {
      setSucceeded(false);
      setProcessing(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Card element not found",
      });
      setProcessing(false);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: error.message || "Your payment could not be processed",
      });
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      setSucceeded(true);
      toast({
        title: "Payment Successful!",
        description: "Your payment has been processed. The label will be available shortly.",
      });
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Complete Payment
          </DialogTitle>
          <DialogDescription>
            Enter your card details to complete the purchase
          </DialogDescription>
        </DialogHeader>

        {succeeded ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-lg font-semibold">Payment Successful!</p>
            <p className="text-sm text-muted-foreground">
              Your label will be purchased automatically and available shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Card Details</label>
              <div className="p-4 border rounded-md bg-background">
                <CardElement options={cardElementOptions} />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-md">
              <span className="font-medium">Total Amount:</span>
              <span className="text-lg font-bold">
                {currency.toUpperCase()} ${(amount / 100).toFixed(2)}
              </span>
            </div>

            <Button
              type="submit"
              disabled={!stripe || processing}
              className="w-full"
              size="lg"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay ${(amount / 100).toFixed(2)}
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}



