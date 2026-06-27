import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Loader2, ShieldCheck, MapPin, Plus, Home, Briefcase, Trash2, Smartphone, Tag, X, ChevronRight, CreditCard, Package, CheckCircle2, Edit2 } from 'lucide-react';
import { createOrder, saveInvoice } from '../firebase/services';
import PageHeader from '../components/PageHeader';
import { useNotification } from '../context/NotificationContext';
import { usePromo } from '../context/PromoContext';
import { getEffectivePrice } from '../utils/pricing';
import { useSiteSettings } from '../context/SiteSettingsContext';
import OrderSuccessPopup from '../components/OrderSuccessPopup';
import { generateInvoice } from '../utils/invoiceGenerator';
import { getOptimizedImage } from '../utils/cloudinary';
import { motion, AnimatePresence } from 'framer-motion';
import { logPurchase } from '../utils/analytics';
import { logOrderEvent } from '../utils/activityLog';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { validatePhone, validatePincode, validateName } from '../utils/security';
import { getProductById } from '../firebase/services';

const API_BASE = import.meta.env.VITE_API_URL || '';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const Checkout = () => {
  const { cart, getCartTotal, clearCart, removeFromCart } = useCart();

  const { promoSettings } = usePromo();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('online');

  const [addresses, setAddresses] = useState(() => {
    try {
      const stored = localStorage.getItem('guest_addresses');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [selectedAddressId, setSelectedAddressId] = useState(() => {
    return localStorage.getItem('guest_defaultAddressId') || null;
  });
  const [showNewAddressForm, setShowNewAddressForm] = useState(addresses.length === 0);
  const [addressToDelete, setAddressToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
    type: 'Home'
  });

  const { settings } = useSiteSettings();
  const FREE_DELIVERY_THRESHOLD = settings?.delivery?.freeAbove ?? 499;
  const FIXED_DELIVERY_CHARGE = settings?.delivery?.charge ?? 29;
  const [buyNowItem, setBuyNowItem] = useState(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [couponData, setCouponData] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const getSelectedState = () => {
    const selected = addresses.find(a => a.id === selectedAddressId);
    const addr = showNewAddressForm ? formData : selected;
    if (!addr) return '';
    const cityVal = addr.city || '';
    const parts = cityVal.split(',').map(s => s.trim());
    const parsedState = parts[1] || '';
    return (addr.state || parsedState || '').trim();
  };

  const isTamilNadu = (() => {
    const stateStr = getSelectedState().toLowerCase().replace(/\s/g, '');
    return !getSelectedState() || stateStr === 'tamilnadu' || stateStr === 'tn';
  })();

  useEffect(() => {
    if (!isTamilNadu && paymentMethod === 'cod') {
      setPaymentMethod('online');
    }
  }, [isTamilNadu, paymentMethod]);



  useEffect(() => {
    const raw = localStorage.getItem('buyNow');
    if (!raw) return;

    // If the user already has cart items, the buyNow key is stale from a
    // previous "Buy Now" session. Clear it so the full cart is used.
    if (cart.length > 0) {
      localStorage.removeItem('buyNow');
      setBuyNowItem(null);
      return;
    }

    // Genuine Buy Now flow — cart is empty, single product checkout.
    try {
      setBuyNowItem(JSON.parse(raw));
    } catch (e) {
      console.error('Failed to parse buyNow item', e);
      localStorage.removeItem('buyNow');
    }
  }, [cart.length]);

  // Delivery charge is computed from subtotal — no side-effect needed.

  useEffect(() => {
    const hasBuyNow = !!localStorage.getItem('buyNow');
    if (cart.length === 0 && !loading && !hasBuyNow) {
      navigate('/cart', { replace: true });
    }
  }, [cart.length, loading, navigate]);

  useEffect(() => {
    let active = true;
    const validateCartProducts = async () => {
      // Determine what to validate: full cart takes priority; fall back to
      // buyNow only when the cart is genuinely empty (true Buy Now flow).
      let itemsToValidate = [];
      let isBuyNow = false;

      if (cart.length > 0) {
        itemsToValidate = [...cart];
      } else {
        const hasBuyNow = localStorage.getItem('buyNow');
        if (hasBuyNow) {
          try {
            itemsToValidate = [JSON.parse(hasBuyNow)];
            isBuyNow = true;
          } catch (e) {
            console.error('Failed to parse buyNow item', e);
          }
        }
      }

      if (itemsToValidate.length === 0) return;

      const invalidProductIds = [];

      for (const item of itemsToValidate) {
        let productId = item.productId || item.id || item.docId || item._id || item.uid;
        if (productId && typeof productId === 'string' && productId.includes('_')) {
          productId = productId.split('_')[0];
        }
        if (!productId) continue;

        const firestorePath = `products/${productId}`;

        try {
          const productData = await getProductById(productId);
          if (!active) return;
          if (!productData) {
            invalidProductIds.push(item.id);
          }
        } catch (err) {
          console.error(`Firestore query failed for path: ${firestorePath}`, err);
        }
      }

      if (invalidProductIds.length > 0) {
        console.error(`Invalid product IDs found on mount: ${invalidProductIds.join(', ')}`);
        showToast('One or more products in your cart are no longer available. Please review your cart.', 'error');

        if (isBuyNow) {
          localStorage.removeItem('buyNow');
          setBuyNowItem(null);
          navigate('/cart', { replace: true });
        } else {
          invalidProductIds.forEach(id => removeFromCart(id));
        }
      }
    };

    if (cart.length > 0 || localStorage.getItem('buyNow')) {
      validateCartProducts();
    }
    return () => {
      active = false;
    };
  }, [cart, removeFromCart, navigate, showToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddNewAddress = async (e) => {
    e.preventDefault();

    // ── Validate form fields before saving ──────────────────────────────────
    const nameCheck    = validateName(formData.name);
    const phoneCheck   = validatePhone(formData.phone);
    const pincodeCheck = validatePincode(formData.pincode);

    if (!nameCheck.valid) { showToast(nameCheck.message, 'error'); return; }
    if (!phoneCheck.valid) { showToast(phoneCheck.message, 'error'); return; }
    if (!formData.address || formData.address.trim().length < 5) {
      showToast('Please enter a complete street address (min 5 characters)', 'error');
      return;
    }
    if (!pincodeCheck.valid) { showToast(pincodeCheck.message, 'error'); return; }

    const newAddress = { ...formData, id: Date.now().toString() };
    const updatedAddresses = [...addresses, newAddress];
    try {
      const nextDefaultId = selectedAddressId || newAddress.id;
      localStorage.setItem('guest_addresses', JSON.stringify(updatedAddresses));
      localStorage.setItem('guest_defaultAddressId', nextDefaultId);
      setAddresses(updatedAddresses);
      setSelectedAddressId(newAddress.id);
      setShowNewAddressForm(false);
      setFormData({ name: '', phone: '', address: '', city: '', pincode: '', type: 'Home' });
      showToast("Address added successfully!", "success");
    } catch (error) {
      showToast("Failed to save address", "error");
    }
  };

  const handleDeleteAddress = (id) => {
    if (addresses.length <= 1) {
      showToast("At least one address is required", "error");
      return;
    }
    setAddressToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (!addressToDelete) return;
    setIsDeleting(true);
    const id = addressToDelete;

    if (addresses.length <= 1) {
      showToast("At least one address is required", "error");
      setIsDeleting(false);
      setAddressToDelete(null);
      return;
    }

    const updatedAddresses = addresses.filter(a => a.id !== id);
    try {
      const storedDefaultId = localStorage.getItem('guest_defaultAddressId');
      const nextDefaultId = storedDefaultId === id
        ? (updatedAddresses[0]?.id || null)
        : storedDefaultId;

      localStorage.setItem('guest_addresses', JSON.stringify(updatedAddresses));
      if (nextDefaultId) {
        localStorage.setItem('guest_defaultAddressId', nextDefaultId);
      } else {
        localStorage.removeItem('guest_defaultAddressId');
      }

      setAddresses(updatedAddresses);

      if (selectedAddressId === id) {
        if (updatedAddresses.length > 0) {
          setSelectedAddressId(updatedAddresses[0].id);
        } else {
          setSelectedAddressId(null);
          setShowNewAddressForm(true);
        }
      }
      showToast("Address deleted successfully", "success");
    } catch (error) {
      showToast("Error deleting address", "error");
    } finally {
      setIsDeleting(false);
      setAddressToDelete(null);
    }
  };

  const handlePincodeChange = async (e) => {
    const code = e.target.value.replace(/\D/g, '');
    if (code.length <= 6) {
      setFormData(prev => ({ ...prev, pincode: code }));
      if (code.length === 6) {
        try {
          const response = await fetch(`https://api.apibharat.com/v1/pincode/${code}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors',
          });
          if (!response.ok) {
            throw new Error(`Pincode API failed with status ${response.status}`);
          }
          const resJson = await response.json();
          if (resJson && resJson.success && resJson.data) {
            const details = resJson.data;
            setFormData(prev => ({
              ...prev,
              city: `${details.district}, ${details.state}`
            }));
            showToast(`Location found: ${details.district}`, "success");
          }
        } catch (error) {
          // Silently ignore pincode lookup failures — city can be entered manually
          console.warn("Pincode lookup failed:", error.message);
        }
      }
    }
  };

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError('');
    setCouponData(null);
    setCouponDiscount(0);
    setCouponLoading(true);
    try {
      const q = query(collection(db, 'coupons'), where('code', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) {
        setCouponError('Invalid coupon code.');
        setCouponLoading(false);
        return;
      }
      const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() };
      if (!coupon.isActive) {
        setCouponError('This coupon is not active.');
        setCouponLoading(false);
        return;
      }
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        setCouponError('This coupon has expired.');
        setCouponLoading(false);
        return;
      }
      const currentSubtotal = buyNowItem
        ? getEffectivePrice(buyNowItem, promoSettings) * (buyNowItem.quantity || 1)
        : getCartTotal();
      if (coupon.minOrderAmount > 0 && currentSubtotal < coupon.minOrderAmount) {
        setCouponError(`Minimum order of ₹${Number(coupon.minOrderAmount).toLocaleString()} required.`);
        setCouponLoading(false);
        return;
      }
      const discount = coupon.discountType === 'percentage'
        ? Math.round(currentSubtotal * (coupon.discountValue / 100))
        : Number(coupon.discountValue);
      setCouponData(coupon);
      setCouponDiscount(Math.min(discount, currentSubtotal));
      showToast(`Coupon applied! You save ₹${Math.min(discount, currentSubtotal).toLocaleString()}`, 'success');
    } catch (err) {
      console.error('Coupon apply error:', err);
      setCouponError('Failed to apply coupon. Please try again.');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setCouponData(null);
    setCouponDiscount(0);
    setCouponInput('');
    setCouponError('');
  };

  const placeOrder = async (e) => {
    if (e) e.preventDefault();

    if (!selectedAddressId && !showNewAddressForm) {
      showToast("Please select a delivery address", "error");
      return;
    }

    setLoading(true);
    const activeAddress = showNewAddressForm ? formData : addresses.find(a => a.id === selectedAddressId);

    if (!activeAddress || !activeAddress.name || !activeAddress.address) {
      showToast("Please complete the address form", "error");
      setLoading(false);
      return;
    }

    // ── Validate active address fields ────────────────────────────────────────
    const nameCheck    = validateName(activeAddress.name);
    const phoneCheck   = validatePhone(activeAddress.phone);
    const pincodeCheck = validatePincode(activeAddress.pincode);

    if (!nameCheck.valid)    { showToast(nameCheck.message,    'error'); setLoading(false); return; }
    if (!phoneCheck.valid)   { showToast(phoneCheck.message,   'error'); setLoading(false); return; }
    if (!pincodeCheck.valid) { showToast(pincodeCheck.message, 'error'); setLoading(false); return; }

    try {
      const activeItems = buyNowItem ? [buyNowItem] : cart;

      const invalidProductIds = [];
      const validItems = [];

      // Validate every cart item before order creation.
      for (const item of activeItems) {
        let productId = item.productId || item.id || item.docId || item._id || item.uid;
        if (productId && typeof productId === 'string' && productId.includes('_')) {
          productId = productId.split('_')[0];
        }
        if (!productId) continue;

        const firestorePath = `products/${productId}`;

        try {
          const productDoc = await getDoc(
            doc(db, "products", productId)
          );
          if (productDoc.exists()) {
            const productData = productDoc.data();
            validItems.push({
              ...item,
              costPrice: Number(productData.costPrice ?? productData.cost ?? productData.price ?? 0)
            });
          } else {
            invalidProductIds.push(item.id);
          }
        } catch (err) {
          console.error(`Firestore query failed for path: ${firestorePath}`, err);
          invalidProductIds.push(item.id);
        }
      }

      if (invalidProductIds.length > 0) {
        console.error(`Invalid product IDs found during checkout: ${invalidProductIds.join(", ")}`);
        showToast("One or more products in your cart are no longer available. We have removed them for you.", "error");

        if (buyNowItem) {
          localStorage.removeItem('buyNow');
          setBuyNowItem(null);
          setLoading(false);
          navigate('/cart', { replace: true });
          return;
        } else {
          invalidProductIds.forEach(id => removeFromCart(id));
        }

        // If no valid items left, stop checkout
        if (validItems.length === 0) {
          setLoading(false);
          return;
        }
      }

      // Continue checkout with remaining validItems
      const subtotal = buyNowItem ? (getEffectivePrice(buyNowItem, promoSettings) * (buyNowItem.quantity || 1)) : validItems.reduce((acc, item) => acc + getEffectivePrice(item, promoSettings) * (item.quantity || 1), 0);
      const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : FIXED_DELIVERY_CHARGE;
      const finalTotal = subtotal + deliveryCharge - couponDiscount;

      let totalProfit = 0;
      const enrichedItems = validItems.map(item => {
        const sellingPrice = getEffectivePrice(item, promoSettings);
        const costPrice = Number(item.costPrice ?? item.cost ?? item.price ?? 0);
        const itemProfit = (sellingPrice - costPrice) * (item.quantity || 1);
        totalProfit += itemProfit;
        let itemId = item.id || item.docId || item._id || item.uid;
        let baseProductId = item.productId || itemId.split('_')[0];
        return {
          id: itemId,
          productId: baseProductId,
          name: item.name,
          image: item.image || '',
          price: Number(item.originalPrice ?? item.price ?? 0), // Store original price
          effectivePrice: sellingPrice, // Store the price it was sold at
          costPrice: costPrice, // Store actual cost price
          profit: itemProfit,
          quantity: item.quantity || 1,
          color: item.color || '',
          selectedColor: item.selectedColor || item.color || '',
          size: item.size || ''
        };
      });

      const cityVal = activeAddress.city || '';
      const parts = cityVal.split(',').map(s => s.trim());
      const parsedDistrict = parts[0] || '';
      const parsedState = parts[1] || '';

      const orderData = {
        name: activeAddress.name,
        phone: activeAddress.phone,
        address: activeAddress.address,
        city: activeAddress.city,
        pincode: activeAddress.pincode,
        landmark: activeAddress.landmark || '',
        district: activeAddress.district || parsedDistrict,
        state: activeAddress.state || parsedState,
        userId: 'guest',
        items: enrichedItems,
        subtotal: subtotal,
        couponCode: couponData?.code || null,
        couponDiscount: couponDiscount || 0,
        deliveryCharge: deliveryCharge,
        deliveryZone: subtotal >= FREE_DELIVERY_THRESHOLD ? 'Free Delivery' : 'Standard',
        estimatedDeliveryDays: '--',
        totalPrice: Math.max(0, finalTotal),
        profit: totalProfit - couponDiscount,
        userEmail: 'unknown',
        createdAt: new Date(),
        status: 'ordered',
        paymentMethod: paymentMethod === 'online' ? "ONLINE PAYMENT" : "COD",
        paymentStatus: "Pending",
        orderStatus: 'ordered',
        customerDetails: {
          name: activeAddress.name,
          phone: activeAddress.phone,
          email: 'unknown',
          address: activeAddress.address,
          district: activeAddress.district || parsedDistrict,
          state: activeAddress.state || parsedState,
          pincode: activeAddress.pincode,
          landmark: activeAddress.landmark || ''
        },
        orderedItems: enrichedItems.map(item => {
          const price = Number(item.effectivePrice || item.price || 0);
          const qty = Number(item.quantity || 1);
          return {
            productId: item.productId || item.id || '',
            productName: item.name,
            image: item.image || '',
            color: typeof item.color === 'object' ? item.color.name : (item.selectedColor || item.color || ''),
            size: item.size || '',
            quantity: qty,
            price: price,
            total: Number(item.total || (price * qty))
          };
        })
      };

      // ── Duplicate order guard ──────────────────────────────────────────────
      // Prevent accidental double-submission: reject if an identical order was
      // placed by this user within the last 60 seconds.
      // Duplicate order check bypassed for Guest checkout

      const executeOrderCreation = async (payloadData) => {
        console.log('[Checkout] Starting final order save to database. Payload:', payloadData);
        const finalOrderId = await createOrder(payloadData);
        console.log('[Checkout] Final order saved successfully. Database Order ID:', finalOrderId);

        // Log order creation to activity trail
        try {
          await logOrderEvent(finalOrderId, 'order_created', {
            userId: 'guest',
            totalPrice: payloadData.totalPrice,
            itemCount: payloadData.items?.length,
            paymentMethod: payloadData.paymentMethod,
          });
        } catch (_) { /* non-critical */ }

        // Save invoice to Firestore
        try {
          await saveInvoice(finalOrderId, payloadData);
        } catch (invErr) {
          console.error("Failed to save invoice to Firestore:", invErr);
        }

        // Track purchase event in Firebase Analytics
        await logPurchase(finalOrderId, payloadData.totalPrice, enrichedItems);

        // Auto generate and download the invoice PDF
        try {
          await generateInvoice({ ...payloadData, id: finalOrderId });
        } catch (pdfErr) {
          console.error("Failed to auto-generate PDF invoice:", pdfErr);
        }

        if (buyNowItem) {
          localStorage.removeItem('buyNow');
        } else {
          clearCart();
        }

        const itemsList = payloadData.items.map(item => `- ${item.name} (x${item.quantity})`).join('\n');
        const message = `NEW ORDER RECEIVED!\n\n` +
          `Customer: ${payloadData.name}\n` +
          `Contact: ${payloadData.phone}\n\n` +
          `Products:\n${itemsList}\n\n` +
          `Total Amount: Rs.${payloadData.totalPrice}\n` +
          `Delivery Address: ${payloadData.address}, ${payloadData.city} - ${payloadData.pincode}\n\n` +
          `Payment Mode: ${payloadData.paymentMethod} (${payloadData.paymentStatus})\n\n` +
          `Please process this order. Thank you!`;

        const adminPhone = "919677417185";
        const whatsappUrl = `https://wa.me/${adminPhone}?text=${encodeURIComponent(message)}`;

        setPlacedOrder({ id: finalOrderId, total: payloadData.totalPrice });
        setShowSuccess(true);

        setTimeout(() => {
          window.open(whatsappUrl, "_blank");
        }, 500);

        showToast("Order placed successfully!", "success");
      };

      if (paymentMethod === 'online') {
        const amountInPaise = Math.round(Math.max(0, finalTotal) * 100);
        const requestUrl = `${API_BASE}/api/create-order`;
        const requestBody = JSON.stringify({ amount: amountInPaise });
        console.log('[Checkout] Request URL:', requestUrl);
        console.log('[Checkout] Request Body:', requestBody);

        const orderResponse = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: requestBody,
        });

        console.log('[Checkout] Response Status:', orderResponse.status);
        const responseText = await orderResponse.text();
        console.log('[Checkout] Response Body:', responseText);

        if (!orderResponse.ok) {
          let parsedError = responseText;
          try {
            const errJson = JSON.parse(responseText);
            if (errJson.description) {
              parsedError = `${errJson.message}: ${errJson.description} (Code: ${errJson.code})`;
            } else {
              parsedError = errJson.message || errJson.error || responseText;
            }
          } catch (_) {}
          throw new Error(parsedError);
        }

        const orderDataResult = JSON.parse(responseText);
        if (!orderDataResult.success || !orderDataResult.order || !orderDataResult.order.id) {
          throw new Error('Invalid response received from payment server');
        }

        const razorpayOrder = orderDataResult.order;
        console.log('[Checkout] Razorpay order initialized:', razorpayOrder);

        // Load Razorpay SDK Script
        const isSDKLoaded = await loadRazorpayScript();
        if (!isSDKLoaded) {
          throw new Error('Failed to load Razorpay SDK. Please check your internet connection.');
        }

        // Step 6: Define options using ONLY the specified fields: key, amount, currency, order_id, name, description, prefill, theme, handler, modal
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
          amount: Number(razorpayOrder.amount),
          currency: String(razorpayOrder.currency || 'INR'),
          order_id: String(razorpayOrder.id),
          name: 'SMKP TRADERS',
          description: 'E-Commerce Order Payment',
          prefill: {
            name: String(activeAddress.name),
            contact: String(activeAddress.phone),
            email: 'guest@smkptraders.com'
          },
          theme: {
            color: '#eab308'
          },
          handler: async function (response) {
            try {
              setLoading(true);
              console.log('[Checkout] Razorpay payment successful. Response data:', response);

              const verifyUrl = `${API_BASE}/api/verify-payment`;
              const verifyBody = JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              console.log('[Checkout] Request URL:', verifyUrl);
              console.log('[Checkout] Request Body:', verifyBody);

              const verifyResponse = await fetch(verifyUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: verifyBody,
              });

              console.log('[Checkout] Response Status:', verifyResponse.status);
              const verifyResponseText = await verifyResponse.text();
              console.log('[Checkout] Response Body:', verifyResponseText);

              if (!verifyResponse.ok) {
                let parsedError = verifyResponseText;
                try {
                  const errJson = JSON.parse(verifyResponseText);
                  parsedError = errJson.message || errJson.error || verifyResponseText;
                } catch (_) {}
                throw new Error(parsedError);
              }

              const verifyData = JSON.parse(verifyResponseText);
              console.log('[Checkout] Signature verification result:', verifyData);

              if (verifyData && verifyData.success) {
                // Step 8: Only AFTER successful verification, save order to Firebase, generate invoice, etc.
                const enrichedOrderData = {
                  ...orderData,
                  paymentMethod: 'ONLINE PAYMENT',
                  paymentStatus: 'Paid',
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                };
                await executeOrderCreation(enrichedOrderData);
              } else {
                throw new Error(verifyData.error || 'Payment verification failed');
              }
            } catch (verificationError) {
              console.error('[Checkout] Signature verification failed:', verificationError);
              showToast(verificationError.message || 'Signature verification failed. Order not placed.', 'error');
            } finally {
              setLoading(false);
            }
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
              showToast('Payment window closed.', 'error');
            }
          }
        };

        console.log('[Checkout] Initializing Razorpay Checkout with options:', { ...options, key: options.key ? options.key.substring(0, 8) + '...' : 'undefined' });
        const razor = new window.Razorpay(options);
        console.log('[Checkout] Razorpay Checkout widget created. Opening iframe...');
        razor.open();
      } else {
        // Cash on Delivery
        await executeOrderCreation(orderData);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      if (error.message === "This product is no longer available") {
        showToast("One or more products in your cart are no longer available. Please review your cart.", "error");
      } else {
        showToast(error.message || "Failed to place order", "error");
      }
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const activeItems = buyNowItem ? [buyNowItem] : cart;
  if (activeItems.length === 0 && !loading && !showSuccess) return null;

  const subtotal = buyNowItem ? (getEffectivePrice(buyNowItem, promoSettings) * (buyNowItem.quantity || 1)) : getCartTotal();
  const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : FIXED_DELIVERY_CHARGE;
  const amountToFreeDelivery = FREE_DELIVERY_THRESHOLD - subtotal;
  const total = Math.max(0, subtotal + deliveryCharge - couponDiscount);
  const getSubtotalMRP = () => {
    if (buyNowItem) {
      const origUnit = Number(buyNowItem.originalPrice ?? buyNowItem.price ?? 0) + (buyNowItem.priceDifference || 0);
      return origUnit * (buyNowItem.quantity || 1);
    }
    return cart.reduce((acc, item) => {
      const origUnit = Number(item.originalPrice ?? item.price ?? 0) + (item.priceDifference || 0);
      return acc + (origUnit * item.quantity);
    }, 0);
  };

  const subtotalMRP = getSubtotalMRP();
  const totalSavings = (subtotalMRP - subtotal) + couponDiscount;

  const steps = [
    { id: 1, label: 'Address', icon: MapPin },
    { id: 2, label: 'Summary', icon: Package },
    { id: 3, label: 'Payment', icon: CreditCard },
  ];

  const selectedAddr = addresses.find(a => a.id === selectedAddressId);

  const stepVariants = {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { opacity: 0, x: -40, transition: { duration: 0.2, ease: 'easeIn' } },
  };

  return (
    <>
      <div className="bg-black min-h-screen pb-[200px] md:pb-28 text-left">
        {/* ── Progress Stepper ── */}
        <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl border-b border-yellow-900/20 shadow-lg shadow-black/40">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = checkoutStep === step.id;
              const isDone = checkoutStep > step.id;
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => isDone && setCheckoutStep(step.id)}
                    className={`flex flex-col items-center gap-1.5 transition-all ${isDone ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isDone
                        ? 'bg-yellow-500 border-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.4)]'
                        : isActive
                          ? 'bg-yellow-500/10 border-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.3)]'
                          : 'bg-transparent border-gray-800'
                      }`}>
                      {isDone
                        ? <CheckCircle2 size={16} className="text-black" />
                        : <Icon size={15} className={isActive ? 'text-yellow-500' : 'text-gray-700'} />
                      }
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${isActive ? 'text-yellow-500' : isDone ? 'text-yellow-600' : 'text-gray-700'
                      }`}>{step.label}</span>
                  </button>
                  {idx < steps.length - 1 && (
                    <div className={`flex-1 h-px mx-2 transition-all duration-500 ${checkoutStep > step.id ? 'bg-yellow-500/60' : 'bg-gray-800'
                      }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6">

          <AnimatePresence mode="wait">

            {/* ── STEP 1: ADDRESS ── */}
            {checkoutStep === 1 && (
              <motion.div key="step1" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                      <MapPin size={15} className="text-yellow-500" /> Delivery Address
                    </h2>
                    <button
                      onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                      className="flex items-center gap-1.5 text-[9px] font-black text-yellow-500 uppercase tracking-widest border border-yellow-500/25 hover:bg-yellow-500/5 px-3 py-1.5 rounded-full transition-all"
                    >
                      {showNewAddressForm ? 'Cancel' : <><Plus size={12} /> Add New</>}
                    </button>
                  </div>

                  {showNewAddressForm ? (
                    <form onSubmit={handleAddNewAddress} className="bg-gray-900/40 border border-yellow-900/15 rounded-2xl p-5 space-y-5">
                      {/* Type selector */}
                      <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Address Type</p>
                        <div className="flex gap-3">
                          {['Home', 'Office', 'Other'].map(type => (
                            <button key={type} type="button" aria-pressed={formData.type === type}
                              onClick={() => setFormData(prev => ({ ...prev, type }))}
                              className={`flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${formData.type === type ? 'border-yellow-500 bg-yellow-500/8 text-yellow-500' : 'border-white/5 text-gray-600'
                                }`}
                            >
                              {type === 'Home' && <Home size={12} />}{type === 'Office' && <Briefcase size={12} />}{type}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label htmlFor="address-name" className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Full Name</label>
                          <input id="address-name" name="name" placeholder="Full Name" required autoComplete="name"
                            value={formData.name} onChange={handleChange}
                            className="w-full bg-black/60 border border-yellow-900/20 rounded-xl px-3.5 py-3 text-white text-xs outline-none focus:border-yellow-500 transition-all" />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="address-phone" className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Phone</label>
                          <input id="address-phone" name="phone" placeholder="Phone Number" required autoComplete="tel"
                            value={formData.phone} onChange={handleChange}
                            className="w-full bg-black/60 border border-yellow-900/20 rounded-xl px-3.5 py-3 text-white text-xs outline-none focus:border-yellow-500 transition-all" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <label htmlFor="address-street" className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Street / Area</label>
                          <textarea id="address-street" name="address" placeholder="Door No, Street, Landmark" required autoComplete="street-address"
                            value={formData.address} onChange={handleChange} rows="2"
                            className="w-full bg-black/60 border border-yellow-900/20 rounded-xl px-3.5 py-3 text-white text-xs outline-none focus:border-yellow-500 transition-all resize-none" />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="address-city" className="text-[9px] font-black text-gray-500 uppercase tracking-widest">City / District</label>
                          <input id="address-city" name="city" placeholder="City" required autoComplete="address-level2"
                            value={formData.city} onChange={handleChange}
                            className="w-full bg-black/60 border border-yellow-900/20 rounded-xl px-3.5 py-3 text-white text-xs outline-none focus:border-yellow-500 transition-all" />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="address-pincode" className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Pincode</label>
                          <input id="address-pincode" name="pincode" placeholder="6-Digit Pincode" required autoComplete="postal-code"
                            value={formData.pincode} onChange={handlePincodeChange} maxLength="6"
                            className="w-full bg-black/60 border border-yellow-900/20 rounded-xl px-3.5 py-3 text-white text-xs outline-none focus:border-yellow-500 transition-all" />
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-yellow-500 text-black font-black py-3.5 rounded-xl uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-yellow-500/15 active:scale-95 transition-all">
                        Save &amp; Deliver Here
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      {addresses.map(addr => (
                        <div key={addr.id} onClick={() => setSelectedAddressId(addr.id)}
                          className={`relative p-4 rounded-2xl border transition-all cursor-pointer ${selectedAddressId === addr.id
                              ? 'border-yellow-500 bg-yellow-500/5 shadow-[0_0_16px_rgba(234,179,8,0.08)]'
                              : 'border-white/5 bg-black/20 hover:border-white/10'
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedAddressId === addr.id ? 'border-yellow-500' : 'border-gray-700'
                              }`}>
                              {selectedAddressId === addr.id && <div className="w-2 h-2 bg-yellow-500 rounded-full" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[7px] font-black uppercase tracking-widest bg-white/5 text-gray-600 px-2 py-0.5 rounded">{addr.type}</span>
                                <p className="font-black text-white text-xs uppercase tracking-wider">{addr.name}</p>
                              </div>
                              <p className="text-[10px] text-gray-500 leading-relaxed">{addr.address}, {addr.city} – {addr.pincode}</p>
                              <p className="text-[9px] font-black text-yellow-500/50 mt-1.5 flex items-center gap-1.5">
                                <Smartphone size={10} /> {addr.phone}
                              </p>
                            </div>
                            <button onClick={e => { e.stopPropagation(); handleDeleteAddress(addr.id); }}
                              className="p-1.5 text-gray-700 hover:text-red-500 transition-all flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {addresses.length === 0 && (
                        <div className="text-center py-16 flex flex-col items-center">
                          <MapPin size={36} className="text-gray-800 mb-4" />
                          <p className="text-gray-600 font-black uppercase tracking-widest text-[9px] mb-4">No saved addresses</p>
                          <button onClick={() => setShowNewAddressForm(true)}
                            className="bg-yellow-500 text-black px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all active:scale-95">
                            Add Address
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: ORDER SUMMARY ── */}
            {checkoutStep === 2 && (
              <motion.div key="step2" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
                <div className="space-y-4">
                  {/* Selected address peek */}
                  {selectedAddr && (
                    <div className="flex items-start justify-between bg-yellow-500/5 border border-yellow-500/20 rounded-2xl px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <MapPin size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">{selectedAddr.name}</p>
                          <p className="text-[9px] text-gray-500 mt-0.5">{selectedAddr.address}, {selectedAddr.city} – {selectedAddr.pincode}</p>
                        </div>
                      </div>
                      <button onClick={() => setCheckoutStep(1)}
                        className="text-[9px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-all">
                        <Edit2 size={11} /> Change
                      </button>
                    </div>
                  )}

                  {/* Product list */}
                  <div>
                    <h2 className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                      <Package size={13} className="text-yellow-500" /> Order Items ({activeItems.reduce((a, i) => a + (i.quantity || 1), 0)})
                    </h2>
                    <div className="space-y-3">
                      {activeItems.map(item => (
                        <div key={item.id} className="flex items-center gap-4 bg-gray-900/40 border border-white/5 rounded-2xl p-4">
                          <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/5 flex-shrink-0">
                            <img src={getOptimizedImage(item.image, 'thumbnail')} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-white truncate uppercase tracking-wider">{item.name}</p>
                            <div className="flex flex-wrap gap-2 mt-1.5 text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                              <span>Qty: {item.quantity || 1}</span>
                              {(item.selectedColor || item.color) && (
                                <span>• {typeof (item.selectedColor || item.color) === 'object' ? (item.selectedColor || item.color).name : (item.selectedColor || item.color)}</span>
                              )}
                              {item.size && <span>• {item.size}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-yellow-500">₹{(getEffectivePrice(item, promoSettings) * (item.quantity || 1)).toLocaleString()}</p>
                            <p className="text-[9px] text-gray-700 mt-0.5">₹{getEffectivePrice(item, promoSettings).toLocaleString()} each</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coupon */}
                  <div className="bg-gray-900/40 border border-yellow-900/15 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-yellow-500/80 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                      <Tag size={12} /> Coupon Code
                    </p>
                    {couponData ? (
                      <div className="flex items-center justify-between bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-2.5">
                        <div>
                          <p className="font-black text-green-400 text-xs tracking-widest">{couponData.code}</p>
                          <p className="text-[8px] text-green-500/60 font-bold uppercase tracking-widest mt-0.5">
                            {couponData.discountType === 'percentage' ? `${couponData.discountValue}%` : `₹${couponData.discountValue}`} OFF applied
                          </p>
                        </div>
                        <button type="button" onClick={removeCoupon} className="text-gray-600 hover:text-red-400 p-1 transition-colors"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <label htmlFor="coupon-code" className="sr-only">Coupon Code</label>
                        <input id="coupon-code" name="couponCode" type="text" autoComplete="off"
                          value={couponInput}
                          onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                          onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                          placeholder="Enter coupon code"
                          className="flex-1 bg-black/50 border border-yellow-900/30 text-white rounded-xl px-3.5 py-2.5 text-xs font-black uppercase tracking-widest outline-none focus:border-yellow-500 transition-all placeholder:normal-case placeholder:font-normal placeholder:tracking-normal" />
                        <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponInput.trim()}
                          className="px-4 py-2.5 bg-yellow-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-yellow-400 transition-all disabled:opacity-50 flex items-center gap-1">
                          {couponLoading ? <Loader2 size={12} className="animate-spin" /> : 'Apply'}
                        </button>
                      </div>
                    )}
                    {couponError && <p className="text-red-400 text-[9px] font-bold mt-2 uppercase tracking-widest">{couponError}</p>}
                  </div>

                  {/* Price summary */}
                  <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-4 space-y-3">
                    <h3 className="text-[9px] font-black text-white uppercase tracking-[0.3em] border-b border-white/5 pb-2 mb-3">Price Details</h3>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-gray-500">MRP ({activeItems.reduce((a, i) => a + (i.quantity || 1), 0)} items)</span>
                      <span className="text-white">₹{subtotalMRP.toLocaleString()}</span>
                    </div>
                    {totalSavings > couponDiscount && (
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-green-500">Product Discount</span>
                        <span className="text-green-500">- ₹{(subtotalMRP - subtotal).toLocaleString()}</span>
                      </div>
                    )}
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-green-400 flex items-center gap-1"><Tag size={9} /> Coupon</span>
                        <span className="text-green-400">- ₹{couponDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-gray-500">Delivery</span>
                      {deliveryCharge === 0
                        ? <span className="text-green-400 font-black">FREE DELIVERY</span>
                        : <span className="text-yellow-500">₹{deliveryCharge.toLocaleString()}</span>
                      }
                    </div>
                    {amountToFreeDelivery > 0 && (
                      <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest">
                          Add ₹{amountToFreeDelivery.toLocaleString()} more to unlock FREE DELIVERY
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black pt-2 border-t border-white/5">
                      <span className="text-gray-300 uppercase tracking-widest text-[10px]">Total</span>
                      <span className="gold-text text-lg">₹{total.toLocaleString()}</span>
                    </div>
                    {totalSavings > 0 && (
                      <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] font-black text-green-500 uppercase tracking-widest">You save ₹{totalSavings.toLocaleString()} 🎉</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: PAYMENT ── */}
            {checkoutStep === 3 && (
              <motion.div key="step3" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
                <div className="space-y-4">
                  {/* Address & order peek */}
                  {selectedAddr && (
                    <div className="flex items-start justify-between bg-yellow-500/5 border border-yellow-500/20 rounded-2xl px-4 py-3">
                      <div className="flex items-start gap-3">
                        <MapPin size={13} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[9px] font-black text-white uppercase tracking-widest">{selectedAddr.name}</p>
                          <p className="text-[8px] text-gray-600 mt-0.5">{selectedAddr.address}, {selectedAddr.pincode}</p>
                        </div>
                      </div>
                      <button onClick={() => setCheckoutStep(1)} className="text-[8px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-1">
                        <Edit2 size={10} /> Change
                      </button>
                    </div>
                  )}

                  {/* Payment method selection */}
                  <div className="bg-gray-900/40 border border-yellow-900/15 rounded-2xl p-5">
                    <p className="text-[9px] font-black text-yellow-500/80 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                      <CreditCard size={12} /> Payment Method
                    </p>
                    <div className="space-y-3">
                      {/* Online Payment */}
                      <div
                        onClick={() => setPaymentMethod('online')}
                        className={`bg-black/40 border-2 rounded-2xl p-4 flex items-start gap-4 cursor-pointer transition-all ${paymentMethod === 'online'
                            ? 'border-yellow-500 bg-yellow-500/5 shadow-[0_0_16px_rgba(234,179,8,0.1)]'
                            : 'border-white/5 hover:border-white/10'
                          }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${paymentMethod === 'online'
                            ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                            : 'bg-gray-800 text-gray-400'
                          }`}>
                          <CreditCard size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-white uppercase tracking-widest text-xs">Pay Online</p>
                          <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">UPI, Cards, GPay, PhonePe, Netbanking, etc.</p>
                          {paymentMethod === 'online' && (
                            <div className="mt-2.5 flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Selected</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Cash on Delivery */}
                      {isTamilNadu ? (
                        <div
                          onClick={() => setPaymentMethod('cod')}
                          className={`bg-black/40 border-2 rounded-2xl p-4 flex items-start gap-4 cursor-pointer transition-all ${paymentMethod === 'cod'
                              ? 'border-yellow-500 bg-yellow-500/5 shadow-[0_0_16px_rgba(234,179,8,0.1)]'
                              : 'border-white/5 hover:border-white/10'
                            }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${paymentMethod === 'cod'
                              ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                              : 'bg-gray-800 text-gray-400'
                            }`}>
                            <ShieldCheck size={18} />
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-white uppercase tracking-widest text-xs">Cash on Delivery</p>
                            <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">Pay securely when your order arrives at your doorstep.</p>
                            {paymentMethod === 'cod' && (
                              <div className="mt-2.5 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Selected</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="bg-black/25 border-2 border-white/5 border-dashed rounded-2xl p-4 flex items-start gap-4 opacity-40 cursor-not-allowed"
                          title="Cash on Delivery is available only in Tamil Nadu"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-800 text-gray-500">
                            <ShieldCheck size={18} />
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-gray-400 uppercase tracking-widest text-xs">Cash on Delivery</p>
                            <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">Pay securely when your order arrives at your doorstep.</p>
                          </div>
                        </div>
                      )}

                      {!isTamilNadu && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-left">
                          <p className="text-[10px] font-semibold text-red-400">
                            Cash on Delivery is available only in Tamil Nadu. Please use Online Payment.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Final price summary */}
                  <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-4 space-y-3">
                    <h3 className="text-[9px] font-black text-white uppercase tracking-[0.3em] border-b border-white/5 pb-2">Order Total</h3>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-white">₹{subtotal.toLocaleString()}</span>
                    </div>
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-green-400 flex items-center gap-1"><Tag size={9} /> Coupon</span>
                        <span className="text-green-400">- ₹{couponDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-gray-500">Delivery</span>
                      {deliveryCharge === 0
                        ? <span className="text-green-400 font-black">FREE DELIVERY</span>
                        : <span className="text-yellow-500">₹{deliveryCharge.toLocaleString()}</span>
                      }
                    </div>
                    {amountToFreeDelivery > 0 && (
                      <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] font-black text-yellow-400 uppercase tracking-widest">
                          Add ₹{amountToFreeDelivery.toLocaleString()} more to unlock FREE DELIVERY
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-white/5">
                      <span className="text-xs font-black text-gray-300 uppercase tracking-widest">Amount to Pay</span>
                      <span className="text-2xl font-black gold-text">₹{total.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Security badge */}
                  <div className="flex items-center gap-3 p-3.5 bg-black/30 border border-yellow-500/10 rounded-2xl">
                    <ShieldCheck size={16} className="text-yellow-500 flex-shrink-0" />
                    <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest leading-relaxed">
                      256-bit encrypted checkout. Your data is safe.
                    </p>
                  </div>

                  {/* Desktop Place Order */}
                  <button
                    onClick={placeOrder}
                    disabled={loading || (!selectedAddressId && !showNewAddressForm)}
                    className={`hidden md:flex w-full h-[56px] rounded-[14px] font-bold text-base uppercase tracking-wider transition-all duration-300 mt-2 items-center justify-center gap-3 active:scale-95 ${loading || (!selectedAddressId && !showNewAddressForm)
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-yellow-500 text-black shadow-[0_0_24px_rgba(255,196,0,0.3)] hover:shadow-[0_0_30px_rgba(255,196,0,0.45)] hover:scale-[1.02] hover:brightness-110'
                      }`}
                  >
                    {loading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : paymentMethod === 'online' ? (
                      <><CreditCard size={18} /> Pay Online</>
                    ) : (
                      <><ShieldCheck size={18} /> Place Order</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── Sticky Bottom Bar ── */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-[60] bg-gray-950 backdrop-blur-xl border-t border-yellow-900/30 shadow-[0_-4px_24px_rgba(0,0,0,0.6)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="text-left flex-shrink-0">
            <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Total</p>
            <p className="text-xl font-black gold-text">₹{total.toLocaleString()}</p>
          </div>
          <div className="flex-1">
            {checkoutStep === 1 && (
              <button
                onClick={() => {
                  if (!selectedAddressId && !showNewAddressForm) {
                    showToast('Please select or add a delivery address', 'error');
                    return;
                  }
                  setCheckoutStep(2);
                }}
                className="w-full h-[54px] rounded-[14px] bg-yellow-500 text-black font-black text-sm uppercase tracking-wider shadow-[0_0_22px_rgba(255,196,0,0.4)] hover:brightness-110 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
                Continue <ChevronRight size={18} />
              </button>
            )}
            {checkoutStep === 2 && (
              <button
                onClick={() => setCheckoutStep(3)}
                className="w-full h-[54px] rounded-[14px] bg-yellow-500 text-black font-black text-sm uppercase tracking-wider shadow-[0_0_22px_rgba(255,196,0,0.4)] hover:brightness-110 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
                Proceed to Payment <ChevronRight size={18} />
              </button>
            )}
            {checkoutStep === 3 && (
              <button
                onClick={placeOrder}
                disabled={loading || (!selectedAddressId && !showNewAddressForm)}
                className={`w-full h-[54px] rounded-[14px] font-bold text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.97] ${loading || (!selectedAddressId && !showNewAddressForm)
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-yellow-500 text-black shadow-[0_0_24px_rgba(255,196,0,0.45)] hover:brightness-110'
                  }`}>
                {loading ? (
                  <><Loader2 className="animate-spin" size={18} /> Processing...</>
                ) : paymentMethod === 'online' ? (
                  <><CreditCard size={18} /> Pay Online</>
                ) : (
                  <><ShieldCheck size={18} /> Place Order</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {showSuccess && placedOrder && (
          <OrderSuccessPopup
            orderId={placedOrder.id}
            total={placedOrder.total}
            onClose={() => setShowSuccess(false)}
          />
        )}
        {addressToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 border border-yellow-900/30 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl space-y-8 text-center"
            >
              <div className="space-y-4">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                  <Trash2 size={28} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">Confirm Deletion</h3>
                <p className="text-xs text-gray-400 font-bold leading-relaxed uppercase tracking-widest">
                  Are you sure you want to delete this address?
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setAddressToDelete(null)}
                  className="flex-1 py-4 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/5 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-red-600/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Checkout;