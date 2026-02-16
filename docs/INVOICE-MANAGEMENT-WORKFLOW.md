# Invoice Management Portal – Workflow & Emails

## How the workflow works

### 1. **Workflow start (when an invoice is “active”)**

- An invoice is in workflow when:
  - **Status** is `sent` or `partially_paid` (not draft, paid, cancelled, disputed).
  - **Due date** has passed (today > due date) → it is treated as **overdue**.

So: **Workflow starts** when the invoice is sent to the client and its due date is in the past.

### 2. **Workflow steps (automatic overdue emails)**

The portal runs an automatic **useEffect** whenever the invoice list or other dependencies change. It does two things:

| Step | When it runs | What happens |
|------|----------------|--------------|
| **1) First overdue** | Invoice is overdue, has no late fee, and `lateFeeEmailSentAt` is empty | Add $19 late fee, update due date to “tomorrow”, save to Firestore, **send one “Late Fee Added” email** and set `lateFeeEmailSentAt`. |
| **2) Second reminder** | Same invoice still overdue, already has late fee and `lateFeeEmailSentAt` set, and `secondOverdueReminderSentAt` is empty | **Send one “Final Reminder” email** and set `secondOverdueReminderSentAt`. |

So in normal operation:

- **At most 1** “Late Fee Added” email per invoice.
- **At most 1** “Final Reminder” email per invoice.

### 3. **Workflow stop (when we do NOT send overdue emails)**

We **do not** run overdue logic or send overdue/reminder emails when:

- **Fully paid by status:** `status === "paid"` or `"cancelled"` or `"disputed"`.
- **Fully paid by amount:** `amountPaid >= grand total` (including late fee), even if status is not yet `"paid"`.

So: **Workflow stops** when the invoice is marked paid (or cancelled/disputed) or when the amount paid is at least the full balance.

### 4. **Other emails (manual or triggered by payment)**

| Email | When it’s sent |
|-------|-----------------|
| **Invoice sent** | Admin clicks “Send” from the email dialog (manual). |
| **Payment confirmation** | Admin records a partial or full payment and the system sends a confirmation to the client. |
| **Resend / updated invoice** | Admin updates late fee (e.g. discount) and chooses to resend the invoice. |

These are triggered by explicit admin actions or payment recording, not by the automatic overdue loop.

---

## Why your client got 566 emails (and how we fix it)

Two things can cause way too many emails even when the invoice is fully paid or should be stopped:

### Cause 1: Invoice never marked as paid

- If the client paid **outside the portal** (bank transfer, etc.) and the admin never recorded the payment or set status to **Paid**, the system still treats the invoice as unpaid and overdue.
- The automatic workflow then keeps considering it for “late fee” and “final reminder” until:
  - Someone marks it **Paid**, or  
  - `amountPaid` is set so that `amountPaid >= grand total` (we now stop when that’s true).

So: **Always mark the invoice as Paid (and/or record the full amount paid) as soon as the client pays.**

### Cause 2: Effect runs on every list change → duplicate sends (bug)

- The overdue logic runs inside a **useEffect** that depends on **invoices** (and other deps).
- **invoices** comes from a **real-time Firestore listener**. Every time any invoice (or the list) changes, the effect runs again.
- The effect does **not** wait for the previous run to finish, and does **not** limit how often it runs. So:
  - Effect runs → finds “overdue, no late fee email” → sends email, starts updating Firestore.
  - Before that update is saved and the new snapshot received, the effect can run again (e.g. another invoice changed, or same doc updated).
  - The list still shows the invoice **without** `lateFeeEmailSentAt` → same invoice is processed again → **another email**. This can repeat many times (e.g. 566).

So: **Workflow stop was correct in theory, but the effect was re-running too often and sending many duplicate overdue/reminder emails.**

### Fix applied in code

- **Throttling / single run:** The automatic overdue workflow is now throttled (e.g. it can only run at most once every X minutes). So even if the effect runs on every snapshot, we don’t process the same overdue logic again and again.
- **Fully paid check:** We already skip any invoice that is fully paid (by status or by `amountPaid >= total`). So once the invoice is paid (or amount is fully recorded), no more overdue or reminder emails.

After the fix:

- Workflow **starts** when the invoice is sent and past due (unchanged).
- Workflow **stops** when the invoice is paid (by status or amount) (unchanged).
- Overdue emails are sent **at most once per invoice** for step 1 and **at most once** for step 2, and only if the workflow is allowed to run (throttled), so you should not see hundreds of emails from the same invoice again.

---

## Short summary for your client

- **When workflow starts:** Invoice is sent and due date has passed (overdue).
- **When workflow stops:** Invoice is marked **Paid** (or amount paid ≥ total).
- **Emails they get automatically:** At most 1 “Late Fee Added” and 1 “Final Reminder” per invoice; plus any manual “Invoice sent” or “Payment confirmation” or “Resend” you do.
- **Why they saw 566:** (1) Invoice may not have been marked paid when they paid outside the system, and (2) a bug caused the automatic logic to run over and over and send the same emails many times. We’ve added a throttle and strict “fully paid” check so this should not repeat.
