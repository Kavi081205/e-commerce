import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldCheck, MapPin, Plus, Home, Briefcase, Trash2, Smartphone, Tag, X } from 'lucide-react';
import { createOrder, getDeliveryCharge, saveInvoice } from '../firebase/services';
import PageHeader from '../components/PageHeader';
import { useNotification } from '../context/NotificationContext';
import { usePromo } from '../context/PromoContext';
import { getEffectivePrice } from '../utils/pricing';
import OrderSuccessPopup from '../components/OrderSuccessPopup';
import { generateInvoice } from '../utils/invoiceGenerator';
import { getOptimizedImage } from '../utils/cloudinary';
import { motion, AnimatePresence } from 'framer-motion';
import { logPurchase } from '../utils/analytics';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const Checkout = () => {
  const { cart, getCartTotal, clearCart, removeFromCart } = useCart();
  const { promoSettings } = usePromo();
  const { currentUser, updateProfile } = useAuth();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  const [addresses, setAddresses] = useState(currentUser?.addresses || []);
  const [selectedAddressId, setSelectedAddressId] = useState(currentUser?.defaultAddressId || null);
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

  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [deliveryZone, setDeliveryZone] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [buyNowItem, setBuyNowItem] = useState(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [couponData, setCouponData] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => {
    if (currentUser?.addresses) {
      setAddresses(currentUser.addresses);
      if (!selectedAddressId && currentUser.addresses.length > 0) {
        setSelectedAddressId(currentUser.defaultAddressId || currentUser.addresses[0].id);
      }
    }
  }, [currentUser, selectedAddressId]);

  useEffect(() => {
    const item = localStorage.getItem('buyNow');
    if (item) {
      setBuyNowItem(JSON.parse(item));
    }
  }, []);

  useEffect(() => {
    const activeAddress = addresses.find(a => a.id === selectedAddressId) || (showNewAddressForm ? formData : null);
    if (activeAddress?.pincode && String(activeAddress.pincode).trim().length === 6) {
      const details = getDeliveryCharge(activeAddress.pincode);
      setDeliveryCharge(details.charge);
      setDeliveryZone(details.zone);
      setDeliveryDays(details.days);
    } else {
      setDeliveryCharge(0);
      setDeliveryZone('');
      setDeliveryDays('');
    }
  }, [selectedAddressId, addresses, formData.pincode, showNewAddressForm]);

  useEffect(() => {
    const hasBuyNow = !!localStorage.getItem('buyNow');
    if (cart.length === 0 && !loading && !hasBuyNow) {
      navigate('/cart', { replace: true });
    }
  }, [cart.length, loading, navigate]);

  useEffect(() => {
    let active = true;
    const validateCartProducts = async () => {
      const hasBuyNow = localStorage.getItem('buyNow');
      let itemsToValidate = [];
      let isBuyNow = false;
      
      if (hasBuyNow) {
        try {
          itemsToValidate = [JSON.parse(hasBuyNow)];
          isBuyNow = true;
        } catch (e) {
          console.error("Failed to parse buyNow item", e);
        }
      } else {
        itemsToValidate = [...cart];
      }

      if (itemsToValidate.length === 0) return;

      const invalidProductIds = [];
      
      for (const item of itemsToValidate) {
        let productId = item.productId || item.id || item.docId || item._id || item.uid;
        if (productId && typeof productId === 'string' && productId.includes('_')) {
          productId = productId.split('_')[0];
        }
        if (!productId) continue;
        
        console.log("Product ID:", productId);
        console.log("Checkout ID:", productId);
        const firestorePath = `products/${productId}`;
        console.log("Firestore Path:", firestorePath);
        
        try {
          const productDoc = await getDoc(
            doc(db, "products", productId)
          );
          if (!active) return;
          console.log("Firestore Exists Result:", productDoc.exists());
          if (!productDoc.exists()) {
            invalidProductIds.push(item.id);
          }
        } catch (err) {
          console.error(`Firestore query failed for path: ${firestorePath}`, err);
        }
      }

      if (invalidProductIds.length > 0) {
        console.error(`Invalid product IDs found on mount: ${invalidProductIds.join(", ")}`);
        showToast("One or more products in your cart are no longer available. Please review your cart.", "error");
        
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
    const newAddress = { ...formData, id: Date.now().toString() };
    const updatedAddresses = [...addresses, newAddress];
    try {
      await updateProfile({
        addresses: updatedAddresses,
        defaultAddressId: selectedAddressId || newAddress.id
      });
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
      const nextDefaultId = currentUser?.defaultAddressId === id
        ? (updatedAddresses[0]?.id || null)
        : currentUser?.defaultAddressId;

      await updateProfile({ 
        addresses: updatedAddresses,
        defaultAddressId: nextDefaultId || null
      });
      
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
          const response = await fetch(`https://api.postalpincode.in/pincode/${code}`);
          if (!response.ok) {
            const errorBody = await response.text();
            console.error("Request URL:", response.url);
            console.error("Status Code:", response.status);
            console.error("Response Body:", errorBody);
            throw new Error(`Pincode API failed with status ${response.status}`);
          }
          const data = await response.json();
          if (data && data[0] && data[0].Status === "Success") {
            const details = data[0].PostOffice[0];
            setFormData(prev => ({
              ...prev,
              city: `${details.District}, ${details.State}`
            }));
            showToast(`Location found: ${details.District}`, "success");
          } else {
            console.error("Request URL:", response.url);
            console.error("Status Code:", response.status);
            console.error("Response Body:", JSON.stringify(data));
          }
        } catch (error) {
          console.error("Pincode API error", error);
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
        
        console.log("Product ID:", productId);
        console.log("Checkout ID:", productId);
        const firestorePath = `products/${productId}`;
        console.log("Firestore Path:", firestorePath);
        
        try {
          const productDoc = await getDoc(
            doc(db, "products", productId)
          );
          console.log("Firestore Exists Result:", productDoc.exists());
          if (productDoc.exists()) {
            validItems.push(item);
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
      const subtotal = buyNowItem ? getEffectivePrice(buyNowItem, promoSettings) : validItems.reduce((acc, item) => acc + getEffectivePrice(item, promoSettings) * item.quantity, 0);
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
          price: Number(item.price), // Store original price
          effectivePrice: sellingPrice, // Store the price it was sold at
          profit: itemProfit, 
          quantity: item.quantity || 1,
          color: item.color || '',
          selectedColor: item.selectedColor || item.color || '',
          size: item.size || ''
        };
      });

      const orderData = {
        name: activeAddress.name,
        phone: activeAddress.phone,
        address: activeAddress.address,
        city: activeAddress.city,
        pincode: activeAddress.pincode,
        userId: currentUser?.uid || 'guest',
        items: enrichedItems,
        subtotal: subtotal,
        couponCode: couponData?.code || null,
        couponDiscount: couponDiscount || 0,
        deliveryCharge: deliveryCharge,
        deliveryZone: deliveryZone || 'Standard Zone',
        estimatedDeliveryDays: deliveryDays || '--',
        totalPrice: Math.max(0, finalTotal),
        profit: totalProfit,
        userEmail: currentUser?.email || 'unknown',
        createdAt: new Date(),
        status: 'ordered',
        paymentMethod: 'COD',
        paymentStatus: 'Pending',
        orderStatus: 'ordered'
      };

      const cartItems = cart;
      const payload = orderData;
      console.log("Cart Items:", cartItems);
      console.log("Checkout Payload:", payload);

      let finalOrderId = null;

      // Create order using local Firebase service
      finalOrderId = await createOrder(orderData);

      // Save invoice to Firestore
      try {
        await saveInvoice(finalOrderId, orderData);
      } catch (invErr) {
        console.error("Failed to save invoice to Firestore:", invErr);
      }

      // Track purchase event in Firebase Analytics
      await logPurchase(finalOrderId, orderData.totalPrice, enrichedItems);

      // Auto generate and download the invoice PDF
      try {
        await generateInvoice({ ...orderData, id: finalOrderId });
      } catch (pdfErr) {
        console.error("Failed to auto-generate PDF invoice:", pdfErr);
      }

      if (buyNowItem) {
        localStorage.removeItem('buyNow');
      } else {
        clearCart();
      }

      const itemsList = orderData.items.map(item => `- ${item.name} (x${item.quantity})`).join('\n');
      const message = `NEW ORDER RECEIVED!\n\n` +
        `Customer: ${orderData.name}\n` +
        `Contact: ${orderData.phone}\n\n` +
        `Products:\n${itemsList}\n\n` +
        `Total Amount: Rs.${orderData.totalPrice}\n` +
        `Delivery Address: ${orderData.address}, ${orderData.city} - ${orderData.pincode}\n\n` +
        `Payment Mode: ${orderData.paymentMethod} (${orderData.paymentStatus})\n\n` +
        `Please process this order. Thank you!`;

      const adminPhone = "919677417185";
      const whatsappUrl = `https://wa.me/${adminPhone}?text=${encodeURIComponent(message)}`;

      setPlacedOrder({ id: finalOrderId, total: orderData.totalPrice });
      setShowSuccess(true);

      setTimeout(() => {
        window.open(whatsappUrl, "_blank");
      }, 500);

      showToast("Order placed successfully!", "success");
    } catch (error) {
      console.error("Checkout error:", error);
      if (error.message === "This product is no longer available") {
        showToast("One or more products in your cart are no longer available. Please review your cart.", "error");
      } else {
        showToast(error.message || "Failed to place order", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const activeItems = buyNowItem ? [buyNowItem] : cart;
  if (activeItems.length === 0 && !loading && !showSuccess) return null;

  const subtotal = buyNowItem ? (getEffectivePrice(buyNowItem, promoSettings) * (buyNowItem.quantity || 1)) : getCartTotal();
  const total = Math.max(0, subtotal + deliveryCharge - couponDiscount);

  return (
    <>
      <div className="bg-black min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <PageHeader
            title="Secure Checkout"
            breadcrumbs={[
              { label: 'Cart', path: '/cart' },
              { label: 'Checkout', path: '/checkout' }
            ]}
          />

          <div className="flex flex-col lg:flex-row gap-16 mt-16">
            <div className="lg:w-2/3 space-y-12">
              <div className="bg-gray-900/30 backdrop-blur-xl rounded-[3rem] border border-yellow-900/10 overflow-hidden shadow-2xl">
                <div className="px-10 py-8 bg-black/40 border-b border-yellow-900/10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <MapPin size={20} className="text-yellow-500" />
                    <h2 className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Delivery Address</h2>
                  </div>
                  <button
                    onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                    className="flex items-center gap-2 text-[9px] font-black text-yellow-500 uppercase tracking-widest hover:bg-yellow-500/5 px-5 py-2.5 rounded-full border border-yellow-500/20 transition-all"
                  >
                    {showNewAddressForm ? 'Cancel' : <><Plus size={16} /> New Address</>}
                  </button>
                </div>

                <div className="p-10">
                  {showNewAddressForm ? (
                    <form onSubmit={handleAddNewAddress} className="space-y-8 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="md:col-span-2">
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] ml-1 mb-4 block">Address Type</p>
                          <div className="flex gap-4">
                            {['Home', 'Office', 'Other'].map(type => (
                              <button
                                key={type}
                                type="button"
                                aria-pressed={formData.type === type}
                                onClick={() => setFormData(prev => ({ ...prev, type }))}
                                className={`flex-1 py-4 px-6 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 ${formData.type === type ? 'border-yellow-500 bg-yellow-500/5 text-yellow-500' : 'border-white/5 text-gray-600'}`}
                              >
                                {type === 'Home' && <Home size={14} />}
                                {type === 'Office' && <Briefcase size={14} />}
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="address-name" className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Identity</label>
                          <input
                            id="address-name"
                            name="name"
                            placeholder="Full Name"
                            required
                            autoComplete="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-yellow-900/20 rounded-2xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="address-phone" className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Contact Channel</label>
                          <input
                            id="address-phone"
                            name="phone"
                            placeholder="Phone Number"
                            required
                            autoComplete="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-yellow-900/20 rounded-2xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all"
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <label htmlFor="address-street" className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Physical Coordinates</label>
                          <textarea
                            id="address-street"
                            name="address"
                            placeholder="Street, Suite, Landmark"
                            required
                            autoComplete="street-address"
                            value={formData.address}
                            onChange={handleChange}
                            rows="3"
                            className="w-full bg-black/50 border border-yellow-900/20 rounded-2xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all resize-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="address-city" className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">City / Region</label>
                          <input
                            id="address-city"
                            name="city"
                            placeholder="City"
                            required
                            autoComplete="address-level2"
                            value={formData.city}
                            onChange={handleChange}
                            className="w-full bg-black/50 border border-yellow-900/20 rounded-2xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="address-pincode" className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Postal Registry</label>
                          <input
                            id="address-pincode"
                            name="pincode"
                            placeholder="6-Digit Pincode"
                            required
                            autoComplete="postal-code"
                            value={formData.pincode}
                            onChange={handlePincodeChange}
                            maxLength="6"
                            className="w-full bg-black/50 border border-yellow-900/20 rounded-2xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all"
                          />
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-yellow-500 text-black font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-[10px] shadow-2xl shadow-yellow-500/10 active:scale-95 transition-all">
                        Deliver to this Address
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          onClick={() => setSelectedAddressId(addr.id)}
                          className={`relative p-8 rounded-[2rem] border transition-all cursor-pointer ${selectedAddressId === addr.id ? 'border-yellow-500 bg-yellow-500/5' : 'border-white/5 bg-black/20 hover:border-white/10'}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex gap-6">
                              <div className={`mt-1.5 w-5 h-5 rounded-full border flex items-center justify-center ${selectedAddressId === addr.id ? 'border-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'border-gray-800'}`}>
                                {selectedAddressId === addr.id && <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />}
                              </div>
                              <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-[8px] font-black uppercase tracking-[0.2em] bg-white/5 text-gray-500 px-2.5 py-1 rounded">
                                    {addr.type}
                                  </span>
                                  <p className="font-black text-white text-sm uppercase tracking-wider">{addr.name}</p>
                                </div>
                                <p className="text-xs text-gray-500 font-bold leading-relaxed uppercase tracking-widest max-w-md">{addr.address}, {addr.city} - {addr.pincode}</p>
                                <p className="text-[10px] font-black text-yellow-500/60 flex items-center gap-3 uppercase tracking-widest">
                                  <Smartphone size={14} /> {addr.phone}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteAddress(addr.id); }}
                              className="p-2 text-gray-800 hover:text-red-500 transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {addresses.length === 0 && (
                        <div className="text-center py-20 flex flex-col items-center justify-center">
                          <MapPin size={48} className="text-gray-900 mx-auto mb-6" />
                          <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px] mb-6">No saved addresses found</p>
                          <button
                            type="button"
                            onClick={() => setShowNewAddressForm(true)}
                            className="bg-yellow-500 text-black px-8 py-3.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] hover:bg-yellow-600 transition-all active:scale-95"
                          >
                            Add New Address
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
 
              <div className="bg-gray-900/30 backdrop-blur-xl rounded-[3rem] border border-yellow-900/10 p-10 shadow-2xl space-y-6">
                <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.5em] mb-10 ml-1">Payment Method</p>
                
                <div className="w-full text-left bg-black/40 border border-yellow-500 bg-yellow-500/5 rounded-[2rem] p-10 flex items-start transition-all">
                  <div className="p-4 rounded-2xl mr-8 shadow-2xl bg-yellow-500 text-black shadow-yellow-500/10">
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <p className="font-black text-white uppercase tracking-[0.3em] text-sm mb-4">Cash On Delivery (COD)</p>
                    <p className="text-xs text-gray-500 mt-2 font-medium leading-relaxed uppercase tracking-widest max-w-lg">
                      Secure cash payment on delivery. Our logistics partner will verify the order details upon arrival. Complete the payment during collection.
                    </p>
                  </div>
                </div>
              </div>
            </div>
 
            <div className="lg:w-1/3">
              <div className="bg-gray-900/50 backdrop-blur-2xl rounded-[3rem] p-10 border border-yellow-900/20 shadow-2xl sticky top-32">
                <h2 className="text-[10px] font-black text-white uppercase tracking-[0.5em] mb-12 border-b border-white/5 pb-8">
                  Order Summary
                </h2>
 
                <div className="space-y-8 mb-12 max-h-[30vh] overflow-y-auto pr-4 custom-scrollbar">
                  {activeItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/5 flex-shrink-0">
                        <img
                          src={getOptimizedImage(item.image, 'thumbnail')}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover grayscale-[0.2]"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-black text-white truncate uppercase tracking-widest">{item.name}</p>
                        <div className="flex flex-wrap gap-2 text-[9px] font-black text-gray-600 uppercase tracking-widest">
                          <span>Qty: {item.quantity || 1}</span>
                          {(item.selectedColor || item.color) && (
                            <span>• Color: {typeof (item.selectedColor || item.color) === 'object' ? (item.selectedColor || item.color).name : (item.selectedColor || item.color)}</span>
                          )}
                          {item.size && (
                            <span>• Size: {item.size}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-black text-white">Rs.{(getEffectivePrice(item, promoSettings) * (item.quantity || 1)).toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Coupon Code */}
                <div className="mb-10 pb-10 border-b border-white/5">
                  <p className="text-[10px] font-black text-yellow-500/80 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                    <Tag size={14} /> Coupon Code
                  </p>
                  {couponData ? (
                    <div className="flex items-center justify-between bg-green-500/5 border border-green-500/20 rounded-2xl px-5 py-4">
                      <div>
                        <p className="font-black text-green-400 text-sm tracking-widest">{couponData.code}</p>
                        <p className="text-[9px] text-green-500/60 font-bold uppercase tracking-widest mt-0.5">
                          {couponData.discountType === 'percentage' ? `${couponData.discountValue}%` : `₹${couponData.discountValue}`} OFF applied
                        </p>
                      </div>
                      <button type="button" onClick={removeCoupon} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                        onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                        placeholder="Enter coupon code"
                        className="flex-1 bg-black/50 border border-yellow-900/30 text-white rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none focus:border-yellow-500 transition-all placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
                      />
                      <button
                        type="button"
                        onClick={applyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="px-5 py-3 bg-yellow-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {couponLoading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <p className="text-red-400 text-[10px] font-bold mt-2 uppercase tracking-widest">{couponError}</p>
                  )}
                </div>

                <div className="space-y-6 pt-10 border-t border-white/5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-white">Rs.{subtotal.toLocaleString()}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-green-400 flex items-center gap-1"><Tag size={10} /> Coupon Discount</span>
                      <span className="text-green-400">- Rs.{couponDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-gray-500">Shipping Charge</span>
                    <span className="text-yellow-500">
                      {deliveryCharge === 0 ? 'CALCULATING...' : `Rs.${deliveryCharge.toLocaleString()}`}
                    </span>
                  </div>
                  {deliveryZone && (
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest animate-fadeIn">
                      <span className="text-gray-500">Delivery Zone</span>
                      <span className="text-white">{deliveryZone}</span>
                    </div>
                  )}
                  {deliveryDays && (
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest animate-fadeIn">
                      <span className="text-gray-500">Estimated Delivery</span>
                      <span className="text-yellow-500/80">{deliveryDays}</span>
                    </div>
                  )}
                  <div className="pt-10 mt-6 border-t-2 border-dashed border-yellow-900/20 flex justify-between items-center">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Total Value</span>
                    <span className="text-3xl font-black gold-text tracking-tighter">Rs.{total.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={placeOrder}
                  disabled={loading || (!selectedAddressId && !showNewAddressForm)}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] transition-all shadow-2xl mt-12 flex items-center justify-center gap-4 active:scale-95 ${loading || (!selectedAddressId && !showNewAddressForm)
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                      : 'bg-yellow-500 text-black shadow-yellow-500/20 hover:scale-[1.02]'
                    }`}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Place Order'}
                </button>

                <div className="mt-10 p-6 bg-black/40 rounded-[1.5rem] border border-yellow-500/10 flex items-start gap-4">
                  <ShieldCheck className="text-yellow-500 mt-1 flex-shrink-0" size={16} />
                  <p className="text-[8px] font-black text-gray-600 uppercase leading-relaxed tracking-widest">
                    High-Grade Security Encryption active. Secure terminal for encrypted data transfer.
                  </p>
                </div>
              </div>
            </div>
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