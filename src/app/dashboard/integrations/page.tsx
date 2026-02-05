"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plug, Loader2, Plus, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const SHOPIFY_SCOPES = "read_orders,read_products,write_fulfillments,read_inventory";

type ShopifyConnectionSummary = {
  id: string;
  shop: string;
  shopName: string;
  connectedAt: { seconds: number; nanoseconds: number } | string;
};

export default function IntegrationsPage() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [shopifyConnections, setShopifyConnections] = useState<ShopifyConnectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [shopInput, setShopInput] = useState("");
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/integrations/shopify-connections", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load connections");
      const data = await res.json();
      setShopifyConnections(data.connections ?? []);
    } catch {
      setShopifyConnections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [user?.uid]);

  const handleConnectShopify = () => {
    const shop = shopInput.trim().toLowerCase().replace(/\.myshopify\.com$/i, "");
    if (!shop) {
      toast({ variant: "destructive", title: "Enter your store name", description: "e.g. mystore from mystore.myshopify.com" });
      return;
    }
    const clientId = process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID;
    if (!clientId) {
      toast({ variant: "destructive", title: "Configuration error", description: "Shopify app not configured." });
      return;
    }
    const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/dashboard/integrations/shopify/callback` : "";
    const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
    const url = `https://${shopDomain}/admin/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(SHOPIFY_SCOPES)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    setConnectDialogOpen(false);
    setShopInput("");
    window.location.href = url;
  };

  const handleDisconnect = async (id: string) => {
    if (!user) return;
    setDisconnectingId(id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/integrations/shopify-connections?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to disconnect");
      }
      toast({ title: "Disconnected", description: "Shopify store has been disconnected." });
      fetchConnections();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Error", description: err instanceof Error ? err.message : "Could not disconnect." });
    } finally {
      setDisconnectingId(null);
    }
  };

  const formatConnectedAt = (raw: ShopifyConnectionSummary["connectedAt"]) => {
    if (!raw) return "—";
    if (typeof raw === "string") return format(new Date(raw), "PP");
    if (raw.seconds) return format(new Date(raw.seconds * 1000), "PP");
    return "—";
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Plug className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-white">Integrations</CardTitle>
                <CardDescription className="text-emerald-100 mt-1">
                  Connect your stores and accounts. Orders and data sync automatically.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          {/* Shopify */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold">Shopify</h3>
                <p className="text-sm text-muted-foreground">
                  Connect one or more Shopify stores. Orders will sync to PSF StockFlow and admins can fulfill them here.
                </p>
              </div>
              <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
                <Button onClick={() => setConnectDialogOpen(true)} className="shrink-0">
                  <Plus className="h-4 w-4 mr-2" />
                  {shopifyConnections.length > 0 ? "Connect another store" : "Connect Shopify"}
                </Button>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Connect Shopify store</DialogTitle>
                    <DialogDescription>
                      Enter your store name (the part before .myshopify.com). You’ll be redirected to Shopify to authorize.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Store name</Label>
                      <Input
                        placeholder="e.g. mystore"
                        value={shopInput}
                        onChange={(e) => setShopInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleConnectShopify()}
                      />
                      <p className="text-xs text-muted-foreground">
                        From mystore.myshopify.com use: mystore
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleConnectShopify}>Continue to Shopify</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-6">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading connected stores…
              </div>
            ) : shopifyConnections.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
                <p className="text-sm text-muted-foreground">No Shopify stores connected yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Click “Connect Shopify” to add your first store.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {shopifyConnections.map((conn) => (
                  <li
                    key={conn.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{conn.shopName || conn.shop}</p>
                      <p className="text-sm text-muted-foreground truncate">{conn.shop}</p>
                      <p className="text-xs text-muted-foreground mt-1">Connected {formatConnectedAt(conn.connectedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDisconnect(conn.id)}
                        disabled={disconnectingId === conn.id}
                      >
                        {disconnectingId === conn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                        Disconnect
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Placeholder for future integrations */}
          <section className="pt-4 border-t">
            <h3 className="text-lg font-semibold text-muted-foreground">More integrations</h3>
            <p className="text-sm text-muted-foreground mt-1">Amazon and other platforms coming soon.</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
