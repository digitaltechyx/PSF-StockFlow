 "use client";

 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { DollarSign } from "lucide-react";
 import { UserPricingView } from "@/components/dashboard/user-pricing-view";

 export default function PricingPage() {
   return (
     <div className="space-y-6">
       <Card className="border-2 shadow-xl overflow-hidden">
         <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white pb-4">
           <div className="flex items-center justify-between">
             <div>
               <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                 <DollarSign className="h-6 w-6" />
                 Pricing
               </CardTitle>
               <CardDescription className="text-purple-100 mt-2">
                 View your current service pricing and add-on rates
               </CardDescription>
             </div>
             <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
               <DollarSign className="h-7 w-7 text-white" />
             </div>
           </div>
         </CardHeader>
         <CardContent className="p-6">
           <UserPricingView />
         </CardContent>
       </Card>
     </div>
   );
 }

