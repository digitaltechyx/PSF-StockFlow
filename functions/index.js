const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const nodemailer = require("nodemailer");

admin.initializeApp();

const allowedOrigins = [
  "https://prepservicesfba.com",
  "https://www.prepservicesfba.com",
  "https://dev.prepservicesfba.com",
];

const corsHandler = cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.includes("prepservicesfba.com")) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
});

function normalizeRole(v) {
  return String(v || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isAdminLikeToken(claims) {
  if (!claims) return false;
  if (claims.admin === true || claims.isAdmin === true) return true;
  if (claims.sub_admin === true || claims.subAdmin === true || claims.isSubAdmin === true) return true;
  const role = normalizeRole(claims.role);
  if (role === "admin" || role === "sub_admin" || role === "subadmin") return true;
  const roles = Array.isArray(claims.roles) ? claims.roles.map(normalizeRole) : [];
  if (roles.includes("admin") || roles.includes("sub_admin") || roles.includes("subadmin")) return true;
  return false;
}

function isAdminLikeUserDoc(data) {
  if (!data) return false;
  if (data.isAdmin === true || data.admin === true || data.is_admin === true) return true;
  if (data.isSubAdmin === true || data.is_sub_admin === true) return true;
  const role = normalizeRole(data.role || data.userRole || data.userType);
  if (role === "admin" || role === "sub_admin" || role === "subadmin") return true;
  const roles = Array.isArray(data.roles) ? data.roles.map(normalizeRole) : [];
  if (roles.includes("admin") || roles.includes("sub_admin") || roles.includes("subadmin")) return true;
  if (Array.isArray(data.features)) {
    if (data.features.includes("admin_dashboard") || data.features.includes("manage_invoices") || data.features.includes("manage_users") || data.features.includes("manage_quotes")) return true;
  } else if (data.features && typeof data.features === "object") {
    if (data.features.admin_dashboard === true || data.features.manage_invoices === true || data.features.manage_users === true || data.features.manage_quotes === true) return true;
  }
  return false;
}

async function requireAdmin(req) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized: Missing token" };
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) return { ok: false, status: 401, error: "Unauthorized: Empty token" };

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (isAdminLikeToken(decoded)) return { ok: true, uid: decoded.uid };

    const snap = await admin.firestore().collection("users").doc(decoded.uid).get();
    const data = snap.exists ? snap.data() : null;
    if (!isAdminLikeUserDoc(data)) {
      return { ok: false, status: 403, error: "Forbidden: Admin access required" };
    }
    return { ok: true, uid: decoded.uid };
  } catch (error) {
    return { ok: false, status: 401, error: "Unauthorized: Invalid token" };
  }
}

exports.sendQuoteEmail = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const { to, subject, message, attachments } = req.body || {};
    if (!to || !subject) {
      res.status(400).json({ error: "Missing required fields." });
      return;
    }

    const smtpConfig = (functions.config() && functions.config().smtp) || {};
    const smtpHost = smtpConfig.host || process.env.SMTP_HOST;
    const smtpPort = Number(smtpConfig.port || process.env.SMTP_PORT || 587);
    const smtpUser = smtpConfig.user || process.env.SMTP_USER;
    const smtpPassword = smtpConfig.password || process.env.SMTP_PASSWORD;
    const smtpSecure = String(smtpConfig.secure || process.env.SMTP_SECURE || "false") === "true";
    const smtpFrom = smtpConfig.from || process.env.SMTP_FROM || smtpUser;
    const smtpFromName = smtpConfig.from_name || process.env.SMTP_FROM_NAME || "Prep Services FBA";

    if (!smtpHost || !smtpUser || !smtpPassword) {
      res.status(500).json({ error: "SMTP credentials are not configured." });
      return;
    }

    const formattedAttachments = Array.isArray(attachments)
      ? attachments.map((file) => ({
          filename: file.name,
          content: Buffer.from(file.dataBase64 || "", "base64"),
          contentType: file.type || undefined,
        }))
      : [];

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        requireTLS: !smtpSecure,
        auth: { user: smtpUser, pass: smtpPassword },
        tls: { rejectUnauthorized: false },
      });

      await transporter.verify();

      await transporter.sendMail({
        from: smtpFromName ? `${smtpFromName} <${smtpFrom}>` : smtpFrom,
        to,
        subject,
        text: message || "",
        attachments: formattedAttachments,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Email send error:", error);
      res.status(500).json({ error: error?.message || "Failed to send email." });
    }
  });
});

// ---- Invoice reminder: send reminder email 24 hours after invoice was sent ----
const INVOICE_REMINDER_MESSAGE = `Hello,

Just a friendly reminder regarding your pending invoice. As per our standard terms, payment is required before work begins, and services may be temporarily paused if an invoice remains unpaid.

If you've already taken care of this, please feel free to ignore this message. Otherwise, we'd appreciate your support in completing the payment at your convenience. If you have any questions or concerns, we're always happy to help.

Thank you for your cooperation.

Kind regards,
Prep Services FBA Team`;

const REMINDER_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSentAtDate(sentAt) {
  if (!sentAt) return null;
  if (sentAt.toDate && typeof sentAt.toDate === "function") return sentAt.toDate();
  if (typeof sentAt === "string" || typeof sentAt === "number") return new Date(sentAt);
  return null;
}

exports.sendInvoiceReminders = functions.pubsub.schedule("every 1 hours").onRun(async (context) => {
  const db = admin.firestore();
  const now = Date.now();

  const smtpConfig = (functions.config() && functions.config().smtp) || {};
  const smtpHost = smtpConfig.host || process.env.SMTP_HOST;
  const smtpPort = Number(smtpConfig.port || process.env.SMTP_PORT || 587);
  const smtpUser = smtpConfig.user || process.env.SMTP_USER;
  const smtpPassword = smtpConfig.password || process.env.SMTP_PASSWORD;
  const smtpSecure = String(smtpConfig.secure || process.env.SMTP_SECURE || "false") === "true";
  const smtpFrom = smtpConfig.from || process.env.SMTP_FROM || smtpUser;
  const smtpFromName = smtpConfig.from_name || process.env.SMTP_FROM_NAME || "Prep Services FBA";

  if (!smtpHost || !smtpUser || !smtpPassword) {
    console.warn("Invoice reminders: SMTP not configured, skipping.");
    return null;
  }

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      requireTLS: !smtpSecure,
      auth: { user: smtpUser, pass: smtpPassword },
      tls: { rejectUnauthorized: false },
    });
    await transporter.verify();
  } catch (err) {
    console.error("Invoice reminders: SMTP verify failed", err);
    return null;
  }

  const candidates = [];
  const sentSnap = await db.collection("external_invoices").where("status", "==", "sent").get();
  sentSnap.docs.forEach((doc) => candidates.push({ id: doc.id, ...doc.data() }));
  const partiallyPaidSnap = await db.collection("external_invoices").where("status", "==", "partially_paid").get();
  partiallyPaidSnap.docs.forEach((doc) => candidates.push({ id: doc.id, ...doc.data() }));

  const toRemind = candidates.filter((inv) => {
    if (inv.reminderSentAt) return false;
    const sentAt = getSentAtDate(inv.sentAt);
    if (!sentAt || isNaN(sentAt.getTime())) return false;
    return now - sentAt.getTime() >= REMINDER_AGE_MS;
  });

  for (const inv of toRemind) {
    const to = (inv.clientEmail || "").trim();
    if (!to) {
      console.warn("Invoice reminder skipped (no email):", inv.id, inv.invoiceNumber);
      continue;
    }
    const subject = `Reminder: Pending Invoice ${inv.invoiceNumber || inv.id}`;
    try {
      await transporter.sendMail({
        from: smtpFromName ? `${smtpFromName} <${smtpFrom}>` : smtpFrom,
        to,
        subject,
        text: INVOICE_REMINDER_MESSAGE,
      });
      await db.collection("external_invoices").doc(inv.id).update({
        reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("Invoice reminder sent:", inv.id, inv.invoiceNumber, to);
    } catch (err) {
      console.error("Invoice reminder send failed:", inv.id, err);
    }
  }

  return null;
});
