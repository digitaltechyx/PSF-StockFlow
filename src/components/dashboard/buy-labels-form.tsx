"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ShoppingCart, MapPin, Package, CreditCard } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { getStripePublishableKey } from "@/lib/stripe";
import { PaymentDialog } from "./payment-dialog";
import type { ShippingAddress, ParcelDetails, ShippingRate } from "@/types";

const addressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  street1: z.string().min(1, "Street address is required"),
  street2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(5, "ZIP code is required"),
  country: z.string().min(1, "Country is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});

const parcelSchema = z.object({
  length: z.coerce.number().positive("Length must be positive"),
  width: z.coerce.number().positive("Width must be positive"),
  height: z.coerce.number().positive("Height must be positive"),
  weight: z.coerce.number().positive("Weight must be positive"),
  weightUnit: z.enum(["lb", "oz", "kg", "g"]),
  distanceUnit: z.enum(["in", "ft", "cm", "m"]),
});

const formSchema = z.object({
  fromAddress: addressSchema,
  toAddress: addressSchema,
  parcel: parcelSchema,
});

type FormValues = z.infer<typeof formSchema>;

export function BuyLabelsForm() {
  const { userProfile, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<any>(null);

  useEffect(() => {
    const initStripe = async () => {
      const stripe = await loadStripe(getStripePublishableKey());
      setStripePromise(stripe);
    };
    initStripe();
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromAddress: {
        name: userProfile?.name || "",
        street1: userProfile?.address || "",
        city: userProfile?.city || "",
        state: userProfile?.state || "",
        zip: userProfile?.zipCode || "",
        country: "US",
        phone: userProfile?.phone || "",
        email: userProfile?.email || "",
      },
      toAddress: {
        name: "",
        street1: "",
        street2: "",
        city: "",
        state: "",
        zip: "",
        country: "US",
        phone: "",
        email: "",
      },
      parcel: {
        length: 10,
        width: 8,
        height: 6,
        weight: 1,
        weightUnit: "lb",
        distanceUnit: "in",
      },
    },
  });

  const handleGetRates = async (data: FormValues) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to get rates.",
      });
      return;
    }

    setLoadingRates(true);
    try {
      // TODO: Call Shippo API to get rates
      // For now, we'll create a placeholder
      const response = await fetch("/api/shippo/rates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromAddress: data.fromAddress,
          toAddress: data.toAddress,
          parcel: data.parcel,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get rates");
      }

      const ratesData = await response.json();
      setRates(ratesData.rates || []);
      setShipmentId(ratesData.shipment_id || null);
      
      if (ratesData.rates && ratesData.rates.length > 0) {
        toast({
          title: "Rates Retrieved",
          description: `Found ${ratesData.rates.length} shipping options.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "No Rates Found",
          description: "No shipping rates available for this shipment.",
        });
      }
    } catch (error: any) {
      console.error("Error getting rates:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to get shipping rates. Please try again.",
      });
    } finally {
      setLoadingRates(false);
    }
  };

  const handlePurchaseLabel = async () => {
    if (!selectedRate || !user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a shipping rate first.",
      });
      return;
    }

    const formData = form.getValues();
    setLoading(true);

    try {
      // Create payment intent
      const paymentResponse = await fetch("/api/stripe/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.uid,
          amount: Math.round(parseFloat(selectedRate.amount) * 100), // Convert to cents
          currency: selectedRate.currency.toLowerCase(),
          fromAddress: formData.fromAddress,
          toAddress: formData.toAddress,
          parcel: formData.parcel,
          selectedRate: {
            objectId: selectedRate.object_id,
            amount: selectedRate.amount,
            currency: selectedRate.currency,
            provider: selectedRate.provider,
            serviceLevel: selectedRate.servicelevel.name,
            shipmentId: shipmentId || (selectedRate as any).shipment,
          },
        }),
      });

      if (!paymentResponse.ok) {
        const error = await paymentResponse.json();
        throw new Error(error.error || "Failed to create payment");
      }

      const { clientSecret, paymentIntentId, labelPurchaseId } = await paymentResponse.json();

      // Set client secret and open payment dialog
      setClientSecret(clientSecret);
      setPaymentDialogOpen(true);
    } catch (error: any) {
      console.error("Error purchasing label:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to purchase label. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Reset form after successful payment
    form.reset();
    setRates([]);
    setSelectedRate(null);
    setShipmentId(null);
    setClientSecret(null);
  };

  return (
    <div className="space-y-6">
      {stripePromise && clientSecret && (
        <Elements stripe={stripePromise}>
          <PaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            clientSecret={clientSecret}
            amount={selectedRate ? Math.round(parseFloat(selectedRate.amount) * 100) : 0}
            currency={selectedRate?.currency || "usd"}
            onSuccess={handlePaymentSuccess}
          />
        </Elements>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase Shipping Label
          </CardTitle>
          <CardDescription>
            Enter shipment details to get shipping rates and purchase a label.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleGetRates)} className="space-y-6">
              {/* From Address */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">From Address</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fromAddress.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fromAddress.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fromAddress.street1"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Street Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fromAddress.street2"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Apartment, suite, etc. (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Apt 4B" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fromAddress.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input placeholder="New York" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fromAddress.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State *</FormLabel>
                        <FormControl>
                          <Input placeholder="NY" maxLength={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fromAddress.zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code *</FormLabel>
                        <FormControl>
                          <Input placeholder="10001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fromAddress.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="US">United States</SelectItem>
                            <SelectItem value="CA">Canada</SelectItem>
                            <SelectItem value="MX">Mexico</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* To Address */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold">To Address</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="toAddress.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toAddress.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 987-6543" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toAddress.street1"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Street Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="456 Oak Ave" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toAddress.street2"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Apartment, suite, etc. (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Suite 200" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toAddress.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input placeholder="Los Angeles" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toAddress.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State *</FormLabel>
                        <FormControl>
                          <Input placeholder="CA" maxLength={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toAddress.zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code *</FormLabel>
                        <FormControl>
                          <Input placeholder="90001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toAddress.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="US">United States</SelectItem>
                            <SelectItem value="CA">Canada</SelectItem>
                            <SelectItem value="MX">Mexico</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Parcel Details */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-semibold">Parcel Details</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="parcel.length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Length *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parcel.width"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Width *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="8" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parcel.height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="6" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parcel.weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parcel.distanceUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dimension Unit *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="in">Inches</SelectItem>
                            <SelectItem value="ft">Feet</SelectItem>
                            <SelectItem value="cm">Centimeters</SelectItem>
                            <SelectItem value="m">Meters</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="parcel.weightUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight Unit *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="lb">Pounds</SelectItem>
                            <SelectItem value="oz">Ounces</SelectItem>
                            <SelectItem value="kg">Kilograms</SelectItem>
                            <SelectItem value="g">Grams</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" disabled={loadingRates} className="w-full">
                {loadingRates ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Rates...
                  </>
                ) : (
                  "Get Shipping Rates"
                )}
              </Button>
            </form>
          </Form>

          {/* Rates Selection */}
          {rates.length > 0 && (
            <div className="mt-6 space-y-4 pt-6 border-t">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Select Shipping Rate
              </h3>
              <div className="space-y-2">
                {rates.map((rate) => (
                  <Card
                    key={rate.object_id}
                    className={`cursor-pointer transition-all ${
                      selectedRate?.object_id === rate.object_id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedRate(rate)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{rate.provider}</p>
                          <p className="text-sm text-muted-foreground">
                            {rate.servicelevel.name}
                          </p>
                          {rate.estimated_days && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Est. {rate.estimated_days} days
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            ${parseFloat(rate.amount).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase">
                            {rate.currency}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedRate && (
                <Button
                  onClick={handlePurchaseLabel}
                  disabled={loading}
                  className="w-full mt-4"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Purchase Label - ${parseFloat(selectedRate.amount).toFixed(2)}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


