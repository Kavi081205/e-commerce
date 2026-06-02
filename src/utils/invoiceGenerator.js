import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import logoUrl from '../assets/logo.png';
import { getInvoiceById } from '../firebase/services';

const COMPANY_NAME = "SMKP TRADERS";
const COMPANY_ADDR = "Chennai, Tamil Nadu, India";
const GSTIN = "33IMVPM1670M1Z9";

const loadImageAsBase64 = (url) => {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("No URL provided"));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
};

export const generateInvoice = async (order, options = { action: 'download' }) => {
  if (!order) {
    console.error("Order object is undefined");
    return;
  }

  try {
    // 1. Fetch saved invoice data from Firebase if available
    let invoiceData = null;
    try {
      invoiceData = await getInvoiceById(order.id);
    } catch (e) {
      console.warn("Could not retrieve stored invoice, generating dynamically", e);
    }

    // Set page format to standard A4 portrait layout: 210mm width x 297mm height
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;

    // --- 2. HEADER SECTION ---
    // Black Top Bar
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, pageWidth, 6, 'F');
    // Gold Accent Line
    doc.setFillColor(212, 175, 55);
    doc.rect(0, 6, pageWidth, 1.5, 'F');

    // Load SMKP Traders Logo
    try {
      const logoData = await loadImageAsBase64(logoUrl);
      doc.addImage(logoData, 'PNG', 15, 12, 14, 14);
    } catch (e) {
      console.warn("Logo failed to load:", e);
    }

    // Company Header Details (Left-aligned)
    doc.setFontSize(14);
    doc.setTextColor(15, 15, 15);
    doc.setFont('helvetica', 'bold');
    doc.text(COMPANY_NAME, 33, 17);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(COMPANY_ADDR, 33, 21.5);
    doc.text(`GSTIN: ${invoiceData?.businessDetails?.gstin || GSTIN}`, 33, 25.5);

    // Title: TAX INVOICE (Right-aligned)
    doc.setFontSize(16);
    doc.setTextColor(212, 175, 55); // Luxury gold branding
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageWidth - 15, 18, { align: 'right' });

    // Gold accent separator line
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.4);
    doc.line(15, 31, pageWidth - 15, 31);

    // --- 3. DYNAMIC ORDER & CUSTOMER INFORMATION ---
    const invoiceNo = invoiceData?.invoiceNumber || `INV-${(order.id || 'N/A').slice(-8).toUpperCase()}`;
    let invDateStr = new Date().toLocaleDateString('en-IN');
    if (invoiceData?.invoiceDate) {
      invDateStr = new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN');
    } else if (order.createdAt) {
      const d = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      invDateStr = d.toLocaleDateString('en-IN');
    }

    const paymentMethod = invoiceData?.paymentMethod || order.paymentMethod || 'COD';
    const customerName = invoiceData?.customerName || order.customerName || order.name || 'Customer';
    const phone = invoiceData?.phone || order.phone || '';
    const address = invoiceData?.address || order.address || '';
    const city = invoiceData?.city || order.city || '';
    const pincode = invoiceData?.pincode || order.pincode || '';
    const fullAddress = `${address}${city ? ', ' + city : ''}${pincode ? ' - ' + pincode : ''}`;

    // Two Columns for Billing and Invoice Details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(212, 175, 55); // Luxury Gold header titles
    doc.text('BILL TO', 15, 39);
    doc.text('INVOICE DETAILS', 120, 39);

    // Subtle grey dividers under column titles
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.line(15, 41, 100, 41);
    doc.line(120, 41, pageWidth - 15, 41);

    // Billing Details (Left Column)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 15, 15);
    doc.text(customerName, 15, 46);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Phone: ${phone}`, 15, 51);

    // Wrap address text properly to avoid overlapping and fit the column width of 85
    const splitAddr = doc.splitTextToSize(fullAddress, 85);
    doc.text(splitAddr, 15, 56);

    // Invoice Details (Right Column)
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Invoice No:', 120, 46);
    doc.text('Invoice Date:', 120, 51);
    doc.text('Payment Mode:', 120, 56);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 15, 15);
    doc.text(invoiceNo, 148, 46);
    doc.text(invDateStr, 148, 51);
    doc.text(paymentMethod.toUpperCase(), 148, 56);

    // Calculate dynamic Table start Y position to prevent overlap with multi-line addresses
    const addressHeight = splitAddr.length * 4.5;
    const billingBlockEnd = 56 + addressHeight;
    const tableStartY = Math.max(billingBlockEnd + 8, 72);

    // --- 4. ORDERED PRODUCTS TABLE ---
    const items = invoiceData?.items || order.items || [];
    
    // Pricing structure
    const subtotal = items.reduce((acc, item) => acc + (Number(item.effectivePrice || item.price || 0) * Number(item.quantity || 1)), 0);
    const deliveryCharge = order.deliveryCharge || 0;
    const grandTotal = order.totalPrice || (subtotal + deliveryCharge);

    // Load item images to Base64 in parallel
    const itemsWithBase64 = await Promise.all(items.map(async (item) => {
      let base64 = null;
      if (item.image) {
        try {
          base64 = await loadImageAsBase64(item.image);
        } catch (e) {
          console.warn("Failed to load image for item:", item.name, e);
        }
      }
      return { ...item, base64 };
    }));

    const tableData = items.map((item) => {
      const qty = Number(item.quantity || 1);
      const effPrice = Number(item.effectivePrice || item.price || 0);
      const itemTotal = effPrice * qty;

      let displayName = item.name || 'Product Item';
      if (item.color || item.size) {
        const parts = [];
        if (item.color) parts.push(typeof item.color === 'object' ? item.color.name : item.color);
        if (item.size) parts.push(item.size);
        displayName += ` (${parts.join(', ')})`;
      }

      return [
        "", // Column 0: Image (drawn via didDrawCell)
        displayName,
        qty,
        `INR ${effPrice.toFixed(2)}`,
        `INR ${itemTotal.toFixed(2)}`
      ];
    });

    if (tableData.length === 0) {
      tableData.push(["", "No items found", "—", "—", "—"]);
    }

    autoTable(doc, {
      startY: tableStartY,
      head: [['Image', 'Product Name', 'Quantity', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 15, 15], // Premium black header
        textColor: [212, 175, 55], // Gold header text
        fontStyle: 'bold',
        fontSize: 8.5,
        valign: 'middle'
      },
      styles: {
        fontSize: 8,
        valign: 'middle',
        cellPadding: 3,
        lineColor: [212, 175, 55], // Gold lines
        lineWidth: 0.15,
        minCellHeight: 12 // Assures 10mm image fits beautifully
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' }, // Image column
        1: { cellWidth: 92, halign: 'left' },   // Product Name
        2: { cellWidth: 20, halign: 'center' }, // Quantity
        3: { cellWidth: 25, halign: 'right' },  // Unit Price
        4: { cellWidth: 25, halign: 'right' }   // Total
      },
      margin: { left: 15, right: 15 },
      didDrawCell: (data) => {
        if (data.column.index === 0 && data.cell.section === 'body') {
          const item = itemsWithBase64[data.row.index];
          if (item && item.base64) {
            const imgWidth = 10;
            const imgHeight = 10;
            const x = data.cell.x + (data.cell.width - imgWidth) / 2;
            const y = data.cell.y + (data.cell.height - imgHeight) / 2;
            doc.addImage(item.base64, 'PNG', x, y, imgWidth, imgHeight);
          }
        }
      }
    });

    // --- 5. PRICING SUMMARY ---
    let finalY = doc.lastAutoTable.finalY + 10;
    // Add page if content exceeds height limits
    if (finalY + 30 > 270) {
      doc.addPage();
      finalY = 25;
    }

    const rightAlignX = 195;
    const labelX = 140;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);

    // Subtotal
    doc.text('Subtotal:', labelX, finalY);
    doc.text(`INR ${subtotal.toFixed(2)}`, rightAlignX, finalY, { align: 'right' });

    let currentY = finalY;

    // Shipping Charge
    currentY += 6;
    doc.text('Shipping Charge:', labelX, currentY);
    doc.text(`INR ${deliveryCharge.toFixed(2)}`, rightAlignX, currentY, { align: 'right' });

    // Gold line separator
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.line(labelX - 10, currentY + 3, rightAlignX, currentY + 3);

    // Grand Total (Highlighted with larger font)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 15, 15);
    doc.text('GRAND TOTAL:', labelX - 10, currentY + 9);
    doc.text(`INR ${grandTotal.toFixed(2)}`, rightAlignX, currentY + 9, { align: 'right' });

    // --- 6. FOOTER SECTION ---
    // Add decorative divider line above footer
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(15, 274, pageWidth - 15, 274);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('This is a computer generated invoice and does not require a signature.', pageWidth / 2, 280, { align: 'center' });
    doc.text('Thank you for shopping with SMKP TRADERS!', pageWidth / 2, 285, { align: 'center' });

    // --- 7. ACTION EXECUTION ---
    if (options.action === 'print') {
      doc.autoPrint();
      const hCode = doc.output('bloburl');
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = hCode;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(hCode);
        }, 1000);
      };
    } else {
      const safeId = order.id || 'unknown';
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${safeId.slice(-8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

  } catch (error) {
    console.error("PDF ERROR:", error);
    alert("Could not generate tax invoice.");
  }
}

export const printLabel = async (order) => {
  if (!order) return;

  const safeId = order.id || 'UNKNOWN';

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [100, 150]
    });

    const width = 100;

    doc.setFillColor(0);
    doc.rect(0, 0, width, 45, 'F');

    try {
      const logoData = await loadImageAsBase64(logoUrl);
      doc.addImage(logoData, 'PNG', 35, 3, 30, 30);
    } catch (e) {
      console.warn("Logo failed to load:", e);
    }

    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(COMPANY_NAME, 50, 36, { align: 'center' });
    doc.setFontSize(8);
    doc.text(COMPANY_ADDR, 50, 40, { align: 'center' });

    // Barcode
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, safeId.toUpperCase(), {
      format: "CODE128",
      width: 2,
      height: 40,
      displayValue: false
    });
    const barcodeImg = canvas.toDataURL("image/png");
    doc.addImage(barcodeImg, 'PNG', 10, 52, 80, 20);

    doc.setTextColor(0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`TRK: SMKP-${safeId.slice(-8).toUpperCase()}`, 50, 75, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(5, 78, 95, 78);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SHIP TO:', 10, 85);
    doc.setFontSize(16);
    doc.text(order.customerName || order.name || 'Customer', 10, 95);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(order.address || 'N/A', 10, 105, { maxWidth: 80 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${order.city || ''} - ${order.pincode || ''}`, 10, 125);
    doc.text(`PHONE: ${order.phone || 'N/A'}`, 10, 132);

    doc.setFillColor(240, 240, 240);
    doc.rect(5, 138, 90, 10, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const isOnline = (order.paymentMethod || '').toUpperCase() === 'ONLINE';
    doc.text(isOnline ? 'PAID TOTAL:' : 'COD TOTAL:', 10, 145);
    doc.text(`INR ${(order.totalPrice || 0).toLocaleString()}`, 90, 145, { align: 'right' });

    doc.autoPrint();
    const hCode = doc.output('bloburl');

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = hCode;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(hCode);
      }, 1000);
    };

  } catch (error) {
    console.error("PRINT ERROR:", error);
    alert("Printing failed. Please check your printer connection.");
  }
};