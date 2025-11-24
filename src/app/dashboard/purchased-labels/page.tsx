"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Package, MapPin, Calendar, Truck, ExternalLink, Filter } from "lucide-react";
import type { LabelPurchase } from "@/types";
import { format } from "date-fns";

export default function PurchasedLabelsPage() {
  const { user, userProfile } = useAuth();
  const { data: labels, loading } = useCollection<LabelPurchase>(
    userProfile?.uid ? `users/${userProfile.uid}/labelPurchases` : ""
  );
  
  // Date filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
  // Ensure labels is always an array
  const safeLabels = labels || [];

  // Filter labels by date range
  const filteredLabels = useMemo(() => {
    if (!startDate && !endDate) {
      return safeLabels;
    }

    return safeLabels.filter((label) => {
      if (!label.createdAt) return false;

      let labelDate: Date;
      try {
        if (typeof label.createdAt === "string") {
          labelDate = new Date(label.createdAt);
        } else if (label.createdAt && typeof label.createdAt === "object" && "seconds" in label.createdAt) {
          labelDate = new Date((label.createdAt as any).seconds * 1000);
        } else {
          return false;
        }
      } catch (e) {
        return false;
      }

      // Set time to start of day for accurate comparison
      const labelDateOnly = new Date(
        labelDate.getFullYear(),
        labelDate.getMonth(),
        labelDate.getDate()
      );

      if (startDate && endDate) {
        const fromDate = new Date(startDate);
        const toDate = new Date(endDate);
        const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
        return labelDateOnly >= fromDateOnly && labelDateOnly <= toDateOnly;
      } else if (startDate) {
        const fromDate = new Date(startDate);
        const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        return labelDateOnly >= fromDateOnly;
      } else if (endDate) {
        const toDate = new Date(endDate);
        const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
        return labelDateOnly <= toDateOnly;
      }

      return true;
    });
  }, [safeLabels, startDate, endDate]);

  const getStatusBadge = (label: LabelPurchase) => {
    const { status, paymentStatus, errorMessage } = label;

    if (paymentStatus === "failed") {
      return <Badge variant="destructive">Payment Failed</Badge>;
    }

    if (paymentStatus === "canceled") {
      return <Badge className="bg-orange-500 text-white">Payment Canceled</Badge>;
    }

    if (paymentStatus === "pending" && errorMessage) {
      return <Badge className="bg-amber-500 text-white">Payment Issue</Badge>;
    }

    if (!status) return <Badge variant="outline">Unknown</Badge>;

    switch (status) {
      case "completed":
      case "label_purchased":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "payment_succeeded":
        return <Badge className="bg-blue-500">Processing</Badge>;
      case "payment_pending":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case "label_failed":
        return <Badge variant="destructive">Label Failed</Badge>;
      case "payment_failed":
        return <Badge variant="destructive">Payment Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const sanitizeErrorMessage = (message?: string | null) => {
    if (!message) return "";
    return message.replace(/stripe/gi, "payment processor").trim();
  };

  const getStatusDetail = (
    label: LabelPurchase
  ): {
    tone: "warning" | "error" | "info";
    title: string;
    message: string;
  } | null => {
    const { status, paymentStatus, errorMessage } = label;
    const sanitizedError = sanitizeErrorMessage(errorMessage);

    if (paymentStatus === "failed") {
      return {
        tone: "error",
        title: "Payment declined",
        message:
          sanitizedError ||
          "Your payment provider declined this charge. Please verify details with your bank or update the card before trying again.",
      };
    }

    if (paymentStatus === "canceled") {
      return {
        tone: "warning",
        title: "Payment canceled",
        message: "You canceled this payment before it completed. Start a new purchase when you're ready.",
      };
    }

    if (paymentStatus === "pending" && errorMessage) {
      return {
        tone: "warning",
        title: "Action required",
        message:
          sanitizedError ||
          "Your payment provider needs confirmation. Complete any authentication prompts or contact them, then retry the payment.",
      };
    }

    if (status === "label_failed") {
      return {
        tone: "error",
        title: "Issue on our side",
        message:
          sanitizedError ||
          "We ran into an issue generating this label. Please try again in a moment or contact support.",
      };
    }

    if (status === "payment_pending" && paymentStatus === "pending") {
      return {
        tone: "info",
        title: "Processing",
        message:
          "Awaiting confirmation from your payment provider. If your card shows declined or incomplete, resolve it with them and retry the purchase.",
      };
    }

    return null;
  };

  const handleDownloadLabel = (labelUrl: string, trackingNumber?: string) => {
    if (labelUrl) {
      window.open(labelUrl, "_blank");
    } else {
      alert("Label URL not available");
    }
  };

  const handleTrackShipment = (trackingNumber: string, provider: string) => {
    // Open tracking in new tab based on provider
    let trackingUrl = "";
    switch (provider.toLowerCase()) {
      case "usps":
        trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
        break;
      case "ups":
        trackingUrl = `https://www.ups.com/track?tracknum=${trackingNumber}`;
        break;
      case "fedex":
        trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
        break;
      case "dhl":
        trackingUrl = `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
        break;
      default:
        trackingUrl = `https://www.google.com/search?q=track+${trackingNumber}`;
    }
    window.open(trackingUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 bg-clip-text text-transparent">
            Purchased Labels
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          View, download, and track all labels you&apos;ve purchased.
        </p>
      </div>

      {/* Date Filters */}
      {safeLabels && safeLabels.length > 0 && (
        <Card className="border border-border/70 shadow-sm rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Filter className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle className="text-base">Filter by Date</CardTitle>
                  <CardDescription>
                    Narrow labels by purchase date range.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  From Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  To Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            {(startDate || endDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="mt-4 w-full sm:w-auto"
              >
                Clear Date Filter
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!safeLabels || safeLabels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No labels purchased yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Purchase your first shipping label to get started
            </p>
          </CardContent>
        </Card>
      ) : filteredLabels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No labels found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {startDate || endDate
                ? "No labels match the selected date range. Try adjusting your filters."
                : "Purchase your first shipping label to get started"}
            </p>
            {(startDate || endDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="mt-4"
              >
                Clear Date Filter
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLabels.map((label, index) => (
            <Card
              key={label.id || `label-${index}`}
              className="hover:shadow-md transition-shadow rounded-2xl border border-border/70"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">
                      Label #{label.id ? label.id.slice(0, 8) : "N/A"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {label.selectedRate?.provider || "Unknown"} •{" "}
                      {label.selectedRate?.serviceLevel || "Standard"}
                    </CardDescription>
                  </div>
                  {getStatusBadge(label)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">To:</span>
                    <span className="text-muted-foreground">
                      {label.toAddress?.city || 'N/A'}, {label.toAddress?.state || 'N/A'}
                    </span>
                  </div>
                  {label.trackingNumber && (
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Tracking:</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {label.trackingNumber}
                      </span>
                    </div>
                  )}
                  {label.createdAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {(() => {
                          try {
                            const date = typeof label.createdAt === "string"
                              ? new Date(label.createdAt)
                              : label.createdAt?.seconds
                                ? new Date(label.createdAt.seconds * 1000)
                                : new Date();
                            return format(date, "MMM d, yyyy");
                          } catch (e) {
                            return "Invalid date";
                          }
                        })()}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="text-base font-semibold">
                      {label.paymentCurrency?.toUpperCase() || "USD"} $
                      {label.paymentAmount ? (label.paymentAmount / 100).toFixed(2) : "0.00"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {label.labelUrl && label.status === "label_purchased" && (
                    <Button
                      size="sm"
                      onClick={() => handleDownloadLabel(label.labelUrl!, label.trackingNumber)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  )}
                  {label.trackingNumber && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleTrackShipment(label.trackingNumber!, label.selectedRate?.provider || '')
                      }
                      className="flex-1"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Track
                    </Button>
                  )}
                </div>

                {(() => {
                  const detail = getStatusDetail(label);
                  if (!detail) return null;

                  const toneStyles: Record<typeof detail.tone, string> = {
                    warning: "bg-amber-50 text-amber-700 border border-amber-200",
                    error: "bg-red-50 text-red-700 border border-red-200",
                    info: "bg-sky-50 text-sky-700 border border-sky-200",
                  };

                  return (
                    <div className={`p-3 text-xs rounded space-y-1 ${toneStyles[detail.tone]}`}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                        {detail.title}
                      </p>
                      <p className="text-[13px] leading-snug">{detail.message}</p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}



