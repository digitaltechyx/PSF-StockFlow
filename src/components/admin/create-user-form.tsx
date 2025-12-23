"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { Loader2, UserPlus, Shield, Zap } from "lucide-react";
import { getDefaultFeaturesForRole } from "@/lib/permissions";
import type { UserRole, UserFeature } from "@/types";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  companyName: z.string().min(1, "Company name is required"),
  ein: z.string().min(1, "EIN is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
  zipCode: z.string().min(5, "Zip code must be at least 5 characters"),
  role: z.enum(["user", "sub_admin"]).default("user"),
  features: z.array(z.string()).default([]),
});

interface CreateUserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Admin features available for sub admins
const ADMIN_FEATURES: { value: UserFeature; label: string; description: string }[] = [
  { value: "admin_dashboard", label: "Admin Dashboard", description: "Access to admin dashboard overview" },
  { value: "manage_users", label: "Manage Users", description: "Create, edit, and manage users" },
  { value: "manage_invoices", label: "Manage Invoices", description: "View and manage invoices" },
  { value: "manage_labels", label: "Manage Labels", description: "View and manage uploaded labels" },
];

export function CreateUserForm({ onSuccess, onCancel }: CreateUserFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      companyName: "",
      ein: "",
      address: "",
      city: "",
      state: "",
      country: "",
      zipCode: "",
      role: "user",
      features: [],
    },
  });

  const selectedRole = form.watch("role");
  const selectedFeatures = form.watch("features");

  async function onSubmit(values: z.infer<typeof createUserSchema>) {
    setIsLoading(true);
    try {
      // Create the user account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );

      // Determine features based on role
      let userFeatures: UserFeature[] = [];
      if (values.role === "sub_admin") {
        // Sub admin gets only the features explicitly selected
        userFeatures = values.features as UserFeature[];
      } else {
        // Regular users get default features for their role
        userFeatures = getDefaultFeaturesForRole(values.role);
      }

      // Create user profile in Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        companyName: values.companyName,
        ein: values.ein,
        address: values.address,
        city: values.city,
        state: values.state,
        country: values.country,
        zipCode: values.zipCode,
        role: values.role,
        roles: [values.role], // Set roles array
        features: userFeatures,
        status: values.role === "sub_admin" ? "approved" : "pending", // Sub admins are auto-approved
        createdAt: new Date(),
      });

      toast({
        title: "Success",
        description: `User "${values.name}" has been created successfully!`,
      });

      form.reset();
      onSuccess?.();

      // Sign out the newly created user and sign back in as admin
      await auth.signOut();
      // The AuthProvider will handle re-authentication automatically

    } catch (error: any) {
      let errorMessage = "Failed to create user.";
      
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "An account with this email already exists.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-lg border-0 shadow-none">
      <CardContent className="p-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter email address" 
                      type="email"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter phone number" 
                      type="tel"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="ABC Company Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ein"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>EIN</FormLabel>
                  <FormControl>
                    <Input placeholder="12-3456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Complete Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="123 Main Street, Suite 100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="New York" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="NY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input placeholder="United States" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zip Code</FormLabel>
                  <FormControl>
                    <Input placeholder="10001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter password (min 6 characters)" 
                      type="password"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Role</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50">
                        <input
                          type="radio"
                          id="role-user"
                          checked={field.value === "user"}
                          onChange={() => field.onChange("user")}
                          className="h-4 w-4"
                        />
                        <label htmlFor="role-user" className="flex-1 cursor-pointer">
                          <div className="font-medium">Regular User</div>
                          <div className="text-xs text-muted-foreground">
                            Client access with inventory management, shipments, and invoices
                          </div>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50">
                        <input
                          type="radio"
                          id="role-sub_admin"
                          checked={field.value === "sub_admin"}
                          onChange={() => field.onChange("sub_admin")}
                          className="h-4 w-4"
                        />
                        <label htmlFor="role-sub_admin" className="flex-1 cursor-pointer">
                          <div className="font-medium">Sub Admin</div>
                          <div className="text-xs text-muted-foreground">
                            Admin dashboard access with limited features (select features below)
                          </div>
                        </label>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedRole === "sub_admin" && (
              <FormField
                control={form.control}
                name="features"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Admin Features
                      </FormLabel>
                      <p className="text-sm text-muted-foreground mt-1">
                        Select which admin features this sub admin should have access to.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {ADMIN_FEATURES.map((feature) => (
                        <div
                          key={feature.value}
                          className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50"
                        >
                          <Checkbox
                            checked={selectedFeatures.includes(feature.value)}
                            onCheckedChange={(checked) => {
                              const currentFeatures = form.getValues("features");
                              if (checked) {
                                form.setValue("features", [...currentFeatures, feature.value]);
                              } else {
                                form.setValue(
                                  "features",
                                  currentFeatures.filter((f) => f !== feature.value)
                                );
                              }
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-1">
                            <label className="text-sm font-medium leading-none cursor-pointer">
                              {feature.label}
                            </label>
                            <p className="text-xs text-muted-foreground">{feature.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedFeatures.length === 0 && (
                      <p className="text-sm text-amber-600 mt-2">
                        âš ï¸ No features selected. Sub admin will not have access to any admin pages.
                      </p>
                    )}
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

