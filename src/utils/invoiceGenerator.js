import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
const logoUrl = '/logo.png';
import { getInvoiceById, getStoreSettings } from '../firebase/services';

const COMPANY_NAME = "SMKP TRADERS";
const COMPANY_TAGLINE = "Premium E-Commerce Store";
const COMPANY_ADDR = "Pommalappatti, Tamil Nadu, India";

// Gold brand color
const GOLD = [212, 175, 55];
const DARK = [15, 15, 15];
const SLATE = [30, 41, 59];

const loadImageAsBase64 = (url) => {
  return new Promise((resolve, reject) => {
    if (!url) { reject(new Error("No URL provided")); return; }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try { resolve(canvas.toDataURL('image/png')); }
      catch (err) { reject(err); }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
};

/**
 * Draws a gold fallback "SMKP" circle badge when logo cannot be loaded.
 * @param {jsPDF} doc
 * @param {number} cx  Centre X (mm)
 * @param {number} cy  Centre Y (mm)
 * @param {number} r   Radius (mm)
 */
const drawFallbackBadge = (doc, cx, cy, r) => {
  // Outer gold circle
  doc.setFillColor(...GOLD);
  doc.circle(cx, cy, r, 'F');
  // Inner dark circle
  doc.setFillColor(...DARK);
  doc.circle(cx, cy, r - 0.8, 'F');
  // Initials text
  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(r * 3.5);
  doc.text('SMKP', cx, cy + r * 1.1, { align: 'center' });
};

// ─────────────────────────────────────────────────────────────────────────────
//  RETAIL INVOICE PDF
// ─────────────────────────────────────────────────────────────────────────────
export const generateInvoice = async (order, options = { action: 'download', courierNotes: '' }) => {
  if (!order) { console.error("Order object is undefined"); return; }

  try {
    // 1. Fetch saved invoice data
    let invoiceData = null;
    try { invoiceData = await getInvoiceById(order.id); }
    catch (e) { console.warn("Could not retrieve stored invoice, generating dynamically", e); }

    // 2. Load store settings
    let companyName  = COMPANY_NAME;
    let companyOwner = "Kaviyarasan Murugan";
    let companyPhone = "9677417185";
    let companyEmail = "kaviyarasanmurugan78@gmail.com";
    let companyAddr  = COMPANY_ADDR;

    const savedBusiness = invoiceData?.businessDetails || order.businessDetails;
    if (savedBusiness) {
      companyName  = savedBusiness.name  || companyName;
      companyOwner = savedBusiness.ownerName || companyOwner;
      companyPhone = savedBusiness.phone || companyPhone;
      companyEmail = savedBusiness.email || companyEmail;
      companyAddr  = `${savedBusiness.address || ''}${savedBusiness.state ? ', ' + savedBusiness.state : ''}${savedBusiness.country ? ', ' + savedBusiness.country : ''}`;
    } else {
      try {
        const settings = await getStoreSettings();
        if (settings) {
          companyName  = settings.name  || companyName;
          companyOwner = settings.ownerName || companyOwner;
          companyPhone = settings.phone || companyPhone;
          companyEmail = settings.email || companyEmail;
          companyAddr  = `${settings.address || ''}${settings.state ? ', ' + settings.state : ''}${settings.country ? ', ' + settings.country : ''}`;
        }
      } catch (err) { console.warn("Could not retrieve store settings", err); }
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;

    // ── HEADER BACKGROUND (dark band) ──────────────────────────────────────
    const headerH = 38; // total header height in mm
    doc.setFillColor(...DARK);
    doc.rect(0, 0, pageWidth, headerH, 'F');

    // Gold accent stripe at bottom of header
    doc.setFillColor(...GOLD);
    doc.rect(0, headerH, pageWidth, 1.5, 'F');

    // ── LOGO (left side inside header) ─────────────────────────────────────
    const logoSize = 28; // mm — square box
    const logoX    = 12;
    const logoY    = (headerH - logoSize) / 2;  // vertically centred
    let   logoLoaded = false;

    try {
      const logoData = await loadImageAsBase64(logoUrl);
      doc.addImage(logoData, 'PNG', logoX, logoY, logoSize, logoSize);
      logoLoaded = true;
    } catch (e) {
      console.warn("Logo failed to load, using fallback badge:", e);
    }

    if (!logoLoaded) {
      // Draw gold circle fallback badge
      const badgeR  = logoSize / 2;
      const badgeCX = logoX + badgeR;
      const badgeCY = logoY + badgeR;
      drawFallbackBadge(doc, badgeCX, badgeCY, badgeR);
    }

    // ── COMPANY NAME + TAGLINE (right of logo) ─────────────────────────────
    const textX = logoX + logoSize + 6;
    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, textX, 15);
    // Tagline
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GOLD);
    doc.text(COMPANY_TAGLINE, textX, 20.5);
    // Contact line
    doc.setFontSize(7.5);
    doc.setTextColor(180, 180, 180);
    doc.text(`Ph: ${companyPhone}  |  ${companyEmail}`, textX, 26);
    // Address line
    doc.text(companyAddr, textX, 30.5);

    // ── RETAIL INVOICE badge (top-right inside header) ─────────────────────
    doc.setFontSize(13);
    doc.setTextColor(...GOLD);
    doc.setFont('helvetica', 'bold');
    doc.text('RETAIL INVOICE', pageWidth - 12, 16, { align: 'right' });

    // Gold right-side accent line
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 12, 18, pageWidth - 12, headerH - 2);

    // Separator below header accent
    const sepY = headerH + 1.5;

    // ── INVOICE SUMMARY BANNER ─────────────────────────────────────────────
    const invoiceNo = invoiceData?.invoiceNumber || `INV-${(order.id || 'N/A').slice(-8).toUpperCase()}`;
    let invDateStr  = new Date().toLocaleDateString('en-IN');
    if (invoiceData?.invoiceDate) {
      invDateStr = new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN');
    } else if (order.createdAt) {
      const d = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      invDateStr = d.toLocaleDateString('en-IN');
    }

    const paymentMethod = invoiceData?.paymentMethod || order.paymentMethod || 'COD';
    const paymentStatus = invoiceData?.paymentStatus || order.paymentStatus || 'Pending';

    const bannerY = sepY + 2;
    doc.setFillColor(248, 248, 248);
    doc.rect(15, bannerY, pageWidth - 30, 12, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.rect(15, bannerY, pageWidth - 30, 12, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    doc.text('INVOICE NO',    18, bannerY + 4);
    doc.text('ORDER ID',      62, bannerY + 4);
    doc.text('DATE',         102, bannerY + 4);
    doc.text('PAYMENT MODE', 141, bannerY + 4);
    doc.text('STATUS',       176, bannerY + 4);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(invoiceNo,                         18, bannerY + 9);
    doc.text(`#${(order.id || '').slice(-8).toUpperCase()}`, 62, bannerY + 9);
    doc.text(invDateStr,                        102, bannerY + 9);
    doc.text(paymentMethod.toUpperCase(),       141, bannerY + 9);

    doc.setTextColor(
      paymentStatus.toLowerCase() === 'paid' ? 22 : 194,
      paymentStatus.toLowerCase() === 'paid' ? 101 : 65,
      paymentStatus.toLowerCase() === 'paid' ? 52  : 12
    );
    doc.text(paymentStatus.toUpperCase(), 176, bannerY + 9);

    // ── ADDRESS BLOCKS (FROM / TO) ─────────────────────────────────────────
    const toName     = invoiceData?.customerName || order.customerName || order.name || 'Customer';
    const toPhone    = invoiceData?.phone  || order.phone  || '';
    const toEmail    = invoiceData?.email  || order.userEmail || '';
    const toAddress  = invoiceData?.address || order.address || '';
    const toCity     = invoiceData?.city   || order.city   || '';
    const toDistrict = invoiceData?.district || order.district || '';
    const toState    = invoiceData?.state  || order.state  || '';
    const toPincode  = invoiceData?.pincode || order.pincode || '';
    const toLandmark = invoiceData?.landmark || order.landmark || '';

    const fromLines = [
      companyName,
      `Phone: ${companyPhone}`,
      companyEmail ? `Email: ${companyEmail}` : null,
      companyAddr,
    ].filter(Boolean);

    const toLines = [
      toName,
      `Phone: ${toPhone}`,
      toEmail ? `Email: ${toEmail}` : null,
      toAddress,
      toLandmark ? `Landmark: ${toLandmark}` : null,
      `${toCity}${toDistrict ? ', ' + toDistrict : ''}`,
      `${toState} - ${toPincode}`
    ].filter(Boolean);

    const blockY = bannerY + 16;
    const blockW = 87;
    const blockH = 40;

    // FROM box (gold border)
    doc.setFillColor(253, 253, 253);
    doc.rect(15, blockY, blockW, blockH, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.35);
    doc.rect(15, blockY, blockW, blockH, 'S');

    // TO box (slate border)
    doc.setFillColor(253, 253, 253);
    doc.rect(108, blockY, blockW, blockH, 'F');
    doc.setDrawColor(...SLATE);
    doc.setLineWidth(0.35);
    doc.rect(108, blockY, blockW, blockH, 'S');

    // Box header tags
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(...GOLD);
    doc.rect(15, blockY, 26, 4.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('FROM (SENDER)', 17.5, blockY + 3.2);

    doc.setFillColor(...SLATE);
    doc.rect(108, blockY, 29, 4.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('SHIP TO (RECEIVER)', 110.5, blockY + 3.2);

    // FROM lines
    doc.setTextColor(...DARK);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(fromLines[0], 18, blockY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    let fY = blockY + 13.5;
    for (let i = 1; i < fromLines.length; i++) {
      doc.text(fromLines[i], 18, fY);
      fY += 4;
    }

    // TO lines
    doc.setTextColor(...DARK);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(toLines[0], 111, blockY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    let tY = blockY + 13.5;
    for (let i = 1; i < toLines.length; i++) {
      const line = toLines[i];
      if (line.startsWith('Phone:')) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
      }
      const split = doc.splitTextToSize(line, 80);
      doc.text(split, 111, tY);
      tY += split.length * 4;
    }

    // ── COURIER NOTES ──────────────────────────────────────────────────────
    const courierNotes = options.courierNotes || order.courierNotes || invoiceData?.courierNotes || '';
    let notesEndY = blockY + blockH;

    if (courierNotes.trim()) {
      doc.setFillColor(254, 243, 199);
      doc.rect(15, notesEndY + 3, pageWidth - 30, 9, 'F');
      doc.setDrawColor(251, 191, 36);
      doc.setLineWidth(0.2);
      doc.rect(15, notesEndY + 3, pageWidth - 30, 9, 'S');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(`COURIER / DELIVERY NOTES: ${courierNotes.trim()}`, 18, notesEndY + 9);
      notesEndY += 12;
    }

    const tableStartY = notesEndY + 5;

    // ── PRODUCTS TABLE ─────────────────────────────────────────────────────
    const items = invoiceData?.items || order.items || [];
    const subtotal       = items.reduce((acc, item) => acc + (Number(item.effectivePrice || item.price || 0) * Number(item.quantity || 1)), 0);
    const deliveryCharge = Number(order.deliveryCharge || 0);
    const couponDiscount = Number(order.couponDiscount || invoiceData?.pricing?.couponDiscount || 0);
    const grandTotal     = order.totalPrice !== undefined ? order.totalPrice : Math.max(0, subtotal + deliveryCharge - couponDiscount);

    // Pre-load item images
    const itemsWithBase64 = await Promise.all(items.map(async (item) => {
      let base64 = null;
      if (item.image) {
        try { base64 = await loadImageAsBase64(item.image); }
        catch (e) { console.warn("Item image load failed:", item.name, e); }
      }
      return { ...item, base64 };
    }));

    const tableData = items.map((item) => {
      const qty      = Number(item.quantity || 1);
      const effPrice = Number(item.effectivePrice || item.price || 0);
      const itemTotal = effPrice * qty;

      let displayName = item.name || 'Product Item';
      if (item.color || item.size) {
        const parts = [];
        if (item.color) parts.push(typeof item.color === 'object' ? item.color.name : item.color);
        if (item.size)  parts.push(item.size);
        displayName += ` (${parts.join(', ')})`;
      }

      return ['', displayName, qty, `INR ${effPrice.toFixed(2)}`, `INR ${itemTotal.toFixed(2)}`];
    });

    if (tableData.length === 0) tableData.push(['', 'No items found', '—', '—', '—']);

    autoTable(doc, {
      startY: tableStartY,
      head: [['Image', 'Product Name', 'Qty', 'Unit Price', 'Total Price']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: DARK,
        textColor: GOLD,
        fontStyle: 'bold',
        fontSize: 8,
        valign: 'middle'
      },
      styles: {
        fontSize: 7.5,
        valign: 'middle',
        cellPadding: 2.5,
        lineColor: GOLD,
        lineWidth: 0.15,
        minCellHeight: 11
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 95, halign: 'left' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 15, right: 15 },
      didDrawCell: (data) => {
        if (data.column.index === 0 && data.cell.section === 'body') {
          const item = itemsWithBase64[data.row.index];
          if (item?.base64) {
            const imgW = 9, imgH = 9;
            const x = data.cell.x + (data.cell.width  - imgW) / 2;
            const y = data.cell.y + (data.cell.height - imgH) / 2;
            doc.addImage(item.base64, 'PNG', x, y, imgW, imgH);
          }
        }
      }
    });

    // ── PRICING SUMMARY ────────────────────────────────────────────────────
    let finalY = doc.lastAutoTable.finalY + 8;
    if (finalY + 32 > 270) { doc.addPage(); finalY = 20; }

    const rightX  = 195;
    const labelX  = 135;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);

    doc.text('Subtotal:', labelX, finalY);
    doc.text(`INR ${subtotal.toFixed(2)}`, rightX, finalY, { align: 'right' });

    finalY += 5;
    doc.text('Shipping Charge:', labelX, finalY);
    doc.text(`INR ${Number(deliveryCharge).toFixed(2)}`, rightX, finalY, { align: 'right' });

    if (couponDiscount > 0) {
      finalY += 5;
      doc.text('Coupon Discount:', labelX, finalY);
      doc.text(`- INR ${couponDiscount.toFixed(2)}`, rightX, finalY, { align: 'right' });
    }

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(labelX - 10, finalY + 2.5, rightX, finalY + 2.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text('GRAND TOTAL:', labelX - 10, finalY + 8);
    doc.text(`INR ${Number(grandTotal).toFixed(2)}`, rightX, finalY + 8, { align: 'right' });

    // ── FOOTER ─────────────────────────────────────────────────────────────
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(15, 274, pageWidth - 15, 274);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('This is a computer-generated invoice. No signature required.', pageWidth / 2, 280, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text(`Thank you for shopping with ${companyName.toUpperCase()}!`, pageWidth / 2, 285, { align: 'center' });

    // ── OUTPUT ─────────────────────────────────────────────────────────────
    if (options.action === 'print') {
      doc.autoPrint();
      const hCode = doc.output('bloburl');
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = hCode;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(hCode); }, 1000);
      };
    } else {
      const safeId = order.id || 'unknown';
      const blob = doc.output('blob');
      const url  = URL.createObjectURL(blob);
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
    alert("Could not generate invoice.");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  SHIPPING LABEL PDF
// ─────────────────────────────────────────────────────────────────────────────
export const printLabel = async (order) => {
  if (!order) return;

  const safeId = order.id || 'UNKNOWN';

  try {
    let companyName  = COMPANY_NAME;
    let companyOwner = "Kaviyarasan Murugan";
    let companyPhone = "9677417185";
    let companyEmail = "kaviyarasanmurugan78@gmail.com";
    let companyAddr  = COMPANY_ADDR;

    try {
      const settings = await getStoreSettings();
      if (settings) {
        companyName  = settings.name  || companyName;
        companyOwner = settings.ownerName || companyOwner;
        companyPhone = settings.phone || companyPhone;
        companyEmail = settings.email || companyEmail;
        companyAddr  = `${settings.address || ''}, ${settings.state || ''}`;
      }
    } catch (e) { console.warn("Could not retrieve store settings for label:", e); }

    const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
    const width = 100;

    // ── BRANDED HEADER ─────────────────────────────────────────────────────
    // Dark header band — taller to fit logo + text
    const hdrH = 32;
    doc.setFillColor(...DARK);
    doc.rect(0, 0, width, hdrH, 'F');

    // Gold accent stripe under header
    doc.setFillColor(...GOLD);
    doc.rect(0, hdrH, width, 1, 'F');

    // Try to load logo
    let logoLoaded = false;
    const logoBoxSize = 22; // mm
    const logoX = 4;
    const logoY = (hdrH - logoBoxSize) / 2;

    try {
      const logoData = await loadImageAsBase64(logoUrl);
      doc.addImage(logoData, 'PNG', logoX, logoY, logoBoxSize, logoBoxSize);
      logoLoaded = true;
    } catch (e) {
      console.warn("Label logo failed to load, using fallback badge:", e);
    }

    if (!logoLoaded) {
      const r  = logoBoxSize / 2;
      drawFallbackBadge(doc, logoX + r, logoY + r, r);
    }

    // Company name + tagline to the right of logo
    const txtX = logoX + logoBoxSize + 4;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName.toUpperCase(), txtX, 11);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GOLD);
    doc.text(COMPANY_TAGLINE, txtX, 16.5);

    doc.setTextColor(160, 160, 160);
    doc.setFontSize(5.5);
    doc.text(`Sender: ${companyOwner}`, txtX, 21.5);
    doc.text(`Ph: ${companyPhone}`, txtX, 25.5);

    // ── BARCODE ────────────────────────────────────────────────────────────
    const barcodeCanvas = document.createElement('canvas');
    JsBarcode(barcodeCanvas, safeId.toUpperCase(), {
      format: "CODE128",
      width: 2.2,
      height: 38,
      displayValue: false
    });
    const barcodeImg = barcodeCanvas.toDataURL("image/png");
    doc.addImage(barcodeImg, 'PNG', 10, hdrH + 4, 80, 14);

    doc.setTextColor(0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`AWB / TRK: SMKP-${safeId.slice(-8).toUpperCase()}`, 50, hdrH + 22, { align: 'center' });

    // Separator
    doc.setLineWidth(0.3);
    doc.setDrawColor(200, 200, 200);
    doc.line(5, hdrH + 25, 95, hdrH + 25);

    // ── SHIP TO ────────────────────────────────────────────────────────────
    const shipY = hdrH + 30;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text('SHIP TO (RECEIVER DETAILS):', 8, shipY);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(order.customerName || order.name || 'Customer', 8, shipY + 8);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    const toPhone    = order.phone    || '';
    const toEmail    = order.userEmail || order.email || '';
    const toAddress  = order.address  || '';
    const toCity     = order.city     || '';
    const toDistrict = order.district || '';
    const toState    = order.state    || '';
    const toPincode  = order.pincode  || '';
    const toLandmark = order.landmark || '';

    const addressBlock = [
      toAddress,
      toLandmark ? `Landmark: ${toLandmark}` : null,
      `${toCity}${toDistrict ? ', ' + toDistrict : ''}`,
      `${toState} - ${toPincode}`,
      `Phone: ${toPhone}`,
      toEmail ? `Email: ${toEmail}` : null
    ].filter(Boolean);

    let curY = shipY + 14;
    for (const line of addressBlock) {
      if (line.startsWith('Phone:')) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.setFontSize(9);
      }
      const split = doc.splitTextToSize(line, 84);
      doc.text(split, 8, curY);
      curY += split.length * 4.5;
    }

    // ── COURIER NOTES ──────────────────────────────────────────────────────
    const labelNotes = order.courierNotes || '';
    if (labelNotes.trim()) {
      doc.setFillColor(254, 243, 199);
      doc.rect(5, 120, 90, 8, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(`NOTES: ${labelNotes.trim()}`, 8, 125);
    }

    // ── FOOTER PAYMENT BOX ─────────────────────────────────────────────────
    doc.setFillColor(245, 245, 245);
    doc.rect(5, 131, 90, 12, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.rect(5, 131, 90, 12, 'S');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const isOnline = (order.paymentMethod || '').toUpperCase().includes('ONLINE') || (order.paymentMethod || '').toUpperCase().includes('RAZORPAY');
    doc.text(isOnline ? 'PAID TOTAL:' : 'COD TOTAL:', 8, 139);
    doc.text(`INR ${(order.totalPrice || 0).toLocaleString()}`, 92, 139, { align: 'right' });

    // ── OUTPUT ─────────────────────────────────────────────────────────────
    doc.autoPrint();
    const hCode = doc.output('bloburl');
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = hCode;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(hCode); }, 1000);
    };

  } catch (error) {
    console.error("PRINT ERROR:", error);
    alert("Printing failed. Please check your printer connection.");
  }
};