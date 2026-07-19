import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Trash2, Plus, Minus, ArrowRight, ShoppingCart, Gift, Tag, Copy, Check } from 'lucide-react';

import { usePromo } from '../context/PromoContext';
import { getEffectivePrice } from '../utils/pricing';
import { getOptimizedImage } from '../utils/cloudinary';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=75';

const Cart = () => {
  const { cart, removeFromCart, updateQuantity, cartTotal, getCartTotal, clearCart } = useCart();
  const { promoSettings } = usePromo();
  const { settings, welcomeOffer } = useSiteSettings();
  const { currentUser } = useAuth();
  const { showToast } = useNotification();
  const [isEligible, setIsEligible] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkEligibility = async () => {
      let phone = '';
      try {
        const stored = localStorage.getItem('guest_addresses');
        const addresses = stored ? JSON.parse(stored) : [];
        const defaultId = localStorage.getItem('guest_defaultAddressId');
        const defaultAddress = addresses.find(a => a.id === defaultId) || addresses[0];
        if (defaultAddress?.phone) {
          phone = defaultAddress.phone;
        }
      } catch (err) {
        console.warn("Failed to retrieve default address phone for eligibility check:", err);
      }

      const userId = currentUser?.uid;
      const code = welcomeOffer?.code || 'FIRSTORDER';
      
      try {
        if (userId) {
          const q1 = query(collection(db, 'orders'), where('userId', '==', userId), where('status', '==', 'delivered'));
          const snap1 = await getDocs(q1);
          if (!snap1.empty) {
            setIsEligible(false);
            return;
          }
          const q2 = query(collection(db, 'orders'), where('userId', '==', userId), where('couponCode', '==', code));
          const snap2 = await getDocs(q2);
          const hasUsed = snap2.docs.some(doc => doc.data().status !== 'cancelled');
          if (hasUsed) {
            setIsEligible(false);
            return;
          }
        }

        if (phone) {
          const q3 = query(collection(db, 'orders'), where('phone', '==', phone), where('status', '==', 'delivered'));
          const snap3 = await getDocs(q3);
          if (!snap3.empty) {
            setIsEligible(false);
            return;
          }
          const q4 = query(collection(db, 'orders'), where('phone', '==', phone), where('couponCode', '==', code));
          const snap4 = await getDocs(q4);
          const hasUsed = snap4.docs.some(doc => doc.data().status !== 'cancelled');
          if (hasUsed) {
            setIsEligible(false);
            return;
          }
        }
      } catch (err) {
        console.error("Error checking welcome offer eligibility in Cart:", err);
      }
      setIsEligible(true);
    };

    if (welcomeOffer?.enabled) {
      checkEligibility();
    }
  }, [currentUser, welcomeOffer]);
  const FREE_DELIVERY_THRESHOLD = settings?.delivery?.freeAbove ?? 499;
  const FIXED_DELIVERY_CHARGE = settings?.delivery?.charge ?? 29;
  const total = cartTotal ?? getCartTotal?.() ?? 0;
  const navigate = useNavigate();

  const getMaxStock = (item) => {
    if (!item.variants || item.variants.length === 0) return Number(item.stock || 0);
    const colorName = typeof item.color === 'object' ? item.color.name : item.color;
    const variant = item.variants.find(v => (v.colorName || v.color) === colorName);
    if (!variant) return Number(item.stock || 0);
    if (item.size && variant.sizes) {
      return Number(variant.sizes[item.size] || 0);
    }
    return Number(variant.stock || 0);
  };

  const handleClearCart = () => {
    if (window.confirm('Remove all items from your cart?')) {
      clearCart();
    }
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 bg-black">
        <div className="w-64 h-64 bg-gray-900/50 rounded-full flex items-center justify-center mb-10 border border-yellow-900/10 shadow-2xl">
          <ShoppingCart size={80} className="text-yellow-500/20" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-4 tracking-tight">Your cart is empty</h2>
        <p className="text-gray-500 mb-10 text-center max-w-md font-normal">
          Your shopping cart is empty. Explore our collections to find your favorite products.
        </p>
        <Link
          to="/products"
          className="bg-white text-black font-semibold py-3.5 px-8 rounded-full transition-all hover:bg-yellow-500 active:scale-95 text-[15px] tracking-wider"
        >
          Explore Collection
        </Link>
      </div>
    );
  }

  const getSubtotalMRP = () => {
    return cart.reduce((acc, item) => {
      const origUnit = Number(item.originalPrice ?? item.price ?? 0) + (item.priceDifference || 0);
      return acc + (origUnit * item.quantity);
    }, 0);
  };

  const subtotalMRP = getSubtotalMRP();
  const discountVal = subtotalMRP - total;
  const deliveryCharge = total >= FREE_DELIVERY_THRESHOLD ? 0 : FIXED_DELIVERY_CHARGE;
  const amountToFreeDelivery = FREE_DELIVERY_THRESHOLD - total;

  return (
    <div className="bg-black min-h-screen pb-32 lg:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="mb-8 lg:mb-16">
          <p className="text-yellow-500 text-[9px] font-semibold uppercase tracking-[0.25em] mb-4">Selection</p>
          <h1 className="text-product md:text-product-sm lg:text-[27px] font-semibold text-white tracking-normal">Shopping Cart</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
          <div className="flex-1 space-y-6">
            <div className="bg-gray-900/30 backdrop-blur-xl rounded-3xl border border-yellow-900/10 overflow-hidden">
              <ul className="divide-y divide-yellow-900/10">
                {cart.map((item) => {
                  const maxStock = getMaxStock(item);
                  const effPrice = getEffectivePrice(item, promoSettings);
                  const origPrice = Number(item.originalPrice ?? item.price ?? 0) + (item.priceDifference || 0);
                  const discountPercent = origPrice > effPrice ? Math.round(((origPrice - effPrice) / origPrice) * 100) : 0;

                  return (
                    <li key={item.id} className="p-4 sm:p-8 flex flex-col sm:flex-row gap-4 sm:gap-8 group text-left">
                      <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border border-white/5 flex-shrink-0 bg-black">
                        <img
                          src={getOptimizedImage(item.image, 'thumbnail', FALLBACK_IMAGE)}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>

                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h3 className="text-sm sm:text-base font-medium text-white group-hover:text-yellow-500 transition-colors line-clamp-1" style={{ textTransform: 'none' }}>
                                <Link to={`/product/${item.productId || item.id}`}>{item.name}</Link>
                              </h3>
                              <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-widest mt-0.5">{item.category || 'Product'}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-semibold text-white">₹{(effPrice * item.quantity).toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                            {item.color && (
                              <span>Color: <strong className="text-white font-semibold">{typeof item.color === 'object' ? item.color.name : item.color}</strong></span>
                            )}
                            {item.size && (
                              <span>Size: <strong className="text-white font-semibold">{item.size}</strong></span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-semibold text-white">₹{effPrice.toLocaleString()}</span>
                            {discountPercent > 0 && (
                              <>
                                <span className="text-xs text-gray-500 line-through font-normal">₹{origPrice.toLocaleString()}</span>
                                <span className="text-xs text-green-500 font-semibold">{discountPercent}% off</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap justify-between items-center gap-4">
                          <div className="flex items-center bg-black border border-yellow-900/20 rounded-xl overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              aria-label={`Decrease quantity of ${item.name}`}
                              className="p-2.5 text-gray-500 hover:text-yellow-500 transition-colors"
                            >
                              {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                            </button>
                            <span className="w-10 text-center text-xs font-semibold text-white">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= maxStock}
                              aria-label={`Increase quantity of ${item.name}`}
                              className="p-2.5 text-gray-500 hover:text-yellow-500 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-widest">
                            {item.quantity >= maxStock && (
                              <span className="text-red-500">Max Stock</span>
                            )}
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-gray-500 hover:text-red-500 flex items-center gap-1.5 transition-colors"
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="bg-black/20 p-6 flex justify-end">
                <button
                  onClick={handleClearCart}
                  className="text-gray-500 hover:text-red-500 text-[10px] font-semibold uppercase tracking-widest transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="sticky top-32 space-y-6">
              
              {/* Welcome Offer Coupon Suggestion */}
              {welcomeOffer?.enabled && isEligible && (!welcomeOffer?.expiryDate || new Date(welcomeOffer.expiryDate) >= new Date()) && (
                <div className="bg-gray-900/50 backdrop-blur-2xl rounded-3xl border border-yellow-500/20 p-6 shadow-[0_4px_24px_rgba(234,179,8,0.03)] animate-fadeIn text-left">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="w-10 h-10 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Gift size={20} className="stroke-[1.5]" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Welcome Offer Available</h3>
                      <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-widest mt-0.5">First-time customers save extra</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-black/40 border border-yellow-900/20 rounded-2xl p-4 flex flex-col items-center text-center">
                      <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-widest mb-1.5">Save flat ₹{welcomeOffer.discountAmount} on minimum order of ₹{welcomeOffer.minOrderValue}</p>
                      <span className="font-mono text-base font-semibold text-yellow-400 tracking-[0.15em] uppercase border border-yellow-500/30 px-4 py-2 rounded-xl bg-yellow-500/5 shadow-inner">
                        {welcomeOffer.code}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(welcomeOffer.code);
                        setCopied(true);
                        showToast(`Coupon ${welcomeOffer.code} copied successfully!`, 'success');
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-black font-semibold py-3.5 rounded-xl text-[15px] uppercase tracking-wider hover:bg-yellow-400 transition-colors shadow-lg active:scale-95"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'COPIED TO CLIPBOARD' : 'COPY COUPON CODE'}
                    </button>
                  </div>
                </div>
              )}

              {/* Price Details */}
              <div className="bg-gray-900/50 backdrop-blur-2xl rounded-3xl border border-yellow-900/20 p-6 lg:p-10">
                <h2 className="text-[10px] font-semibold text-white uppercase tracking-[0.5em] mb-6 lg:mb-10">Price Details</h2>

              <div className="space-y-6 mb-8 lg:mb-10">
                <div className="flex justify-between text-gray-500 text-xs font-semibold uppercase tracking-widest">
                  <span>Price ({cart.reduce((acc, i) => acc + i.quantity, 0)} items)</span>
                  <span>₹{subtotalMRP.toLocaleString()}</span>
                </div>
                {discountVal > 0 && (
                  <div className="flex justify-between text-green-500 text-xs font-semibold uppercase tracking-widest">
                    <span>Discount</span>
                    <span>- ₹{discountVal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500 text-xs font-semibold uppercase tracking-widest">
                  <span>Delivery Charges</span>
                  {deliveryCharge === 0
                    ? <span className="text-green-400 font-semibold">FREE DELIVERY</span>
                    : <span className="text-yellow-500">₹{deliveryCharge.toLocaleString()}</span>
                  }
                </div>
                {amountToFreeDelivery > 0 && (
                  <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-semibold text-yellow-400 uppercase tracking-widest">
                      Add ₹{amountToFreeDelivery.toLocaleString()} more to unlock FREE DELIVERY
                    </p>
                  </div>
                )}
                <div className="border-t border-yellow-900/10 pt-6 flex justify-between items-baseline">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Total Amount</span>
                  <span className="text-price lg:text-[15px] font-semibold gold-text leading-none">₹{(total + deliveryCharge).toLocaleString()}</span>
                </div>
                {discountVal > 0 && (
                  <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-4 text-center mt-4">
                    <p className="text-[10px] font-semibold text-green-500 uppercase tracking-widest">
                      You will save ₹{discountVal.toLocaleString()} on this order
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  // Clear any stale buyNow item so the full cart is used in checkout
                  localStorage.removeItem('buyNow');
                  navigate('/checkout');
                }}
                className="hidden lg:flex w-full bg-yellow-500 text-black font-semibold py-4 rounded-2xl items-center justify-center transition-all hover:scale-[1.02] active:scale-95 shadow-2xl uppercase tracking-wider text-[15px]"
              >
                Proceed to Checkout <ArrowRight size={16} className="ml-3" />
              </button>

              <div className="mt-8 text-center hidden lg:block">
                <p className="text-[9px] text-gray-700 font-semibold uppercase tracking-[0.2em]">Secure End-to-End Encrypted Transfer</p>
              </div>
            </div>
            </div> {/* Closing sticky top-32 wrapper */}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Footer Checkout Bar */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-950 border-t border-yellow-900/20 px-4 flex items-center justify-between shadow-2xl"
        style={{
          paddingTop: '12px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))'
        }}
      >
        <div className="text-left">
          <p className="text-[8px] text-gray-500 font-semibold uppercase tracking-widest">Total Amount</p>
          <p className="text-price font-semibold text-white leading-none">₹{(total + deliveryCharge).toLocaleString()}</p>
        </div>
        <button
          onClick={() => {
            // Clear any stale buyNow item so the full cart is used in checkout
            localStorage.removeItem('buyNow');
            navigate('/checkout');
          }}
          className="bg-yellow-500 text-black font-semibold py-3.5 px-8 rounded-xl text-[15px] uppercase tracking-wider hover:bg-yellow-400 transition-colors shadow-lg active:scale-95"
        >
          PLACE ORDER
        </button>
      </div>
    </div>
  );
};

export default Cart;