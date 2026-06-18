import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
const logoUrl = '/logo.png';
import { getInvoiceById, getStoreSettings } from '../firebase/services';

const COMPANY_NAME = "SMKP TRADERS";
const COMPANY_ADDR = "Pommalappatti, Tamil Nadu, India";
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

export const generateInvoice = async (order, options = { action: 'download', courierNotes: '' }) => {
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

    // Load store settings
    let companyName = COMPANY_NAME;
    let companyOwner = "Kaviyarasan Murugan";
    let companyPhone = "9677417185";
    let companyEmail = "kaviyarasanmurugan78@gmail.com";
    let companyAddr = COMPANY_ADDR;
    let companyGST = GSTIN;

    const savedBusiness = invoiceData?.businessDetails || order.businessDetails;
    if (savedBusiness) {
      companyName = savedBusiness.name || companyName;
      companyOwner = savedBusiness.ownerName || companyOwner;
      companyPhone = savedBusiness.phone || companyPhone;
      companyEmail = savedBusiness.email || companyEmail;
      companyAddr = `${savedBusiness.address || ''}${savedBusiness.state ? ', ' + savedBusiness.state : ''}${savedBusiness.country ? ', ' + savedBusiness.country : ''}`;
      companyGST = savedBusiness.gstin || companyGST;
    } else {
      try {
        const settings = await getStoreSettings();
        if (settings) {
          companyName = settings.name || companyName;
          companyOwner = settings.ownerName || companyOwner;
          companyPhone = settings.phone || companyPhone;
          companyEmail = settings.email || companyEmail;
          companyAddr = `${settings.address || ''}${settings.state ? ', ' + settings.state : ''}${settings.country ? ', ' + settings.country : ''}`;
          companyGST = settings.gstin || companyGST;
        }
      } catch (err) {
        console.warn("Could not retrieve current store settings, using default info", err);
      }
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

    // Load Logo
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
    doc.text(companyName, 33, 17);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Owner: ${companyOwner} | Phone: ${companyPhone}`, 33, 21.5);
    doc.text(`GSTIN: ${companyGST} | Email: ${companyEmail}`, 33, 25.5);

    // Title: TAX INVOICE (Right-aligned)
    doc.setFontSize(16);
    doc.setTextColor(212, 175, 55); // Luxury gold branding
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageWidth - 15, 18, { align: 'right' });

    // Gold accent separator line
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.4);
    doc.line(15, 31, pageWidth - 15, 31);

    // --- 3. INVOICE / ORDER SUMMARY BANNER ---
    const invoiceNo = invoiceData?.invoiceNumber || `INV-${(order.id || 'N/A').slice(-8).toUpperCase()}`;
    let invDateStr = new Date().toLocaleDateString('en-IN');
    if (invoiceData?.invoiceDate) {
      invDateStr = new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN');
    } else if (order.createdAt) {
      const d = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      invDateStr = d.toLocaleDateString('en-IN');
    }

    const paymentMethod = invoiceData?.paymentMethod || order.paymentMethod || 'COD';
    const paymentStatus = invoiceData?.paymentStatus || order.paymentStatus || 'Pending';

    // Summary block background
    doc.setFillColor(248, 248, 248);
    doc.rect(15, 34, pageWidth - 30, 12, 'F');
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.rect(15, 34, pageWidth - 30, 12, 'S');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('INVOICE ID', 18, 38.5);
    doc.text('ORDER ID', 55, 38.5);
    doc.text('DATE & TIME', 95, 38.5);
    doc.text('PAYMENT MODE', 135, 38.5);
    doc.text('PAYMENT STATUS', 170, 38.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 15, 15);
    doc.text(invoiceNo, 18, 42.5);
    doc.text(`#${(order.id || 'N/A').toUpperCase()}`, 55, 42.5);
    doc.text(invDateStr, 95, 42.5);
    doc.text(paymentMethod.toUpperCase(), 135, 42.5);
    
    // Color status green if Paid, red/orange otherwise
    if (paymentStatus.toLowerCase() === 'paid') {
      doc.setTextColor(22, 101, 52); // green-800
    } else {
      doc.setTextColor(194, 65, 12); // orange-700
    }
    doc.text(paymentStatus.toUpperCase(), 170, 42.5);

    // --- 4. SHIPPING DUAL ADDRESS CONTAINERS (FROM / TO) ---
    // Prepare Customer Details
    const toName = invoiceData?.customerName || order.customerName || order.name || 'Customer';
    const toPhone = invoiceData?.phone || order.phone || '';
    const toEmail = invoiceData?.email || order.userEmail || '';
    const toAddress = invoiceData?.address || order.address || '';
    const toCity = invoiceData?.city || order.city || '';
    const toDistrict = invoiceData?.district || order.district || '';
    const toState = invoiceData?.state || order.state || '';
    const toPincode = invoiceData?.pincode || order.pincode || '';
    const toLandmark = invoiceData?.landmark || order.landmark || '';

    // Format address blocks
    const fromLines = [
      companyName,
      `Owner: ${companyOwner}`,
      `Phone: ${companyPhone}`,
      `Email: ${companyEmail}`,
      companyAddr,
      `GSTIN: ${companyGST}`
    ];

    const toLines = [
      toName,
      `Phone: ${toPhone}`,
      toEmail ? `Email: ${toEmail}` : null,
      toAddress,
      toLandmark ? `Landmark: ${toLandmark}` : null,
      `${toCity}${toDistrict ? ', ' + toDistrict : ''}`,
      `${toState} - ${toPincode}`
    ].filter(Boolean);

    const blockY = 50;
    const blockWidth = 87;
    const blockHeight = 44;

    // LEFT Box: FROM (Sender)
    doc.setFillColor(253, 253, 253);
    doc.rect(15, blockY, blockWidth, blockHeight, 'F');
    doc.setDrawColor(212, 175, 55); // Gold border for professional brand feel
    doc.setLineWidth(0.35);
    doc.rect(15, blockY, blockWidth, blockHeight, 'S');

    // RIGHT Box: TO (Receiver)
    doc.setFillColor(253, 253, 253);
    doc.rect(108, blockY, blockWidth, blockHeight, 'F');
    doc.setDrawColor(30, 41, 59); // Slate-800 border
    doc.setLineWidth(0.35);
    doc.rect(108, blockY, blockWidth, blockHeight, 'S');

    // Box Header Labels
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(212, 175, 55); // Gold Header Tag for FROM
    doc.rect(15, blockY, 25, 4.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('FROM (SENDER)', 17.5, blockY + 3.2);

    doc.setFillColor(30, 41, 59); // Dark Header Tag for TO
    doc.rect(108, blockY, 28, 4.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('SHIP TO (RECEIVER)', 110.5, blockY + 3.2);

    // Render FROM Address Details
    doc.setTextColor(15, 15, 15);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(fromLines[0], 18, blockY + 9); // Company Name in Bold

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    let currentFromY = blockY + 13.5;
    for (let i = 1; i < fromLines.length; i++) {
      const line = fromLines[i];
      if (line.startsWith('GSTIN')) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 15, 15);
      }
      doc.text(line, 18, currentFromY);
      currentFromY += 4;
    }

    // Render TO Address Details
    doc.setTextColor(15, 15, 15);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(toLines[0], 111, blockY + 9); // Customer Name in Bold & larger font

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    let currentToY = blockY + 13.5;
    for (let i = 1; i < toLines.length; i++) {
      const line = toLines[i];
      if (line.startsWith('Phone:')) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 15, 15);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
      }
      // Auto wrap long shipping addresses to fit inside the 80mm column width
      const splitLine = doc.splitTextToSize(line, 80);
      doc.text(splitLine, 111, currentToY);
      currentToY += (splitLine.length * 4);
    }

    // --- 5. OPTIONAL COURIER NOTES SECTION ---
    const courierNotes = options.courierNotes || order.courierNotes || invoiceData?.courierNotes || '';
    let courierBlockEndY = blockY + blockHeight;

    if (courierNotes.trim()) {
      doc.setFillColor(254, 243, 199); // Light amber bg
      doc.rect(15, courierBlockEndY + 3, pageWidth - 30, 9, 'F');
      doc.setDrawColor(251, 191, 36); // Amber border
      doc.setLineWidth(0.2);
      doc.rect(15, courierBlockEndY + 3, pageWidth - 30, 9, 'S');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9); // Amber-800 text
      doc.text(`COURIER / DELIVERY NOTES: ${courierNotes.trim()}`, 18, courierBlockEndY + 9);
      courierBlockEndY += 12;
    }

    const tableStartY = courierBlockEndY + 5;

    // --- 6. ORDERED PRODUCTS TABLE ---
    const items = invoiceData?.items || order.items || [];
    
    // Pricing structure
    const subtotal = items.reduce((acc, item) => acc + (Number(item.effectivePrice || item.price || 0) * Number(item.quantity || 1)), 0);
    const deliveryCharge = order.deliveryCharge || 0;
    const couponDiscount = Number(order.couponDiscount || invoiceData?.pricing?.couponDiscount || 0);
    const grandTotal = order.totalPrice !== undefined ? order.totalPrice : Math.max(0, subtotal + deliveryCharge - couponDiscount);

    // Calculate GST component (18% inclusive GST placeholder split 50/50 into CGST 9% and SGST 9%)
    const gstTotal = invoiceData?.pricing?.gst || (subtotal - (subtotal / 1.18));
    const cgstAmount = gstTotal / 2;
    const sgstAmount = gstTotal / 2;

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
        "", // Image column
        displayName,
        qty,
        `INR ${(effPrice / 1.18).toFixed(2)}`, // Taxable value (excl. GST)
        `INR ${(effPrice - (effPrice / 1.18)).toFixed(2)}`, // GST Component
        `INR ${itemTotal.toFixed(2)}`
      ];
    });

    if (tableData.length === 0) {
      tableData.push(["", "No items found", "—", "—", "—", "—"]);
    }

    autoTable(doc, {
      startY: tableStartY,
      head: [['Image', 'Product Name', 'Qty', 'Taxable Val', 'GST (18%)', 'Total Price']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 15, 15], // Premium black header
        textColor: [212, 175, 55], // Gold header text
        fontStyle: 'bold',
        fontSize: 8,
        valign: 'middle'
      },
      styles: {
        fontSize: 7.5,
        valign: 'middle',
        cellPadding: 2.5,
        lineColor: [212, 175, 55], // Gold lines
        lineWidth: 0.15,
        minCellHeight: 11
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' }, // Image
        1: { cellWidth: 80, halign: 'left' },   // Product Name
        2: { cellWidth: 12, halign: 'center' }, // Qty
        3: { cellWidth: 23, halign: 'right' },  // Taxable Price
        4: { cellWidth: 25, halign: 'right' },  // GST amount
        5: { cellWidth: 25, halign: 'right' }   // Total Price
      },
      margin: { left: 15, right: 15 },
      didDrawCell: (data) => {
        if (data.column.index === 0 && data.cell.section === 'body') {
          const item = itemsWithBase64[data.row.index];
          if (item && item.base64) {
            const imgWidth = 9;
            const imgHeight = 9;
            const x = data.cell.x + (data.cell.width - imgWidth) / 2;
            const y = data.cell.y + (data.cell.height - imgHeight) / 2;
            doc.addImage(item.base64, 'PNG', x, y, imgWidth, imgHeight);
          }
        }
      }
    });

    // --- 7. PRICING SUMMARY ---
    let finalY = doc.lastAutoTable.finalY + 8;
    if (finalY + 38 > 270) {
      doc.addPage();
      finalY = 20;
    }

    const rightAlignX = 195;
    const labelX = 135;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);

    // Subtotal (excl. GST)
    doc.text('Taxable Subtotal:', labelX, finalY);
    doc.text(`INR ${(subtotal / 1.18).toFixed(2)}`, rightAlignX, finalY, { align: 'right' });

    // CGST
    finalY += 5;
    doc.text('CGST (9%):', labelX, finalY);
    doc.text(`INR ${cgstAmount.toFixed(2)}`, rightAlignX, finalY, { align: 'right' });

    // SGST
    finalY += 5;
    doc.text('SGST (9%):', labelX, finalY);
    doc.text(`INR ${sgstAmount.toFixed(2)}`, rightAlignX, finalY, { align: 'right' });

    // Shipping Charge
    finalY += 5;
    doc.text('Shipping Charge:', labelX, finalY);
    doc.text(`INR ${deliveryCharge.toFixed(2)}`, rightAlignX, finalY, { align: 'right' });

    // Coupon Discount
    if (couponDiscount > 0) {
      finalY += 5;
      doc.text('Coupon Discount:', labelX, finalY);
      doc.text(`- INR ${couponDiscount.toFixed(2)}`, rightAlignX, finalY, { align: 'right' });
    }

    // Gold divider
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.4);
    doc.line(labelX - 10, finalY + 2.5, rightAlignX, finalY + 2.5);

    // Grand Total (Highlighted with larger font)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 15, 15);
    doc.text('GRAND TOTAL (INCL. GST):', labelX - 10, finalY + 8);
    doc.text(`INR ${grandTotal.toFixed(2)}`, rightAlignX, finalY + 8, { align: 'right' });

    // --- 8. FOOTER SECTION ---
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(15, 274, pageWidth - 15, 274);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('This is a computer generated invoice and does not require a signature.', pageWidth / 2, 280, { align: 'center' });
    doc.text(`Thank you for shopping with ${companyName.toUpperCase()}!`, pageWidth / 2, 285, { align: 'center' });

    // --- 9. ACTION EXECUTION ---
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
};

