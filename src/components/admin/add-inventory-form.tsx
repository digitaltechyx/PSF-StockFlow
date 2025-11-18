"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { addDoc, collection } from "firebase/firestore";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import type { InventoryItem } from "@/types";

const baseFormSchema = z.object({
  productName: z.string().min(1, "Product name is required."),
  quantity: z.coerce.number().int().positive("Quantity must be a positive number."),
  dateAdded: z.date({ required_error: "A date is required." }),
  status: z.enum(["In Stock", "Out of Stock"], { required_error: "You need to select a status." }),
});

export function AddInventoryForm({ userId, inventory = [] }: { userId: string; inventory?: InventoryItem[] }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof baseFormSchema>>({
    resolver: zodResolver(baseFormSchema),
    defaultValues: {
      productName: "",
      quantity: 1,
      status: "In Stock",
    },
  });

  // Custom validation function for duplicate product names
  const validateProductName = (name: string): boolean => {
    if (!name || !name.trim()) return true; // Let base schema handle empty validation
    const normalizedName = name.trim().toLowerCase();
    return !inventory.some(
      (item) => item.productName.trim().toLowerCase() === normalizedName
    );
  };

  // Re-validate product name when inventory changes
  useEffect(() => {
    const productName = form.getValues("productName");
    if (productName) {
      const isValid = validateProductName(productName);
      if (!isValid) {
        form.setError("productName", {
          type: "manual",
          message: "This product name already exists in the inventory. Please use a different name.",
        });
      } else {
        form.clearErrors("productName");
      }
    }
  }, [inventory, form]);

  async function onSubmit(values: z.infer<typeof baseFormSchema>) {
    // Check for duplicate product name before submitting
    if (!validateProductName(values.productName)) {
      form.setError("productName", {
        type: "manual",
        message: "This product name already exists in the inventory. Please use a different name.",
      });
      return;
    }

    setIsLoading(true);
    try {
      await addDoc(collection(db, `users/${userId}/inventory`), {
        ...values,
      });
      toast({
        title: "Success",
        description: "Inventory item added successfully.",
      });
      form.reset();
      form.setValue('quantity', 1);
      form.setValue('status', 'In Stock');

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add inventory item.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Product</CardTitle>
        <CardDescription>Fill in the details to add a new product to this user&apos;s inventory.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., T-Shirt" 
                        {...field}
                        onBlur={(e) => {
                          field.onBlur();
                          // Validate on blur
                          const value = e.target.value;
                          if (value && !validateProductName(value)) {
                            form.setError("productName", {
                              type: "manual",
                              message: "This product name already exists in the inventory. Please use a different name.",
                            });
                          } else {
                            form.clearErrors("productName");
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="dateAdded"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date Added</FormLabel>
                  <DatePicker date={field.value} setDate={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-row space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="In Stock" />
                        </FormControl>
                        <FormLabel className="font-normal">In Stock</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="Out of Stock" />
                        </FormControl>
                        <FormLabel className="font-normal">Out of Stock</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Product
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
