"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { addDoc, collection, doc, runTransaction } from "firebase/firestore";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import type { InventoryItem } from "@/types";

const formSchema = z.object({
  productId: z.string().min(1, "Please select a product."),
  date: z.date({ required_error: "A shipping date is required." }),
  quantity: z.coerce.number().int().positive("Shipped quantity must be a positive number."),
  packOf: z.coerce.number().int().positive("Pack size must be a positive number."),
  unitPrice: z.coerce.number().positive("Unit price must be a positive number."),
  shipTo: z.string().min(1, "Ship to destination is required."),
  remarks: z.string().optional(),
});

// Removed packOfOptions array since we're using a number input now

export function ShipInventoryForm({ userId, inventory }: { userId: string; inventory: InventoryItem[] }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      packOf: 1,
      quantity: 1,
      unitPrice: 0,
      shipTo: "",
      remarks: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const inventoryDocRef = doc(db, `users/${userId}/inventory`, values.productId);
        const inventoryDoc = await transaction.get(inventoryDocRef);

        if (!inventoryDoc.exists()) {
          throw new Error("Product not found in inventory.");
        }

        const currentInventory = inventoryDoc.data() as Omit<InventoryItem, 'id'>;
        // Treat shipped quantity as number of boxes; total units shipped = boxes * packOf
        const totalUnitsShipped = values.quantity * values.packOf;
        if (currentInventory.quantity < totalUnitsShipped) {
          throw new Error("Not enough stock to ship this quantity.");
        }

        const newQuantity = currentInventory.quantity - totalUnitsShipped;
        const newStatus = newQuantity > 0 ? "In Stock" : "Out of Stock";

        transaction.update(inventoryDocRef, {
          quantity: newQuantity,
          status: newStatus,
        });

        const shippedCollectionRef = collection(db, `users/${userId}/shipped`);
        transaction.set(doc(shippedCollectionRef), {
          productName: currentInventory.productName,
          date: values.date,
          createdAt: new Date(),
          // Store total units shipped
          shippedQty: totalUnitsShipped,
          // Keep boxes shipped for reference/debugging
          boxesShipped: values.quantity,
          remainingQty: newQuantity,
          packOf: values.packOf,
          unitPrice: values.unitPrice,
          shipTo: values.shipTo,
          remarks: values.remarks,
        });
      });

      toast({
        title: "Success",
        description: "Shipment recorded successfully.",
      });
      form.reset();
      form.setValue('packOf', 1);
      form.setValue('quantity', 1);
      form.setValue('shipTo', '');

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to record shipment.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record a Shipment</CardTitle>
        <CardDescription>Select a product and enter the details of the shipment.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className="w-full justify-between"
                        >
                          {field.value
                            ? inventory.find((item) => item.id === field.value)?.productName + 
                              ` (In Stock: ${inventory.find((item) => item.id === field.value)?.quantity})`
                            : "Select a product to ship..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </DialogTrigger>
                    <DialogContent className="p-0">
                      <DialogTitle className="sr-only">Select a product</DialogTitle>
                      <div className="p-3 border-b">
                        <Input
                          autoFocus
                          placeholder="Search products..."
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const normalized = query.trim().toLowerCase();
                              const matches = inventory
                                .filter(item => item.quantity > 0)
                                .filter(item => item.productName.toLowerCase().includes(normalized));
                              const first = matches[0] ?? inventory.filter(item => item.quantity > 0)[0];
                              if (first) {
                                field.onChange(first.id);
                                setOpen(false);
                              }
                            }
                          }}
                        />
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {inventory
                          .filter(item => item.quantity > 0)
                          .filter(item => item.productName.toLowerCase().includes(query.trim().toLowerCase()))
                          .map((item) => (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                              onClick={() => { field.onChange(item.id); setOpen(false); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { field.onChange(item.id); setOpen(false); }}}
                            >
                              <Check className={`h-4 w-4 ${field.value === item.id ? 'opacity-100' : 'opacity-0'}`} />
                              {item.productName} (In Stock: {item.quantity})
                            </div>
                          ))}
                        {inventory.filter(item => item.quantity > 0).filter(item => item.productName.toLowerCase().includes(query.trim().toLowerCase())).length === 0 && (
                          <div className="px-3 py-4 text-sm text-muted-foreground">No products found.</div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Shipping Date</FormLabel>
                  <DatePicker date={field.value} setDate={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shipTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ship To</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter destination (e.g., Customer Name, Address, Store Location)" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
              name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipped Units</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="packOf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pack Of</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter pack size" 
                        min="1"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="unitPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prep Unit Price ($)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Enter unit price" 
                      step="0.01"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add any notes about the shipment..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <Button type="submit" disabled={isLoading || inventory.length === 0}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Shipment
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
