
"use client";

import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
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
import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { generateQuoteInvoicePdfBlob } from "@/lib/quote-invoice-generator";
import {
  Badge,
} from "@/components/ui/badge";
import {
  Button,
} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  Download,
  Eye,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";

type QuoteStatus = "draft" | "sent" | "accepted" | "lost";

interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface QuoteEmailLog {
  type: "send" | "follow_up";
  to: string;
  subject: string;
  message: string;
  attachments: { name: string; size: number }[];
  sentAt: any;
  sentBy?: string;
}

interface QuoteDecisionDetails {
  clientName?: string;
  clientEmail?: string;
  clientContact?: string;
  clientCompany?: string;
  notes?: string;
  decidedAt?: any;
  decidedBy?: string;
}

interface Quote {
  id: string;
  status: QuoteStatus;
  reference: string;
  quoteDate: string;
  validUntil: string;
  recipientName: string;
  recipientEmail: string;
  recipientAddress?: string;
  recipientCity?: string;
  recipientState?: string;
  recipientZip?: string;
  recipientCountry?: string;
  recipientPhone?: string;
  subject: string;
  message: string;
  notes?: string;
  terms?: string;
  items: QuoteLineItem[];
  subtotal: number;
  salesTax: number;
  shippingCost: number;
  total: number;
  preparedBy?: string;
  approvedBy?: string;
  preparedDate?: string;
  approvedDate?: string;
  createdAt?: any;
  updatedAt?: any;
  sentAt?: any;
  followUpCount?: number;
  lastFollowUpAt?: any;
  emailLog?: QuoteEmailLog[];
  acceptedDetails?: QuoteDecisionDetails;
  lostDetails?: QuoteDecisionDetails;
  convertedInvoiceId?: string;
  convertedInvoiceNumber?: string;
  convertedAt?: any;
}

const FOLLOW_UP_LIMIT = 9;
const TAX_RATE = 0.06625;

const COMPANY_INFO = {
  name: "Prep Services FBA",
  addressLines: ["7000 Atrium Way B05", "Mount Laurel, NJ, 08054"],
  phone: "+1-347-661-3010",
  email: "info@prepservicesfba.com",
};

const createEmptyItem = (): QuoteLineItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unitPrice: 0,
  amount: 0,
});

const createEmptyQuoteForm = (): Omit<Quote, "id" | "status" | "createdAt" | "updatedAt"> => {
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(today.getDate() + 7);
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return {
    reference: `Q-${year}${month}-${randomNum}`,
    quoteDate: today.toISOString().slice(0, 10),
    validUntil: validUntil.toISOString().slice(0, 10),
    recipientName: "",
    recipientEmail: "",
    recipientAddress: "",
    recipientCity: "",
    recipientState: "",
    recipientZip: "",
    recipientCountry: "",
    recipientPhone: "",
    subject: "",
    message: "",
    notes: "",
    terms:
      "Payment is required 100% upfront before any prep work or shipments are processed.\n" +
      "All quantities are confirmed based on physical inventory received at our warehouse only.\n" +
      "Client is responsible for supplier, carrier, or Amazon inbound discrepancies.\n" +
      "Client is responsible for providing accurate FNSKU labels, prep instructions, and Amazon compliance requirements.\n" +
      "Client shipments leave our facility; carrier delays, losses, or Amazon receiving issues are not our responsibility.\n" +
      "Completed orders not shipped or collected within 7 days may incur storage fees.\n" +
      "Quotes are estimates only. The final invoice is based on the actual received units and services performed.",
    items: [createEmptyItem()],
    subtotal: 0,
    salesTax: 0,
    shippingCost: 0,
    total: 0,
    preparedBy: "",
    approvedBy: "",
    preparedDate: "",
    approvedDate: "",
    sentAt: undefined,
    followUpCount: 0,
    lastFollowUpAt: undefined,
    emailLog: [],
    acceptedDetails: undefined,
    lostDetails: undefined,
    convertedInvoiceId: undefined,
    convertedAt: undefined,
  };
};

const formatDate = (value?: any) => {
  if (!value) return "—";
  const date =
    value?.toDate?.() ||
    (typeof value?.seconds === "number" ? new Date(value.seconds * 1000) : null) ||
    (typeof value === "string" ? new Date(value) : null) ||
    (value instanceof Date ? value : null);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const formatDateForDisplay = (dateString?: string) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateString;
  }
};

