"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Truck, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function TrackShipmentPage() {
  const [carrier, setCarrier] = useState<string>("usps");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<any | null>(null);

  const handleTrack = async () => {
    const trimmed = trackingNumber.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setTrackingData(null);

    try {
      const res = await fetch("/api/shippo/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trackingNumber: trimmed, carrier }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.details || data.error || "Failed to get tracking information.");
        return;
      }
      setTrackingData(data.tracking);
    } catch (e: any) {
      setError(e.message || "Something went wrong while fetching tracking data.");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = !trackingNumber.trim() || loading;

  const hasTrackingData = !!trackingData;
  const rawStatus = trackingData?.tracking_status?.status as string | undefined;
  const rawStatusDetails = trackingData?.tracking_status?.status_details as string | undefined;
  const statusUpper = rawStatus?.toUpperCase();
  const looksUnknown =
    !trackingData?.tracking_status ||
    statusUpper === "UNKNOWN" ||
    (rawStatusDetails && rawStatusDetails.toLowerCase().includes("not found"));

  const trackingDetailsDescription = !hasTrackingData
    ? "Results will appear here after you track a shipment."
    : looksUnknown
    ? "We couldn't find any tracking information for this tracking number. Please check the number and carrier, or try again later."
    : "Latest status for this tracking number.";

  return (
    <div className="container mx-auto max-w-2xl py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-transparent">
            Track Shipment
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your carrier and tracking number to see the latest status of your parcel.
        </p>
      </div>

      <Card className="shadow-md border border-border/70 rounded-2xl bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Truck className="h-4 w-4" />
            </span>
            <span className="text-lg">Track your label</span>
          </CardTitle>
          <CardDescription>
            Get real-time tracking updates from major carriers like USPS, UPS, FedEx, and DHL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid gap-4 sm:grid-cols-[0.9fr,1.4fr]">
            <div className="space-y-2">
              <Label htmlFor="carrier" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Carrier
              </Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger id="carrier">
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usps">USPS</SelectItem>
                  <SelectItem value="ups">UPS</SelectItem>
                  <SelectItem value="fedex">FedEx</SelectItem>
                  <SelectItem value="dhl">DHL</SelectItem>
                  <SelectItem value="other">Other / Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracking-number" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tracking Number
              </Label>
              <Input
                id="tracking-number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="9200 1903 96…"
                className="font-mono text-sm tracking-wide"
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={handleTrack}
            disabled={isDisabled}
            className="w-full sm:w-auto px-6"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking status…
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Track Shipment
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md border border-border/70 rounded-2xl bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Tracking details</CardTitle>
          <CardDescription>
            {trackingDetailsDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {trackingData ? (
            <>
              {trackingData.tracking_status && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Current status
                  </p>
                  <p className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-primary">
                    {trackingData.tracking_status.status || "Unknown"}
                  </p>
                  {trackingData.tracking_status.status_details && (
                    <p className="text-xs text-muted-foreground">
                      {trackingData.tracking_status.status_details}
                    </p>
                  )}
                </div>
              )}

              {Array.isArray(trackingData.tracking_history) &&
                trackingData.tracking_history.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recent scans
                    </p>
                    <ul className="space-y-1.5 text-xs">
                      {trackingData.tracking_history.slice(0, 5).map((event: any, idx: number) => (
                        <li
                          key={idx}
                          className="rounded-lg border border-border/70 bg-muted/60 px-3 py-2"
                        >
                          <div className="font-semibold">
                            {event.status || "Update"}
                          </div>
                          {event.location && (
                            <div className="text-muted-foreground">
                              {event.location.city && `${event.location.city}, `}
                              {event.location.state || event.location.zip || ""}
                            </div>
                          )}
                          {event.date && (
                            <div className="text-[10px] text-muted-foreground">
                              {event.date}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tracking data yet. Enter a tracking number above and click &quot;Track Shipment&quot;.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



