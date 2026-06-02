import * as XLSX from 'xlsx';

/* ── FIX 5: local date string for filename (YYYY-MM-DD in user's timezone) ── */
function localDateStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/* ── FIX 4: explicit locale + format so output is consistent everywhere ───── */
function formatDate(value) {
  if (!value) return 'N/A';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export const exportOrdersToExcel = (orders) => {
  if (!orders || orders.length === 0) return;

  const data = orders.map(order => {
    // FIX 2 & 3: safe numeric helpers — fall back to 0 so cells are never NaN/undefined
    const deliveryCharge = Number(order.deliveryCharge) || 0;
    const totalPrice = Number(order.totalPrice) || 0;
    const subtotal = Number(order.subtotal) || (totalPrice - deliveryCharge) || 0;

    return {
      'Order ID': order.id ? String(order.id).toUpperCase() : 'N/A',  // FIX 1
      'Date': formatDate(order.createdAt),                          // FIX 4
      'Customer Name': order.customerName || order.name || 'Guest',
      'Phone': order.phone || 'N/A',
      'Address': order.address || 'N/A',
      'City': order.city || 'N/A',
      'Pincode': order.pincode || 'N/A',
      'Products': order.items?.map(i => `${i.name} (x${i.quantity})`).join(', ') || 'N/A',
      'Subtotal': subtotal,        // FIX 2
      'Delivery Charge': deliveryCharge,
      'Total Price': totalPrice,      // FIX 3
      'Order Status': order.orderStatus ? String(order.orderStatus).toUpperCase() : (order.status ? String(order.status).toUpperCase() : 'ORDERED'),
      'Payment Method': order.paymentMethod ? String(order.paymentMethod).toUpperCase() : 'COD',
      'Payment Status': order.paymentStatus ? String(order.paymentStatus) : 'Pending',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

  worksheet['!cols'] = [
    { wch: 25 }, // Order ID
    { wch: 22 }, // Date
    { wch: 20 }, // Customer Name
    { wch: 15 }, // Phone
    { wch: 40 }, // Address
    { wch: 15 }, // City
    { wch: 10 }, // Pincode
    { wch: 50 }, // Products
    { wch: 12 }, // Subtotal
    { wch: 15 }, // Delivery Charge
    { wch: 15 }, // Total Price
    { wch: 15 }, // Order Status
    { wch: 18 }, // Payment Method
    { wch: 18 }, // Payment Status
  ];

  XLSX.writeFile(workbook, `Orders_Export_${localDateStamp()}.xlsx`); // FIX 5
};