const formatTermsAsBullets = (terms?: string) => {
  if (!terms) return [];
  return terms
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const calculateTotals = (items: QuoteLineItem[], shippingCost: number, salesTax: number) => {
  const normalized = items.map((item) => ({
    ...item,
    amount: Number(item.quantity || 0) * Number(item.unitPrice || 0),
  }));
  const subtotal = normalized.reduce((sum, item) => sum + (item.amount || 0), 0);
  const total = subtotal + Number(salesTax || 0) + Number(shippingCost || 0);
  return { items: normalized, subtotal, salesTax, total };
};

export function QuoteManagement() {
  const { userProfile, user } = useAuth();
  const { toast } = useToast();

  const toBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  };
  const quoteTemplateRef = useRef<HTMLDivElement | null>(null);
  const quotesQuery = useMemo(
    () => query(collection(db, "quotes"), orderBy("createdAt", "desc")),
    []
  );
  const { data: quotes, loading } = useCollection<Quote>("quotes", quotesQuery);
  
  const deleteLogsQuery = useMemo(
    () => query(collection(db, "quote_delete_logs"), orderBy("deletedAt", "desc")),
    []
  );
  const { data: deleteLogs, loading: deleteLogsLoading } = useCollection<any>("quote_delete_logs", deleteLogsQuery);

  const [activeTab, setActiveTab] = useState("new");
  const [formData, setFormData] = useState(createEmptyQuoteForm());
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailMode, setEmailMode] = useState<"send" | "follow_up">("send");
  const [activeEmailQuote, setActiveEmailQuote] = useState<Quote | null>(null);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionQuote, setDecisionQuote] = useState<Quote | null>(null);
  const [decisionStatus, setDecisionStatus] = useState<"accepted" | "lost">("accepted");
  const [decisionDetails, setDecisionDetails] = useState<QuoteDecisionDetails>({});
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showConvertedOnly, setShowConvertedOnly] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to: "",
    subject: "",
    message: "",
    attachments: [] as File[],
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteQuote, setDeleteQuote] = useState<Quote | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const statusCounts = useMemo(() => {
    const counts = { draft: 0, sent: 0, accepted: 0, lost: 0 };
    quotes.forEach((quote) => {
      counts[quote.status] += 1;
    });
    return counts;
  }, [quotes]);

  const draftQuotes = quotes.filter((q) => q.status === "draft");
  const sentQuotes = quotes.filter((q) => q.status === "sent");
  const acceptedQuotes = quotes.filter((q) => q.status === "accepted");
  const lostQuotes = quotes.filter((q) => q.status === "lost");
  const filteredDraftQuotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return draftQuotes;
    return draftQuotes.filter((quote) =>
      [quote.reference, quote.recipientName, quote.recipientEmail]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [draftQuotes, searchQuery]);
  const filteredSentQuotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sentQuotes;
    return sentQuotes.filter((quote) =>
      [quote.reference, quote.recipientName, quote.recipientEmail]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [sentQuotes, searchQuery]);
  const filteredAcceptedQuotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return acceptedQuotes;
    return acceptedQuotes.filter((quote) =>
      [quote.reference, quote.recipientName, quote.recipientEmail]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [acceptedQuotes, searchQuery]);
  const filteredLostQuotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return lostQuotes;
    return lostQuotes.filter((quote) =>
      [quote.reference, quote.recipientName, quote.recipientEmail]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [lostQuotes, searchQuery]);
  const filteredConvertibleQuotes = useMemo(() => {
    const base = filteredAcceptedQuotes;
    if (!showConvertedOnly) return base;
    return base.filter((quote) => Boolean(quote.convertedInvoiceId));
  }, [filteredAcceptedQuotes, showConvertedOnly]);

  const resetForm = () => {
    setFormData(createEmptyQuoteForm());
    setEditingQuoteId(null);
  };

  const mapQuoteToFormData = (quote: Quote) => ({
    reference: quote.reference,
    quoteDate: quote.quoteDate,
    validUntil: quote.validUntil,
    recipientName: quote.recipientName,
    recipientEmail: quote.recipientEmail,
    recipientAddress: quote.recipientAddress || "",
    recipientCity: quote.recipientCity || "",
    recipientState: quote.recipientState || "",
    recipientZip: quote.recipientZip || "",
    recipientCountry: quote.recipientCountry || "",
    recipientPhone: quote.recipientPhone || "",
    subject: quote.subject || "",
    message: quote.message || "",
    notes: quote.notes || "",
    terms: quote.terms || "",
    items: quote.items.length ? quote.items : [createEmptyItem()],
    subtotal: quote.subtotal,
    salesTax: quote.salesTax || 0,
    shippingCost: quote.shippingCost || 0,
    total: quote.total,
    preparedBy: quote.preparedBy || "",
    approvedBy: quote.approvedBy || "",
    preparedDate: quote.preparedDate || "",
    approvedDate: quote.approvedDate || "",
    sentAt: quote.sentAt,
    followUpCount: quote.followUpCount ?? 0,
    lastFollowUpAt: quote.lastFollowUpAt,
    emailLog: quote.emailLog ?? [],
    acceptedDetails: quote.acceptedDetails,
    lostDetails: quote.lostDetails,
    convertedInvoiceId: quote.convertedInvoiceId,
    convertedAt: quote.convertedAt,
  });

  const validateForm = () => {
    if (!formData.recipientName.trim()) {
      toast({ variant: "destructive", title: "Recipient name is required." });
      return false;
    }
    if (!formData.recipientEmail.trim()) {
      toast({ variant: "destructive", title: "Recipient email is required." });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.recipientEmail.trim())) {
      toast({ variant: "destructive", title: "Recipient email is invalid." });
      return false;
    }
    if (!formData.items.length || formData.items.every((item) => !item.description.trim())) {
      toast({ variant: "destructive", title: "Add at least one line item." });
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    // For drafts, only validate that we have at least a reference number
    if (!formData.reference.trim()) {
      toast({ variant: "destructive", title: "Quotation number is required." });
      return;
    }
    setSaving(true);
    try {
      const { items, subtotal, salesTax, total } = calculateTotals(
        formData.items,
        formData.shippingCost,
        formData.salesTax
      );
      
      // Remove undefined values from formData (Firestore doesn't allow undefined)
      const cleanFormData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== undefined)
      );
      
      if (editingQuoteId) {
        await updateDoc(doc(db, "quotes", editingQuoteId), {
          ...cleanFormData,
          items,
          subtotal,
          salesTax,
          total,
          status: "draft",
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Draft updated." });
      } else {
        await addDoc(collection(db, "quotes"), {
          ...cleanFormData,
          items,
          subtotal,
          salesTax,
          total,
          status: "draft",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userProfile?.uid || "",
        });
        toast({ title: "Draft saved." });
      }
      resetForm();
      setActiveTab("draft");
    } catch (error) {
      console.error("Failed to save draft:", error);
      toast({ 
        variant: "destructive", 
        title: "Failed to save draft.",
        description: error instanceof Error ? error.message : "Please try again."
      });
    } finally {
      setSaving(false);
    }
  };

  const openEmailDialog = (quote: Quote, mode: "send" | "follow_up") => {
    setEmailMode(mode);
    setActiveEmailQuote(quote);
    if (mode === "send") {
      setFormData(mapQuoteToFormData(quote));
      setEditingQuoteId(quote.id);
      if (activeTab !== "new") {
        setActiveTab("new");
      }
    }
    setEmailForm({
      to: quote.recipientEmail,
      subject: quote.subject || `Prep Services FBA - Quotation ${quote.reference}`,
      message: quote.message || "",
      attachments: [],
    });
    setEmailDialogOpen(true);
  };

  const handleSendFromForm = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const { items, subtotal, salesTax, total } = calculateTotals(
        formData.items,
        formData.shippingCost,
        formData.salesTax
      );
      
      // Remove undefined values from formData (Firestore doesn't allow undefined)
      const cleanFormData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== undefined)
      );
      
      if (editingQuoteId) {
        await updateDoc(doc(db, "quotes", editingQuoteId), {
          ...cleanFormData,
          items,
          subtotal,
          salesTax,
          total,
          updatedAt: serverTimestamp(),
        });
        const quote = quotes.find((q) => q.id === editingQuoteId);
        if (quote) {
          const preparedQuote = {
            ...quote,
            ...(cleanFormData as Omit<Quote, "id" | "status">),
            items,
            subtotal,
            salesTax,
            total,
          } as Quote;
          openEmailDialog(preparedQuote, "send");
        }
      } else {
        const docRef = await addDoc(collection(db, "quotes"), {
          ...cleanFormData,
          items,
          subtotal,
          salesTax,
          total,
          status: "draft",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userProfile?.uid || "",
        });
        const preparedQuote = {
          id: docRef.id,
          status: "draft",
          ...(cleanFormData as Omit<Quote, "id" | "status">),
          items,
          subtotal,
          salesTax,
          total,
        } as Quote;
        openEmailDialog(preparedQuote, "send");
      }
    } catch (error) {
      console.error("Failed to prepare send:", error);
      toast({ variant: "destructive", title: "Failed to prepare email." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuote = (quote: Quote) => {
    setDeleteQuote(quote);
    setDeleteReason("");
    setDeleteDialogOpen(true);
  };

  const confirmDeleteQuote = async () => {
    if (!deleteQuote) return;
    if (!deleteReason.trim()) {
      toast({ variant: "destructive", title: "Please provide a reason for deletion." });
      return;
    }
    setSaving(true);
    try {
      // Save deletion log before deleting
      await addDoc(collection(db, "quote_delete_logs"), {
        quoteId: deleteQuote.id,
        reference: deleteQuote.reference,
        recipientName: deleteQuote.recipientName,
        recipientEmail: deleteQuote.recipientEmail,
        recipientAddress: deleteQuote.recipientAddress || "",
        recipientCity: deleteQuote.recipientCity || "",
        recipientState: deleteQuote.recipientState || "",
        recipientZip: deleteQuote.recipientZip || "",
        recipientCountry: deleteQuote.recipientCountry || "",
        recipientPhone: deleteQuote.recipientPhone || "",
        status: deleteQuote.status,
        subtotal: deleteQuote.subtotal,
        salesTax: deleteQuote.salesTax || 0,
        shippingCost: deleteQuote.shippingCost || 0,
        total: deleteQuote.total,
        items: deleteQuote.items,
        quoteDate: deleteQuote.quoteDate,
        validUntil: deleteQuote.validUntil,
        terms: deleteQuote.terms || "",
        preparedBy: deleteQuote.preparedBy || "",
        approvedBy: deleteQuote.approvedBy || "",
        reason: deleteReason.trim(),
        deletedBy: userProfile?.uid || "",
        deletedByName: userProfile?.name || userProfile?.email || "Unknown",
        deletedAt: serverTimestamp(),
        createdAt: deleteQuote.createdAt,
        sentAt: deleteQuote.sentAt,
        followUpCount: deleteQuote.followUpCount || 0,
      });
      
      // Delete the quote
      await deleteDoc(doc(db, "quotes", deleteQuote.id));
      toast({ title: "Quote deleted and logged." });
      setDeleteDialogOpen(false);
      setDeleteQuote(null);
      setDeleteReason("");
    } catch (error) {
      console.error("Failed to delete quote:", error);
      toast({ variant: "destructive", title: "Failed to delete quote." });
    } finally {
      setSaving(false);
    }
  };

  const handleEditQuote = (quote: Quote) => {
    setFormData(mapQuoteToFormData(quote));
    setEditingQuoteId(quote.id);
    setActiveTab("new");
  };

  const generateQuotePdfFile = async (reference: string) => {
    if (!quoteTemplateRef.current) return null;
    setIsPrintMode(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const canvas = await html2canvas(quoteTemplateRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let y = 0;

      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      } else {
        let remainingHeight = imgHeight;
        while (remainingHeight > 0) {
          pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
          remainingHeight -= pageHeight;
          y -= pageHeight;
          if (remainingHeight > 0) {
            pdf.addPage();
          }
        }
      }
      const pdfBlob = pdf.output("blob");
      return new File([pdfBlob], `${reference || "quotation"}.pdf`, { type: "application/pdf" });
    } finally {
      setIsPrintMode(false);
    }
  };

  const handleSendEmail = async () => {
    if (!activeEmailQuote) return;
    if (!emailForm.to.trim()) {
      toast({ variant: "destructive", title: "Recipient email is required." });
      return;
    }
    if (!emailForm.subject.trim()) {
      toast({ variant: "destructive", title: "Email subject is required." });
      return;
    }
    setIsSendingEmail(true);
    let restoreState: {
      activeTab: string;
      formData: typeof formData;
      editingQuoteId: string | null;
    } | null = null;
    try {
      let attachmentsToSend = emailForm.attachments;

      if (emailMode === "send") {
        const needsTemplateRefresh =
          activeTab !== "new" ||
          !quoteTemplateRef.current ||
          formData.reference !== activeEmailQuote.reference;
        if (needsTemplateRefresh) {
          restoreState = { activeTab, formData, editingQuoteId };
          setFormData(mapQuoteToFormData(activeEmailQuote));
          setEditingQuoteId(activeEmailQuote.id);
          if (activeTab !== "new") {
            setActiveTab("new");
          }
          await new Promise((resolve) => setTimeout(resolve, 120));
        }

        const autoAttachment = await generateQuotePdfFile(
          activeEmailQuote.reference || formData.reference
        );
        if (!autoAttachment) {
          throw new Error("Failed to generate quote PDF attachment.");
        }
        attachmentsToSend = [autoAttachment, ...emailForm.attachments];
      }

      // Get Firebase ID token for authentication
      const idToken = user ? await user.getIdToken() : "";
      if (!idToken) {
        throw new Error("Please re-login and try again.");
      }

      console.log("[Email Send] User UID:", user?.uid);
      console.log("[Email Send] User profile:", userProfile);
      console.log("[Email Send] Token obtained:", idToken ? "Yes" : "No");

      const payload = new FormData();
      payload.append("to", emailForm.to.trim());
      payload.append("subject", emailForm.subject.trim());
      payload.append("message", emailForm.message || "");
      attachmentsToSend.forEach((file) => payload.append("attachments", file));

      const headers: HeadersInit = {
        Authorization: `Bearer ${idToken}`,
      };
      const externalEmailApi = process.env.NEXT_PUBLIC_EMAIL_API_URL;
      const vercelBypass = process.env.NEXT_PUBLIC_VERCEL_PROTECTION_BYPASS;
      if (vercelBypass) {
        headers["x-vercel-protection-bypass"] = vercelBypass;
        console.log("[Email Send] Vercel bypass header set");
      } else {
        console.log("[Email Send] Vercel bypass header missing");
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
        const apiUrl = vercelBypass
          ? `/api/email/send?x-vercel-protection-bypass=${encodeURIComponent(vercelBypass)}`
          : "/api/email/send";

        response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: payload,
        });
      }
      
      console.log("[Email Send] Response status:", response.status);
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      let responseData: any = {};
      
      if (contentType && contentType.includes("application/json")) {
        try {
          responseData = await response.json();
        } catch (jsonError) {
          // If JSON parsing fails, get text response
          const textResponse = await response.text();
          throw new Error(`Server error: ${textResponse.substring(0, 200)}`);
        }
      } else {
        // Non-JSON response (likely HTML/text error page)
        const textResponse = await response.text();
        const vercelId = response.headers.get("x-vercel-id");
        if (response.status === 403 && (vercelId || textResponse.toLowerCase().includes("forbidden"))) {
          throw new Error(
            "Request blocked by deployment protection. If this is a Vercel-protected dev domain, add a bypass token in NEXT_PUBLIC_VERCEL_PROTECTION_BYPASS."
          );
        }
        throw new Error(`Server returned: ${textResponse.substring(0, 200)}`);
      }
      
      if (!response.ok) {
        throw new Error(responseData.error || `Email request failed (${response.status})`);
      }

      const logEntry: QuoteEmailLog = {
        type: emailMode,
        to: emailForm.to.trim(),
        subject: emailForm.subject.trim(),
        message: emailForm.message || "",
        attachments: attachmentsToSend.map((file) => ({
          name: file.name,
          size: file.size,
        })),
        sentAt: new Date(),
        sentBy: userProfile?.uid || "",
      };

      const followUpCount = (activeEmailQuote.followUpCount ?? 0) + (emailMode === "follow_up" ? 1 : 0);
      const updatePayload: Partial<Quote> = {
        status: "sent",
        sentAt: activeEmailQuote.sentAt || new Date(),
        followUpCount,
        lastFollowUpAt:
          emailMode === "follow_up"
            ? new Date()
            : activeEmailQuote.lastFollowUpAt ?? null,
        emailLog: [...(activeEmailQuote.emailLog || []), logEntry],
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "quotes", activeEmailQuote.id), updatePayload);
      toast({ title: emailMode === "send" ? "Quote sent." : "Follow-up sent." });
      setEmailDialogOpen(false);
      setActiveEmailQuote(null);
      resetForm();
      setActiveTab("sent");
    } catch (error) {
      console.error("Failed to send email:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send email. Please check your SMTP configuration.";
      if (restoreState) {
        setActiveTab(restoreState.activeTab);
        setFormData(restoreState.formData);
        setEditingQuoteId(restoreState.editingQuoteId);
      }
      toast({ 
        variant: "destructive", 
        title: "Failed to send email.",
        description: errorMessage
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDecision = (quote: Quote, status: "accepted" | "lost") => {
    setDecisionQuote(quote);
    setDecisionStatus(status);
    setDecisionDetails({});
    setDecisionDialogOpen(true);
  };

  const buildInvoiceDataFromQuote = (quote: Quote) => {
    const invoiceNumber = quote.convertedInvoiceNumber || `INV-${quote.reference}`;
    const recipientCityStateZip = [quote.recipientCity, quote.recipientState, quote.recipientZip]
      .filter(Boolean)
      .join(", ");
    const invoiceDate = quote.convertedAt ? formatDate(quote.convertedAt) : formatDateForDisplay(quote.quoteDate);
    return {
      invoiceNumber,
      date: invoiceDate || formatDateForDisplay(quote.quoteDate) || "—",
      orderNumber: `ORD-${quote.reference}`,
      soldTo: {
        name: quote.recipientName || "",
        email: quote.recipientEmail || "",
        phone: quote.recipientPhone || "",
        addressLine: quote.recipientAddress || "",
        cityStateZip: recipientCityStateZip,
        country: quote.recipientCountry || "",
      },
      items: quote.items.map((item) => ({
        description: item.description || "",
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        amount: Number(item.amount || 0),
      })),
      subtotal: quote.subtotal,
      salesTax: quote.salesTax || 0,
      shippingCost: quote.shippingCost || 0,
      total: quote.total,
    };
  };

  const submitDecision = async () => {
    if (!decisionQuote) return;
    setSaving(true);
    try {
      const payload =
        decisionStatus === "accepted"
          ? { acceptedDetails: { ...decisionDetails, decidedAt: new Date(), decidedBy: userProfile?.uid || "" } }
          : { lostDetails: { ...decisionDetails, decidedAt: new Date(), decidedBy: userProfile?.uid || "" } };
      await updateDoc(doc(db, "quotes", decisionQuote.id), {
        status: decisionStatus,
        ...payload,
        updatedAt: serverTimestamp(),
      });
      toast({ title: `Quote marked as ${decisionStatus}.` });
      setDecisionDialogOpen(false);
    } catch (error) {
      console.error("Failed to update decision:", error);
      toast({ variant: "destructive", title: "Failed to update quote." });
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToInvoice = async (quote: Quote) => {
    setSaving(true);
    try {
      const invoiceNumber = quote.convertedInvoiceNumber || `INV-${quote.reference}`;
      const invoiceDate = new Date().toISOString().slice(0, 10);
      const invoiceDoc = await addDoc(collection(db, "quote_invoices"), {
        quoteId: quote.id,
        invoiceNumber,
        invoiceDate,
        orderNumber: `ORD-${quote.reference}`,
        reference: quote.reference,
        quoteDate: quote.quoteDate,
        validUntil: quote.validUntil,
        recipientName: quote.recipientName,
        recipientEmail: quote.recipientEmail,
        recipientAddress: quote.recipientAddress || "",
        recipientCity: quote.recipientCity || "",
        recipientState: quote.recipientState || "",
        recipientZip: quote.recipientZip || "",
        recipientPhone: quote.recipientPhone || "",
        items: quote.items,
        subtotal: quote.subtotal,
        salesTax: quote.salesTax || 0,
        shippingCost: quote.shippingCost || 0,
        total: quote.total,
        notes: quote.notes || "",
        terms: quote.terms || "",
        preparedBy: quote.preparedBy || "",
        approvedBy: quote.approvedBy || "",
        preparedDate: quote.preparedDate || "",
        approvedDate: quote.approvedDate || "",
        createdAt: serverTimestamp(),
        createdBy: userProfile?.uid || "",
      });
      await updateDoc(doc(db, "quotes", quote.id), {
        convertedInvoiceId: invoiceDoc.id,
        convertedInvoiceNumber: invoiceNumber,
        convertedAt: serverTimestamp(),
      });
      toast({ title: "Quote converted to invoice." });
    } catch (error) {
      console.error("Failed to convert quote:", error);
      toast({ variant: "destructive", title: "Failed to convert quote." });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!quoteTemplateRef.current) return;
    setIsPrintMode(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const canvas = await html2canvas(quoteTemplateRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let y = 0;

      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      } else {
        let remainingHeight = imgHeight;
        while (remainingHeight > 0) {
          pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
          remainingHeight -= pageHeight;
          y -= pageHeight;
          if (remainingHeight > 0) {
            pdf.addPage();
          }
        }
      }
      pdf.save(`${formData.reference || "quotation"}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast({ variant: "destructive", title: "Failed to export PDF." });
    } finally {
      setIsPrintMode(false);
    }
  };

  const handleViewPdf = async (quote: Quote) => {
    const restoreState = {
      activeTab,
      formData,
      editingQuoteId,
    };
    try {
      setFormData(mapQuoteToFormData(quote));
      setEditingQuoteId(quote.id);
      if (activeTab !== "new") {
        setActiveTab("new");
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
      const pdfFile = await generateQuotePdfFile(quote.reference);
      if (!pdfFile) {
        throw new Error("Failed to generate quote PDF.");
      }
      const pdfUrl = URL.createObjectURL(pdfFile);
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);
    } catch (error) {
      console.error("Failed to preview PDF:", error);
      toast({ variant: "destructive", title: "Failed to preview PDF." });
    } finally {
      setActiveTab(restoreState.activeTab);
      setFormData(restoreState.formData);
      setEditingQuoteId(restoreState.editingQuoteId);
    }
  };

  const handleDownloadQuotePdf = async (quote: Quote) => {
    const restoreState = {
      activeTab,
      formData,
      editingQuoteId,
    };
    try {
      setFormData(mapQuoteToFormData(quote));
      setEditingQuoteId(quote.id);
      if (activeTab !== "new") {
        setActiveTab("new");
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
      const pdfFile = await generateQuotePdfFile(quote.reference);
      if (!pdfFile) {
        throw new Error("Failed to generate quote PDF.");
      }
      const pdfUrl = URL.createObjectURL(pdfFile);
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = pdfFile.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);
    } catch (error) {
      console.error("Failed to download PDF:", error);
      toast({ variant: "destructive", title: "Failed to download PDF." });
    } finally {
      setActiveTab(restoreState.activeTab);
      setFormData(restoreState.formData);
      setEditingQuoteId(restoreState.editingQuoteId);
    }
  };

  const mapDeleteLogToFormData = (log: any) => ({
    reference: log.reference || "",
    quoteDate: log.quoteDate || "",
    validUntil: log.validUntil || "",
    recipientName: log.recipientName || "",
    recipientEmail: log.recipientEmail || "",
    recipientAddress: log.recipientAddress || "",
    recipientCity: log.recipientCity || "",
    recipientState: log.recipientState || "",
    recipientZip: log.recipientZip || "",
    recipientCountry: log.recipientCountry || "",
    recipientPhone: log.recipientPhone || "",
    subject: "",
    message: "",
    notes: "",
    terms: log.terms || "",
    items: log.items?.length ? log.items : [createEmptyItem()],
    subtotal: log.subtotal || 0,
    salesTax: log.salesTax || 0,
    shippingCost: log.shippingCost || 0,
    total: log.total || 0,
    preparedBy: log.preparedBy || "",
    approvedBy: log.approvedBy || "",
    preparedDate: "",
    approvedDate: "",
    sentAt: log.sentAt,
    followUpCount: log.followUpCount ?? 0,
    lastFollowUpAt: log.lastFollowUpAt,
    emailLog: [],
    acceptedDetails: undefined,
    lostDetails: undefined,
    convertedInvoiceId: undefined,
    convertedAt: undefined,
  });

  const handleViewDeletedQuote = async (log: any) => {
    const restoreState = {
      activeTab,
      formData,
      editingQuoteId,
    };
    try {
      const formDataFromLog = mapDeleteLogToFormData(log);
      setFormData(formDataFromLog);
      setEditingQuoteId(null);
      if (activeTab !== "new") {
        setActiveTab("new");
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
      const pdfFile = await generateQuotePdfFile(log.reference || "deleted-quote");
      if (!pdfFile) {
        throw new Error("Failed to generate quote PDF.");
      }
      const pdfUrl = URL.createObjectURL(pdfFile);
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);
    } catch (error) {
      console.error("Failed to preview PDF:", error);
      toast({ variant: "destructive", title: "Failed to preview PDF." });
    } finally {
      setActiveTab(restoreState.activeTab);
      setFormData(restoreState.formData);
      setEditingQuoteId(restoreState.editingQuoteId);
    }
  };

  const handleViewInvoicePdf = async (quote: Quote) => {
    try {
      const invoiceData = buildInvoiceDataFromQuote(quote);
      const pdfBlob = await generateQuoteInvoicePdfBlob({
        invoiceNumber: invoiceData.invoiceNumber,
        invoiceDate: invoiceData.date,
        company: {
          name: COMPANY_INFO.name,
          email: COMPANY_INFO.email,
          phone: COMPANY_INFO.phone,
          addressLine: COMPANY_INFO.addressLines[0] || "",
          cityStateZip: COMPANY_INFO.addressLines[1] || "",
        },
        soldTo: invoiceData.soldTo,
        items: invoiceData.items,
        subtotal: invoiceData.subtotal,
        salesTax: invoiceData.salesTax,
        shippingCost: invoiceData.shippingCost,
        total: invoiceData.total,
      });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);
    } catch (error) {
      console.error("Failed to preview invoice PDF:", error);
      toast({ variant: "destructive", title: "Failed to preview invoice." });
    }
  };

  const handleDownloadInvoicePdf = async (quote: Quote) => {
    try {
      const invoiceData = buildInvoiceDataFromQuote(quote);
      const pdfBlob = await generateQuoteInvoicePdfBlob({
        invoiceNumber: invoiceData.invoiceNumber,
        invoiceDate: invoiceData.date,
        company: {
          name: COMPANY_INFO.name,
          email: COMPANY_INFO.email,
          phone: COMPANY_INFO.phone,
          addressLine: COMPANY_INFO.addressLines[0] || "",
          cityStateZip: COMPANY_INFO.addressLines[1] || "",
        },
        soldTo: invoiceData.soldTo,
        items: invoiceData.items,
        subtotal: invoiceData.subtotal,
        salesTax: invoiceData.salesTax,
        shippingCost: invoiceData.shippingCost,
        total: invoiceData.total,
      });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `Invoice-${invoiceData.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);
    } catch (error) {
      console.error("Failed to download invoice PDF:", error);
      toast({ variant: "destructive", title: "Failed to download invoice." });
    }
  };

  const downloadCsv = (rows: Quote[], filename: string) => {
    if (!rows.length) {
      toast({ variant: "destructive", title: "No data to export." });
      return;
    }
    const header = [
      "Reference",
      "Recipient Name",
      "Recipient Email",
      "Status",
      "Sent At",
      "Follow Ups",
      "Client Name",
      "Client Email",
      "Client Contact",
      "Client Company",
      "Notes",
    ];
    const data = rows.map((quote) => {
      const details = quote.status === "accepted" ? quote.acceptedDetails : quote.lostDetails;
      return [
        quote.reference,
        quote.recipientName,
        quote.recipientEmail,
        quote.status,
        formatDate(quote.sentAt),
        `${quote.followUpCount ?? 0}/${FOLLOW_UP_LIMIT}`,
        details?.clientName || "",
        details?.clientEmail || "",
        details?.clientContact || "",
        details?.clientCompany || "",
        details?.notes || "",
      ];
    });
    const csv = [header, ...data]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateItem = (index: number, field: keyof QuoteLineItem, value: string) => {
    const updated = [...formData.items];
    if (field === "quantity" || field === "unitPrice") {
      updated[index][field] = Number(value);
    } else {
      updated[index][field] = value as never;
    }
    const { items, subtotal, salesTax, total } = calculateTotals(
      updated,
      formData.shippingCost,
      formData.salesTax
    );
    setFormData((prev) => ({ ...prev, items, subtotal, salesTax, total }));
  };

  const addItem = () => {
    const updated = [...formData.items, createEmptyItem()];
    const { items, subtotal, salesTax, total } = calculateTotals(
      updated,
      formData.shippingCost,
      formData.salesTax
    );
    setFormData((prev) => ({ ...prev, items, subtotal, salesTax, total }));
  };

  const removeItem = (index: number) => {
    const updated = formData.items.filter((_, idx) => idx !== index);
    const fallback = updated.length ? updated : [createEmptyItem()];
    const { items, subtotal, salesTax, total } = calculateTotals(
      fallback,
      formData.shippingCost,
      formData.salesTax
    );
    setFormData((prev) => ({ ...prev, items, subtotal, salesTax, total }));
  };

  const statusLabel =
    decisionStatus === "lost" ? "rejected" : decisionStatus;
  const getQuoteStatusLabel = (quote: Quote, followUpCount: number) => {
    if (quote.status === "sent" && followUpCount > 0) return "Follow Up";
    if (quote.status === "lost") return "Rejected";
    return quote.status;
  };

  const renderQuoteRow = (quote: Quote, options?: { showActions?: boolean; showFollowUp?: boolean }) => {
    const followUpCount = quote.followUpCount ?? 0;
    const followUpLimitReached = followUpCount >= FOLLOW_UP_LIMIT;
    const isDraft = quote.status === "draft";
    
    // For drafts, use 4 columns (hide follow-up count)
    // For others, use 5 columns
    const gridCols = isDraft 
      ? "grid-cols-[1.2fr_1.4fr_0.8fr_1fr]"
      : "grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr_0.8fr]";
    
    return (
      <div
        key={quote.id}
        className={cn(
          "grid gap-3 items-center border-b px-3 py-3 text-sm",
          gridCols,
          followUpLimitReached && options?.showFollowUp ? "bg-red-50 border-red-200" : "border-border"
        )}
      >
        <div>
          <p className="font-medium">{quote.recipientName || "—"}</p>
          <p className="text-xs text-muted-foreground break-all">{quote.recipientEmail || "—"}</p>
        </div>
        <div>
          <p className="font-medium">{quote.reference}</p>
          {!isDraft && (
            <p className="text-xs text-muted-foreground">Sent: {formatDate(quote.sentAt)}</p>
          )}
        </div>
        <div>
          <Badge variant="secondary" className="capitalize">
            {getQuoteStatusLabel(quote, followUpCount)}
          </Badge>
        </div>
        {!isDraft && (
          <div className="text-xs">
            {followUpCount}/{FOLLOW_UP_LIMIT} follow ups
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleViewPdf(quote)}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          {options?.showActions && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleEditQuote(quote)}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => openEmailDialog(quote, "send")}>
                <Send className="h-4 w-4 mr-1" />
                Send
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteQuote(quote)}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          )}
          {options?.showFollowUp && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={followUpLimitReached}
                onClick={() => openEmailDialog(quote, "follow_up")}
              >
                <Mail className="h-4 w-4 mr-1" />
                Follow Up
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDecision(quote, "accepted")}>
                <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                Accepted
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDecision(quote, "lost")}>
                <XCircle className="h-4 w-4 mr-1 text-red-600" />
                Reject
              </Button>
            </>
          )}
          {!options?.showActions && !options?.showFollowUp && (
            <Badge variant="outline" className="capitalize">
              {quote.status}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quote Management</h1>
        <p className="text-muted-foreground mt-1">
          Create, send, and track quotation follow-ups
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>Draft</CardTitle>
            <CardDescription>Saved but not sent</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{statusCounts.draft}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sent</CardTitle>
            <CardDescription>Awaiting response</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{statusCounts.sent}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Follow Up</CardTitle>
            <CardDescription>Active follow-ups</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {sentQuotes.filter((q) => (q.followUpCount ?? 0) > 0).length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Accepted</CardTitle>
            <CardDescription>Won quotations</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{statusCounts.accepted}</CardContent>
        </Card>
        <Card>
          <CardHeader>
          <CardTitle>Rejected</CardTitle>
            <CardDescription>Closed quotations</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{statusCounts.lost}</CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="follow_up">Follow Up</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
        <TabsTrigger value="lost">Rejected</TabsTrigger>
          <TabsTrigger value="convert">Convert to Invoice</TabsTrigger>
          <TabsTrigger value="deleted">Deleted</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                {editingQuoteId ? "Edit Quote" : "New Quote"}
              </CardTitle>
              <CardDescription>
                Fill out the quotation template and save or send it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <style jsx global>{`
                .quote-print-mode input,
                .quote-print-mode textarea {
                  border-color: transparent !important;
                  background: transparent !important;
                  box-shadow: none !important;
                  padding-left: 0 !important;
                  padding-right: 0 !important;
                }

                .quote-print-mode textarea {
                  resize: none !important;
                }

                .quote-print-mode .quote-remove-column,
                .quote-print-mode .quote-actions {
                  display: none !important;
                }
              `}</style>
              <div
                ref={quoteTemplateRef}
                className={cn(
                  "bg-white border-2 border-amber-700/70 rounded-md p-6 shadow-sm max-w-[794px] mx-auto space-y-6",
                  isPrintMode && "quote-print-mode"
                )}
              >
                <div className="space-y-4">
                  <h2 className="text-center text-2xl font-bold tracking-wide text-amber-800">SALES QUOTATION</h2>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex justify-center sm:justify-start">
                      <img
                        src="/quote-logo.png"
                        alt="Prep Services FBA"
                        className="h-20 w-auto object-contain"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-2 sm:text-right">
                      <div className="flex flex-col gap-2 sm:items-end">
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <span>Quotation Number:</span>
                          {isPrintMode ? (
                            <span className="font-semibold text-amber-900">{formData.reference || "—"}</span>
                          ) : (
                            <Input
                              value={formData.reference}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, reference: event.target.value }))
                              }
                              className="h-8 w-44 text-center"
                            />
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <span>Date:</span>
                          {isPrintMode ? (
                            <span className="font-semibold text-amber-900">{formatDateForDisplay(formData.quoteDate) || "—"}</span>
                          ) : (
                            <Input
                              type="date"
                              value={formData.quoteDate}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, quoteDate: event.target.value }))
                              }
                              className="h-8 w-40 text-center"
                            />
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-end">
                          <span>Valid Until:</span>
                          {isPrintMode ? (
                            <span className="font-semibold text-amber-900">{formatDateForDisplay(formData.validUntil) || "—"}</span>
                          ) : (
                            <Input
                              type="date"
                              value={formData.validUntil}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, validUntil: event.target.value }))
                              }
                              className="h-8 w-40 text-center"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border border-amber-200/70 rounded-md p-4 text-sm space-y-1">
                    <p className="text-xs uppercase text-amber-700 font-semibold">From</p>
                    <p className="font-semibold">{COMPANY_INFO.name}</p>
                    {COMPANY_INFO.addressLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    <p>Phone: {COMPANY_INFO.phone}</p>
                    <p>Email: {COMPANY_INFO.email}</p>
                  </div>
                  <div className="border border-amber-200/70 rounded-md p-4 text-sm space-y-3">
                    <p className="text-xs uppercase text-amber-700 font-semibold">To</p>
                    {isPrintMode ? (
                      <div className="space-y-1">
                        <p className="font-semibold">{formData.recipientName || "—"}</p>
                        {formData.recipientAddress && <p>{formData.recipientAddress}</p>}
                        {(formData.recipientCity || formData.recipientState || formData.recipientZip || formData.recipientCountry) && (
                          <p>
                            {[formData.recipientCity, formData.recipientState, formData.recipientZip, formData.recipientCountry]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                        {formData.recipientPhone && <p>Phone: {formData.recipientPhone}</p>}
                        {formData.recipientEmail && <p>Email: {formData.recipientEmail}</p>}
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Client Name</Label>
                          <Input
                            value={formData.recipientName}
                            onChange={(event) =>
                              setFormData((prev) => ({ ...prev, recipientName: event.target.value }))
                            }
                            placeholder="Client name"
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Address</Label>
                          <Input
                            value={formData.recipientAddress}
                            onChange={(event) =>
                              setFormData((prev) => ({ ...prev, recipientAddress: event.target.value }))
                            }
                            placeholder="Client address"
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Country</Label>
                          <Input
                            value={formData.recipientCountry}
                            onChange={(event) =>
                              setFormData((prev) => ({ ...prev, recipientCountry: event.target.value }))
                            }
                            placeholder="Country"
                            className="h-9"
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">City</Label>
                            <Input
                              value={formData.recipientCity}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, recipientCity: event.target.value }))
                              }
                              placeholder="City"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">State</Label>
                            <Input
                              value={formData.recipientState}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, recipientState: event.target.value }))
                              }
                              placeholder="State"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Zip Code</Label>
                            <Input
                              value={formData.recipientZip}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, recipientZip: event.target.value }))
                              }
                              placeholder="Zip"
                              className="h-9"
                            />
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Phone</Label>
                            <Input
                              value={formData.recipientPhone}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, recipientPhone: event.target.value }))
                              }
                              placeholder="Phone"
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Email</Label>
                            <Input
                              value={formData.recipientEmail}
                              onChange={(event) =>
                                setFormData((prev) => ({ ...prev, recipientEmail: event.target.value }))
                              }
                              placeholder="client@email.com"
                              type="email"
                              className="h-9"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">Itemized Quotation Details</h3>
                    <Button variant="outline" size="sm" onClick={addItem} className="quote-actions">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  <div className="border border-amber-200/70 rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-50 text-amber-900">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-semibold">Item Description</th>
                          <th className="px-3 py-2 font-semibold w-24">Quantity</th>
                          <th className="px-3 py-2 font-semibold w-32">Unit Price ($)</th>
                          <th className="px-3 py-2 font-semibold w-32 text-right">Total Price ($)</th>
                          {!isPrintMode && <th className="px-3 py-2 font-semibold w-10 text-right quote-remove-column"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, index) => (
                          <tr key={item.id} className="border-t border-amber-100">
                            <td className="px-3 py-2">
                              {isPrintMode ? (
                                <span className="text-sm">{item.description || "—"}</span>
                              ) : (
                                <Input
                                  value={item.description}
                                  onChange={(event) => updateItem(index, "description", event.target.value)}
                                  placeholder="Manual field"
                                  className="h-8"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isPrintMode ? (
                                <span className="text-sm">{item.quantity || 0}</span>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  value={item.quantity}
                                  onChange={(event) => updateItem(index, "quantity", event.target.value)}
                                  className="h-8"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isPrintMode ? (
                                <span className="text-sm">${(item.unitPrice || 0).toFixed(2)}</span>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(event) => updateItem(index, "unitPrice", event.target.value)}
                                  className="h-8"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              ${item.amount.toFixed(2)}
                            </td>
                            {!isPrintMode && (
                              <td className="px-3 py-2 text-right quote-remove-column">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(index)}
                                  className="text-destructive h-8 w-8 quote-actions"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                            const { items, subtotal, total } = calculateTotals(
                              formData.items,
                              formData.shippingCost,
                              salesTax
                            );
                            setFormData((prev) => ({ ...prev, salesTax, items, subtotal, total }));
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
                            const { items, subtotal, salesTax, total } = calculateTotals(
                              formData.items,
                              shippingCost,
                              formData.salesTax
                            );
                            setFormData((prev) => ({ ...prev, shippingCost, items, subtotal, salesTax, total }));
                          }}
                          className="h-8 w-28 text-right"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-amber-200 pt-2 text-amber-900 font-semibold">
                      <span>Grand Total</span>
                      <span>${formData.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="border border-amber-200/70 rounded-md p-4 space-y-2">
                  <p className="text-xs uppercase text-amber-700 font-semibold">Terms &amp; Conditions</p>
                  {isPrintMode ? (
                    <ul className="text-xs leading-5 space-y-1 list-disc list-inside text-amber-900">
                      {formatTermsAsBullets(formData.terms).map((term, idx) => (
                        <li key={idx}>{term}</li>
                      ))}
                    </ul>
                  ) : (
                    <Textarea
                      value={formData.terms}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, terms: event.target.value }))
                      }
                      rows={6}
                      className="text-xs leading-5"
                    />
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2 text-sm">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Prepared By</Label>
                    {isPrintMode ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{formData.preparedBy || "—"}</p>
                        {formData.preparedDate && (
                          <p className="text-xs text-muted-foreground">{formatDateForDisplay(formData.preparedDate)}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <Input
                          value={formData.preparedBy}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, preparedBy: event.target.value }))
                          }
                          className="h-9"
                        />
                        <Label className="text-xs text-muted-foreground">Date</Label>
                        <Input
                          type="date"
                          value={formData.preparedDate}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, preparedDate: event.target.value }))
                          }
                          className="h-9"
                        />
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Approved By</Label>
                    {isPrintMode ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{formData.approvedBy || "—"}</p>
                        {formData.approvedDate && (
                          <p className="text-xs text-muted-foreground">{formatDateForDisplay(formData.approvedDate)}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <Input
                          value={formData.approvedBy}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, approvedBy: event.target.value }))
                          }
                          className="h-9"
                        />
                        <Label className="text-xs text-muted-foreground">Date</Label>
                        <Input
                          type="date"
                          value={formData.approvedDate}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, approvedDate: event.target.value }))
                          }
                          className="h-9"
                        />
                      </>
                    )}
                  </div>
                </div>
                <p className="text-center text-sm text-amber-900">
                  We appreciate the opportunity to do business with you.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Save as Draft
                </Button>
                <Button onClick={handleSendFromForm} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  Send
                </Button>
                <Button variant="outline" onClick={handleDownloadPdf}>
                  <Download className="h-4 w-4 mr-1" />
                  Download PDF
                </Button>
                {editingQuoteId && (
                  <Button variant="ghost" onClick={resetForm}>
                    Cancel Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="draft" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Draft Quotes</CardTitle>
              <CardDescription>Edit, send, or delete draft quotations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by name, email, or reference"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredDraftQuotes.length ? (
                filteredDraftQuotes.map((quote) => renderQuoteRow(quote, { showActions: true }))
              ) : (
                <p className="text-sm text-muted-foreground">No draft quotes yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sent Quotes</CardTitle>
              <CardDescription>All sent quotations with recipient details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by name, email, or reference"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSentQuotes.length ? (
                filteredSentQuotes.map((quote) => renderQuoteRow(quote))
              ) : (
                <p className="text-sm text-muted-foreground">No sent quotes yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="follow_up" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Follow Up</CardTitle>
              <CardDescription>
                Send follow-ups or mark the quote as accepted or rejected.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by name, email, or reference"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSentQuotes.length ? (
                filteredSentQuotes.map((quote) => renderQuoteRow(quote, { showFollowUp: true }))
              ) : (
                <p className="text-sm text-muted-foreground">No quotes to follow up.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accepted" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Accepted Quotes</CardTitle>
                <CardDescription>Quotes marked as accepted.</CardDescription>
              </div>
              <Button variant="outline" onClick={() => downloadCsv(acceptedQuotes, "accepted-quotes.csv")}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by name, email, or reference"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAcceptedQuotes.length ? (
                filteredAcceptedQuotes.map((quote) => renderQuoteRow(quote))
              ) : (
                <p className="text-sm text-muted-foreground">No accepted quotes yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lost" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Rejected Quotes</CardTitle>
                <CardDescription>Quotes marked as rejected.</CardDescription>
              </div>
              <Button variant="outline" onClick={() => downloadCsv(lostQuotes, "rejected-quotes.csv")}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by name, email, or reference"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLostQuotes.length ? (
                filteredLostQuotes.map((quote) => renderQuoteRow(quote))
              ) : (
                <p className="text-sm text-muted-foreground">No rejected quotes yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="convert" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Convert to Invoice</CardTitle>
              <CardDescription>Convert accepted quotations into invoices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by name, email, or reference"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <div className="flex items-center justify-end">
                <Button
                  variant={showConvertedOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowConvertedOnly((prev) => !prev)}
                >
                  {showConvertedOnly ? "Showing Converted" : "Show Converted Only"}
                </Button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConvertibleQuotes.length ? (
                <>
                  {filteredConvertibleQuotes.map((quote) => (
                  <div key={quote.id} className="flex items-center justify-between border-b py-3 text-sm">
                    <div>
                      <p className="font-medium">{quote.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        {quote.recipientName} ({quote.recipientEmail})
                      </p>
                    </div>
                    {quote.convertedInvoiceId ? (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewInvoicePdf(quote)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadInvoicePdf(quote)}>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewPdf(quote)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConvertToInvoice(quote)}
                        >
                          Convert to Invoice
                        </Button>
                      </div>
                    )}
                  </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No accepted quotes to convert.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deleted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deleted Quotes</CardTitle>
              <CardDescription>View deletion logs for removed quotations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by name, email, or reference"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {deleteLogsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : deleteLogs.length ? (
                <div className="space-y-3">
                  {deleteLogs
                    .filter((log) => {
                      const query = searchQuery.trim().toLowerCase();
                      if (!query) return true;
                      return (
                        log.reference?.toLowerCase().includes(query) ||
                        log.recipientName?.toLowerCase().includes(query) ||
                        log.recipientEmail?.toLowerCase().includes(query)
                      );
                    })
                    .map((log) => (
                      <div
                        key={log.id}
                        className="border rounded-lg p-4 space-y-3 bg-muted/30"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-semibold text-lg">{log.reference || "—"}</p>
                            <p className="text-sm text-muted-foreground">
                              {log.recipientName || "—"} ({log.recipientEmail || "—"})
                            </p>
                          </div>
                          <Badge variant="destructive">Deleted</Badge>
                        </div>
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Deleted By:</span>
                            <span>{log.deletedByName || "Unknown"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Deleted At:</span>
                            <span>{formatDate(log.deletedAt)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Original Status:</span>
                            <Badge variant="secondary" className="capitalize">
                              {log.status || "—"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Total Amount:</span>
                            <span>${(log.total || 0).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium mb-1">Deletion Reason:</p>
                          <p className="text-sm text-muted-foreground bg-background p-3 rounded-md border">
                            {log.reason || "No reason provided"}
                          </p>
                        </div>
                        <div className="flex justify-end pt-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewDeletedQuote(log)}>
                            <Eye className="h-4 w-4 mr-1" />
                            View Quote
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No deleted quotes found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{emailMode === "send" ? "Send Quote" : "Send Follow Up"}</DialogTitle>
            <DialogDescription>
              Compose the email to send to the recipient.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="emailTo">To</Label>
              <Input
                id="emailTo"
                value={emailForm.to}
                onChange={(event) => setEmailForm((prev) => ({ ...prev, to: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailSubject">Subject</Label>
              <Input
                id="emailSubject"
                value={emailForm.subject}
                onChange={(event) => setEmailForm((prev) => ({ ...prev, subject: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailMessage">Message</Label>
              <Textarea
                id="emailMessage"
                value={emailForm.message}
                onChange={(event) => setEmailForm((prev) => ({ ...prev, message: event.target.value }))}
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailAttachments">Attachments</Label>
              <Input
                id="emailAttachments"
                type="file"
                multiple
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  setEmailForm((prev) => ({ ...prev, attachments: files }));
                }}
              />
              {emailMode === "send" && (
                <div className="text-xs text-muted-foreground">
                  The quotation PDF will be attached automatically when you send.
                </div>
              )}
              {emailForm.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {emailForm.attachments.map((file) => (
                    <Badge key={file.name} variant="secondary">
                      {file.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={isSendingEmail}>
              {isSendingEmail ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">Mark as {statusLabel}</DialogTitle>
            <DialogDescription>
              Add optional client details for this quote.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input
                value={decisionDetails.clientName || ""}
                onChange={(event) =>
                  setDecisionDetails((prev) => ({ ...prev, clientName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Client Email</Label>
              <Input
                type="email"
                value={decisionDetails.clientEmail || ""}
                onChange={(event) =>
                  setDecisionDetails((prev) => ({ ...prev, clientEmail: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Client Contact</Label>
              <Input
                value={decisionDetails.clientContact || ""}
                onChange={(event) =>
                  setDecisionDetails((prev) => ({ ...prev, clientContact: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Client Company</Label>
              <Input
                value={decisionDetails.clientCompany || ""}
                onChange={(event) =>
                  setDecisionDetails((prev) => ({ ...prev, clientCompany: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={decisionDetails.notes || ""}
                onChange={(event) =>
                  setDecisionDetails((prev) => ({ ...prev, notes: event.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitDecision} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quote</DialogTitle>
            <DialogDescription>
              Please provide a reason for deleting this quote. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteQuote && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                <p className="font-medium">Quote Reference: {deleteQuote.reference}</p>
                <p className="text-muted-foreground">
                  {deleteQuote.recipientName} ({deleteQuote.recipientEmail})
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deleteReason">Deletion Reason *</Label>
                <Textarea
                  id="deleteReason"
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  placeholder="Enter the reason for deleting this quote..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteQuote(null);
              setDeleteReason("");
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteQuote} disabled={saving || !deleteReason.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
