import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  writeBatch,
  runTransaction      // ✅ Added for atomic order creation
} from 'firebase/firestore';
import { db } from '../firebase';

// --- Product Services ---

export const getProducts = async ({ category = null, limitCount = 20, lastVisibleDoc = null } = {}) => {
  try {
    const constraints = [orderBy('createdAt', 'desc')];

    if (category && category !== 'all') {
      constraints.push(where('category', '==', category));
    }

    if (lastVisibleDoc) {
      constraints.push(startAfter(lastVisibleDoc));
    }

    constraints.push(limit(limitCount));

    const q = query(collection(db, 'products'), ...constraints);
    const snapshot = await getDocs(q);
    
    const products = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    
    return { products, lastDoc };
  } catch (error) {
    console.error("Error getting products:", error);
    throw error;
  }
};

// ✅ Fixed: now returns latest products for New Arrivals, falling back to unfiltered if createdAt is missing
export const getFeaturedProducts = async (count = 4) => {
  try {
    const q = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    let products = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    
    // If database query yields 0 due to missing createdAt fields, fallback to unfiltered
    if (products.length === 0) {
      console.warn("getFeaturedProducts: 0 results returned. Falling back to unfiltered query.");
      const fallbackQuery = query(
        collection(db, 'products'),
        limit(count)
      );
      const fallbackSnapshot = await getDocs(fallbackQuery);
      products = fallbackSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    }
    
    return products;
  } catch (error) {
    console.error("Error getting featured products:", error);
    throw error;
  }
};

