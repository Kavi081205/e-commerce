import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { getInvoiceById, getStoreSettings } from '../firebase/services';

const logoUrl = '/logo.png';

const COMPANY_NAME = "SMKP TRADERS";
const COMPANY_TAGLINE = "Premium E-Commerce & Retail";
const COMPANY_WEBSITE = "smkptraders.in";
const COMPANY_EMAIL = "kaviyarasanmurugan78@gmail.com";
const COMPANY_PHONE = "9677417185";
const COMPANY_ADDR = "Pommalappatti, Tamil Nadu, India - 625523";
const DEFAULT_GSTIN = "33IMVPM1670M1Z9";
const SELLER_STATE = "Tamil Nadu";
const SELLER_STATE_CODE = "33";

// Premium Black & Gold Palette
const GOLD = [212, 175, 55];       // #D4AF37
const DARK_GOLD = [184, 134, 11];  // #B8860B
const DARK = [15, 15, 15];         // #0F0F0F
const SLATE = [30, 41, 59];        // #1E293B
const LIGHT_BG = [250, 250, 250];

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
 * Draws a subtle semi-transparent SMKP TRADERS background watermark on every page
 */
const drawWatermark = (doc, pageWidth, pageHeight) => {
  doc.saveGraphicsState();
  if (doc.GState) {
    doc.setGState(new doc.GState({ opacity: 0.04 }));
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(46);
  doc.setTextColor(...DARK);
  doc.text('SMKP TRADERS', pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 35
  });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2.5);
  doc.circle(pageWidth / 2, pageHeight / 2, 60, 'S');

  doc.restoreGraphicsState();
};

/**
 * Draws fallback gold circle badge when logo image cannot be loaded.
 */
const drawFallbackBadge = (doc, cx, cy, r) => {
  doc.setFillColor(...GOLD);
  doc.circle(cx, cy, r, 'F');
  doc.setFillColor(...DARK);
  doc.circle(cx, cy, r - 0.8, 'F');
  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(r * 3.5);
  doc.text('SMKP', cx, cy + r * 1.1, { align: 'center' });
};

/**
 * Helper to convert numbers to Indian Currency Words
 */
const numberToWords = (num) => {
  if (!num || isNaN(num) || num === 0) return 'Rupees Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
             'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const formatChunk = (n) => {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    } else if (n > 0) {
      str += a[n];
    }
    return str.trim();
  };

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  let result = '';
  let n = integerPart;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore > 0) result += formatChunk(crore) + ' Crore ';
  if (lakh > 0) result += formatChunk(lakh) + ' Lakh ';
  if (thousand > 0) result += formatChunk(thousand) + ' Thousand ';
  if (n > 0) result += formatChunk(n);

  result = result.trim() ? `Rupees ${result.trim()}` : 'Rupees Zero';

  if (decimalPart > 0) {
    result += ` and ${formatChunk(decimalPart)} Paise`;
  }
  return result + ' Only';
};

/**
 * Returns color badge parameters based on payment status & mode
 */
const getPaymentStatusBadge = (status, method) => {
  const s = (status || '').toUpperCase();
  const m = (method || '').toUpperCase();

  if (s === 'PAID' || s === 'SUCCESS' || s === 'COMPLETED') {
    return { bg: [34, 197, 94], text: [255, 255, 255], label: 'PAID' };
  }
  if (s === 'FAILED' || s === 'CANCELLED' || s === 'DECLINED') {
    return { bg: [239, 68, 68], text: [255, 255, 255], label: s || 'FAILED' };
  }
  if (s === 'REFUNDED' || s === 'RETURNED') {
    return { bg: [147, 51, 234], text: [255, 255, 255], label: 'REFUNDED' };
  }
  if (m.includes('COD') || s === 'COD' || s === 'PENDING') {
    return { bg: [30, 41, 59], text: [212, 175, 55], label: m.includes('COD') ? 'COD (PENDING)' : 'PENDING' };
  }
  return { bg: [100, 116, 139], text: [255, 255, 255], label: s || 'PENDING' };
};

