 "use client";

 import { ArrowLeftRight } from "lucide-react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { ProductReturnRequestForm } from "@/components/dashboard/product-return-request-form";
 import { ProductReturnTable } from "@/components/dashboard/product-return-table";

 export default function ProductReturnsPage() {
   return (
     <div className="space-y-6">
       <Card className="border-2 shadow-xl overflow-hidden">
         <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-600 text-white pb-4">
           <div className="flex items-center justify-between">
             <div>
               <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                 <ArrowLeftRight className="h-6 w-6" />
                 Product Returns
               </CardTitle>
               <CardDescription className="text-orange-100 mt-2">
                 Create a return request and track its status
               </CardDescription>
             </div>
             <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
               <ArrowLeftRight className="h-7 w-7 text-white" />
             </div>
           </div>
         </CardHeader>
         <CardContent className="p-6">
           <Tabs defaultValue="new" className="w-full">
             <TabsList className="grid w-full grid-cols-2">
               <TabsTrigger value="new">New Request</TabsTrigger>
               <TabsTrigger value="history">History</TabsTrigger>
             </TabsList>
             <TabsContent value="new" className="mt-4">
               <ProductReturnRequestForm />
             </TabsContent>
             <TabsContent value="history" className="mt-4">
               <ProductReturnTable />
             </TabsContent>
           </Tabs>
         </CardContent>
       </Card>
     </div>
   );
 }

