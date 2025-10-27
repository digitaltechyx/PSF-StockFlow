import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('x-signature');
    
    // Verify webhook signature (optional but recommended for security)
    const webhookSecret = process.env.WISE_WEBHOOK_SECRET;
    
    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');
      
      if (signature !== `sha256=${expectedSignature}`) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }
    
    // Parse the webhook data
    const webhookData = JSON.parse(body);
    
    console.log('Wise webhook received:', {
      eventType: webhookData.event_type,
      data: webhookData
    });
    
    // Process different webhook events
    switch (webhookData.event_type) {
      case 'transfers#state-change':
        await handleTransferStateChange(webhookData);
        break;
      case 'transfers#funds-added':
        await handleFundsAdded(webhookData);
        break;
      case 'transfers#outgoing-payment-sent':
        await handlePaymentSent(webhookData);
        break;
      case 'transfers#outgoing-payment-delivered':
        await handlePaymentDelivered(webhookData);
        break;
      default:
        console.log('Unknown webhook event:', webhookData.event_type);
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Webhook received successfully' 
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handler for transfer state changes
async function handleTransferStateChange(data: any) {
  console.log('Transfer state changed:', data);
  
  // Example: Update invoice status in your database
  // You would update your Firestore to mark invoice status
  // based on the transfer state
  
  const transferId = data.resource?.id;
  const newState = data.resource?.status;
  
  console.log(`Transfer ${transferId} is now ${newState}`);
  
  // TODO: Update your database with the new transfer state
  // Example:
  // await updateInvoiceStatus(transferId, newState);
}

// Handler for funds added to transfer
async function handleFundsAdded(data: any) {
  console.log('Funds added to transfer:', data);
  
  // Example: Notify customer or admin that funds are being processed
  const transferId = data.resource?.id;
  
  console.log(`Funds added to transfer: ${transferId}`);
  
  // TODO: Update invoice status to "Processing"
  // Example:
  // await updateInvoiceStatus(transferId, 'processing');
}

// Handler for payment sent
async function handlePaymentSent(data: any) {
  console.log('Payment sent:', data);
  
  // Example: Update invoice status to "Sent"
  const transferId = data.resource?.id;
  
  console.log(`Payment sent for transfer: ${transferId}`);
  
  // TODO: Update invoice status to "Sent"
  // Example:
  // await updateInvoiceStatus(transferId, 'sent');
}

// Handler for payment delivered
async function handlePaymentDelivered(data: any) {
  console.log('Payment delivered:', data);
  
  // Example: Mark invoice as paid
  const transferId = data.resource?.id;
  
  console.log(`Payment delivered for transfer: ${transferId}`);
  
  // TODO: Update invoice status to "Paid"
  // Example:
  // await updateInvoiceStatus(transferId, 'paid');
  
  // You could also send a notification to the customer
  // await sendPaymentConfirmationEmail(transferId);
}

// Add a GET handler for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Wise Webhook Endpoint is active',
    url: 'https://ims.prepservicesfba.com/api/wise/webhook',
    timestamp: new Date().toISOString()
  });
}

