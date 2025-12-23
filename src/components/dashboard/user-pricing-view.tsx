 "use client";

 import { useMemo, useState } from "react";
 import { useAuth } from "@/hooks/use-auth";
 import { useCollection } from "@/hooks/use-collection";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Skeleton } from "@/components/ui/skeleton";

 type PricingRuleDoc = {
   id: string;
   userId?: string;
   service?: string;
   package?: string;
   quantityRange?: string;
   productType?: string;
   rate?: number;
   packOf?: number;
   updatedAt?: any;
   createdAt?: any;
 };

 type StoragePricingDoc = {
   id: string;
   storageType?: string;
   price?: number;
   palletCount?: number;
   updatedAt?: any;
   createdAt?: any;
 };

 type SimplePriceDoc = {
   id: string;
   price?: number;
   updatedAt?: any;
   createdAt?: any;
 };

 type ContainerHandlingDoc = {
   id: string;
   containerSize?: string;
   price?: number;
   updatedAt?: any;
   createdAt?: any;
 };

 type AdditionalServicesDoc = {
   id: string;
   bubbleWrapPrice?: number;
   stickerRemovalPrice?: number;
   warningLabelPrice?: number;
   updatedAt?: any;
   createdAt?: any;
 };

 const FBA_PACKAGES = [
   { package: "Premium", quantityRange: "1001+" },
   { package: "Small Business", quantityRange: "501-1000" },
   { package: "Standard", quantityRange: "50-500" },
   { package: "Starter", quantityRange: "<50" },
 ] as const;

 const FBM_PACKAGES = [
   { package: "Premium", quantityRange: "101+" },
   { package: "Small Business", quantityRange: "50+" },
   { package: "Standard", quantityRange: "25+" },
   { package: "Starter", quantityRange: "<25" },
 ] as const;

 const PRODUCT_TYPES = ["Standard", "Large"] as const;

 function toMs(v: any): number {
   if (!v) return 0;
   if (typeof v === "string") {
     const t = new Date(v).getTime();
     return Number.isNaN(t) ? 0 : t;
   }
   if (typeof v?.toDate === "function") return v.toDate().getTime();
   if (typeof v?.seconds === "number") return v.seconds * 1000;
   if (v instanceof Date) return v.getTime();
   return 0;
 }

 function money(v: unknown): string {
   const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
   if (!Number.isFinite(n)) return "-";
   return `$${n.toFixed(2)}`;
 }

 function pickLatest<T extends { updatedAt?: any; createdAt?: any }>(docs: T[]): T | null {
   if (!docs || docs.length === 0) return null;
   return [...docs].sort((a, b) => toMs(b.updatedAt || b.createdAt) - toMs(a.updatedAt || a.createdAt))[0] ?? null;
 }

 function productTypeLabel(t: string) {
   if (t === "Standard") return "Standard (6x6x6) - <3lbs";
   if (t === "Large") return "Large (10x10x10) - <6lbs";
   return t;
 }

 export function UserPricingView() {
   const { userProfile } = useAuth();
   const uid = userProfile?.uid || "";
   const [activeTab, setActiveTab] = useState<string>("FBA/WFS/TFS");

   const { data: pricingList, loading: pricingLoading, error: pricingError } = useCollection<PricingRuleDoc>(
     uid ? `users/${uid}/pricing` : ""
   );
   const { data: storagePricingList, loading: storageLoading } = useCollection<StoragePricingDoc>(
     uid ? `users/${uid}/storagePricing` : ""
   );
   const { data: boxForwardingPricingList, loading: boxLoading } = useCollection<SimplePriceDoc>(
     uid ? `users/${uid}/boxForwardingPricing` : ""
   );
   const { data: palletForwardingPricingList, loading: palletLoading } = useCollection<SimplePriceDoc>(
     uid ? `users/${uid}/palletForwardingPricing` : ""
   );
   const { data: containerHandlingPricingList, loading: containerLoading } = useCollection<ContainerHandlingDoc>(
     uid ? `users/${uid}/containerHandlingPricing` : ""
   );
   const { data: additionalServicesPricingList, loading: additionalLoading } = useCollection<AdditionalServicesDoc>(
     uid ? `users/${uid}/additionalServicesPricing` : ""
   );

   const pricingByKey = useMemo(() => {
     const map = new Map<string, PricingRuleDoc>();
     for (const d of pricingList || []) {
       if (!d.service || !d.package || !d.quantityRange || !d.productType) continue;
       const key = `${d.service}|${d.package}|${d.quantityRange}|${d.productType}`;
       const prev = map.get(key);
       if (!prev || toMs(d.updatedAt || d.createdAt) > toMs(prev.updatedAt || prev.createdAt)) {
         map.set(key, d);
       }
     }
     return map;
   }, [pricingList]);

   const latestStorage = useMemo(() => pickLatest(storagePricingList || []), [storagePricingList]);
   const latestBox = useMemo(() => pickLatest(boxForwardingPricingList || []), [boxForwardingPricingList]);
   const latestPallet = useMemo(() => pickLatest(palletForwardingPricingList || []), [palletForwardingPricingList]);
   const latestAdditional = useMemo(() => pickLatest(additionalServicesPricingList || []), [additionalServicesPricingList]);

   const containerBySize = useMemo(() => {
     const m = new Map<string, ContainerHandlingDoc>();
     for (const d of containerHandlingPricingList || []) {
       const size = d.containerSize || "unknown";
       const prev = m.get(size);
       if (!prev || toMs(d.updatedAt || d.createdAt) > toMs(prev.updatedAt || prev.createdAt)) m.set(size, d);
     }
     return m;
   }, [containerHandlingPricingList]);

   const isLoading = pricingLoading || storageLoading || boxLoading || palletLoading || containerLoading || additionalLoading;

   if (!uid) {
     return <div className="text-sm text-muted-foreground">Loading user…</div>;
   }

   if (isLoading) {
     return (
       <div className="space-y-3">
         <Skeleton className="h-10 w-full" />
         <Skeleton className="h-44 w-full" />
       </div>
     );
   }

   if (pricingError) {
     return (
       <div className="text-sm">
         <div className="font-medium text-destructive">Pricing couldn’t be loaded.</div>
         <div className="text-muted-foreground mt-1">This is usually a Firestore permission/rules issue.</div>
       </div>
     );
   }

   const renderServiceTable = (service: "FBA/WFS/TFS" | "FBM") => {
     const pkgs = service === "FBM" ? FBM_PACKAGES : FBA_PACKAGES;
     return (
       <div className="overflow-x-auto">
         <table className="w-full border-collapse">
           <thead>
             <tr className="border-b bg-muted">
               <th className="text-left p-2 text-sm font-medium">Package</th>
               <th className="text-left p-2 text-sm font-medium">Range</th>
               <th className="text-left p-2 text-sm font-medium">Product Type</th>
               <th className="text-left p-2 text-sm font-medium">Rate ($)</th>
               <th className="text-left p-2 text-sm font-medium">Pack Of ($+)</th>
             </tr>
           </thead>
           <tbody>
             {pkgs.flatMap((pkg) =>
               PRODUCT_TYPES.map((pt) => {
                 const key = `${service}|${pkg.package}|${pkg.quantityRange}|${pt}`;
                 const rule = pricingByKey.get(key);
                 return (
                   <tr key={key} className="border-b hover:bg-muted/50">
                     <td className="p-2 text-sm">{pkg.package}</td>
                     <td className="p-2 text-sm">{pkg.quantityRange}</td>
                     <td className="p-2 text-sm">{productTypeLabel(pt)}</td>
                     <td className="p-2 text-sm font-medium">{money(rule?.rate)}</td>
                     <td className="p-2 text-sm font-medium">{money(rule?.packOf)}</td>
                   </tr>
                 );
               })
             )}
           </tbody>
         </table>
       </div>
     );
   };

   return (
     <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="w-full">
       <div className="overflow-x-auto mb-4">
         <TabsList className="inline-flex min-w-full w-auto h-auto p-1 bg-muted rounded-lg">
           <TabsTrigger value="FBA/WFS/TFS" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white whitespace-nowrap px-4 py-2">
             FBA/WFS/TFS
           </TabsTrigger>
           <TabsTrigger value="FBM" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white whitespace-nowrap px-4 py-2">
             FBM
           </TabsTrigger>
           <TabsTrigger value="Storage" className="data-[state=active]:bg-green-500 data-[state=active]:text-white whitespace-nowrap px-4 py-2">
             Storage
           </TabsTrigger>
           <TabsTrigger value="Box Forwarding" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white whitespace-nowrap px-4 py-2">
             Box Forwarding
           </TabsTrigger>
           <TabsTrigger value="Pallet Forwarding" className="data-[state=active]:bg-red-500 data-[state=active]:text-white whitespace-nowrap px-4 py-2">
             Pallet Forwarding
           </TabsTrigger>
           <TabsTrigger value="Container Handling" className="data-[state=active]:bg-teal-500 data-[state=active]:text-white whitespace-nowrap px-4 py-2">
             Container Handling
           </TabsTrigger>
           <TabsTrigger value="Additional Services" className="data-[state=active]:bg-pink-500 data-[state=active]:text-white whitespace-nowrap px-4 py-2">
             Additional Services
           </TabsTrigger>
         </TabsList>
       </div>

       <TabsContent value="FBA/WFS/TFS" className="mt-4">
         {renderServiceTable("FBA/WFS/TFS")}
       </TabsContent>

       <TabsContent value="FBM" className="mt-4">
         {renderServiceTable("FBM")}
       </TabsContent>

       <TabsContent value="Storage" className="mt-4">
         <Card>
           <CardHeader>
             <CardTitle className="text-base">Storage Pricing</CardTitle>
           </CardHeader>
           <CardContent className="space-y-2 text-sm">
             <div className="flex items-center justify-between">
               <span>Storage Type</span>
               <span className="font-medium">{latestStorage?.storageType || (userProfile as any)?.storageType || "-"}</span>
             </div>
             <div className="flex items-center justify-between">
               <span>Price</span>
               <span className="font-semibold">{money(latestStorage?.price)}</span>
             </div>
             {(latestStorage?.storageType === "pallet_base" || (userProfile as any)?.storageType === "pallet_base") && (
               <div className="flex items-center justify-between">
                 <span>Pallet Count</span>
                 <span className="font-medium">{latestStorage?.palletCount ?? "-"}</span>
               </div>
             )}
           </CardContent>
         </Card>
       </TabsContent>

       <TabsContent value="Box Forwarding" className="mt-4">
         <Card>
           <CardHeader>
             <CardTitle className="text-base">Box Forwarding</CardTitle>
           </CardHeader>
           <CardContent className="text-sm flex items-center justify-between">
             <span>Price</span>
             <span className="font-semibold">{money(latestBox?.price)}</span>
           </CardContent>
         </Card>
       </TabsContent>

       <TabsContent value="Pallet Forwarding" className="mt-4">
         <Card>
           <CardHeader>
             <CardTitle className="text-base">Pallet Forwarding</CardTitle>
           </CardHeader>
           <CardContent className="space-y-2 text-sm">
             <div className="flex items-center justify-between">
               <span>Forwarding Price</span>
               <span className="font-semibold">{money(latestPallet?.price)}</span>
             </div>
             <div className="text-xs text-muted-foreground">
               Pallet “Existing Inventory” pricing is handled manually at approval.
             </div>
           </CardContent>
         </Card>
       </TabsContent>

       <TabsContent value="Container Handling" className="mt-4">
         <Card>
           <CardHeader>
             <CardTitle className="text-base">Container Handling</CardTitle>
           </CardHeader>
           <CardContent className="space-y-2 text-sm">
             <div className="flex items-center justify-between">
               <span>20ft</span>
               <span className="font-semibold">{money(containerBySize.get("20ft")?.price)}</span>
             </div>
             <div className="flex items-center justify-between">
               <span>40ft</span>
               <span className="font-semibold">{money(containerBySize.get("40ft")?.price)}</span>
             </div>
           </CardContent>
         </Card>
       </TabsContent>

       <TabsContent value="Additional Services" className="mt-4">
         <Card>
           <CardHeader>
             <CardTitle className="text-base">Additional Services</CardTitle>
           </CardHeader>
           <CardContent className="space-y-2 text-sm">
             <div className="flex items-center justify-between">
               <span>Bubble Wrap (per ft)</span>
               <span className="font-semibold">{money(latestAdditional?.bubbleWrapPrice)}</span>
             </div>
             <div className="flex items-center justify-between">
               <span>Sticker Removal (per item)</span>
               <span className="font-semibold">{money(latestAdditional?.stickerRemovalPrice)}</span>
             </div>
             <div className="flex items-center justify-between">
               <span>Warning Labels (per label)</span>
               <span className="font-semibold">{money(latestAdditional?.warningLabelPrice)}</span>
             </div>
           </CardContent>
         </Card>
       </TabsContent>
     </Tabs>
   );
 }


