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
import { uploadImage as cloudinaryUpload, uploadVideo as cloudinaryVideoUpload } from '../services/uploadService';

// --- In-Memory Query Cache & Loading Guards ---
const queryCache = new Map();
const activeRequests = new Map();

/**
 * Wraps a fetch function with memory caching and duplicate request prevention.
 */
export const cachedFetch = async (key, fetchFn, ttl = 300000, forceRefresh = false) => {
  const now = Date.now();

  // Check if cache exists and is valid
  if (!forceRefresh && queryCache.has(key)) {
    const cached = queryCache.get(key);
    if (now - cached.timestamp < ttl) {
      console.log(`[Firestore Cache Hit] Key: ${key}`);
      return cached.data;
    }
  }

  // Loading guard: check for active request promise
  if (activeRequests.has(key)) {
    console.log(`[Firestore Loading Guard] Reusing active request for key: ${key}`);
    return activeRequests.get(key);
  }

  console.log(`[Firestore Cache Miss] Fetching fresh data for key: ${key}`);
  const promise = (async () => {
    try {
      const data = await fetchFn();
      queryCache.set(key, { data, timestamp: now });
      return data;
    } finally {
      activeRequests.delete(key);
    }
  })();

  activeRequests.set(key, promise);
  return promise;
};

/**
 * Invalidates cache entries matching a prefix.
 */
export const invalidateCache = (keyPrefix = null) => {
  if (!keyPrefix) {
    queryCache.clear();
    console.log('[Firestore Cache] Cleared all cache');
  } else {
    for (const key of queryCache.keys()) {
      if (key.startsWith(keyPrefix)) {
        queryCache.delete(key);
        console.log(`[Firestore Cache] Invalidated key: ${key}`);
      }
    }
  }
};

// --- Product Services ---

export const getProducts = async ({ category = null, limitCount = 20, lastVisibleDoc = null } = {}, forceRefresh = false) => {
  const cacheKey = `products_list_${category || 'all'}_${limitCount}_${lastVisibleDoc?.id || 'none'}`;
  return cachedFetch(cacheKey, async () => {
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
  }, 300000, forceRefresh);
};

// ✅ Fixed: now returns latest products for New Arrivals, falling back to unfiltered if createdAt is missing
export const getFeaturedProducts = async (count = 4, forceRefresh = false) => {
  const cacheKey = `featured_products_${count}`;
  return cachedFetch(cacheKey, async () => {
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
  }, 300000, forceRefresh);
};

export const getProductById = async (id, forceRefresh = false) => {
  const cacheKey = `product_${id}`;
  return cachedFetch(cacheKey, async () => {
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
  }, 300000, forceRefresh);
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
    // Invalidate list caches
    invalidateCache('products_list_');
    invalidateCache('featured_products_');
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
    // Invalidate caches
    invalidateCache(`product_${id}`);
    invalidateCache('products_list_');
    invalidateCache('featured_products_');
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
};

export const uploadImage = cloudinaryUpload;
export const uploadVideo = cloudinaryVideoUpload;

