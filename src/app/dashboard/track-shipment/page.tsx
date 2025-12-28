"use client";

import { useMemo, useState } from "react";
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
import { Progress } from "@/components/ui/progress";

function formatDateTime(value: any) {
  if (!value) return "";
  let date: Date | null = null;
  if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "object") {
    if ("seconds" in value && typeof value.seconds === "number") {
      date = new Date(value.seconds * 1000);
    } else if ("_seconds" in value) {
      date = new Date(value._seconds * 1000);
    }
  }
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatStatus(status: string | undefined): string {
  if (!status) return "Update";
  const statusLower = status.toLowerCase();
  
  // Map common statuses to user-friendly text
  if (statusLower.includes("delivered")) return "Delivered";
  if (statusLower.includes("out_for_delivery") || statusLower.includes("out for delivery")) return "Out for Delivery";
  if (statusLower.includes("arrived_at_post_office") || statusLower.includes("arrived at post office")) return "Arrived at Post Office";
  if (statusLower.includes("arrived_at_usps") || statusLower.includes("arrived at usps")) return "Arrived at USPS Regional Facility";
  if (statusLower.includes("in_transit") || statusLower.includes("in transit")) return "In Transit to Next Facility";
  if (statusLower.includes("departed") || statusLower.includes("departed usps")) return "Departed USPS Facility";
  if (statusLower.includes("arrived_at_facility") || statusLower.includes("arrived at facility")) return "Arrived at USPS Facility";
  if (statusLower.includes("pre_transit") || statusLower.includes("pre transit")) return "Label Created";
  if (statusLower.includes("transit")) return "In Transit";
  
  // Capitalize first letter of each word
  return status
    .split(/[_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getTimelineDate(event: any) {
  return (
    event?.status_date ||
    event?.timestamp ||
    event?.date ||
    event?.object_created ||
    event?.created_at
  );
}

function getProgressValue(statusRaw: string | undefined) {
  if (!statusRaw) return 12;
  const status = statusRaw.toLowerCase();
  if (status.includes("delivered")) return 100;
  if (status.includes("out_for_delivery")) return 85;
  if (status.includes("transit")) return 65;
  if (status.includes("pre_transit")) return 40;
  if (status.includes("unknown")) return 20;
  return 50;
}

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

  const rawStatus = trackingData?.tracking_status?.status as string | undefined;
  const rawStatusDetails = trackingData?.tracking_status?.status_details as string | undefined;

  const looksUnknown = useMemo(() => {
    const statusUpper = rawStatus?.toUpperCase();
    return (
      !trackingData?.tracking_status ||
      statusUpper === "UNKNOWN" ||
      (rawStatusDetails && rawStatusDetails.toLowerCase().includes("not found"))
    );
  }, [trackingData, rawStatus, rawStatusDetails]);

  const timelineEvents = trackingData?.tracking_history ?? [];
  const progressValue = getProgressValue(trackingData?.tracking_status?.status);

  const statusMessage = !trackingData
    ? "Results will appear here after you track a shipment."
    : looksUnknown
    ? "We couldn't find any tracking information for this tracking number. Please double-check the number and carrier."
    : "Latest status for this tracking number.";

  const latestLocation =
    trackingData?.tracking_status?.location || timelineEvents?.[0]?.location;
  const latestLocationText = latestLocation
    ? [latestLocation.city, latestLocation.state || latestLocation.zip]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="container mx-auto max-w-3xl py-8 space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-transparent">
            Track Shipment
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your carrier and tracking number to get the latest status within seconds.
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
            Works with USPS, UPS, FedEx, DHL and other major carriers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid gap-4 sm:grid-cols-[0.9fr,1.4fr]">
            <div className="space-y-2">
              <Label
                htmlFor="carrier"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
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
              <Label
                htmlFor="tracking-number"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
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
                Checking status...
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

      {trackingData ? (
        <Card className="border border-white/20 bg-slate-950 text-slate-50 shadow-2xl shadow-slate-950/40 rounded-2xl">
          <CardContent className="space-y-6 p-6">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
              <div className="text-xs uppercase text-slate-400">Tracking number</div>
              <div className="font-mono text-base font-semibold text-white">
                {trackingData.tracking_number || trackingNumber}
              </div>
              {trackingData.eta && (
                <div className="text-sm font-semibold text-emerald-400">
                  Expected delivery {formatDateTime(trackingData.eta)}
                </div>
              )}
              {trackingData.tracking_status?.status && (
                <div className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  {trackingData.tracking_status.status}
                </div>
              )}
              <p className="text-xs text-slate-400">{statusMessage}</p>
              {latestLocationText && (
                <p className="text-xs text-slate-400">
                  Latest scan:{" "}
                  <span className="text-slate-100">{latestLocationText}</span>
                </p>
              )}
              <div className="pt-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
                  <span>Label created</span>
                  <span>Delivered</span>
                </div>
                <Progress value={progressValue} className="mt-2 h-2 bg-slate-800" />
              </div>
            </div>

            {timelineEvents.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
                  Tracking History
                </p>
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-600"></div>
                  
                  {/* Timeline events - reverse chronological (most recent first) */}
                  <div className="space-y-6 pl-8">
                    {timelineEvents.slice(0, 10).map((event: any, idx: number) => {
                      const location = event?.location || {};
                      const locationText = [
                        location.city,
                        location.state,
                        location.zip,
                        location.facility_name
                      ]
                        .filter(Boolean)
                        .join(", ");
                      const dateText = formatDateTime(getTimelineDate(event));
                      const statusText = formatStatus(event.status);
                      const isDelivered = statusText.toLowerCase().includes("delivered") && idx === 0;
                      const isFirst = idx === 0;

                      return (
                        <div key={idx} className="relative">
                          {/* Timeline node */}
                          <div
                            className={`absolute -left-9 top-1 h-4 w-4 rounded-full border-2 ${
                              isDelivered
                                ? "bg-green-500 border-green-500"
                                : "bg-blue-600 border-blue-600"
                            }`}
                          />
                          
                          {/* Event content */}
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-white">
                              {statusText}
                            </p>
                            {event.status_details && (
                              <p className="text-xs text-slate-300">{event.status_details}</p>
                            )}
                            {locationText && (
                              <p className="text-xs text-slate-400">{locationText}</p>
                            )}
                            {dateText && (
                              <p className="text-xs text-slate-400">{dateText}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md border border-border/70 rounded-2xl bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Tracking details</CardTitle>
            <CardDescription>
              Results will appear here after you track a shipment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Enter a tracking number above and click “Track Shipment” to view the full
              timeline.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}