export const printLabel = async (order) => {
  if (!order) return;

  const safeId = order.id || 'UNKNOWN';

  try {
    // Fetch current store details for shipping label FROM block
    let companyName = COMPANY_NAME;
    let companyOwner = "Kaviyarasan Murugan";
    let companyPhone = "9677417185";
    let companyEmail = "kaviyarasanmurugan78@gmail.com";
    let companyAddr = COMPANY_ADDR;

    try {
      const settings = await getStoreSettings();
      if (settings) {
        companyName = settings.name || companyName;
        companyOwner = settings.ownerName || companyOwner;
        companyPhone = settings.phone || companyPhone;
        companyEmail = settings.email || companyEmail;
        companyAddr = `${settings.address || ''}, ${settings.state || ''}`;
      }
    } catch (e) {
      console.warn("Could not retrieve current store settings for label print, using default:", e);
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [100, 150] // Standard shipping label format
    });

    const width = 100;

    // Header header box
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(0, 0, width, 24, 'F');

    doc.setTextColor(255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName.toUpperCase(), 50, 8, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sender: ${companyOwner} | Phone: ${companyPhone}`, 50, 13, { align: 'center' });
    doc.text(companyAddr, 50, 17, { align: 'center' });

    // Barcode
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, safeId.toUpperCase(), {
      format: "CODE128",
      width: 2.2,
      height: 38,
      displayValue: false
    });
    const barcodeImg = canvas.toDataURL("image/png");
    doc.addImage(barcodeImg, 'PNG', 10, 28, 80, 16);

    doc.setTextColor(0);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`AWB / TRK: SMKP-${safeId.slice(-8).toUpperCase()}`, 50, 49, { align: 'center' });

    // Separator line
    doc.setLineWidth(0.35);
    doc.setDrawColor(200, 200, 200);
    doc.line(5, 52, 95, 52);

    // SHIPPING TO CONTAINER
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('SHIP TO (RECEIVER DETAILS):', 8, 58);
    
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(order.customerName || order.name || 'Customer', 8, 66);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    const toPhone = order.phone || '';
    const toEmail = order.userEmail || order.email || '';
    const toAddress = order.address || '';
    const toCity = order.city || '';
    const toDistrict = order.district || '';
    const toState = order.state || '';
    const toPincode = order.pincode || '';
    const toLandmark = order.landmark || '';

    const addressBlock = [
      toAddress,
      toLandmark ? `Landmark: ${toLandmark}` : null,
      `${toCity}${toDistrict ? ', ' + toDistrict : ''}`,
      `${toState} - ${toPincode}`,
      `Phone: ${toPhone}`,
      toEmail ? `Email: ${toEmail}` : null
    ].filter(Boolean);

    let currentY = 73;
    for (const line of addressBlock) {
      if (line.startsWith('Phone:')) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9.5);
      }
      const splitLines = doc.splitTextToSize(line, 84);
      doc.text(splitLines, 8, currentY);
      currentY += (splitLines.length * 4.5);
    }

    // Courier Notes in label
    const labelNotes = order.courierNotes || '';
    if (labelNotes.trim()) {
      doc.setFillColor(254, 243, 199);
      doc.rect(5, 120, 90, 8, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(`NOTES: ${labelNotes.trim()}`, 8, 125);
    }

    // Footer summary box
    doc.setFillColor(245, 245, 245);
    doc.rect(5, 131, 90, 12, 'F');
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.4);
    doc.rect(5, 131, 90, 12, 'S');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const isOnline = (order.paymentMethod || '').toUpperCase() === 'ONLINE' || (order.paymentMethod || '').toUpperCase() === 'RAZORPAY';
    doc.text(isOnline ? 'PAID TOTAL:' : 'COD TOTAL:', 8, 139);
    doc.text(`INR ${(order.totalPrice || 0).toLocaleString()}`, 92, 139, { align: 'right' });

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