export const getProductById = async (id) => {
  try {
    const docRef = doc(db, 'products', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting product:", error);
    throw error;
  }
};

export const getProductsByIds = async (ids) => {
  if (!ids || ids.length === 0) return [];
  try {
    const promises = ids.map(id => getProductById(id));
    const results = await Promise.all(promises);
    return results.filter(p => p !== null);
  } catch (error) {
    console.error("Error getting products by IDs:", error);
    throw error;
  }
};

export const addProduct = async (productData) => {
  try {
    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding product:", error);
    throw error;
  }
};

export const updateProduct = async (id, productData) => {
  try {
    const docRef = doc(db, 'products', id);
    await updateDoc(docRef, {
      ...productData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
};

export const uploadImage = async (file) => {
  if (!file) return null;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "smkp_upload");

  try {
    const res = await fetch(
      "https://api.cloudinary.com/v1_1/doca4zvcx/image/upload",
      { method: "POST", body: formData }
    );

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Request URL:", res.url);
      console.error("Status Code:", res.status);
      console.error("Response Body:", errorBody);
      throw new Error(`Cloudinary upload failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary Error:", error);
    throw error;
  }
};

export const deleteProduct = async (id) => {
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
};

// --- Logistics & Order Management ---

// --- Logistics & Order Management ---

// ✅ Pincode-based delivery zone and shipping fee calculator
export const getDeliveryCharge = (pincode) => {
  const code = String(pincode || '').trim().replace(/\D/g, '');
  if (code.length !== 6) {
    return {
      charge: 0,
      zone: 'Invalid Pincode',
      days: '--'
    };
  }

  // Same District (Chennai) = ₹40 (starts with 600)
  if (code.startsWith('600')) {
    return {
      charge: 40,
      zone: 'Same District (Chennai)',
      days: '1-2 Days'
    };
  }

  const prefix2 = code.slice(0, 2);
  const prefix3 = code.slice(0, 3);

  // Tamil Nadu Other District = ₹60 (starts with 60 to 64, except Chennai 600)
  if (['60', '61', '62', '63', '64'].includes(prefix2)) {
    return {
      charge: 60,
      zone: 'Tamil Nadu Other District',
      days: '2-3 Days'
    };
  }

  // South India States = ₹80
  // Karnataka (56-59), Kerala (67-69), Andhra Pradesh/Telangana (50-53)
  const southIndiaPrefixes = [
    '50', '51', '52', '53',
    '56', '57', '58', '59',
    '67', '68', '69'
  ];
  if (southIndiaPrefixes.includes(prefix2)) {
    return {
      charge: 80,
      zone: 'South India States',
      days: '3-4 Days'
    };
  }

  // North East States = ₹180
  // Assam (78), NE (79), Sikkim (737)
  if (prefix2 === '78' || prefix2 === '79' || prefix3 === '737') {
    return {
      charge: 180,
      zone: 'North East States',
      days: '7-9 Days'
    };
  }

  // Rest of India = ₹120
  return {
    charge: 120,
    zone: 'Rest of India',
    days: '5-7 Days'
  };
};

// ✅ Fixed: wrapped in runTransaction so order + stock update are fully atomic
export const createOrder = async (orderData) => {
  if (!orderData.userId) {
    throw new Error("Cannot create order: User ID is required for tracking.");
  }

  try {
    const orderId = await runTransaction(db, async (transaction) => {
      // 1. Read all products first
      const productSnaps = {};
      const productDatas = {};

      for (const item of orderData.items) {
        const prodId = item.productId || item.id;
        if (!productSnaps[prodId]) {
          console.log("Reading product...");
          const productRef = doc(db, 'products', prodId);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists()) {
            throw new Error(`Product ${prodId} not found.`);
          }
          productSnaps[prodId] = productSnap;
          productDatas[prodId] = productSnap.data();
        }
      }

      // 2. Validate stock and track availability in memory
      const tempStockTracker = {}; // key: prodId or prodId_color_size

      for (const item of orderData.items) {
        const prodId = item.productId || item.id;
        const productData = productDatas[prodId];
        
        let stock = 0;
        let stockKey = prodId;

        if (productData.variants && productData.variants.length > 0) {
          const colorName = typeof item.color === 'object' ? item.color.name : item.color;
          const variant = productData.variants.find(v => (v.colorName || v.color) === colorName);
          if (variant) {
            if (item.size && variant.sizes) {
              stockKey = `${prodId}_${colorName}_${item.size}`;
              if (tempStockTracker[stockKey] === undefined) {
                tempStockTracker[stockKey] = Number(variant.sizes[item.size] || 0);
              }
            } else {
              stockKey = `${prodId}_${colorName}`;
              if (tempStockTracker[stockKey] === undefined) {
                tempStockTracker[stockKey] = Number(variant.stock || 0);
              }
            }
          } else {
            if (tempStockTracker[stockKey] === undefined) {
              tempStockTracker[stockKey] = Number(productData.stock ?? 0);
            }
          }
        } else {
          if (tempStockTracker[stockKey] === undefined) {
            tempStockTracker[stockKey] = Number(productData.stock ?? 0);
          }
        }

        stock = tempStockTracker[stockKey];
        console.log("Stock available:", stock);

        const quantity = item.quantity || 1;
        if (stock < quantity) {
          const colorName = typeof item.color === 'object' ? item.color.name : item.color;
          const variantDetail = colorName ? ` (${colorName}${item.size ? ' - ' + item.size : ''})` : '';
          throw new Error(`Insufficient stock for product: ${productData.name}${variantDetail}`);
        }

        tempStockTracker[stockKey] -= quantity;
      }

      // 3. Create the order document (Write 1)
      const orderRef = doc(collection(db, 'orders'));
      const formattedOrder = {
        userId: orderData.userId,
        customerName: orderData.name,
        address: orderData.address,
        city: orderData.city,
        pincode: orderData.pincode,
        phone: orderData.phone,
        items: orderData.items,
        totalPrice: orderData.totalPrice,
        subtotal: orderData.subtotal,
        deliveryCharge: orderData.deliveryCharge,
        deliveryZone: orderData.deliveryZone || '',
        estimatedDeliveryDays: orderData.estimatedDeliveryDays || '',
        userEmail: orderData.userEmail,
        status: orderData.status || 'ordered',
        orderStatus: orderData.orderStatus || orderData.status || 'ordered',
        paymentMethod: orderData.paymentMethod || 'COD',
        paymentStatus: orderData.paymentStatus || 'Pending',
        paymentDetails: orderData.paymentDetails || null,
        statusHistory: [
          {
            status: orderData.status || 'ordered',
            timestamp: new Date().toISOString(),
            message: 'Order placed successfully'
          }
        ],
        createdAt: serverTimestamp()
      };
      transaction.set(orderRef, formattedOrder);

      // 4. Track variants/stock updates in memory and then write them (Write 2)
      const productUpdates = {};

      for (const item of orderData.items) {
        const prodId = item.productId || item.id;
        const currentData = productUpdates[prodId] || productDatas[prodId];

        let updatedData = { ...currentData };
        const quantity = item.quantity || 1;

        if (updatedData.variants && updatedData.variants.length > 0) {
          const colorName = typeof item.color === 'object' ? item.color.name : item.color;
          updatedData.variants = updatedData.variants.map(v => {
            if ((v.colorName || v.color) === colorName) {
              if (item.size && v.sizes) {
                return {
                  ...v,
                  sizes: {
                    ...v.sizes,
                    [item.size]: Math.max(0, Number(v.sizes[item.size] || 0) - quantity)
                  },
                  stock: Math.max(0, Number(v.stock || 0) - quantity)
                };
              } else {
                return {
                  ...v,
                  stock: Math.max(0, Number(v.stock || 0) - quantity)
                };
              }
            }
            return v;
          });
          updatedData.stock = Number(updatedData.stock || 0) - quantity;
        } else {
          updatedData.stock = Number(updatedData.stock || 0) - quantity;
        }

        updatedData.soldCount = Number(updatedData.soldCount || 0) + quantity;
        productUpdates[prodId] = updatedData;
      }

      // Write updates to database
      for (const prodId of Object.keys(productUpdates)) {
        const productRef = doc(db, 'products', prodId);
        const finalData = productUpdates[prodId];
        transaction.update(productRef, {
          stock: finalData.stock,
          soldCount: finalData.soldCount,
          ...(finalData.variants && { variants: finalData.variants })
        });
      }

      return orderRef.id;
    });

    return orderId;
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
};

// --- Order Services ---

export const getOrders = async () => {
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error("Error getting orders:", error);
    throw error;
  }
};

export const getOrderById = async (id) => {
  try {
    const docRef = doc(db, 'orders', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting order:", error);
    throw error;
  }
};

// ✅ Fixed: now appends to statusHistory to preserve the full audit trail
export const updateOrderStatus = async (id, status, message = '') => {
  try {
    const docRef = doc(db, 'orders', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error(`Order ${id} not found.`);

    const existing = docSnap.data().statusHistory || [];
    const newEntry = {
      status,
      timestamp: new Date().toISOString(),
      message: message || `Status updated to ${status}`
    };

    await updateDoc(docRef, {
      status,
      statusHistory: [...existing, newEntry],
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
};

export const deleteOrder = async (id) => {
  try {
    await deleteDoc(doc(db, 'orders', id));
  } catch (error) {
    console.error("Error deleting order:", error);
    throw error;
  }
};

// --- Expense Services ---

export const getExpenses = async () => {
  try {
    const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error("Error getting expenses:", error);
    throw error;
  }
};

export const addExpense = async (expenseData) => {
  try {
    const docRef = await addDoc(collection(db, 'expenses'), {
      ...expenseData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding expense:", error);
    throw error;
  }
};

// ✅ Added: missing deleteExpense to match the pattern of other services
export const deleteExpense = async (id) => {
  try {
    await deleteDoc(doc(db, 'expenses', id));
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
};

// --- Invoice Services ---

export const saveInvoice = async (orderId, orderData) => {
  try {
    const invoiceRef = doc(db, 'invoices', orderId);
    
    const items = orderData.items || [];
    const subtotal = orderData.subtotal || 0;
    const deliveryCharge = orderData.deliveryCharge || 0;
    const totalPrice = orderData.totalPrice || 0;
    
    const subtotalExclGST = subtotal / 1.18;
    const gstAmount = subtotal - subtotalExclGST;
    
    // Convert timestamp
    let formattedDate = new Date().toISOString();
    if (orderData.createdAt) {
      if (typeof orderData.createdAt.toDate === 'function') {
        formattedDate = orderData.createdAt.toDate().toISOString();
      } else if (orderData.createdAt.seconds) {
        formattedDate = new Date(orderData.createdAt.seconds * 1000).toISOString();
      } else {
        formattedDate = new Date(orderData.createdAt).toISOString();
      }
    }

    const invoiceData = {
      orderId: orderId,
      invoiceNumber: `INV-${orderId.slice(-8).toUpperCase()}`,
      invoiceDate: formattedDate,
      paymentMethod: orderData.paymentMethod || 'COD',
      paymentStatus: orderData.paymentStatus || 'Pending',
      customerName: orderData.customerName || orderData.name || 'Customer',
      phone: orderData.phone || '',
      address: orderData.address || '',
      city: orderData.city || '',
      pincode: orderData.pincode || '',
      userId: orderData.userId || 'guest',
      items: items.map(item => ({
        id: item.id || '',
        name: item.name || item.title || '',
        image: item.image || '',
        quantity: Number(item.quantity || item.qty || 1),
        price: Number(item.price || item.effectivePrice || 0),
        effectivePrice: Number(item.effectivePrice || item.price || 0),
        discount: Number(item.price || 0) > Number(item.effectivePrice || 0) ? (Number(item.price) - Number(item.effectivePrice)) : 0
      })),
      pricing: {
        subtotal: subtotalExclGST,
        discount: items.reduce((acc, item) => acc + (Number(item.price || 0) > Number(item.effectivePrice || 0) ? (Number(item.price) - Number(item.effectivePrice)) * Number(item.quantity || 1) : 0), 0),
        shipping: deliveryCharge,
        gst: gstAmount,
        grandTotal: totalPrice
      },
      createdAt: serverTimestamp()
    };
    
    await setDoc(invoiceRef, invoiceData);
    return invoiceData;
  } catch (error) {
    console.error("Error saving invoice:", error);
    throw error;
  }
};

export const getInvoices = async () => {
  try {
    const q = query(collection(db, 'invoices'), orderBy('invoiceDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error("Error getting invoices:", error);
    throw error;
  }
};

export const getInvoiceById = async (orderId) => {
  try {
    const docRef = doc(db, 'invoices', orderId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting invoice by id:", error);
    throw error;
  }
};