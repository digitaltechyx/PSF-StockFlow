"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/hooks/use-collection";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { generateQuoteInvoicePdfBlob } from "@/lib/quote-invoice-generator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle,
  CircleArrowLeft,
  Clock,
  Download,
  FileText,
  Loader2,
  Mail,
  Plus,
  Receipt,
  RotateCcw,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

type ExternalInvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "disputed"
  | "cancelled";

type PaymentMethod = "Zelle" | "ACH" | "Wire" | "Cash" | "Other";

interface ExternalInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface ExternalInvoicePayment {
  id: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt?: any;
}

interface ExternalInvoiceDispute {
  reason?: string;
  notes?: string;
  status?: "Open" | "Resolved";
  updatedAt?: any;
}

interface ExternalInvoiceCancel {
  reason?: string;
  cancelledAt?: any;
}

interface ExternalInvoice {
  id: string;
  status: ExternalInvoiceStatus;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  clientCity?: string;
  clientState?: string;
  clientZip?: string;
  clientCountry?: string;
  terms?: string;
  items: ExternalInvoiceItem[];
  subtotal: number;
  salesTax: number;
  shippingCost: number;
  total: number;
  amountPaid: number;
  outstandingBalance: number;
  payments: ExternalInvoicePayment[];
  sentAt?: any;
  dispute?: ExternalInvoiceDispute;
  cancelled?: ExternalInvoiceCancel;
  createdAt?: any;
  updatedAt?: any;
}

const TAX_RATE = 0.06625;

const COMPANY_INFO = {
  name: "Prep Services FBA",
  addressLines: ["7000 Atrium Way B05", "Mount Laurel, NJ, 08054"],
  phone: "+1-347-661-3010",
  email: "info@prepservicesfba.com",
};

const INVOICE_TERMS = [
  "Invoices must be paid in full before work begins unless written credit terms are approved by management.",
  "Unpaid invoices after the due time may incur a $19 late fee per invoice.",
  "Prep Services FBA may pause receiving, prep, storage, and shipments until payment is completed.",
  "All completed labor services are non-refundable.",
  "Client is responsible for product compliance, labeling accuracy, and marketplace requirements.",
  "Any billing concern must be reported within 48 hours of invoice receipt. Unauthorized chargebacks may result in service suspension.",
].join("\n");

const createEmptyItem = (): ExternalInvoiceItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unitPrice: 0,
  amount: 0,
});

const createInvoiceNumber = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `INV-${year}${month}-${randomNum}`;
};

const createEmptyInvoiceForm = (): Omit<ExternalInvoice, "id"> => {
  const today = new Date();
  const due = new Date(today);
  due.setDate(today.getDate() + 2);
  return {
    status: "draft",
    invoiceNumber: createInvoiceNumber(),
    invoiceDate: today.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    clientCity: "",
    clientState: "",
    clientZip: "",
    clientCountry: "",
    terms: INVOICE_TERMS,
    items: [createEmptyItem()],
    subtotal: 0,
    salesTax: 0,
    shippingCost: 0,
    total: 0,
    amountPaid: 0,
    outstandingBalance: 0,
    payments: [],
  };
};

const formatDate = (value?: any) => {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? new Date(value) : value?.toDate?.() || new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString();
  } catch {
    return "—";
  }
};

const toNumber = (value: string | number) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isOverdueInvoice = (invoice: ExternalInvoice) => {
  if (invoice.status === "paid" || invoice.status === "cancelled" || invoice.status === "disputed") {
    return false;
  }
  const due = new Date(invoice.dueDate);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return (invoice.status === "sent" || invoice.status === "partially_paid") && due < today;
};