/**
 * Draws digital signature block for SMKP TRADERS
 */
const drawDigitalSignature = (doc, x, y, width, height) => {
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height, 'S');

  doc.setFillColor(...DARK);
  doc.rect(x, y, width, 5, 'F');
  doc.setTextColor(...GOLD);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('FOR SMKP TRADERS', x + width / 2, y + 3.6, { align: 'center' });

  // Signature script representation
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Kaviyarasan M.', x + 8, y + 14);

  // Verification stamp badge
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.circle(x + width - 10, y + 13, 5.5, 'S');
  doc.setFontSize(4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_GOLD);
  doc.text('DIGITALLY', x + width - 10, y + 12, { align: 'center' });
  doc.text('SIGNED', x + width - 10, y + 14.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...DARK);
  doc.text('Authorized Signatory', x + width / 2, y + height - 2.5, { align: 'center' });
};

// ─────────────────────────────────────────────────────────────────────────────
//  GST TAX INVOICE PDF GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
export const generateInvoice = async (order, options = { action: 'download', courierNotes: '' }) => {
  if (!order) { console.error("Order object is undefined"); return; }

  try {
    // 1. Fetch saved invoice data if available
    let invoiceData = null;
    try { invoiceData = await getInvoiceById(order.id); }
    catch (e) { console.warn("Could not retrieve stored invoice, generating dynamically", e); }

    // 2. Fetch company/store details
    let companyName    = COMPANY_NAME;
    let companyPhone   = COMPANY_PHONE;
    let companyEmail   = COMPANY_EMAIL;
    let companyWebsite = COMPANY_WEBSITE;
    let companyAddr    = COMPANY_ADDR;
    let sellerGstin    = DEFAULT_GSTIN;
    let sellerState    = SELLER_STATE;
    let sellerStateCode = SELLER_STATE_CODE;

    const savedBusiness = invoiceData?.businessDetails || order.businessDetails;
    if (savedBusiness) {
      companyName    = savedBusiness.name    || companyName;
      companyPhone   = savedBusiness.phone   || companyPhone;
      companyEmail   = savedBusiness.email   || companyEmail;
      companyWebsite = savedBusiness.website || companyWebsite;
      sellerGstin    = savedBusiness.gstin   || sellerGstin;
      companyAddr    = `${savedBusiness.address || ''}${savedBusiness.state ? ', ' + savedBusiness.state : ''}${savedBusiness.country ? ', ' + savedBusiness.country : ''}`;
    } else {
      try {
        const settings = await getStoreSettings();
        if (settings) {
          companyName    = settings.name    || companyName;
          companyPhone   = settings.phone   || companyPhone;
          companyEmail   = settings.email   || companyEmail;
          companyWebsite = settings.website || companyWebsite;
          sellerGstin    = settings.gstin   || sellerGstin;
          companyAddr    = `${settings.address || ''}${settings.state ? ', ' + settings.state : ''}${settings.country ? ', ' + settings.country : ''}`;
        }
      } catch (err) { console.warn("Could not retrieve store settings", err); }
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth  = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - (margin * 2);

    // ── HEADER (Obsidian Dark Band + Gold Accent) ──────────────────────────
    const headerH = 38;
    doc.setFillColor(...DARK);
    doc.rect(0, 0, pageWidth, headerH, 'F');

    // Gold accent stripe
    doc.setFillColor(...GOLD);
    doc.rect(0, headerH, pageWidth, 1.8, 'F');

    // ── BRAND LOGO ────────────────────────────────────────────────────────
    const logoSize = 25;
    const logoX    = margin;
    const logoY    = (headerH - logoSize) / 2;
    let logoLoaded = false;

    try {
      const logoData = await loadImageAsBase64(logoUrl);
      doc.addImage(logoData, 'PNG', logoX, logoY, logoSize, logoSize);
      logoLoaded = true;
    } catch (e) {
      console.warn("Logo load failed, rendering fallback badge:", e);
    }

    if (!logoLoaded) {
      const r = logoSize / 2;
      drawFallbackBadge(doc, logoX + r, logoY + r, r);
    }

    // ── BRAND TITLE & CONTACT DETAILS ──────────────────────────────────────
    const textX = logoX + logoSize + 5;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, textX, 12.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text(COMPANY_TAGLINE.toUpperCase(), textX, 17);

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(190, 190, 190);
    doc.text(`GSTIN: ${sellerGstin}  |  State Code: ${sellerStateCode} (${sellerState})`, textX, 21.5);
    doc.text(`Ph: +91 ${companyPhone}  |  Email: ${companyEmail}`, textX, 25.5);
    doc.text(`Web: ${companyWebsite}  |  ${companyAddr}`, textX, 29.5);

    // ── TAX INVOICE BADGE (Top Right) ──────────────────────────────────────
    doc.setFontSize(14);
    doc.setTextColor(...GOLD);
    doc.setFont('helvetica', 'bold');
    doc.text('TAX INVOICE', pageWidth - margin, 14.5, { align: 'right' });

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('(Original for Recipient)', pageWidth - margin, 18.8, { align: 'right' });

    // ── ORDER VERIFICATION QR CODE (Top Right of Header) ─────────────────
    let qrDataUrl = null;
    try {
      const verifyUrl = `https://${companyWebsite}/order/${order.id || 'N/A'}`;
      qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 120,
        margin: 1,
        color: { dark: '#0F0F0F', light: '#FFFFFF' }
      });
      const qrSize = 14;
      const qrX = pageWidth - margin - qrSize;
      const qrY = 21;
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      doc.setFontSize(4.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GOLD);
      doc.text('SCAN TO VERIFY', qrX + (qrSize / 2), qrY + qrSize + 1.8, { align: 'center' });
    } catch (e) {
      console.warn("QR Code generation error:", e);
    }

    // ── INVOICE METADATA BANNER ────────────────────────────────────────────
    const invoiceNo = invoiceData?.invoiceNumber || `INV-${(order.id || 'N/A').slice(-8).toUpperCase()}`;
    let invDateStr  = new Date().toLocaleDateString('en-IN');
    if (invoiceData?.invoiceDate) {
      invDateStr = new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN');
    } else if (order.createdAt) {
      const d = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      invDateStr = d.toLocaleDateString('en-IN');
    }

    const paymentMethod = (invoiceData?.paymentMethod || order.paymentMethod || 'COD').toUpperCase();
    const paymentStatus = (invoiceData?.paymentStatus || order.paymentStatus || 'Pending').toUpperCase();
    const statusBadge   = getPaymentStatusBadge(paymentStatus, paymentMethod);

    const bannerY = headerH + 4.5;
    const bannerH = 15;

    doc.setFillColor(...LIGHT_BG);
    doc.rect(margin, bannerY, contentWidth, bannerH, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.25);
    doc.rect(margin, bannerY, contentWidth, bannerH, 'S');

    // Metadata Columns
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110, 110, 110);

    const colWidth = contentWidth / 5;
    const col1 = margin + 3;
    const col2 = margin + colWidth + 2;
    const col3 = margin + (colWidth * 2) + 2;
    const col4 = margin + (colWidth * 3) + 2;
    const col5 = margin + (colWidth * 4) - 5;

    doc.text('INVOICE NO',    col1, bannerY + 4.5);
    doc.text('ORDER ID',      col2, bannerY + 4.5);
    doc.text('DATE',         col3, bannerY + 4.5);
    doc.text('PAYMENT MODE', col4, bannerY + 4.5);
    doc.text('PAYMENT STATUS', col5 + 5, bannerY + 4.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(invoiceNo,                          col1, bannerY + 10.5);
    doc.text(`#${(order.id || '').toUpperCase()}`, col2, bannerY + 10.5);
    doc.text(invDateStr,                         col3, bannerY + 10.5);
    doc.text(paymentMethod,                      col4, bannerY + 10.5);

    // Colored Badge for Payment Status
    const badgeW = 28;
    const badgeH = 5.5;
    const badgeX = col5 + 5;
    const badgeY = bannerY + 7.2;

    doc.setFillColor(...statusBadge.bg);
    doc.rect(badgeX, badgeY, badgeW, badgeH, 'F');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...statusBadge.text);
    doc.text(statusBadge.label, badgeX + (badgeW / 2), badgeY + 3.8, { align: 'center' });

    // Barcode on top right of metadata banner
    try {
      const barcodeCanvas = document.createElement('canvas');
      JsBarcode(barcodeCanvas, (order.id || 'INV').toUpperCase(), {
        format: "CODE128",
        width: 1.5,
        height: 25,
        displayValue: false,
        margin: 0
      });
      const barcodeImg = barcodeCanvas.toDataURL("image/png");
      doc.addImage(barcodeImg, 'PNG', pageWidth - margin - 35, bannerY + 2.5, 32, 10);
    } catch (e) {
      console.warn("Barcode rendering skipped:", e);
    }

    // ── ADDRESS & DISPATCH CARDS (SELLER, BILLED TO, SHIPPED TO, COURIER) ───
    const toName     = invoiceData?.customerName || order.customerName || order.name || 'Valued Customer';
    const toPhone    = invoiceData?.phone  || order.phone  || '';
    const toEmail    = invoiceData?.email  || order.userEmail || '';
    const toAddress  = invoiceData?.address || order.address || '';
    const toCity     = invoiceData?.city   || order.city   || '';
    const toDistrict = invoiceData?.district || order.district || '';
    const toState    = invoiceData?.state  || order.state  || sellerState;
    const toPincode  = invoiceData?.pincode || order.pincode || '';
    const toLandmark = invoiceData?.landmark || order.landmark || '';
    const buyerGstin = invoiceData?.buyerGstin || order.buyerGstin || 'URP (Unregistered Person)';

    const courierName = invoiceData?.courierName || order.courierName || 'SMKP Express Logistics';
    const trackingId  = invoiceData?.trackingId  || order.trackingId  || order.awb || `SMKP-${(order.id || 'TRK').slice(-8).toUpperCase()}`;
    const estDelivery = invoiceData?.estimatedDelivery || order.estimatedDelivery || '3-5 Business Days';

    const cardsY = bannerY + bannerH + 4;
    const cardH = 38;
    const cardW = (contentWidth - 6) / 3;

    const card1X = margin;
    const card2X = card1X + cardW + 3;
    const card3X = card2X + cardW + 3;

    // Draw 3 card boxes
    [card1X, card2X, card3X].forEach(x => {
      doc.setFillColor(254, 254, 254);
      doc.rect(x, cardsY, cardW, cardH, 'F');
      doc.setDrawColor(...SLATE);
      doc.setLineWidth(0.2);
      doc.rect(x, cardsY, cardW, cardH, 'S');
    });

    // Header strip for Card 1 (SELLER)
    doc.setFillColor(...DARK);
    doc.rect(card1X, cardsY, cardW, 4.5, 'F');
    doc.setTextColor(...GOLD);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('SOLD BY (SELLER)', card1X + 3, cardsY + 3.2);

    // Header strip for Card 2 (BILLED TO)
    doc.setFillColor(...SLATE);
    doc.rect(card2X, cardsY, cardW, 4.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('BILLED TO (BUYER)', card2X + 3, cardsY + 3.2);

    // Header strip for Card 3 (SHIPPED TO & COURIER)
    doc.setFillColor(...DARK_GOLD);
    doc.rect(card3X, cardsY, cardW, 4.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('SHIPPED TO & COURIER', card3X + 3, cardsY + 3.2);

    // Card 1 Content (SELLER)
    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, card1X + 3, cardsY + 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(70, 70, 70);
    doc.text(`GSTIN: ${sellerGstin}`, card1X + 3, cardsY + 12.5);
    doc.text(`State Code: ${sellerStateCode} (${sellerState})`, card1X + 3, cardsY + 16);
    doc.text(`Ph: +91 ${companyPhone}`, card1X + 3, cardsY + 19.5);
    const splitAddr = doc.splitTextToSize(companyAddr, cardW - 6);
    doc.text(splitAddr, card1X + 3, cardsY + 23);

    // Card 2 Content (BILLED TO)
    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(toName, card2X + 3, cardsY + 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(70, 70, 70);
    doc.text(`GSTIN: ${buyerGstin}`, card2X + 3, cardsY + 12.5);
    doc.text(`Phone: ${toPhone}`, card2X + 3, cardsY + 16);
    if (toEmail) doc.text(`Email: ${toEmail}`, card2X + 3, cardsY + 19.5);
    const bLines = doc.splitTextToSize(`${toAddress}, ${toCity}, ${toState} - ${toPincode}`, cardW - 6);
    doc.text(bLines, card2X + 3, cardsY + (toEmail ? 23 : 19.5));

    // Card 3 Content (SHIPPED TO & DISPATCH)
    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(toName, card3X + 3, cardsY + 8.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(70, 70, 70);
    doc.text(`Courier: ${courierName}`, card3X + 3, cardsY + 12.5);
    doc.text(`AWB / Trk: ${trackingId}`, card3X + 3, cardsY + 16);
    doc.text(`Est. Delivery: ${estDelivery}`, card3X + 3, cardsY + 19.5);
    const sAddressStr = `${toAddress}, ${toCity}, ${toState} - ${toPincode}`;
    const sLines = doc.splitTextToSize(sAddressStr, cardW - 6);
    doc.text(sLines, card3X + 3, cardsY + 23);

    // ── COURIER NOTES (Optional Banner) ────────────────────────────────────
    const courierNotes = options.courierNotes || order.courierNotes || invoiceData?.courierNotes || '';
    let notesEndY = cardsY + cardH;

    if (courierNotes.trim()) {
      doc.setFillColor(254, 243, 199);
      doc.rect(margin, notesEndY + 2.5, contentWidth, 7, 'F');
      doc.setDrawColor(251, 191, 36);
      doc.setLineWidth(0.2);
      doc.rect(margin, notesEndY + 2.5, contentWidth, 7, 'S');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(`DISPATCH / COURIER INSTRUCTIONS: ${courierNotes.trim()}`, margin + 3, notesEndY + 7);
      notesEndY += 9.5;
    }

    // ── PRODUCT TABLE WITH THUMBNAILS ─────────────────────────────────────
    const tableStartY = notesEndY + 4;
    const rawItems    = invoiceData?.items || order.items || [];
    const isIntraState = toState.trim().toLowerCase().includes('tamil nadu') || toState.trim().toLowerCase().includes('tn') || !toState;

    // Pre-load product thumbnail images as Base64
    const itemsWithThumbnails = await Promise.all(rawItems.map(async (item) => {
      let thumbBase64 = null;
      const imgUrl = item.image || item.thumbnail || item.images?.[0];
      if (imgUrl) {
        try { thumbBase64 = await loadImageAsBase64(imgUrl); }
        catch (e) { console.warn("Thumbnail image load error:", item.name, e); }
      }
      return { ...item, thumbBase64 };
    }));

    let totalTaxableValueSum = 0;
    let totalCgstSum = 0;
    let totalSgstSum = 0;
    let totalIgstSum = 0;
    let grandItemsTotal = 0;

    const tableRows = itemsWithThumbnails.map((item, idx) => {
      const qty = Math.max(1, Number(item.quantity || 1));
      const price = Number(item.price || item.effectivePrice || 0);
      const itemDiscount = Number(item.discount || 0);
      const gstPercent = Number(item.gstPercent || item.taxPercent || 18);
      const hsn = item.hsnCode || item.hsn || '8517';

      const totalItemVal = Math.max(0, (price * qty) - itemDiscount);

      // Inclusive GST calculation
      const taxableValue = totalItemVal / (1 + (gstPercent / 100));
      const totalTax = totalItemVal - taxableValue;
      const unitPriceBase = taxableValue / qty;

      let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;
      if (isIntraState) {
        cgstAmt = totalTax / 2;
        sgstAmt = totalTax / 2;
        totalCgstSum += cgstAmt;
        totalSgstSum += sgstAmt;
      } else {
        igstAmt = totalTax;
        totalIgstSum += igstAmt;
      }

      totalTaxableValueSum += taxableValue;
      grandItemsTotal += totalItemVal;

      let nameStr = item.name || 'Product Item';
      if (item.color || item.size) {
        const specs = [];
        if (item.color) specs.push(typeof item.color === 'object' ? item.color.name : item.color);
        if (item.size)  specs.push(`Size: ${item.size}`);
        nameStr += ` (${specs.join(', ')})`;
      }

      if (isIntraState) {
        return [
          idx + 1,
          '', // Cell 1 reserved for thumbnail image
          nameStr,
          hsn,
          qty,
          `INR ${unitPriceBase.toFixed(2)}`,
          itemDiscount > 0 ? `INR ${itemDiscount.toFixed(2)}` : '0.00',
          `INR ${taxableValue.toFixed(2)}`,
          `${gstPercent}%`,
          `INR ${cgstAmt.toFixed(2)}`,
          `INR ${sgstAmt.toFixed(2)}`,
          `INR ${totalItemVal.toFixed(2)}`
        ];
      } else {
        return [
          idx + 1,
          '', // Cell 1 reserved for thumbnail image
          nameStr,
          hsn,
          qty,
          `INR ${unitPriceBase.toFixed(2)}`,
          itemDiscount > 0 ? `INR ${itemDiscount.toFixed(2)}` : '0.00',
          `INR ${taxableValue.toFixed(2)}`,
          `${gstPercent}%`,
          `INR ${igstAmt.toFixed(2)}`,
          `INR ${totalItemVal.toFixed(2)}`
        ];
      }
    });

    if (tableRows.length === 0) {
      tableRows.push(['1', '', 'Product Item', '8517', '1', '0.00', '0.00', '0.00', '18%', '0.00', '0.00', '0.00']);
    }

    const tableHeaders = isIntraState 
      ? [['#', 'Item', 'Description of Goods', 'HSN/SAC', 'Qty', 'Unit Price', 'Discount', 'Taxable Val', 'GST %', 'CGST', 'SGST', 'Total (INR)']]
      : [['#', 'Item', 'Description of Goods', 'HSN/SAC', 'Qty', 'Unit Price', 'Discount', 'Taxable Val', 'GST %', 'IGST', 'Total (INR)']];

    autoTable(doc, {
      startY: tableStartY,
      head: tableHeaders,
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: DARK,
        textColor: GOLD,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: GOLD
      },
      styles: {
        fontSize: 6.8,
        valign: 'middle',
        cellPadding: 2,
        lineColor: [220, 220, 220],
        lineWidth: 0.15,
        textColor: DARK,
        minCellHeight: 11
      },
      columnStyles: isIntraState ? {
        0:  { cellWidth: 7,  halign: 'center' },
        1:  { cellWidth: 11, halign: 'center' },
        2:  { cellWidth: 42, halign: 'left' },
        3:  { cellWidth: 13, halign: 'center' },
        4:  { cellWidth: 9,  halign: 'center' },
        5:  { cellWidth: 17, halign: 'right' },
        6:  { cellWidth: 14, halign: 'right' },
        7:  { cellWidth: 19, halign: 'right' },
        8:  { cellWidth: 11, halign: 'center' },
        9:  { cellWidth: 14, halign: 'right' },
        10: { cellWidth: 14, halign: 'right' },
        11: { cellWidth: 15, halign: 'right', fontStyle: 'bold' }
      } : {
        0:  { cellWidth: 7,  halign: 'center' },
        1:  { cellWidth: 11, halign: 'center' },
        2:  { cellWidth: 48, halign: 'left' },
        3:  { cellWidth: 14, halign: 'center' },
        4:  { cellWidth: 9,  halign: 'center' },
        5:  { cellWidth: 18, halign: 'right' },
        6:  { cellWidth: 15, halign: 'right' },
        7:  { cellWidth: 20, halign: 'right' },
        8:  { cellWidth: 12, halign: 'center' },
        9:  { cellWidth: 16, halign: 'right' },
        10: { cellWidth: 16, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: margin, right: margin },
      didDrawCell: (data) => {
        // Draw thumbnail image in Column 1 for body rows
        if (data.column.index === 1 && data.cell.section === 'body') {
          const item = itemsWithThumbnails[data.row.index];
          if (item?.thumbBase64) {
            const size = 7.5;
            const x = data.cell.x + (data.cell.width - size) / 2;
            const y = data.cell.y + (data.cell.height - size) / 2;
            doc.addImage(item.thumbBase64, 'PNG', x, y, size, size);
          }
        }
      }
    });

    // ── FINANCIAL TOTALS & TAX BREAKDOWN SUMMARY ──────────────────────────
    let endTableY = doc.lastAutoTable.finalY + 4;
    if (endTableY + 45 > 275) { doc.addPage(); endTableY = 20; }

    const deliveryCharge = Number(order.deliveryCharge || 0);
    const couponDiscount = Number(order.couponDiscount || invoiceData?.pricing?.couponDiscount || 0);
    const couponCode     = (invoiceData?.couponCode || order.couponCode || order.appliedCoupon || '').toUpperCase();
    const grandTotal     = order.totalPrice !== undefined ? Number(order.totalPrice) : Math.max(0, grandItemsTotal + deliveryCharge - couponDiscount);

    // Summary Boxes Layout
    const leftW = 108;
    const rightW = contentWidth - leftW - 4;
    const summaryH = 38;

    const leftX = margin;
    const rightX = margin + leftW + 4;

    // Left Card (Words & Declaration)
    doc.setFillColor(...LIGHT_BG);
    doc.rect(leftX, endTableY, leftW, summaryH, 'F');
    doc.setDrawColor(...SLATE);
    doc.setLineWidth(0.2);
    doc.rect(leftX, endTableY, leftW, summaryH, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('AMOUNT IN WORDS:', leftX + 3, endTableY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK_GOLD);
    const wordsStr = numberToWords(grandTotal);
    const splitWords = doc.splitTextToSize(wordsStr, leftW - 6);
    doc.text(splitWords, leftX + 3, endTableY + 9.5);

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.15);
    doc.line(leftX + 3, endTableY + 16, leftX + leftW - 3, endTableY + 16);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90, 90, 90);
    doc.text('DECLARATION & TERMS:', leftX + 3, endTableY + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(110, 110, 110);
    doc.text('• Tax payable on Reverse Charge basis: NO', leftX + 3, endTableY + 24);
    doc.text('• We declare that this invoice shows the actual price of the goods described.', leftX + 3, endTableY + 28);
    doc.text('• All disputes subject to Tamil Nadu Jurisdiction.', leftX + 3, endTableY + 32);

    // Right Box: Financial Breakdown Card
    doc.setFillColor(254, 254, 254);
    doc.rect(rightX, endTableY, rightW, summaryH, 'F');
    doc.setDrawColor(...DARK);
    doc.setLineWidth(0.2);
    doc.rect(rightX, endTableY, rightW, summaryH, 'S');

    let rY = endTableY + 5;
    const rLabelX = rightX + 3;
    const rValX   = rightX + rightW - 3;

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);

    doc.text('Subtotal (Taxable):', rLabelX, rY);
    doc.text(`INR ${totalTaxableValueSum.toFixed(2)}`, rValX, rY, { align: 'right' });

    if (couponDiscount > 0 || couponCode) {
      rY += 3.8;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(`Discount (${couponCode || 'Coupon'}):`, rLabelX, rY);
      doc.text(`- INR ${couponDiscount.toFixed(2)}`, rValX, rY, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
    }

    rY += 3.8;
    doc.text('Delivery Charges:', rLabelX, rY);
    doc.text(`INR ${deliveryCharge.toFixed(2)}`, rValX, rY, { align: 'right' });

    if (isIntraState) {
      rY += 3.8;
      doc.text('CGST:', rLabelX, rY);
      doc.text(`INR ${totalCgstSum.toFixed(2)}`, rValX, rY, { align: 'right' });
      rY += 3.8;
      doc.text('SGST / IGST (SGST):', rLabelX, rY);
      doc.text(`INR ${totalSgstSum.toFixed(2)}`, rValX, rY, { align: 'right' });
    } else {
      rY += 3.8;
      doc.text('SGST / IGST (IGST):', rLabelX, rY);
      doc.text(`INR ${totalIgstSum.toFixed(2)}`, rValX, rY, { align: 'right' });
    }

    // Prominent Grand Total Box
    const totalBoxY = endTableY + summaryH - 10;
    doc.setFillColor(...DARK);
    doc.rect(rightX, totalBoxY, rightW, 10, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.rect(rightX, totalBoxY, rightW, 10, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text('GRAND TOTAL:', rLabelX, totalBoxY + 6.5);
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`INR ${grandTotal.toFixed(2)}`, rValX, totalBoxY + 6.5, { align: 'right' });

    // ── AUTHORIZED DIGITAL SIGNATURE CARD ─────────────────────────────────
    let sigY = endTableY + summaryH + 4;
    if (sigY + 25 > 275) { doc.addPage(); sigY = 20; }

    const sigW = 58;
    const sigH = 22;
    const sigX = pageWidth - margin - sigW;

    drawDigitalSignature(doc, sigX, sigY, sigW, sigH);

    // ── MULTI-PAGE WATERMARK, RETURN POLICY & FOOTER LOOP ──────────────────
    const totalPages = doc.getNumberOfPages();

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      doc.setPage(pageNum);

      // 1. Draw light background watermark on all pages
      drawWatermark(doc, pageWidth, pageHeight);

      // 2. Footer Divider Line
      const footerY = 280;
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.2);
      doc.line(margin, footerY - 3.5, pageWidth - margin, footerY - 3.5);

      // 3. Brand Thank You Line
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...GOLD);
      doc.text(`Thank you for shopping with ${companyName.toUpperCase()}!`, pageWidth / 2, footerY, { align: 'center' });

      // 4. Return Policy & Support Line
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text(`RETURN POLICY: 7-day hassle-free replacement/return policy for damaged items. Visit https://${companyWebsite}/returns`, pageWidth / 2, footerY + 3.8, { align: 'center' });

      // 5. Legal footnote & Page Numbers
      doc.setFontSize(5.8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Computer generated Tax Invoice under Section 31 of CGST Act, 2017  |  Page ${pageNum} of ${totalPages}`, pageWidth / 2, footerY + 7.5, { align: 'center' });
    }

    // ── OUTPUT HANDLING ───────────────────────────────────────────────────
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
      link.download = `Invoice_${safeId.slice(-8).toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

  } catch (error) {
    console.error("PDF GENERATION ERROR:", error);
    alert("Could not generate invoice PDF.");
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
    let companyPhone = COMPANY_PHONE;
    let companyEmail = COMPANY_EMAIL;
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
    const hdrH = 32;
    doc.setFillColor(...DARK);
    doc.rect(0, 0, width, hdrH, 'F');

    doc.setFillColor(...GOLD);
    doc.rect(0, hdrH, width, 1, 'F');

    let logoLoaded = false;
    const logoBoxSize = 22;
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

    const labelNotes = order.courierNotes || '';
    if (labelNotes.trim()) {
      doc.setFillColor(254, 243, 199);
      doc.rect(5, 120, 90, 8, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(`NOTES: ${labelNotes.trim()}`, 8, 125);
    }

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