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

  const getStatusBadge = (status: string | undefined) => {
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
      case "payment_failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Purchased Labels</h1>
        <p className="text-muted-foreground mt-2">
          View and download your purchased shipping labels
        </p>
      </div>

      {/* Date Filters */}
      {safeLabels && safeLabels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter by Date
            </CardTitle>
            <CardDescription>
              Filter labels by purchase date range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">From Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">To Date</Label>
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
            <Card key={label.id || `label-${index}`} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">Label #{label.id ? label.id.slice(0, 8) : 'N/A'}</CardTitle>
                  {getStatusBadge(label.status)}
                </div>
                <CardDescription>
                  {label.selectedRate?.provider || 'Unknown'} - {label.selectedRate?.serviceLevel || 'Standard'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <div className="pt-2 border-t">
                    <span className="font-medium">Amount: </span>
                    <span className="text-lg font-bold">
                      {label.paymentCurrency?.toUpperCase() || 'USD'} $
                      {label.paymentAmount ? (label.paymentAmount / 100).toFixed(2) : '0.00'}
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

                {label.errorMessage && (
                  <div className="p-2 bg-destructive/10 text-destructive text-xs rounded">
                    {label.errorMessage}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}



