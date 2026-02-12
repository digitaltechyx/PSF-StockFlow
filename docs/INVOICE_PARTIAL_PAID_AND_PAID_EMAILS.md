# Invoice management: emails for Partial paid & Paid

When an admin records a payment in the Invoice Management Portal and the invoice becomes **partially paid** or **paid**, the client will receive one of the following emails (no PDF attachment for these; they’re confirmations only).

---

## 1. Partial paid (payment received, balance still due)

**To:** `{clientEmail}`  
**Subject:** `Payment Received – Invoice {invoiceNumber} (Partial)`

**Message (plain text):**

```
Hi,

Thank you for your payment. We have received the amount you sent and applied it to Invoice {invoiceNumber}.

Your remaining balance on this invoice is ${outstandingBalance}. We look forward to receiving the rest when you’re ready. If you have any questions or need an updated invoice, just let us know.

Best regards,
Prep Services FBA Team
```

*(In the app, `{invoiceNumber}` and `{outstandingBalance}` will be replaced with the real invoice number and remaining balance.)*

---

## 2. Paid in full

**To:** `{clientEmail}`  
**Subject:** `Invoice {invoiceNumber} Paid in Full – Thank You`

**Message (plain text):**

```
Hi,

Thank you for your payment. We have received the full amount for Invoice {invoiceNumber}, and this invoice is now paid in full.

No further action is needed. If you have any questions, we’re happy to help.

Best regards,
Prep Services FBA Team
```

*(In the app, `{invoiceNumber}` will be replaced with the real invoice number.)*

---

## When these are sent

- **Partial paid:** Sent automatically when the admin records a payment and the invoice status becomes **Partially paid** (i.e. there is still an outstanding balance).
- **Paid:** Sent automatically when the admin records a payment and the invoice status becomes **Paid** (outstanding balance is zero).

Same email API as the rest of the portal (e.g. `/api/email/send` or `NEXT_PUBLIC_EMAIL_API_URL`). No attachment for these two emails.
