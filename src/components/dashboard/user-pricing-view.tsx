 "use client";

 import { useMemo } from "react";
 import { useAuth } from "@/hooks/use-auth";
 import { useCollection } from "@/hooks/use-collection";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Skeleton } from "@/components/ui/skeleton";

 type PricingRule = {
   id: string;
   service?: string;
   package?: string;
   quantityRange?: string;
   productType?: string;
   rate?: number | string;
   packOf?: number | string;
 };

 type SimplePriceDoc = {
   id: string;
   price?: number | string;
   type?: string;
   storageType?: string;
   palletCount?: number;
 };

 type ContainerHandlingDoc = {
   id: string;
   containerSize?: string;
   price?: number | string;
 };

 type AdditionalServicesDoc = {
   id: string;
   bubbleWrapPrice?: number | string;
   stickerRemovalPrice?: number | string;
   warningLabelPrice?: number | string;
 };

 function asMoney(v: unknown): string {
   const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
   if (!Number.isFinite(n)) return "-";
   return `$${n.toFixed(2)}`;
 }

 export function UserPricingView() {
   const { userProfile } = useAuth();

   const uid = userProfile?.uid || "";
   const { data: pricingRules, loading: pricingLoading, error: pricingError } = useCollection<PricingRule>(
     uid ? `users/${uid}/pricing` : ""
   );
   const { data: storagePricing, loading: storageLoading } = useCollection<SimplePriceDoc>(
     uid ? `users/${uid}/storagePricing` : ""
   );
   const { data: boxForwarding, loading: boxLoading } = useCollection<SimplePriceDoc>(
     uid ? `users/${uid}/boxForwardingPricing` : ""
   );
   const { data: palletForwarding, loading: palletLoading } = useCollection<SimplePriceDoc>(
     uid ? `users/${uid}/palletForwardingPricing` : ""
   );
   const { data: containerHandling, loading: containerLoading } = useCollection<ContainerHandlingDoc>(
     uid ? `users/${uid}/containerHandlingPricing` : ""
   );
   const { data: additionalServices, loading: addLoading } = useCollection<AdditionalServicesDoc>(
     uid ? `users/${uid}/additionalServicesPricing` : ""
   );

   const grouped = useMemo(() => {
     const map = new Map<string, PricingRule[]>();
     for (const r of pricingRules || []) {
       const key = (r.service || "Unknown Service").toString();
       map.set(key, [...(map.get(key) || []), r]);
     }
     // stable-ish ordering
     return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
   }, [pricingRules]);

   if (!uid) {
     return <div className="text-sm text-muted-foreground">Loading user…</div>;
   }

   if (pricingLoading || storageLoading || boxLoading || palletLoading || containerLoading || addLoading) {
     return (
       <div className="space-y-3">
         <Skeleton className="h-6 w-40" />
         <Skeleton className="h-24 w-full" />
         <Skeleton className="h-24 w-full" />
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

   return (
     <div className="space-y-6">
       <Card>
         <CardHeader className="pb-3">
           <CardTitle className="text-base">Service Pricing</CardTitle>
         </CardHeader>
         <CardContent>
           {grouped.length === 0 ? (
             <div className="text-sm text-muted-foreground">No pricing configured yet.</div>
           ) : (
             <div className="space-y-6">
               {grouped.map(([service, rows]) => (
                 <div key={service} className="space-y-2">
                   <div className="flex items-center gap-2">
                     <div className="font-semibold">{service}</div>
                     <Badge variant="secondary">{rows.length}</Badge>
                   </div>
                   <div className="border rounded-lg overflow-hidden">
                     <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead>Package</TableHead>
                           <TableHead>Qty</TableHead>
                           <TableHead>Type</TableHead>
                           <TableHead className="text-right">Rate</TableHead>
                           <TableHead className="text-right">Pack Of</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {rows.map((r) => (
                           <TableRow key={r.id}>
                             <TableCell className="font-medium">{r.package || "-"}</TableCell>
                             <TableCell>{r.quantityRange || "-"}</TableCell>
                             <TableCell>{r.productType || "-"}</TableCell>
                             <TableCell className="text-right">{asMoney(r.rate)}</TableCell>
                             <TableCell className="text-right">
                               {typeof r.packOf === "number"
                                 ? asMoney(r.packOf)
                                 : typeof r.packOf === "string" && r.packOf.trim() !== ""
                                   ? asMoney(r.packOf)
                                   : "-"}
                             </TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </CardContent>
       </Card>

       <div className="grid gap-4 md:grid-cols-2">
         <Card>
           <CardHeader className="pb-3">
             <CardTitle className="text-base">Storage</CardTitle>
           </CardHeader>
           <CardContent className="text-sm space-y-2">
             {storagePricing.length === 0 ? (
               <div className="text-muted-foreground">Not configured.</div>
             ) : (
               storagePricing.map((s) => (
                 <div key={s.id} className="flex items-center justify-between">
                   <span>{s.storageType || s.type || "Storage"}</span>
                   <span className="font-semibold">{asMoney(s.price)}</span>
                 </div>
               ))
             )}
           </CardContent>
         </Card>

         <Card>
           <CardHeader className="pb-3">
             <CardTitle className="text-base">Additional Services</CardTitle>
           </CardHeader>
           <CardContent className="text-sm space-y-2">
             {additionalServices.length === 0 ? (
               <div className="text-muted-foreground">Not configured.</div>
             ) : (
               additionalServices.map((a) => (
                 <div key={a.id} className="space-y-1">
                   <div className="flex items-center justify-between">
                     <span>Bubble Wrap (per ft)</span>
                     <span className="font-semibold">{asMoney(a.bubbleWrapPrice)}</span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span>Sticker Removal (per item)</span>
                     <span className="font-semibold">{asMoney(a.stickerRemovalPrice)}</span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span>Warning Labels (per label)</span>
                     <span className="font-semibold">{asMoney(a.warningLabelPrice)}</span>
                   </div>
                 </div>
               ))
             )}
           </CardContent>
         </Card>
       </div>

       <div className="grid gap-4 md:grid-cols-2">
         <Card>
           <CardHeader className="pb-3">
             <CardTitle className="text-base">Forwarding</CardTitle>
           </CardHeader>
           <CardContent className="text-sm space-y-2">
             <div className="flex items-center justify-between">
               <span>Box Forwarding</span>
               <span className="font-semibold">{boxForwarding[0] ? asMoney(boxForwarding[0].price) : "-"}</span>
             </div>
             <div className="flex items-center justify-between">
               <span>Pallet Forwarding</span>
               <span className="font-semibold">{palletForwarding[0] ? asMoney(palletForwarding[0].price) : "-"}</span>
             </div>
             <div className="text-xs text-muted-foreground">
               Pallet “Existing Inventory” pricing is handled manually at approval.
             </div>
           </CardContent>
         </Card>

         <Card>
           <CardHeader className="pb-3">
             <CardTitle className="text-base">Container Handling</CardTitle>
           </CardHeader>
           <CardContent className="text-sm space-y-2">
             {containerHandling.length === 0 ? (
               <div className="text-muted-foreground">Not configured.</div>
             ) : (
               containerHandling.map((c) => (
                 <div key={c.id} className="flex items-center justify-between">
                   <span>{c.containerSize || "Container"}</span>
                   <span className="font-semibold">{asMoney(c.price)}</span>
                 </div>
               ))
             )}
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }


