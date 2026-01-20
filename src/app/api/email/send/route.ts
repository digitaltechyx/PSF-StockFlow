import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const to = String(formData.get("to") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const message = String(formData.get("message") || "");

    if (!to || !subject) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE === "true";
    const smtpFrom = process.env.SMTP_FROM || smtpUser;
    const smtpFromName = process.env.SMTP_FROM_NAME || "Prep Services FBA";

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return NextResponse.json({ error: "SMTP credentials are not configured." }, { status: 500 });
    }

    const attachmentFiles = formData.getAll("attachments").filter((file) => file instanceof File) as File[];
    const attachments = await Promise.all(
      attachmentFiles.map(async (file) => ({
        filename: file.name,
        content: Buffer.from(await file.arrayBuffer()),
      }))
    );

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      requireTLS: !smtpSecure, // require TLS for non-SSL ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false,
      },
    });

    // Verify connection configuration
    await transporter.verify();

    await transporter.sendMail({
      from: smtpFromName ? `${smtpFromName} <${smtpFrom}>` : smtpFrom,
      to,
      subject,
      text: message,
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email send error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send email.";
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
