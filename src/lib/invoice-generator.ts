import jsPDF from 'jspdf';
import type { ShippedItem } from '@/types';

interface User {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  orderNumber: string;
  soldTo: User;
  shipTo: string;
  fbm: string;
  items: Array<{
    quantity: number;
    productName: string;
    packaging: string;
    unitPrice: number;
    amount: number;
  }>;
  userId?: string;
  status?: 'pending' | 'paid';
}

export async function generateInvoicePDF(data: InvoiceData): Promise<void> {
  // Create PDF with A4 size
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Set up page dimensions for A4
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;
  
  // Add watermark logo (centered, large, semi-transparent)
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '/Prep.png';
    
    await new Promise((resolve) => {
      logoImg.onload = () => {
        try {
          // Add watermark logo in the center of the page
          // Position: center of page, slightly transparent
          const watermarkWidth = 120;
          const watermarkHeight = 80;
          const xPos = (pageWidth - watermarkWidth) / 2;
          const yPosWatermark = (pageHeight - watermarkHeight) / 2;
          
          // Save the current graphics state
          doc.saveGraphicsState();
          
          // Set global alpha for transparency (watermark effect)
          doc.setGState(doc.GState({opacity: 0.08}));
          
          // Add the watermark logo
          doc.addImage(logoImg, 'PNG', xPos, yPosWatermark, watermarkWidth, watermarkHeight);
          
          // Restore graphics state
          doc.restoreGraphicsState();
          
          resolve(null);
        } catch (error) {
          console.error('Error adding watermark logo to PDF:', error);
          resolve(null);
        }
      };
      logoImg.onerror = () => {
        console.warn('Could not load logo for watermark');
        resolve(null);
      };
      // Set a timeout to prevent hanging
      setTimeout(() => resolve(null), 1000);
    });
  } catch (error) {
    console.error('Error loading watermark logo:', error);
  }
  
  // Company name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PREP SERVICES FBA', margin, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('ADDR 7000 Atrium Way B05', margin, yPos);
  
  yPos += 5;
  doc.text('Mount Laurel NJ, 08054', margin, yPos);
  
  yPos += 5;
  doc.text('TEL : (347-661-3010)', margin, yPos);
  
  yPos += 5;
  doc.text('EMAIL ID: INFO@PREPSERVICESFBA.COM', margin, yPos);
  
  // Invoice details (top right)
  const invoiceDetailsStart = 150;
  yPos = margin;
  
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE #:', invoiceDetailsStart, yPos);
  doc.text(data.invoiceNumber, invoiceDetailsStart + 30, yPos);
  
  yPos += 7;
  doc.text('DATE:', invoiceDetailsStart, yPos);
  doc.text(data.date, invoiceDetailsStart + 30, yPos);
  
  // Horizontal line
  yPos = 50;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  // Sold To section
  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SOLD TO:', margin, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const soldToLines = data.soldTo.name.split('\n');
  soldToLines.forEach((line, index) => {
    doc.text(line, margin, yPos + (index * 5));
  });
  
  if (data.soldTo.address) {
    yPos += soldToLines.length * 5 + 2;
    doc.text(data.soldTo.address, margin, yPos);
  }
  
  if (data.soldTo.phone) {
    yPos += 5;
    doc.text(`TEL: ${data.soldTo.phone}`, margin, yPos);
  }
  
  // Add email to Sold To section
  if (data.soldTo.email) {
    yPos += 5;
    doc.text(`EMAIL: ${data.soldTo.email}`, margin, yPos);
  }
  
  // Ship To section (to the right of Sold To)
  const shipToStartX = 105;
  let shipToYPos = 58;
  
  doc.setFont('helvetica', 'bold');
  doc.text('SHIP TO:', shipToStartX, shipToYPos);
  
  shipToYPos += 7;
  doc.setFont('helvetica', 'normal');
  const shipToLines = data.shipTo.split('\n');
  shipToLines.forEach((line, index) => {
    doc.text(line.substring(0, 30), shipToStartX, shipToYPos + (index * 5));
  });
  
  // FBM section
  shipToYPos += shipToLines.length * 5 + 5;
  doc.setFont('helvetica', 'bold');
  doc.text('FBM:', shipToStartX, shipToYPos);
  
  shipToYPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(data.fbm, shipToStartX, shipToYPos);
  
  // Notes section
  yPos = shipToYPos + 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('NOTE: PLEASE MAKE CHECK PAYABLE TO PREP SERVICES FBA LLC . ALL PRICES FOB', margin, yPos);
  
  yPos += 8;
  doc.setFontSize(8);
  
  // Create a small table for notes
  doc.text('FOB POINT:', margin, yPos);
  doc.text('NEW JERSEY', margin + 30, yPos);
  
  yPos += 5;
  doc.text('TERMS:', margin, yPos);
  doc.text('NET', margin + 30, yPos);
  
  yPos += 5;
  doc.text('SHIP DATE:', margin, yPos);
  doc.text(data.date, margin + 30, yPos);
  
  yPos += 5;
  doc.text('SHIPPED VIA:', margin, yPos);
  doc.text('Standard', margin + 30, yPos);
  
  // Itemized table
  yPos += 12;
  const tableStartY = yPos;
  
  // Table headers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('QUANTITY', margin, tableStartY);
  doc.text('PRODUCT DESCRIPTION', margin + 25, tableStartY);
  doc.text('PACKAGING', margin + 100, tableStartY);
  doc.text('UNIT PRICE $', margin + 130, tableStartY);
  doc.text('AMOUNT', margin + 160, tableStartY);
  
  // Horizontal line under headers
  doc.line(margin, tableStartY + 3, pageWidth - margin, tableStartY + 3);
  
  // Table rows
  let currentY = tableStartY + 10;
  data.items.forEach((item, index) => {
    if (currentY > 250) {
      // New page if needed
      doc.addPage();
      currentY = 20;
    }
    
    doc.setFont('helvetica', 'normal');
    doc.text(item.quantity.toString(), margin, currentY);
    doc.text(item.productName.substring(0, 30), margin + 25, currentY);
    doc.text(item.packaging, margin + 100, currentY);
    doc.text(`$${item.unitPrice.toFixed(2)}`, margin + 130, currentY);
    doc.text(`$${item.amount.toFixed(2)}`, margin + 160, currentY);
    
    currentY += 7;
  });
  
  // Calculate totals
  const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
  
  // Summary section
  const summaryStartY = currentY + 10;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('NJ Sales Tax 6.625% - Excluded', margin, summaryStartY);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('GRAND TOTAL', margin, summaryStartY + 12);
  doc.text(`TOTAL: $${subtotal.toFixed(2)}`, pageWidth - 50, summaryStartY + 12);
  
  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text('WE APPRECIATE YOUR BUSINESS', pageWidth / 2, 280, { align: 'center' });
  
  // Save the PDF
  doc.save(`Invoice-${data.invoiceNumber}.pdf`);
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `INV-${year}${month}${day}-${Date.now().toString().slice(-3)}`;
}