export const deleteProduct = async (id) => {
  try {
    await deleteDoc(doc(db, 'products', id));
    // Invalidate caches
    invalidateCache(`product_${id}`);
    invalidateCache('products_list_');
    invalidateCache('featured_products_');
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

        const stock = tempStockTracker[stockKey];
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

      const cityVal = orderData.city || orderData.customerDetails?.city || '';
      const parts = cityVal.split(',').map(s => s.trim());
      const parsedDistrict = parts[0] || '';
      const parsedState = parts[1] || '';

      const itemsList = orderData.items || orderData.orderedItems || [];
      const orderedItems = itemsList.map(item => {
        const price = Number(item.effectivePrice || item.price || 0);
        const qty = Number(item.quantity || 1);
        return {
          productId: item.productId || item.id || '',
          productName: item.name || item.productName || 'Unknown Product',
          image: item.image || '',
          color: typeof item.color === 'object' ? item.color.name : (item.selectedColor || item.color || ''),
          size: item.size || '',
          quantity: qty,
          price: price,
          total: Number(item.total || (price * qty))
        };
      });

      const formattedOrder = {
        userId: orderData.userId,
        customerName: orderData.name,
        address: orderData.address,
        city: orderData.city,
        pincode: orderData.pincode,
        phone: orderData.phone,
        items: orderData.items,
        totalPrice: orderData.totalPrice,
        profit: Number(orderData.profit || 0),
        subtotal: orderData.subtotal,
        couponCode: orderData.couponCode || null,
        couponDiscount: Number(orderData.couponDiscount || 0),
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
        createdAt: serverTimestamp(),
        customerDetails: {
          name: orderData.name,
          phone: orderData.phone,
          email: orderData.userEmail || '',
          address: orderData.address,
          district: orderData.district || parsedDistrict,
          state: orderData.state || parsedState,
          pincode: orderData.pincode,
          landmark: orderData.landmark || ''
        },
        orderedItems: orderedItems
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

// --- Store Settings Services ---

export const getStoreSettings = async (forceRefresh = false) => {
  return cachedFetch('store_settings', async () => {
    try {
      const docRef = doc(db, 'settings', 'store');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      console.error("Error getting store settings:", error);
      throw error;
    }
  }, 300000, forceRefresh);
};

export const updateStoreSettings = async (settingsData) => {
  try {
    const docRef = doc(db, 'settings', 'store');
    const dataToSave = {
      ...settingsData,
      updatedAt: serverTimestamp()
    };
    await setDoc(docRef, dataToSave, { merge: true });
    invalidateCache('store_settings');
    return dataToSave;
  } catch (error) {
    console.error("Error updating store settings:", error);
    throw error;
  }
};

// --- Categories & Promotion services with caching ---

export const getCategories = async (forceRefresh = false) => {
  return cachedFetch('categories_list', async () => {
    try {
      const q = query(
        collection(db, 'categories'),
        where('active', '==', true),
        orderBy('order', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error("Error getting categories:", error);
      throw error;
    }
  }, 600000, forceRefresh);
};

export const getOffers = async (forceRefresh = false) => {
  return cachedFetch('offers_list', async () => {
    try {
      const offersRef = collection(db, 'offers');
      const snapshot = await getDocs(offersRef);
      const list = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const rawExpiry = data.expiryDateTime || data.offerEndDate || '';
        const expiry = rawExpiry ? String(rawExpiry).replace(' ', 'T') : '';
        return {
          id: docSnap.id,
          ...data,
          expiryDateTime: expiry,
          offerEndDate: expiry
        };
      });
      return list;
    } catch (error) {
      console.error("Error getting offers:", error);
      throw error;
    }
  }, 300000, forceRefresh);
};

export const getMainPromotion = async (forceRefresh = false) => {
  return cachedFetch('main_promotion', async () => {
    try {
      const promoDocRef = doc(db, 'promotions', 'main');
      const snapshot = await getDoc(promoDocRef);
      if (snapshot.exists()) {
        return snapshot.data();
      }
      return { bannerProductIds: [] };
    } catch (error) {
      console.error("Error getting main promotion:", error);
      throw error;
    }
  }, 300000, forceRefresh);
};


// --- Invoice Services ---

export const saveInvoice = async (orderId, orderData) => {
  try {
    const invoiceRef = doc(db, 'invoices', orderId);
    
    const items = orderData.items || [];
    const subtotal = orderData.subtotal || 0;
    const deliveryCharge = orderData.deliveryCharge || 0;
    const totalPrice = orderData.totalPrice || 0;
    
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

    // Fetch store details to snapshot them on the invoice
    let businessDetails = {
      name: "SMKP TRADERS",
      ownerName: "Kaviyarasan Murugan",
      phone: "9677417185",
      email: "kaviyarasanmurugan78@gmail.com",
      address: "Pommalappatti",
      state: "Tamil Nadu",
      country: "India"
    };

    try {
      const storeDetails = await getStoreSettings();
      if (storeDetails) {
        businessDetails = {
          name: storeDetails.name || businessDetails.name,
          ownerName: storeDetails.ownerName || businessDetails.ownerName,
          phone: storeDetails.phone || businessDetails.phone,
          email: storeDetails.email || businessDetails.email,
          address: storeDetails.address || businessDetails.address,
          state: storeDetails.state || businessDetails.state,
          country: storeDetails.country || businessDetails.country
        };
      }
    } catch (e) {
      console.warn("Failed to retrieve store settings for invoice snapshot, using default:", e);
    }
    
    const invoiceData = {
      orderId: orderId,
      invoiceNumber: `INV-${orderId.slice(-8).toUpperCase()}`,
      invoiceDate: formattedDate,
      paymentMethod: orderData.paymentMethod || 'COD',
      paymentStatus: orderData.paymentStatus || 'Pending',
      customerName: orderData.customerName || orderData.name || 'Customer',
      phone: orderData.phone || '',
      email: orderData.customerDetails?.email || orderData.userEmail || '',
      address: orderData.address || '',
      city: orderData.city || '',
      district: orderData.district || orderData.customerDetails?.district || '',
      state: orderData.state || orderData.customerDetails?.state || '',
      pincode: orderData.pincode || '',
      landmark: orderData.landmark || orderData.customerDetails?.landmark || '',
      userId: orderData.userId || 'guest',
      businessDetails: businessDetails,
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
        subtotal: subtotal,
        discount: items.reduce((acc, item) => acc + (Number(item.price || 0) > Number(item.effectivePrice || 0) ? (Number(item.price) - Number(item.effectivePrice)) * Number(item.quantity || 1) : 0), 0),
        couponDiscount: Number(orderData.couponDiscount || 0),
        shipping: deliveryCharge,
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

// -----------------------------------------------------------------------------
//  COMPLAINT SERVICES
// -----------------------------------------------------------------------------

export const submitComplaint = async (complaintData) => {
  try {
    const complaintsRef = collection(db, 'complaints');
    const docRef = await addDoc(complaintsRef, {
      ...complaintData,
      status: 'New',
      priority: 'Medium',
      adminNotes: '',
      adminReply: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await createComplaintNotification(docRef.id, complaintData);
    return docRef.id;
  } catch (error) {
    console.error('Error submitting complaint:', error);
    throw error;
  }
};

export const getComplaintsByUser = async (identifier) => {
  try {
    const q = query(
      collection(db, 'complaints'),
      where('customerPhone', '==', identifier),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching user complaints:', error);
    return [];
  }
};

export const getAllComplaints = async () => {
  try {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching all complaints:', error);
    return [];
  }
};

export const getComplaintById = async (complaintId) => {
  try {
    const docRef = doc(db, 'complaints', complaintId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
  } catch (error) {
    console.error('Error fetching complaint:', error);
    return null;
  }
};

export const updateComplaint = async (complaintId, updates) => {
  try {
    const docRef = doc(db, 'complaints', complaintId);
    await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error('Error updating complaint:', error);
    throw error;
  }
};

export const deleteComplaint = async (id) => {
  try {
    await deleteDoc(doc(db, 'complaints', id));
  } catch (error) {
    console.error('Error deleting complaint:', error);
    throw error;
  }
};

export const createComplaintNotification = async (complaintId, complaintData) => {
  try {
    const notifRef = collection(db, 'adminNotifications');
    const message = `New Complaint from ${complaintData.customerName || 'Customer'}\nOrder: #${(complaintData.orderId || '').slice(-8).toUpperCase()}\nType: ${complaintData.complaintType || 'General'}\nDetails: ${(complaintData.description || '').slice(0, 120)}`;
    await addDoc(notifRef, {
      type: 'complaint',
      complaintId,
      orderId: complaintData.orderId || '',
      customerName: complaintData.customerName || '',
      customerPhone: complaintData.customerPhone || '',
      complaintType: complaintData.complaintType || '',
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating complaint notification:', error);
  }
};

export const getUnreadComplaintCount = async () => {
  try {
    const q = query(
      collection(db, 'adminNotifications'),
      where('type', '==', 'complaint'),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    console.error('Error fetching notification count:', error);
    return 0;
  }
};

export const markComplaintNotificationsRead = async () => {
  try {
    const q = query(
      collection(db, 'adminNotifications'),
      where('type', '==', 'complaint'),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch (error) {
    console.error('Error marking notifications read:', error);
  }
};