export function InvoiceManagementPortal() {
  const { userProfile, user } = useAuth();
  const { toast } = useToast();

  const invoiceTemplateRef = useRef<HTMLDivElement | null>(null);
  const [isPrintMode, setIsPrintMode] = useState(false);

  const toBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  };

  const invoicesQuery = useMemo(
    () => query(collection(db, "external_invoices"), orderBy("createdAt", "desc")),
    []
  );
  const { data: invoices, loading } = useCollection<ExternalInvoice>("external_invoices", invoicesQuery);

  const deleteLogsQuery = useMemo(
    () => query(collection(db, "external_invoice_delete_logs"), orderBy("deletedAt", "desc")),
    []
  );
  const { data: deleteLogs } = useCollection<{ id: string; restored?: boolean; [k: string]: any }>(
    "external_invoice_delete_logs",
    deleteLogsQuery
  );
  const nonRestoredDeleteLogs = useMemo(
    () => (deleteLogs || []).filter((log) => !log.restored),
    [deleteLogs]
  );

  const [activeTab, setActiveTab] = useState("new");
  const [formData, setFormData] = useState(createEmptyInvoiceForm());
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to: "",
    subject: "",
    message: "",
    attachments: [] as File[],
  });
  const [activeEmailInvoice, setActiveEmailInvoice] = useState<ExternalInvoice | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteInvoice, setDeleteInvoice] = useState<ExternalInvoice | null>(null);

  const [partialDialogOpen, setPartialDialogOpen] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const [partialInvoice, setPartialInvoice] = useState<ExternalInvoice | null>(null);

  const [paidDialogOpen, setPaidDialogOpen] = useState(false);
  const [paidInvoice, setPaidInvoice] = useState<ExternalInvoice | null>(null);
  const [paidForm, setPaidForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amountPaid: "",
    method: "Zelle" as PaymentMethod,
    reference: "",
    notes: "",
  });

  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeInvoice, setDisputeInvoice] = useState<ExternalInvoice | null>(null);
  const [disputeForm, setDisputeForm] = useState({
    reason: "",
    notes: "",
    status: "Open" as "Open" | "Resolved",
  });

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelInvoice, setCancelInvoice] = useState<ExternalInvoice | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [paymentHistoryPage, setPaymentHistoryPage] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const recalculateTotals = (
    items: ExternalInvoiceItem[],
    shippingCostValue: number,
    currentSalesTax?: number
  ) => {
    const updatedItems = items.map((item) => ({
      ...item,
      amount: Number(item.quantity || 0) * Number(item.unitPrice || 0),
    }));
    const subtotal = updatedItems.reduce((sum, item) => sum + item.amount, 0);
    // Use current sales tax if provided, otherwise calculate from TAX_RATE
    const salesTax = currentSalesTax !== undefined 
      ? Number(currentSalesTax) 
      : Number((subtotal * TAX_RATE).toFixed(2));
    const total = Number((subtotal + salesTax + shippingCostValue).toFixed(2));
    const amountPaid = formData.amountPaid || 0;
    const outstandingBalance = Math.max(0, Number((total - amountPaid).toFixed(2)));
    return {
      items: updatedItems,
      subtotal,
      salesTax,
      total,
      amountPaid,
      outstandingBalance,
    };
  };

  const statusCounts = useMemo(() => {
    const counts = {
      draft: 0,
      sent: 0,
      partiallyPaid: 0,
      paid: 0,
      overdue: 0,
      disputed: 0,
      cancelled: 0,
    };
    invoices.forEach((invoice) => {
      if (isOverdueInvoice(invoice)) {
        counts.overdue += 1;
        return;
      }
      switch (invoice.status) {
        case "draft":
          counts.draft += 1;
          break;
        case "sent":
          counts.sent += 1;
          break;
        case "partially_paid":
          counts.partiallyPaid += 1;
          break;
        case "paid":
          counts.paid += 1;
          break;
        case "disputed":
          counts.disputed += 1;
          break;
        case "cancelled":
          counts.cancelled += 1;
          break;
        default:
          break;
      }
    });
    return counts;
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const queryText = searchQuery.trim().toLowerCase();
    if (!queryText) return invoices;
    return invoices.filter((invoice) =>
      [invoice.invoiceNumber, invoice.clientName, invoice.clientEmail]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(queryText))
    );
  }, [invoices, searchQuery]);

  const draftInvoices = filteredInvoices.filter((invoice) => invoice.status === "draft");
  const sentInvoices = filteredInvoices.filter(
    (invoice) => invoice.status === "sent" && !isOverdueInvoice(invoice)
  );
  const partiallyPaidInvoices = filteredInvoices.filter(
    (invoice) => invoice.status === "partially_paid" && !isOverdueInvoice(invoice)
  );
  const paidInvoices = filteredInvoices.filter((invoice) => invoice.status === "paid");
  const overdueInvoices = filteredInvoices.filter((invoice) => isOverdueInvoice(invoice));
  const disputedInvoices = filteredInvoices.filter((invoice) => invoice.status === "disputed");
  const cancelledInvoices = filteredInvoices.filter((invoice) => invoice.status === "cancelled");

  const paymentHistory = useMemo(() => {
    const list: Array<ExternalInvoicePayment & { invoiceNumber: string; clientName: string; total: number }> = [];
    invoices.forEach((invoice) => {
      invoice.payments?.forEach((payment) => {
        list.push({
          ...payment,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          total: invoice.total,
        });
      });
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices]);

  const getPaginatedData = <T,>(data: T[], page: number) => {
    const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      paginatedData: data.slice(startIndex, endIndex),
      totalPages,
      startIndex,
      endIndex,
    };
  };

  const resetForm = () => {
    setFormData(createEmptyInvoiceForm());
    setEditingInvoiceId(null);
  };

  const updateItem = (id: string, field: keyof ExternalInvoiceItem, value: string) => {
    setFormData((prev) => {
      const nextItems = prev.items.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "description" ? value : toNumber(value),
            }
          : item
      );
      return {
        ...prev,
        ...recalculateTotals(nextItems, toNumber(prev.shippingCost), prev.salesTax),
      };
    });
  };

  const addItem = () => {
    setFormData((prev) => {
      const nextItems = [...prev.items, createEmptyItem()];
      return {
        ...prev,
        ...recalculateTotals(nextItems, toNumber(prev.shippingCost), prev.salesTax),
      };
    });
  };

  const removeItem = (id: string) => {
    setFormData((prev) => {
      const nextItems = prev.items.length > 1 ? prev.items.filter((item) => item.id !== id) : prev.items;
      return {
        ...prev,
        ...recalculateTotals(nextItems, toNumber(prev.shippingCost), prev.salesTax),
      };
    });
  };

  const buildInvoicePdfData = (invoice: ExternalInvoice) => {
    const formatDateForPdf = (dateStr?: string) => {
      if (!dateStr) return undefined;
      try {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      } catch {
        return dateStr;
      }
    };
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: formatDateForPdf(invoice.invoiceDate) || invoice.invoiceDate,
      dueDate: formatDateForPdf(invoice.dueDate),
    company: {
      name: COMPANY_INFO.name,
      email: COMPANY_INFO.email,
      phone: COMPANY_INFO.phone,
      addressLine: COMPANY_INFO.addressLines[0] || "",
      cityStateZip: COMPANY_INFO.addressLines[1] || "",
      country: "United States",
    },
    soldTo: {
      name: invoice.clientName || "",
      email: invoice.clientEmail || "",
      phone: invoice.clientPhone || "",
      addressLine: invoice.clientAddress || "",
      cityStateZip: [invoice.clientCity, invoice.clientState, invoice.clientZip].filter(Boolean).join(", "),
      country: invoice.clientCountry || "",
    },
    items: invoice.items.map((item) => ({
      description: item.description || "",
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      amount: Number(item.amount || 0),
    })),
    subtotal: invoice.subtotal,
    salesTax: invoice.salesTax || 0,
    shippingCost: invoice.shippingCost || 0,
    total: invoice.total,
    terms: invoice.terms,
  };
  };

  const downloadInvoicePdf = async (invoice: ExternalInvoice) => {
    try {
      const blob = await generateQuoteInvoicePdfBlob(buildInvoicePdfData(invoice));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice-${invoice.invoiceNumber}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error("Failed to download invoice PDF:", error);
      toast({ variant: "destructive", title: "Failed to download invoice PDF." });
    }
  };

  const saveInvoiceRecord = async (status: ExternalInvoiceStatus) => {
    const payload: Omit<ExternalInvoice, "id"> = {
      ...formData,
      status,
      amountPaid: formData.amountPaid || 0,
      outstandingBalance: formData.outstandingBalance || 0,
      updatedAt: serverTimestamp(),
    };

    if (editingInvoiceId) {
      await updateDoc(doc(db, "external_invoices", editingInvoiceId), payload as any);
      return { ...payload, id: editingInvoiceId } as ExternalInvoice;
    }

    const docRef = await addDoc(collection(db, "external_invoices"), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return { ...payload, id: docRef.id } as ExternalInvoice;
  };

  const viewInvoicePdf = async (invoice: ExternalInvoice) => {
    try {
      const blob = await generateQuoteInvoicePdfBlob(buildInvoicePdfData(invoice));
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error("Failed to preview invoice PDF:", error);
      toast({ variant: "destructive", title: "Failed to preview invoice PDF." });
    }
  };

  const downloadPaidInvoicesCsv = () => {
    if (!paidInvoices.length) {
      toast({ variant: "destructive", title: "No paid invoices to export." });
      return;
    }
    const headers = [
      "Invoice Number",
      "Client Name",
      "Client Email",
      "Invoice Date",
      "Due Date",
      "Total",
      "Amount Paid",
      "Outstanding Balance",
      "Payment Count",
      "Last Payment Date",
    ];
    const rows = paidInvoices.map((invoice) => {
      const lastPayment = invoice.payments?.length
        ? invoice.payments[invoice.payments.length - 1]
        : undefined;
      return [
        invoice.invoiceNumber,
        invoice.clientName,
        invoice.clientEmail,
        invoice.invoiceDate,
        invoice.dueDate,
        invoice.total.toFixed(2),
        invoice.amountPaid.toFixed(2),
        invoice.outstandingBalance.toFixed(2),
        String(invoice.payments?.length || 0),
        lastPayment?.date || "",
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `paid-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const downloadReceiptPdf = (
    payment: ExternalInvoicePayment & { invoiceNumber: string; clientName: string; total: number }
  ) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Payment Receipt", 14, 20);
    doc.setFontSize(11);
    doc.text(`Invoice: ${payment.invoiceNumber}`, 14, 32);
    doc.text(`Client: ${payment.clientName}`, 14, 40);
    doc.text(`Payment Date: ${payment.date}`, 14, 48);
    doc.text(`Payment Method: ${payment.method}`, 14, 56);
    doc.text(`Amount Paid: $${payment.amount.toFixed(2)}`, 14, 64);
    doc.text(`Invoice Total: $${payment.total.toFixed(2)}`, 14, 72);
    if (payment.reference) {
      doc.text(`Reference: ${payment.reference}`, 14, 80);
    }
    if (payment.notes) {
      doc.text("Notes:", 14, 88);
      doc.text(payment.notes, 14, 96);
    }
    doc.save(`Receipt-${payment.invoiceNumber}-${payment.date}.pdf`);
  };

  const saveInvoice = async (status: ExternalInvoiceStatus) => {
    if (!userProfile) {
      toast({ variant: "destructive", title: "You must be logged in to save invoices." });
      return;
    }

    setSaving(true);
    try {
      await saveInvoiceRecord(status);

      toast({ title: status === "draft" ? "Invoice saved as draft." : "Invoice saved." });
      resetForm();
      if (status === "draft") {
        setActiveTab("draft");
      }
    } catch (error) {
      console.error("Failed to save invoice:", error);
      toast({ variant: "destructive", title: "Failed to save invoice." });
    } finally {
      setSaving(false);
    }
  };

  const handleSendFromForm = async () => {
    if (!userProfile) {
      toast({ variant: "destructive", title: "You must be logged in to send invoices." });
      return;
    }
    setSaving(true);
    try {
      const savedInvoice = await saveInvoiceRecord("draft");
      setEditingInvoiceId(savedInvoice.id);
      setActiveTab("draft");
      openEmailDialog(savedInvoice);
    } catch (error) {
      console.error("Failed to prepare invoice for sending:", error);
      toast({ variant: "destructive", title: "Failed to prepare invoice for sending." });
    } finally {
      setSaving(false);
    }
  };

  const handleEditInvoice = (invoice: ExternalInvoice) => {
    const normalizedItems = (invoice.items || []).map((it: ExternalInvoiceItem, i: number) => ({
      id: it.id || crypto.randomUUID(),
      description: String(it.description ?? ""),
      quantity: Number(it.quantity ?? 0),
      unitPrice: Number(it.unitPrice ?? 0),
      amount: Number(it.amount ?? 0),
    }));
    setFormData({
      ...invoice,
      items: normalizedItems.length ? normalizedItems : [createEmptyItem()],
    });
    setEditingInvoiceId(invoice.id);
    setActiveTab("new");
  };

  const handleDeleteInvoice = (invoice: ExternalInvoice) => {
    setDeleteInvoice(invoice);
    setDeleteReason("");
    setDeleteDialogOpen(true);
  };

  const confirmDeleteInvoice = async () => {
    if (!deleteInvoice) return;
    setSaving(true);
    try {
      const { id: _id, ...rest } = deleteInvoice;
      await addDoc(collection(db, "external_invoice_delete_logs"), {
        ...rest,
        invoiceId: deleteInvoice.id,
        deletedBy: userProfile?.uid || "",
        deletedByName: userProfile?.name || userProfile?.email || "Unknown",
        deletedAt: serverTimestamp(),
        reason: deleteReason.trim(),
      });
      await deleteDoc(doc(db, "external_invoices", deleteInvoice.id));
      toast({ title: "Invoice deleted and logged." });
      setDeleteDialogOpen(false);
      setDeleteInvoice(null);
      setDeleteReason("");
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      toast({ variant: "destructive", title: "Failed to delete invoice." });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreInvoice = async (log: { id: string; [k: string]: any }) => {
    if (!userProfile) {
      toast({ variant: "destructive", title: "You must be logged in to restore invoices." });
      return;
    }
    setSaving(true);
    try {
      const {
        id: _logId,
        invoiceId: _invoiceId,
        deletedBy,
        deletedByName,
        deletedAt,
        reason,
        restored: _r,
        restoredAt: _ra,
        restoredInvoiceId: _ri,
        ...invoiceData
      } = log;
      const cleanInvoice = {
        ...invoiceData,
        status: (log.status as ExternalInvoiceStatus) || "draft",
        items:
          Array.isArray(log.items) && log.items.length
            ? log.items.map((it: any) => ({ ...it, id: it.id || crypto.randomUUID() }))
            : [createEmptyItem()],
        payments: Array.isArray(log.payments) ? log.payments : [],
        amountPaid: Number(log.amountPaid ?? 0),
        outstandingBalance: Number(log.outstandingBalance ?? 0),
      };
      const docRef = await addDoc(collection(db, "external_invoices"), {
        ...cleanInvoice,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "external_invoice_delete_logs", log.id), {
        restored: true,
        restoredAt: serverTimestamp(),
        restoredInvoiceId: docRef.id,
      });
      toast({
        title: "Invoice restored",
        description: `${log.invoiceNumber ?? "Invoice"} has been restored to ${log.status ?? "draft"} status.`,
      });
      setActiveTab(log.status === "draft" ? "draft" : "new");
    } catch (error) {
      console.error("Failed to restore invoice:", error);
      toast({ variant: "destructive", title: "Failed to restore invoice." });
    } finally {
      setSaving(false);
    }
  };

  const openEmailDialog = (invoice: ExternalInvoice) => {
    setActiveEmailInvoice(invoice);
    setEmailForm({
      to: invoice.clientEmail || "",
      subject: `Prep Services FBA - Invoice ${invoice.invoiceNumber}`,
      message: "",
      attachments: [],
    });
    setEmailDialogOpen(true);
  };

  const sendInvoiceEmail = async () => {
    if (!activeEmailInvoice || !user) return;
    setIsSendingEmail(true);
    try {
      const invoiceBlob = await generateQuoteInvoicePdfBlob(buildInvoicePdfData(activeEmailInvoice));
      const invoiceFile = new File([invoiceBlob], `Invoice-${activeEmailInvoice.invoiceNumber}.pdf`, {
        type: "application/pdf",
      });
      const attachmentsToSend = [invoiceFile, ...emailForm.attachments];

      const idToken = await user.getIdToken();
      const headers: HeadersInit = {
        Authorization: `Bearer ${idToken}`,
      };
      const externalEmailApi = process.env.NEXT_PUBLIC_EMAIL_API_URL;
      const vercelBypass = process.env.NEXT_PUBLIC_VERCEL_PROTECTION_BYPASS;
      if (vercelBypass) {
        headers["x-vercel-protection-bypass"] = vercelBypass;
      }

      let response: Response;
      if (externalEmailApi) {
        const attachmentsPayload = await Promise.all(
          attachmentsToSend.map(async (file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            dataBase64: toBase64(await file.arrayBuffer()),
          }))
        );
        response = await fetch(externalEmailApi, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: emailForm.to.trim(),
            subject: emailForm.subject.trim(),
            message: emailForm.message || "",
            attachments: attachmentsPayload,
          }),
        });
      } else {
        const payload = new FormData();
        payload.append("to", emailForm.to.trim());
        payload.append("subject", emailForm.subject.trim());
        payload.append("message", emailForm.message || "");
        attachmentsToSend.forEach((file) => payload.append("attachments", file));
        const apiUrl = vercelBypass
          ? `/api/email/send?x-vercel-protection-bypass=${encodeURIComponent(vercelBypass)}`
          : "/api/email/send";
        response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: payload,
        });
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to send invoice.");
      }

      await updateDoc(doc(db, "external_invoices", activeEmailInvoice.id), {
        status: "sent",
        sentAt: activeEmailInvoice.sentAt || new Date(),
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Invoice send." });
      setEmailDialogOpen(false);
      setActiveEmailInvoice(null);
      setActiveTab("sent");
    } catch (error) {
      console.error("Failed to send invoice:", error);
      toast({ variant: "destructive", title: "Failed to send invoice." });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const applyPartialPayment = async () => {
    if (!partialInvoice) return;
    const amount = toNumber(partialAmount);
    if (amount <= 0) {
      toast({ variant: "destructive", title: "Enter a valid payment amount." });
      return;
    }
    setSaving(true);
    try {
      const updatedPaid = Number((partialInvoice.amountPaid + amount).toFixed(2));
      const outstanding = Math.max(0, Number((partialInvoice.total - updatedPaid).toFixed(2)));
      const payments = [
        ...(partialInvoice.payments || []),
        {
          id: crypto.randomUUID(),
          amount,
          date: new Date().toISOString().slice(0, 10),
          method: "Other",
          createdAt: serverTimestamp(),
        },
      ];

      await updateDoc(doc(db, "external_invoices", partialInvoice.id), {
        amountPaid: updatedPaid,
        outstandingBalance: outstanding,
        status: outstanding === 0 ? "paid" : "partially_paid",
        payments,
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Partial payment applied." });
      setPartialDialogOpen(false);
      setPartialAmount("");
      setPartialInvoice(null);
    } catch (error) {
      console.error("Failed to apply partial payment:", error);
      toast({ variant: "destructive", title: "Failed to apply payment." });
    } finally {
      setSaving(false);
    }
  };

  const applyPaidPayment = async () => {
    if (!paidInvoice) return;
    if (!paidForm.paymentDate || !paidForm.amountPaid) {
      toast({ variant: "destructive", title: "Payment date and amount are required." });
      return;
    }
    const amount = toNumber(paidForm.amountPaid);
    if (amount <= 0) {
      toast({ variant: "destructive", title: "Enter a valid payment amount." });
      return;
    }
    setSaving(true);
    try {
      const updatedPaid = Number((paidInvoice.amountPaid + amount).toFixed(2));
      const outstanding = Math.max(0, Number((paidInvoice.total - updatedPaid).toFixed(2)));
      const payments = [
        ...(paidInvoice.payments || []),
        {
          id: crypto.randomUUID(),
          amount,
          date: paidForm.paymentDate,
          method: paidForm.method,
          reference: paidForm.reference || "",
          notes: paidForm.notes || "",
          createdAt: serverTimestamp(),
        },
      ];

      await updateDoc(doc(db, "external_invoices", paidInvoice.id), {
        amountPaid: updatedPaid,
        outstandingBalance: outstanding,
        status: outstanding === 0 ? "paid" : "partially_paid",
        payments,
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Payment recorded." });
      setPaidDialogOpen(false);
      setPaidInvoice(null);
      setPaidForm({
        paymentDate: new Date().toISOString().slice(0, 10),
        amountPaid: "",
        method: "Zelle",
        reference: "",
        notes: "",
      });
    } catch (error) {
      console.error("Failed to record payment:", error);
      toast({ variant: "destructive", title: "Failed to record payment." });
    } finally {
      setSaving(false);
    }
  };

  const applyDispute = async () => {
    if (!disputeInvoice) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "external_invoices", disputeInvoice.id), {
        status: "disputed",
        dispute: {
          ...disputeForm,
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Invoice marked as disputed." });
      setDisputeDialogOpen(false);
      setDisputeInvoice(null);
      setDisputeForm({ reason: "", notes: "", status: "Open" });
    } catch (error) {
      console.error("Failed to mark dispute:", error);
      toast({ variant: "destructive", title: "Failed to mark disputed." });
    } finally {
      setSaving(false);
    }
  };

  const resolveDisputeStatus = async (invoice: ExternalInvoice, status: "sent") => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "external_invoices", invoice.id), {
        status,
        dispute: {
          ...(invoice.dispute || {}),
          status: "Resolved",
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Dispute resolved." });
    } catch (error) {
      console.error("Failed to resolve dispute:", error);
      toast({ variant: "destructive", title: "Failed to resolve dispute." });
    } finally {
      setSaving(false);
    }
  };

  const applyCancel = async () => {
    if (!cancelInvoice) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "external_invoices", cancelInvoice.id), {
        status: "cancelled",
        cancelled: {
          reason: cancelReason.trim(),
          cancelledAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Invoice cancelled." });
      setCancelDialogOpen(false);
      setCancelInvoice(null);
      setCancelReason("");
    } catch (error) {
      console.error("Failed to cancel invoice:", error);
      toast({ variant: "destructive", title: "Failed to cancel invoice." });
    } finally {
      setSaving(false);
    }
  };

  const renderInvoiceRow = (
    invoice: ExternalInvoice,
    options?: { showActions?: boolean; allowDisputeActions?: boolean; hideSendAndDownload?: boolean }
  ) => {
    const overdue = isOverdueInvoice(invoice);
    const lastPayment = invoice.payments?.length ? invoice.payments[invoice.payments.length - 1] : undefined;
    const paymentsDisabled = invoice.status === "cancelled";
    const btnClass = "h-8 w-8 p-0 shrink-0";
    return (
      <Card
        key={invoice.id}
        className={cn(
          "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.01] border-2",
          overdue ? "border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/10" : "border-gray-200 dark:border-gray-800"
        )}
      >
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-md shrink-0">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate">
                  {invoice.clientName || "—"}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {invoice.clientEmail || "—"}
                </p>
                <div className="flex flex-wrap gap-x-2 gap-y-1 items-center text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                    {invoice.invoiceNumber}
                  </span>
                  <span>Due {formatDate(invoice.dueDate)}</span>
                  {invoice.sentAt && <span>Sent {formatDate(invoice.sentAt)}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <Badge variant="secondary" className="capitalize text-xs">
                {overdue ? "Overdue" : invoice.status.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Total ${invoice.total.toFixed(2)}
              </Badge>
              {invoice.status === "partially_paid" && (
                <Badge variant="outline" className="text-xs">
                  Paid ${invoice.amountPaid.toFixed(2)}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                Outstanding ${invoice.outstandingBalance.toFixed(2)}
              </Badge>
              {invoice.status === "partially_paid" && lastPayment?.date && (
                <Badge variant="outline" className="text-xs">
                  Last Payment {formatDate(lastPayment.date)}
                </Badge>
              )}
            </div>
            {options?.showActions && (
              <div className="flex flex-wrap gap-1.5 justify-end items-center">
                {options?.allowDisputeActions && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`${btnClass} hover:bg-slate-500 hover:text-white`}
                      title="Back to Sent"
                      onClick={() => resolveDisputeStatus(invoice, "sent")}
                    >
                      <CircleArrowLeft className="h-4 w-4" />
                    </Button>
                    {overdue && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={`${btnClass} hover:bg-red-500 hover:text-white`}
                        title="Back to Overdue"
                        onClick={() => resolveDisputeStatus(invoice, "sent")}
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
                {!options?.hideSendAndDownload && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`${btnClass} hover:bg-purple-500 hover:text-white`}
                      title="Send"
                      onClick={() => openEmailDialog(invoice)}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`${btnClass} hover:bg-blue-500 hover:text-white`}
                      title="Download"
                      onClick={() => downloadInvoicePdf(invoice)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={`${btnClass} hover:bg-indigo-500 hover:text-white`}
                  title="View"
                  onClick={() => viewInvoicePdf(invoice)}
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${btnClass} hover:bg-amber-500 hover:text-white`}
                  title="Partially Paid"
                  disabled={paymentsDisabled}
                  onClick={() => {
                    setPartialInvoice(invoice);
                    setPartialAmount("");
                    setPartialDialogOpen(true);
                  }}
                >
                  <BadgeDollarSign className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${btnClass} hover:bg-green-500 hover:text-white`}
                  title="Paid"
                  disabled={paymentsDisabled}
                  onClick={() => {
                    setPaidInvoice(invoice);
                    setPaidDialogOpen(true);
                  }}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
                {!options?.allowDisputeActions && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${btnClass} hover:bg-orange-500 hover:text-white`}
                    title="Disputed"
                    onClick={() => {
                      setDisputeInvoice(invoice);
                      setDisputeDialogOpen(true);
                    }}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={`${btnClass} hover:bg-red-500 hover:text-white`}
                  title="Cancel"
                  onClick={() => {
                    setCancelInvoice(invoice);
                    setCancelDialogOpen(true);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-fuchsia-50 via-purple-50 to-fuchsia-100 dark:from-fuchsia-950/20 dark:via-purple-950/20 dark:to-fuchsia-900/20 border border-fuchsia-200/50 dark:border-fuchsia-800/50 p-6 shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-md">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-900 to-purple-900 dark:from-fuchsia-100 dark:to-purple-100 bg-clip-text text-transparent">
              Invoice Management
            </h1>
          </div>
          <p className="text-fuchsia-800/80 dark:text-fuchsia-200/80 ml-12">
            Create, send, and track invoices for external customers
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-blue-700 dark:text-blue-300">{statusCounts.draft}</CardContent>
        </Card>
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <Send className="h-4 w-4" />
              Sent
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-purple-700 dark:text-purple-300">{statusCounts.sent}</CardContent>
        </Card>
        <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <BadgeDollarSign className="h-4 w-4" />
              Partially Paid
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-700 dark:text-amber-300">{statusCounts.partiallyPaid}</CardContent>
        </Card>
        <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Paid
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-green-700 dark:text-green-300">{statusCounts.paid}</CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-700 dark:text-red-300">{statusCounts.overdue}</CardContent>
        </Card>
        <Card className="border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-700 dark:text-orange-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Disputed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-orange-700 dark:text-orange-300">{statusCounts.disputed}</CardContent>
        </Card>
        <Card className="border-2 border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <X className="h-4 w-4" />
              Cancelled / Void
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            {statusCounts.cancelled + nonRestoredDeleteLogs.length}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 md:grid-cols-9 gap-2 bg-white dark:bg-gray-900 border shadow-sm p-2 h-auto">
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New
          </TabsTrigger>
          <TabsTrigger value="draft" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Draft
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Sent
          </TabsTrigger>
          <TabsTrigger value="partially_paid" className="flex items-center gap-2">
            <BadgeDollarSign className="h-4 w-4" />
            Partially Paid
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Paid
          </TabsTrigger>
          <TabsTrigger value="overdue" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Overdue
          </TabsTrigger>
          <TabsTrigger value="disputed" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Disputed
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Cancelled / Void
          </TabsTrigger>
          <TabsTrigger value="receipts" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Receipts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-4">
          <Card className="border-2 border-fuchsia-200 dark:border-fuchsia-800 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-fuchsia-50 to-purple-50 dark:from-fuchsia-950/30 dark:to-purple-950/30 border-b border-fuchsia-200 dark:border-fuchsia-800">
              <CardTitle className="flex items-center gap-2 text-fuchsia-700 dark:text-fuchsia-300">
                <div className="p-2 rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-md">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                {editingInvoiceId ? "Edit Invoice" : "New Invoice"}
              </CardTitle>
              <CardDescription className="text-fuchsia-600/80 dark:text-fuchsia-400/80">
                Fill out the invoice template and save or send it. Due date defaults to 48 hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <style jsx global>{`
                .invoice-print-mode input,
                .invoice-print-mode textarea {
                  border-color: transparent !important;
                  background: transparent !important;
                  box-shadow: none !important;
                  padding-left: 0 !important;
                  padding-right: 0 !important;
                }

                .invoice-print-mode textarea {
                  resize: none !important;
                }

                .invoice-print-mode .invoice-remove-column,
                .invoice-print-mode .invoice-actions {
                  display: none !important;
                }
              `}</style>
              <div
                ref={invoiceTemplateRef}
                className={cn(
                  "bg-white border-2 border-amber-700/70 rounded-md p-6 shadow-sm max-w-[794px] mx-auto space-y-6",
                  isPrintMode && "invoice-print-mode"
                )}
              >
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex justify-center sm:justify-start">
                      <img
                        src="/quote-logo.png"
                        alt="Prep Services FBA"
                        className="h-20 w-auto object-contain"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-2 sm:text-right">
                      <h2 className="text-center sm:text-right text-2xl font-bold tracking-wide text-amber-800">INVOICE</h2>
                      <div className="flex flex-col gap-2 sm:items-end">
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <span>Invoice #:</span>
                          {isPrintMode ? (
                            <span className="font-semibold text-amber-900">{formData.invoiceNumber || "—"}</span>
                          ) : (
                            <Input
                              value={formData.invoiceNumber}
                              disabled
                              className="h-8 w-44 text-center"
                            />
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <span>Date:</span>
                          {isPrintMode ? (
                            <span className="font-semibold text-amber-900">{formatDate(formData.invoiceDate) || "—"}</span>
                          ) : (
                            <Input
                              type="date"
                              value={formData.invoiceDate}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, invoiceDate: event.target.value }))
                              }
                              className="h-8 w-40 text-center"
                            />
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <span>Due Date:</span>
                          {isPrintMode ? (
                            <span className="font-semibold text-amber-900">{formatDate(formData.dueDate) || "—"}</span>
                          ) : (
                            <Input
                              type="date"
                              value={formData.dueDate}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, dueDate: event.target.value }))
                              }
                              className="h-8 w-40 text-center"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-amber-200/70 pt-4"></div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border border-amber-200/70 rounded-md p-4 text-sm space-y-1">
                    <p className="text-xs uppercase text-amber-700 font-semibold">Company Details</p>
                    <p className="font-semibold">{COMPANY_INFO.name}</p>
                    {COMPANY_INFO.addressLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    <p>Phone: {COMPANY_INFO.phone}</p>
                    <p>Email: {COMPANY_INFO.email}</p>
                  </div>
                  <div className="border border-amber-200/70 rounded-md p-4 text-sm space-y-3">
                    <p className="text-xs uppercase text-amber-700 font-semibold">Sold To</p>
                    {isPrintMode ? (
                      <div className="space-y-1">
                        <p className="font-semibold">{formData.clientName || "—"}</p>
                        {formData.clientAddress && <p>{formData.clientAddress}</p>}
                        {(formData.clientCity || formData.clientState || formData.clientZip || formData.clientCountry) && (
                          <p>
                            {[formData.clientCity, formData.clientState, formData.clientZip, formData.clientCountry]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                        {formData.clientPhone && <p>Phone: {formData.clientPhone}</p>}
                        {formData.clientEmail && <p>Email: {formData.clientEmail}</p>}
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Client Name</Label>
                          <Input
                            value={formData.clientName}
                            onChange={(event) =>
                              setFormData((prev) => ({ ...prev, clientName: event.target.value }))
                            }
                            placeholder="Client name"
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Address</Label>
                          <Input
                            value={formData.clientAddress}
                            onChange={(event) =>
                              setFormData((prev) => ({ ...prev, clientAddress: event.target.value }))
                            }
                            placeholder="Client address"
                            className="h-9"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">City</Label>
                            <Input
                              value={formData.clientCity}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, clientCity: event.target.value }))
                              }
                              placeholder="City"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">State</Label>
                            <Input
                              value={formData.clientState}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, clientState: event.target.value }))
                              }
                              placeholder="State"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">ZIP</Label>
                            <Input
                              value={formData.clientZip}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, clientZip: event.target.value }))
                              }
                              placeholder="ZIP"
                              className="h-9"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Country</Label>
                          <Input
                            value={formData.clientCountry}
                            onChange={(event) =>
                              setFormData((prev) => ({ ...prev, clientCountry: event.target.value }))
                            }
                            placeholder="Country"
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Phone</Label>
                          <Input
                            value={formData.clientPhone}
                            onChange={(event) =>
                              setFormData((prev) => ({ ...prev, clientPhone: event.target.value }))
                            }
                            placeholder="Phone"
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Email</Label>
                          <Input
                            value={formData.clientEmail}
                            onChange={(event) =>
                              setFormData((prev) => ({ ...prev, clientEmail: event.target.value }))
                            }
                            placeholder="Email"
                            className="h-9"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-amber-800">
                    NOTE: Please make all payments to Prep Services FBA LLC. All prices are F.O.B.
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-semibold">FOB POINT:</span> <span>NEW JERSEY</span>
                    </div>
                    <div>
                      <span className="font-semibold">TERMS:</span> <span>NET</span>
                    </div>
                    <div>
                      <span className="font-semibold">SHIPPED VIA:</span> <span>Standard</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200/70 pb-2">
                    <h3 className="font-semibold text-amber-800">Item Description</h3>
                    <div className="flex gap-8 text-sm font-semibold text-amber-800">
                      <span>Qty</span>
                      <span>Unit Price</span>
                      <span>Amount</span>
                    </div>
                  </div>
                  {formData.items.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center border-b border-amber-100/50 pb-2 invoice-actions">
                      <div className="col-span-6">
                        {isPrintMode ? (
                          <p className="text-sm">{item.description || "—"}</p>
                        ) : (
                          <Input
                            value={item.description}
                            onChange={(event) => updateItem(item.id, "description", event.target.value)}
                            placeholder="Item description"
                            className="h-9 border-amber-200/70"
                          />
                        )}
                      </div>
                      <div className="col-span-2">
                        {isPrintMode ? (
                          <p className="text-sm text-center">{Number(item.quantity ?? 0)}</p>
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={item.quantity != null ? String(item.quantity) : ""}
                            onChange={(event) => updateItem(item.id, "quantity", event.target.value)}
                            className="h-9 text-center border-amber-200/70"
                          />
                        )}
                      </div>
                      <div className="col-span-2">
                        {isPrintMode ? (
                          <p className="text-sm text-right">${Number(item.unitPrice ?? 0).toFixed(2)}</p>
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice != null ? String(item.unitPrice) : ""}
                            onChange={(event) => updateItem(item.id, "unitPrice", event.target.value)}
                            className="h-9 text-right border-amber-200/70"
                            placeholder="0.00"
                          />
                        )}
                      </div>
                      <div className="col-span-1">
                        <p className="text-sm text-right font-semibold">${Number(item.amount ?? 0).toFixed(2)}</p>
                      </div>
                      <div className="col-span-1 flex justify-end invoice-remove-column">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          disabled={formData.items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="invoice-actions pt-2">
                    <Button variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-2 text-sm">
                    <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                      <span>Subtotal</span>
                      <span className="font-semibold">${formData.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Sales Tax (6.625%)</span>
                      {isPrintMode ? (
                        <span className="font-semibold">${formData.salesTax.toFixed(2)}</span>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.salesTax}
                          onChange={(event) => {
                            const salesTax = Number(event.target.value || 0);
                            const totals = recalculateTotals(formData.items, formData.shippingCost, salesTax);
                            setFormData((prev) => ({ ...prev, ...totals }));
                          }}
                          className="h-8 w-28 text-right"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Shipping Cost</span>
                      {isPrintMode ? (
                        <span className="font-semibold">${formData.shippingCost.toFixed(2)}</span>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.shippingCost}
                          onChange={(event) => {
                            const shippingCost = Number(event.target.value || 0);
                            const totals = recalculateTotals(formData.items, shippingCost, formData.salesTax);
                            setFormData((prev) => ({ ...prev, shippingCost, ...totals }));
                          }}
                          className="h-8 w-28 text-right"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-amber-200 pt-2 text-amber-900 font-semibold">
                      <span>Grand Total</span>
                      <span className="font-semibold">${formData.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-amber-200/70 pt-4">
                  <p className="text-xs uppercase text-amber-700 font-semibold mb-2">Terms & Conditions</p>
                  {isPrintMode ? (
                    <div className="text-xs text-amber-900 whitespace-pre-line">{formData.terms || "—"}</div>
                  ) : (
                    <Textarea
                      rows={6}
                      value={formData.terms}
                      onChange={(event) => setFormData((prev) => ({ ...prev, terms: event.target.value }))}
                      className="border-amber-200/70 text-xs"
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => saveInvoice("draft")} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                  Save as Draft
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSendFromForm}
                  disabled={saving}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadInvoicePdf({ ...formData, id: "preview" })}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="draft" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Draft Invoices</CardTitle>
              <CardDescription>Saved invoices that are not sent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {draftInvoices.length ? (
                draftInvoices.map((invoice) => (
                  <Card key={invoice.id} className="border-2 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div>
                        <div className="font-semibold">{invoice.clientName || "—"}</div>
                        <div className="text-sm text-muted-foreground">{invoice.invoiceNumber}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditInvoice(invoice)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEmailDialog(invoice)}>
                          Send
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteInvoice(invoice)}>
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No draft invoices yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sent Invoices</CardTitle>
              <CardDescription>All sent invoices with outstanding balances.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sentInvoices.length ? sentInvoices.map((invoice) => renderInvoiceRow(invoice, { showActions: true, hideSendAndDownload: true })) : (
                <p className="text-sm text-muted-foreground">No sent invoices yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partially_paid" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Partially Paid</CardTitle>
              <CardDescription>Invoices with partial payments and outstanding balance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {partiallyPaidInvoices.length ? (
                partiallyPaidInvoices.map((invoice) => renderInvoiceRow(invoice, { showActions: true }))
              ) : (
                <p className="text-sm text-muted-foreground">No partially paid invoices.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paid" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Paid Invoices</CardTitle>
                  <CardDescription>Invoices fully paid with zero balance.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={downloadPaidInvoicesCsv}>
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {paidInvoices.length ? (
                paidInvoices.map((invoice) => renderInvoiceRow(invoice))
              ) : (
                <p className="text-sm text-muted-foreground">No paid invoices.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Overdue Invoices</CardTitle>
              <CardDescription>Invoices past their due date.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {overdueInvoices.length ? (
                overdueInvoices.map((invoice) => renderInvoiceRow(invoice, { showActions: true }))
              ) : (
                <p className="text-sm text-muted-foreground">No overdue invoices.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Disputed Invoices</CardTitle>
              <CardDescription>Invoices marked as disputed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {disputedInvoices.length ? (
                disputedInvoices.map((invoice) =>
                  renderInvoiceRow(invoice, { showActions: true, allowDisputeActions: true })
                )
              ) : (
                <p className="text-sm text-muted-foreground">No disputed invoices.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cancelled / Void</CardTitle>
              <CardDescription>Voided or cancelled invoices, and deleted drafts (restore from here).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cancelledInvoices.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Voided / Cancelled</h4>
                  {cancelledInvoices.map((invoice) => renderInvoiceRow(invoice))}
                </div>
              )}
              {nonRestoredDeleteLogs.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">Deleted (Drafts &amp; others)</h4>
                  {nonRestoredDeleteLogs.map((log) => (
                    <Card
                      key={log.id}
                      className="border-2 border-amber-200/70 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/20"
                    >
                      <CardContent className="p-5">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-amber-500/80 shadow-md">
                                <FileText className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100">
                                  {log.clientName || "—"}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                                  {log.clientEmail || "—"}
                                </p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                    {log.invoiceNumber || log.invoiceId || "—"}
                                  </span>
                                  <Badge variant="secondary" className="capitalize">
                                    Deleted {log.status || "draft"}
                                  </Badge>
                                  {log.reason && (
                                    <span className="text-xs text-muted-foreground">• {log.reason}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            <Badge variant="outline" className="text-xs">
                              Total ${Number(log.total ?? 0).toFixed(2)}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreInvoice(log)}
                              disabled={saving}
                              className="hover:bg-green-500 hover:text-white hover:border-green-500 dark:hover:bg-green-600 transition-all shadow-sm"
                            >
                              {saving ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  Restoring...
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Restore
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {!cancelledInvoices.length && !nonRestoredDeleteLogs.length && (
                <p className="text-sm text-muted-foreground">No cancelled or deleted invoices.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receipts / Payment History</CardTitle>
              <CardDescription>All payments logged against invoices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentHistory.length ? (
                <>
                  <div className="space-y-3">
                    {getPaginatedData(paymentHistory, paymentHistoryPage).paginatedData.map((payment) => (
                      <Card key={payment.id} className="border-2 border-gray-200 dark:border-gray-800">
                        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                          <div>
                            <div className="font-semibold">{payment.clientName}</div>
                            <div className="text-sm text-muted-foreground">{payment.invoiceNumber}</div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {payment.method} • {formatDate(payment.date)}
                          </div>
                          <div className="font-semibold">${payment.amount.toFixed(2)}</div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadReceiptPdf(payment)}
                          >
                            <Receipt className="h-4 w-4 mr-1" />
                            Receipt
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {paymentHistory.length > itemsPerPage && (
                    <div className="flex items-center justify-between pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={paymentHistoryPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {paymentHistoryPage} / {getPaginatedData(paymentHistory, paymentHistoryPage).totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPaymentHistoryPage((p) =>
                            Math.min(getPaginatedData(paymentHistory, paymentHistoryPage).totalPages, p + 1)
                          )
                        }
                        disabled={paymentHistoryPage >= getPaginatedData(paymentHistory, paymentHistoryPage).totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No payment history yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft Invoice</DialogTitle>
            <DialogDescription>Provide a reason for deleting this draft.</DialogDescription>
          </DialogHeader>
          <Textarea value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteInvoice} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
            <DialogDescription>Compose the email to send the invoice.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>To</Label>
              <Input value={emailForm.to} onChange={(event) => setEmailForm((prev) => ({ ...prev, to: event.target.value }))} />
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={emailForm.subject} onChange={(event) => setEmailForm((prev) => ({ ...prev, subject: event.target.value }))} />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea rows={5} value={emailForm.message} onChange={(event) => setEmailForm((prev) => ({ ...prev, message: event.target.value }))} />
            </div>
            <div>
              <Label>Attachments</Label>
              <Input
                type="file"
                multiple
                onChange={(event) =>
                  setEmailForm((prev) => ({ ...prev, attachments: Array.from(event.target.files || []) }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendInvoiceEmail} disabled={isSendingEmail}>
              {isSendingEmail ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={partialDialogOpen} onOpenChange={setPartialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Partially Paid</DialogTitle>
            <DialogDescription>Enter the amount received.</DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            value={partialAmount}
            onChange={(event) => setPartialAmount(event.target.value)}
            placeholder="Amount"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyPartialPayment} disabled={saving}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paidDialogOpen} onOpenChange={setPaidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Paid</DialogTitle>
            <DialogDescription>Record payment details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paidForm.paymentDate}
                onChange={(event) => setPaidForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
              />
            </div>
            <div>
              <Label>Amount Paid</Label>
              <Input
                type="number"
                value={paidForm.amountPaid}
                onChange={(event) => setPaidForm((prev) => ({ ...prev, amountPaid: event.target.value }))}
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select
                value={paidForm.method}
                onValueChange={(value: PaymentMethod) => setPaidForm((prev) => ({ ...prev, method: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Zelle">Zelle</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="Wire">Wire</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference / Transaction ID</Label>
              <Input
                value={paidForm.reference}
                onChange={(event) => setPaidForm((prev) => ({ ...prev, reference: event.target.value }))}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={paidForm.notes}
                onChange={(event) => setPaidForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyPaidPayment} disabled={saving}>
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Disputed</DialogTitle>
            <DialogDescription>Provide dispute details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason</Label>
              <Select value={disputeForm.reason} onValueChange={(value) => setDisputeForm((prev) => ({ ...prev, reason: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="billing">Billing Issue</SelectItem>
                  <SelectItem value="service">Service Dispute</SelectItem>
                  <SelectItem value="chargeback">Chargeback</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={disputeForm.notes}
                onChange={(event) => setDisputeForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={disputeForm.status}
                onValueChange={(value: "Open" | "Resolved") => setDisputeForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyDispute} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel / Void Invoice</DialogTitle>
            <DialogDescription>Provide an optional reason for voiding.</DialogDescription>
          </DialogHeader>
          <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={applyCancel} disabled={saving}>
              Void Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
