import sendWhatsAppNotificationHandler, { formatE164Phone } from '../api/send-whatsapp.js';

console.log("=== WHATSAPP AUDIT TEST SCRIPT ===");

// 1. Test Phone Number Formatting
console.log("\n1. Testing E.164 Phone Formatting:");
console.log("  9677417185   ->", formatE164Phone("9677417185"));
console.log("  09677417185  ->", formatE164Phone("09677417185"));
console.log("  919677417185 ->", formatE164Phone("919677417185"));
console.log("  +919677417185->", formatE164Phone("+919677417185"));

// 2. Test Request & Payload Execution
console.log("\n2. Testing WhatsApp Handler Request Execution:");

const mockReq = {
  method: 'POST',
  body: {
    orderId: 'TEST-ORD-98210',
    customerName: 'Kaviyarasan M',
    phone: '9677417185',
    items: [
      { name: 'SMKP Premium Leather Wallet', quantity: 1, price: 999 },
      { name: 'SMKP Cotton T-Shirt', quantity: 2, price: 499 }
    ],
    totalPrice: 1997,
    address: 'Pommalappatti',
    city: 'Theni',
    pincode: '625523',
    paymentMethod: 'COD',
    paymentStatus: 'Pending'
  }
};

const mockRes = {
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    console.log(`\nResponse HTTP Status: ${this.statusCode}`);
    console.log("Response Audit Data:", JSON.stringify(data, null, 2));
    return this;
  }
};

await sendWhatsAppNotificationHandler(mockReq, mockRes);
