import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Star, Truck, ShieldCheck, Loader2, Heart, Gift, Zap, Sparkles, Copy, Check, Calendar, ShoppingCart } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, doc, where, getDoc, getDocs, getCountFromServer, onSnapshot } from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFeaturedProducts, getProductsByIds, getProductById, getCategories } from '../firebase/services';
import LazyImage from '../components/LazyImage';
import { useInView } from 'react-intersection-observer'; // FIX 1: use the canonical hook directly
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import { usePromo } from '../context/PromoContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { isProductSold } from '../utils/productUtils';
import { getEffectivePrice } from '../utils/pricing';
import { getOptimizedImage, getHDImage } from '../utils/cloudinary';
import ProductRating from '../components/ProductRating';
import { useValidatedProducts } from '../hooks/useValidatedProducts';
import DailyNotes from '../components/DailyNotes';

/* ─────────────────────────────────────────────────────────────────
   STATIC DATA (non-category)
───────────────────────────────────────────────────────────────── */

const perks = [
  { icon: Truck, title: 'Logistics', desc: 'Fast & Secure Delivery' },
  { icon: ShieldCheck, title: 'Secure Payments', desc: 'End-to-end encrypted payments' },
  { icon: Star, title: 'Quality Products', desc: 'Only the finest trending products' },
];

/* ─────────────────────────────────────────────────────────────────
   HOOK — Dynamic categories from Firestore
───────────────────────────────────────────────────────────────── */
const useDynamicCategories = () => {
  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      return await getCategories();
    },
    staleTime: 1000 * 60 * 10 // 10 minutes cache
  });

  const categoriesKey = JSON.stringify(categories.map(c => ({ id: c.id, slug: c.slug })));

  const { data: productCounts = {} } = useQuery({
    queryKey: ['categoryCounts', categoriesKey],
    queryFn: async () => {
      if (categories.length === 0) return {};
      const counts = {};
      await Promise.all(
        categories.map(async (cat) => {
          try {
            const q = query(collection(db, 'products'), where('category', '==', cat.slug));
            const countSnap = await getCountFromServer(q);
            counts[cat.id] = countSnap.data().count;
          } catch (err) {
            console.error('Failed to get count for category', cat.slug, err);
            counts[cat.id] = 0;
          }
        })
      );
      return counts;
    },
    enabled: categories.length > 0,
    staleTime: 1000 * 60 * 10 // 10 minutes cache
  });

  return { categories, catLoading, productCounts };
};

/* ─────────────────────────────────────────────────────────────────
   BANNER COUNTDOWN TIMER (compact pill for banner overlay)
─────────────────────────────────────────────────────────────────  */

/** Safely parse any date string including datetime-local (no timezone).
 *  Falls back to space→T replacement for "YYYY-MM-DD HH:MM" format.
 */
const parseOfferDate = (raw) => {
  if (!raw) return NaN;
  let ts = new Date(raw).getTime();
  if (!isNaN(ts)) return ts;
  // Handle "2026-06-05 18:30" stored with a space instead of T
  ts = new Date(String(raw).replace(' ', 'T')).getTime();
  return ts;
};

const calcTimeLeft = (expiryMs) => {
  const distance = expiryMs - Date.now();
  if (distance <= 0) return { expired: true, days: 0, hours: 0, mins: 0, secs: 0 };
  return {
    expired: false,
    days:  Math.floor(distance / 86_400_000),
    hours: Math.floor((distance % 86_400_000) / 3_600_000),
    mins:  Math.floor((distance % 3_600_000)  / 60_000),
    secs:  Math.floor((distance % 60_000)     / 1_000),
  };
};

const BannerCountdown = ({ offer, compact = false }) => {
  // 2. Create proper timer state
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const [expired, setExpired] = useState(false);

  // 4. Add working countdown useEffect
  useEffect(() => {
    if (!offer?.expiryDateTime) return;

    const tick = () => {
      const now = new Date().getTime();
      // 6. Handle timezone and normalization safely
      const rawDate = String(offer.expiryDateTime).replace(' ', 'T');
      const expiryTime = new Date(rawDate).getTime();
      const distance = expiryTime - now;

      if (isNaN(expiryTime) || distance <= 0) {
        setExpired(true);
        return;
      }

      setExpired(false);
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((distance / (1000 * 60)) % 60),
        seconds: Math.floor((distance / 1000) % 60),
      });
    };

    // Run immediately on mount
    tick();

    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [offer?.expiryDateTime]);

  // No expiryDateTime — nothing to count down; hide silently.
  if (!offer?.expiryDateTime) return null;

  if (expired) {
    return (
      <div className="flex items-center justify-center w-full py-2.5">
        <div className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-900/20 text-red-400 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider select-none shadow-[0_0_15px_rgba(239,68,68,0.15)]
        `}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          EXPIRED
        </div>
      </div>
    );
  }

  const d = timeLeft.days.toString().padStart(2, '0');
  const h = timeLeft.hours.toString().padStart(2, '0');
  const m = timeLeft.minutes.toString().padStart(2, '0');
  const s = timeLeft.seconds.toString().padStart(2, '0');

  if (compact) {
    return (
      <div className="flex items-center justify-center w-full py-2.5 select-none font-mono tracking-wide">
        <div className="flex items-center justify-center gap-1 sm:gap-1.5">
          {/* Days Box */}
          <div className="flex items-center justify-center font-semibold rounded-lg border border-yellow-500/35 bg-neutral-950/90 text-white w-[28px] h-[28px] sm:w-[34px] sm:h-[34px] text-[9px] sm:text-[11px] shadow-[0_0_8px_rgba(250,204,21,0.05)]">
            {d}<span className="text-yellow-500 font-semibold ml-0.5 text-[7px] sm:text-[9px]">D</span>
          </div>

          <span className="text-yellow-500/30 font-semibold animate-pulse text-[9px] sm:text-[11px] flex items-center justify-center w-1.5 h-[28px] sm:h-[34px]">:</span>

          {/* Hours Box */}
          <div className="flex items-center justify-center font-semibold rounded-lg border border-yellow-500/35 bg-neutral-950/90 text-white w-[28px] h-[28px] sm:w-[34px] sm:h-[34px] text-[9px] sm:text-[11px] shadow-[0_0_8px_rgba(250,204,21,0.05)]">
            {h}<span className="text-yellow-500 font-semibold ml-0.5 text-[7px] sm:text-[9px]">H</span>
          </div>

          <span className="text-yellow-500/30 font-semibold animate-pulse text-[9px] sm:text-[11px] flex items-center justify-center w-1.5 h-[28px] sm:h-[34px]">:</span>

          {/* Minutes Box */}
          <div className="flex items-center justify-center font-semibold rounded-lg border border-yellow-500/35 bg-neutral-950/90 text-white w-[28px] h-[28px] sm:w-[34px] sm:h-[34px] text-[9px] sm:text-[11px] shadow-[0_0_8px_rgba(250,204,21,0.05)]">
            {m}<span className="text-yellow-500 font-semibold ml-0.5 text-[7px] sm:text-[9px]">M</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-center select-none font-mono tracking-wide gap-3 sm:gap-4 text-xs sm:text-sm md:text-base py-3.5 px-6 rounded-full bg-black/80 border border-yellow-500/35 shadow-[0_0_24px_rgba(250,204,21,0.18)]">
      <span className="font-semibold uppercase tracking-widest text-yellow-400 flex items-center gap-1.5 text-[10px] sm:text-xs mr-1">
        <Zap size={13} className="text-yellow-500 fill-yellow-500 animate-pulse" />
        Ends In:
      </span>

      <div className="flex items-center gap-2">
        {/* Days Box */}
        <div className="flex items-center justify-center font-semibold rounded-lg border border-yellow-500/30 bg-neutral-950/90 text-white px-3 py-1.5 text-xs sm:text-sm min-w-[34px] sm:min-w-[42px] shadow-[0_0_8px_rgba(250,204,21,0.05)]">
          {d}<span className="text-yellow-500 font-semibold ml-0.5">D</span>
        </div>

        <span className="text-yellow-500/30 font-semibold animate-pulse">:</span>

        {/* Hours Box */}
        <div className="flex items-center justify-center font-semibold rounded-lg border border-yellow-500/30 bg-neutral-950/90 text-white px-3 py-1.5 text-xs sm:text-sm min-w-[34px] sm:min-w-[42px] shadow-[0_0_8px_rgba(250,204,21,0.05)]">
          {h}<span className="text-yellow-500 font-semibold ml-0.5">H</span>
        </div>

        <span className="text-yellow-500/30 font-semibold animate-pulse">:</span>

        {/* Minutes Box */}
        <div className="flex items-center justify-center font-semibold rounded-lg border border-yellow-500/30 bg-neutral-950/90 text-white px-3 py-1.5 text-xs sm:text-sm min-w-[34px] sm:min-w-[42px] shadow-[0_0_8px_rgba(250,204,21,0.05)]">
          {m}<span className="text-yellow-500 font-semibold ml-0.5">M</span>
        </div>

        <span className="text-yellow-500/30 font-semibold animate-pulse">:</span>

        {/* Seconds Box */}
        <div className="flex items-center justify-center font-semibold rounded-lg border border-yellow-500/30 bg-neutral-950/90 text-white px-3 py-1.5 text-xs sm:text-sm min-w-[34px] sm:min-w-[42px] shadow-[0_0_8px_rgba(250,204,21,0.05)]">
          {s}<span className="text-yellow-500 font-semibold ml-0.5">S</span>
        </div>
      </div>
    </div>
  );
};


/* ─────────────────────────────────────────────────────────────────
   COUNTDOWN TIMER
───────────────────────────────────────────────────────────────── */
const CountdownTimer = ({ expiryDate }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    if (!expiryDate) return;
    const tick = () => {
      const distance = new Date(expiryDate).getTime() - Date.now();
      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(distance / 86_400_000),
        hours: Math.floor((distance % 86_400_000) / 3_600_000),
        mins: Math.floor((distance % 3_600_000) / 60_000),
        secs: Math.floor((distance % 60_000) / 1_000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiryDate]);

  const isZero = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.mins === 0 && timeLeft.secs === 0;
  if (!expiryDate || isZero) return null;

  return (
    <div className="flex gap-3 mt-4">
      {[
        { label: 'Days', value: timeLeft.days },
        { label: 'Hrs', value: timeLeft.hours },
        { label: 'Min', value: timeLeft.mins },
        { label: 'Sec', value: timeLeft.secs },
      ].map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center">
          <div className="bg-yellow-500/10 backdrop-blur-md border border-yellow-500/20 w-12 h-12 rounded-2xl flex items-center justify-center font-semibold text-yellow-500 text-sm shadow-[0_0_15px_rgba(234,179,8,0.1)]">
            {value.toString().padStart(2, '0')}
          </div>
          <span className="text-[7px] font-semibold text-yellow-600 mt-2 uppercase tracking-[0.2em]">{label}</span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   PRODUCT CARD
   FIX 1: useInView from react-intersection-observer — no more
   duck-typing, always returns { ref, inView }.
───────────────────────────────────────────────────────────────── */
const ProductCard = ({ product, delay = 0, promoSettings }) => {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { showToast } = useNotification();
  const [addingToCart, setAddingToCart] = useState(false);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { settings } = useSiteSettings();

  const handleWishlist = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  }, [product, toggleWishlist]);

  const handleAddToCart = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent?.stopImmediatePropagation) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }

    console.log("ADD TO CART CLICKED", product.id);

    let defaultColor = '';
    let defaultSize = '';
    if (product.variants && product.variants.length > 0) {
      defaultColor = product.variants[0]?.colorName || product.variants[0]?.color || '';
      if (product.variants[0]?.sizes) {
        const sizesKeys = Object.keys(product.variants[0].sizes);
        if (sizesKeys.length > 0) defaultSize = sizesKeys[0];
      }
    } else {
      if (product.colors && product.colors.length > 0) {
        defaultColor = typeof product.colors[0] === 'object' ? product.colors[0].name : product.colors[0];
      }
      if (product.sizes && product.sizes.length > 0) {
        defaultSize = typeof product.sizes[0] === 'object' ? product.sizes[0].name : product.sizes[0];
      }
    }

    addToCart(product, defaultColor, defaultSize, 1);
    showToast('Added to Cart 🛒', 'success');

    setAddingToCart(true);
    setTimeout(() => setAddingToCart(false), 1500);
  }, [product, addToCart, showToast]);

  const effPrice = getEffectivePrice(product, promoSettings);
  const origPrice = Number(product.originalPrice ?? product.price ?? 0);
  const discountPercent = origPrice > effPrice ? Math.round(((origPrice - effPrice) / origPrice) * 100) : 0;

  const showWishlist = settings?.productCard?.showWishlistButton !== false;
  const showStock = settings?.productCard?.showStockBadge !== false;
  const showRating = settings?.productCard?.showRating !== false;
  const showDiscount = settings?.productCard?.showDiscountBadge !== false;
  const showQuickView = settings?.productCard?.showQuickView !== false;

  return (
    <div
      ref={ref}
      className={`bg-gray-900/40 rounded-2xl border border-yellow-900/10 overflow-hidden hover:border-yellow-500/30 transition-all flex flex-col h-full relative group ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      {showWishlist && (
        <button
          type="button"
          onClick={handleWishlist}
          className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            isInWishlist(product.id)
              ? 'bg-yellow-500 text-black'
              : 'bg-black/50 backdrop-blur-sm text-gray-400 hover:text-yellow-500 border border-white/5'
          }`}
          aria-label="Toggle wishlist"
        >
          <Heart size={14} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
        </button>
      )}

      {/* 1. Image Link */}
      <Link
        to={`/product/${product.id}`}
        onClick={() => console.log("PRODUCT CARD CLICKED", product.id)}
        className="block overflow-hidden aspect-square relative bg-black"
      >
        <LazyImage
          src={getOptimizedImage(product.image, 'card')}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          wrapperClass="w-full h-full"
        />
        {showStock && (
          <>
            {isProductSold(product) ? (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60">
                <span className="bg-red-600 text-white text-[9px] font-bold px-3 py-1.5 rounded uppercase tracking-widest shadow-xl rotate-[-10deg]">
                  SOLD OUT
                </span>
              </div>
            ) : (
              <>
                {Number(product.soldCount || 0) >= 50 && (
                  <div className="absolute top-2 left-2 z-10 bg-yellow-500 text-black text-[7px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded shadow">
                    🏆 Best Seller
                  </div>
                )}
                {(() => {
                  const stock = Number(product.stock || 0);
                  if (stock <= 0) {
                    return (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
                        <span className="bg-red-600 text-white text-[8px] font-semibold px-2.5 py-1 rounded uppercase tracking-wider rotate-[-10deg]">
                          Out of Stock
                        </span>
                      </div>
                    );
                  }
                  if (stock === 1) {
                    return (
                      <div className="absolute bottom-2 left-2 z-10 bg-orange-600 text-white text-[8px] font-semibold px-2 py-0.5 rounded shadow uppercase tracking-wider">
                        Only 1 Left
                      </div>
                    );
                  }
                  if (stock === 2) {
                    return (
                      <div className="absolute bottom-2 left-2 z-10 bg-orange-600 text-white text-[8px] font-semibold px-2 py-0.5 rounded shadow uppercase tracking-wider">
                        Only 2 Left
                      </div>
                    );
                  }
                  if (stock === 3) {
                    return (
                      <div className="absolute bottom-2 left-2 z-10 bg-orange-600 text-white text-[8px] font-semibold px-2 py-0.5 rounded shadow uppercase tracking-wider">
                        Only 3 Left
                      </div>
                    );
                  }
                  if (stock >= 4 && stock <= 10) {
                    return (
                      <div className="absolute bottom-2 left-2 z-10 bg-yellow-500 text-black text-[8px] font-semibold px-2 py-0.5 rounded shadow uppercase tracking-wider">
                        Limited Stock
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </>
        )}

        {showQuickView && (
          <div className="absolute bottom-2 inset-x-2 bg-black/70 backdrop-blur-sm py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
            <span className="text-[8px] font-semibold tracking-widest uppercase text-yellow-500">Quick View</span>
          </div>
        )}
      </Link>

      {/* Card Details */}
      <div className="p-3 flex-grow flex flex-col gap-2 bg-black/10">
        <span className="text-[12px] font-semibold text-yellow-500 uppercase tracking-widest">{product.category}</span>
        
        {/* 2. Title Link */}
        <Link
          to={`/product/${product.id}`}
          onClick={() => console.log("PRODUCT CARD CLICKED", product.id)}
          className="block"
        >
          <h3 className="type-product-title text-[#F8F8F8] line-clamp-2 group-hover:text-yellow-500 transition-colors" style={{ textTransform: 'none' }}>
            {product.name}
          </h3>
        </Link>

        {showRating && (
          <div className="flex items-center gap-1.5 my-1">
            <ProductRating productId={product.id} compact={true} />
          </div>
        )}

        <div className="mt-auto pt-2 border-t border-white/5 flex flex-wrap items-baseline gap-2">
          <span className="type-price premium-gold-price text-[#FFD700] leading-none">₹{effPrice.toLocaleString()}</span>
          {showDiscount && discountPercent > 0 && (
            <>
              <span className="text-xs text-gray-500 line-through font-normal">₹{origPrice.toLocaleString()}</span>
              <span className="text-xs text-green-500 font-semibold">{discountPercent}% off</span>
            </>
          )}
          {!showDiscount && discountPercent > 0 && (
            <span className="text-xs text-gray-500 line-through font-normal">₹{origPrice.toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* ── Add to Cart / Out of Stock / SOLD OUT button ── */}
      {isProductSold(product) || Number(product.stock || 0) <= 0 ? (
        <button
          type="button"
          disabled
          className="w-full py-3 bg-gray-800 text-gray-500 text-[10px] font-bold uppercase tracking-[0.15em] cursor-not-allowed flex items-center justify-center gap-2 border-t border-white/5"
          aria-label="Sold out"
        >
          {isProductSold(product) ? 'SOLD OUT' : 'Out of Stock'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleAddToCart}
          className={`w-full py-3 text-[10px] font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 border-t ${
            addingToCart
              ? 'bg-green-500 text-black border-t-green-600'
              : 'bg-yellow-500 text-black hover:bg-yellow-400 border-t-yellow-600'
          }`}
          aria-label="Add to cart"
        >
          {addingToCart ? (
            <>
              <Check size={12} className="flex-shrink-0" />
              Added!
            </>
          ) : (
            <>
              <ShoppingCart size={12} className="flex-shrink-0" />
              Add to Cart
            </>
          )}
        </button>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   WELCOME OFFER BANNER Component
───────────────────────────────────────────────────────────────── */
const WelcomeOfferBanner = ({ welcomeOffer }) => {
  const { showToast } = useNotification();
  const { currentUser } = useAuth();
  const [isEligible, setIsEligible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState(0);

  const expired = welcomeOffer?.expiryDate && new Date(welcomeOffer.expiryDate) < new Date();

  useEffect(() => {
    if (!welcomeOffer?.enabled || expired || !welcomeOffer?.discountAmount) return;
    let start = 0;
    const end = welcomeOffer.discountAmount;
    const duration = 800; // ms
    const incrementTime = Math.max(10, Math.floor(duration / end));
    const timer = setInterval(() => {
      start += 1;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, incrementTime);
    return () => clearInterval(timer);
  }, [welcomeOffer?.discountAmount, welcomeOffer?.enabled, expired]);

  useEffect(() => {
    const checkEligibility = async () => {
      if (currentUser?.uid) {
        try {
          const q = query(
            collection(db, 'orders'),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'delivered')
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            setIsEligible(false);
            return;
          }
          
          if (welcomeOffer?.code) {
            const qCoupon = query(
              collection(db, 'orders'),
              where('userId', '==', currentUser.uid),
              where('couponCode', '==', welcomeOffer.code)
            );
            const snapCoupon = await getDocs(qCoupon);
            const hasUsed = snapCoupon.docs.some(doc => doc.data().status !== 'cancelled');
            if (hasUsed) {
              setIsEligible(false);
              return;
            }
          }
        } catch (err) {
          console.error("Error checking welcome offer eligibility on home:", err);
        }
      }
      setIsEligible(true);
    };

    if (welcomeOffer?.enabled && !expired) {
      checkEligibility();
    }
  }, [currentUser, welcomeOffer, expired]);

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [timerExpired, setTimerExpired] = useState(false);

  useEffect(() => {
    if (!welcomeOffer?.expiryDate) return;
    
    const tick = () => {
      const expiryTime = new Date(welcomeOffer.expiryDate + 'T23:59:59').getTime();
      const now = new Date().getTime();
      const distance = expiryTime - now;
      
      if (isNaN(expiryTime) || distance <= 0) {
        setTimerExpired(true);
        return;
      }
      
      setTimerExpired(false);
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((distance / (1000 * 60)) % 60),
        seconds: Math.floor((distance / 1000) % 60),
      });
    };
    
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [welcomeOffer?.expiryDate]);

  if (!welcomeOffer?.enabled || expired || timerExpired || !isEligible) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(welcomeOffer.code).then(() => {
      setCopied(true);
      showToast(`Coupon ${welcomeOffer.code} copied successfully.`, 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShopNow = () => {
    const el = document.getElementById('products-section') || document.querySelector('section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = '/products';
    }
  };

  return (
    <div className="w-full px-3 sm:px-8 lg:px-8 xl:px-12 mt-6 animate-fadeIn">
      <div className="relative w-full lg:max-w-[1400px] lg:mx-auto rounded-3xl overflow-hidden border border-yellow-500/20 bg-black shadow-[0_12px_40px_rgba(234,179,8,0.07)] p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Radial Luxury Glow background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,119,6,0.12),rgba(0,0,0,0))]" />
        
        {/* Left Column: Gift Icon and Main Offer Text */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left flex-1">
          {/* Glowing Gift Icon with Floating Animation */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex items-center justify-center text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.15)] animate-float flex-shrink-0">
            <Gift size={44} className="stroke-[1.5]" />
          </div>
          
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-semibold uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full shadow-inner">
              🎉 Welcome to SMKP TRADERS
            </span>
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight uppercase leading-none">
                Get ₹{count} OFF on Your First Order
              </h2>
              <p className="text-gray-400 font-semibold uppercase tracking-widest text-[10px] sm:text-xs">
                Coupon Code: {welcomeOffer.code}
              </p>
              <p className="text-gray-500 font-semibold uppercase tracking-widest text-[9px] sm:text-[10px]">
                Minimum Order: ₹{welcomeOffer.minOrderValue}
              </p>
            </div>
            {/* Offer conditions */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-[9px] sm:text-[10px] text-gray-600 font-semibold uppercase tracking-wider">
              <span>• Valid only for first-time customers</span>
              <span>• One use per customer</span>
            </div>
          </div>
        </div>

        {/* Right Column: Code & Countdown Widget */}
        <div className="relative z-10 flex flex-col items-center md:items-end gap-6 flex-shrink-0 w-full md:w-auto">
          {/* Expiry Countdown Clock (if expiryDate is set) */}
          {welcomeOffer.expiryDate && (
            <div className="flex flex-col items-center md:items-end gap-1.5">
              <p className="text-[8px] font-semibold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-1">
                <Calendar size={10} /> OFFER ENDS IN
              </p>
              <div className="flex gap-2">
                {[
                  { label: 'D', val: timeLeft.days },
                  { label: 'H', val: timeLeft.hours },
                  { label: 'M', val: timeLeft.minutes },
                  { label: 'S', val: timeLeft.seconds }
                ].map((t, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div className="w-10 h-10 bg-gray-950 border border-yellow-900/20 rounded-lg flex items-center justify-center text-xs font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.8)] relative overflow-hidden">
                      <div className="absolute inset-x-0 top-0 bottom-1/2 bg-white/5 border-b border-white/5" />
                      <span>{String(t.val).padStart(2, '0')}</span>
                    </div>
                    <span className="text-[7px] font-semibold text-gray-600 mt-1">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coupon Code and CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3.5 w-full sm:w-auto">
            {/* Coupon Code Badge */}
            <div 
              onClick={handleCopy}
              className="group cursor-pointer min-w-[150px] text-center border border-yellow-500/40 hover:border-yellow-400 bg-yellow-500/5 rounded-xl px-4 py-3 flex flex-col justify-center items-center shadow-[0_0_15px_rgba(234,179,8,0.08)] hover:shadow-[0_0_20px_rgba(234,179,8,0.18)] transition-all relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine" style={{ animationDuration: '1.5s' }} />
              <p className="text-[8px] text-gray-500 font-semibold uppercase tracking-widest leading-none mb-1">Coupon Code</p>
              <p className="font-mono text-sm font-semibold text-yellow-400 tracking-[0.15em] uppercase">{welcomeOffer.code}</p>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={handleCopy}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-black border border-white/10 text-white hover:text-yellow-500 hover:border-yellow-500/30 px-6 py-4 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-all active:scale-95"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              
              <button 
                onClick={handleShopNow}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-yellow-500 text-black hover:bg-yellow-400 px-6 py-4 rounded-xl text-[10px] font-semibold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-yellow-500/20"
              >
                <ShoppingCart size={14} /> Shop Now
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   HOME PAGE
───────────────────────────────────────────────────────────────── */
const Home = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { settings, welcomeOffer } = useSiteSettings();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const handleProductsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['featuredProducts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    };
    window.addEventListener('products-updated', handleProductsUpdated);
    return () => window.removeEventListener('products-updated', handleProductsUpdated);
  }, [queryClient]);

  const { promoSettings } = usePromo();
  const { categories, catLoading, productCounts } = useDynamicCategories();

  // Recently Viewed — raw list from localStorage (just IDs + cached fields)
  const [rawRecentlyViewed, setRawRecentlyViewed] = useState([]);

  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      setRawRecentlyViewed(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('recentlyViewed parse error:', e);
      setRawRecentlyViewed([]);
    }
  }, []);

  // Validate each recently-viewed product against Firestore (removes deleted/inactive)
  const { validItems: recentlyViewed } = useValidatedProducts('recentlyViewed', rawRecentlyViewed);

  const bannerIds = promoSettings?.bannerProductIds || [];
  const bannerIdsKey = JSON.stringify(bannerIds);

  // Fetch banner products
  const { data: bannerProducts = [], isLoading: bannerLoading } = useQuery({
    queryKey: ['bannerProducts', bannerIdsKey],
    queryFn: async () => {
      if (bannerIds.length === 0) return [];
      return await getProductsByIds(bannerIds);
    },
    enabled: bannerIds.length > 0,
    staleTime: 0
  });

  // Real-time listener for featured products (New Arrivals)
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc'),
      limit(8)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setFeaturedProducts(prods);
      setFeaturedLoading(false);
    }, (err) => {
      console.error("Error in real-time featured products listener:", err);
      setFeaturedLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const products = featuredProducts;
  const loading = featuredLoading;

  const activeOffers = promoSettings?.activeOffers || [];
  const activeOffersKey = JSON.stringify(activeOffers.map(o => ({ id: o.id, productId: o.productId })));

  // Fetch product details for ALL active offers (cached)
  const { data: offerProductsMap = {} } = useQuery({
    queryKey: ['offerProducts', activeOffersKey],
    queryFn: async () => {
      if (activeOffers.length === 0) return {};
      const map = {};
      await Promise.all(
        activeOffers.map(async (offer) => {
          if (!offer.productId) return;
          const prod = await getProductById(offer.productId);
          if (prod) {
            map[offer.id] = prod;
          }
        })
      );
      return map;
    },
    enabled: activeOffers.length > 0,
    staleTime: 1000 * 60 * 5 // 5 minutes cache
  });

  useEffect(() => {
    setCurrentIndex(0);
  }, [bannerProducts.length]);

  useEffect(() => {
    if (bannerProducts.length <= 1) return;
    const id = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % bannerProducts.length);
    }, 6000);
    return () => clearInterval(id);
  }, [bannerProducts.length]);

  const safeIndex = Math.min(currentIndex, Math.max(0, bannerProducts.length - 1));

  // Find the active (non-expired) offer for the current banner product.
  // ONLY look in activeOffers — PromoContext already filters: isActive=true AND expiryDateTime > now.
  // Never fall back to expired offers from allOffers.
  const currentProduct = bannerProducts[safeIndex];
  const offer = (promoSettings?.activeOffers || []).find(o => o.productId === currentProduct?.id) || null;


  // Hero banner dual-price computation (never overwrites DB price)
  const bannerOrigPrice  = Number(currentProduct?.originalPrice ?? currentProduct?.price ?? 0);
  const bannerDiscountPct = offer ? Number(offer.discount) : 0;
  const bannerSalePrice  = bannerDiscountPct > 0
    ? Math.round(bannerOrigPrice * (1 - bannerDiscountPct / 100))
    : bannerOrigPrice;
  const bannerHasDiscount = bannerDiscountPct > 0 && bannerSalePrice < bannerOrigPrice;

  const handleFeaturedClick = () => {
    const target = bannerProducts[safeIndex];
    if (target?.id) {
      navigate(`/product/${target.id}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black overflow-x-hidden pb-12">
      <Helmet>
        <title>SMKP TRADERS | Premium Online E-Commerce Store</title>
        <meta name="description" content="Shop luxury sarees, kids dresses, wheat grains, premium toys, gadgets, and luxury gifts at SMKP Traders. Exceptional quality guaranteed." />
      </Helmet>

      {/* ── 1. Dynamic Top Categories Bar ── */}
      <div className="w-full max-w-full bg-slate-950/60 border-b border-yellow-900/10 py-4 px-4 overflow-x-auto scrollbar-none flex flex-nowrap gap-6 sm:gap-8 items-center justify-start md:justify-center select-none touch-pan-x">
        {catLoading ? (
          // Skeleton loaders
          [...Array(6)].map((_, i) => (
            <div key={`cat-skeleton-${i}`} className="flex flex-col items-center gap-1.5 flex-shrink-0 animate-pulse">
              <div className="w-14 h-14 rounded-full bg-gray-800 border-2 border-yellow-900/10" />
              <div className="h-2 w-10 rounded bg-gray-800" />
            </div>
          ))
        ) : categories.length === 0 ? (
          <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest w-full text-center py-2">
            No categories available
          </p>
        ) : (
          categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/products?category=${cat.slug}`}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group transition-transform hover:scale-105 active:scale-95"
            >
              <div className="relative w-14 h-14 rounded-full border-2 border-yellow-900/20 group-hover:border-yellow-500 overflow-hidden bg-black p-0.5 transition-all duration-300 group-hover:shadow-[0_0_16px_rgba(234,179,8,0.35)]">
                {cat.image ? (
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover rounded-full"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center">
                    <span className="text-yellow-500/40 text-lg font-semibold">{cat.name?.[0]}</span>
                  </div>
                )}
              </div>
              <span className="text-[9px] font-semibold uppercase text-gray-400 group-hover:text-yellow-400 tracking-wider transition-colors">
                {cat.name}
              </span>
              {productCounts[cat.id] !== undefined && (
                <span className="text-[7px] font-semibold text-yellow-600/60 -mt-1">
                  {productCounts[cat.id]} items
                </span>
              )}
            </Link>
          ))
        )}
      </div>

      {/* ── 2. Hero Banner Carousel ── */}
      <div className="w-full px-3 sm:px-8 lg:px-8 xl:px-12 mt-4 sm:mt-6">
        <div className="relative w-full lg:max-w-[1400px] lg:mx-auto rounded-2xl sm:rounded-[1.75rem] overflow-hidden border border-yellow-900/15 bg-gray-950 shadow-[0_8px_40px_rgba(0,0,0,0.6)] group h-[190px] sm:h-[280px] md:h-[360px] lg:h-[440px]">
          <AnimatePresence mode="wait">
            {bannerLoading ? (
              <div key="loader" className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-yellow-500" />
              </div>
            ) : (settings?.banners?.desktop || settings?.banners?.mobile) ? (
              <motion.div
                key="custom-banner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0"
              >
                {settings.banners.desktop && (
                  <img
                    src={settings.banners.desktop}
                    alt="Desktop Banner"
                    className="hidden lg:block w-full h-full object-cover object-center"
                  />
                )}
                {(settings.banners.mobile || settings.banners.desktop) && (
                  <img
                    src={settings.banners.mobile || settings.banners.desktop}
                    alt="Mobile Banner"
                    className="lg:hidden w-full h-full object-cover object-center"
                  />
                )}
              </motion.div>
            ) : bannerProducts.length > 0 ? (
              <motion.div
                key={safeIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 cursor-pointer"
                onClick={handleFeaturedClick}
              >
                {/* ── Mobile/Tablet: full background image with overlay ── */}
                <div className="lg:hidden absolute inset-0">
                  <img
                    src={getHDImage(bannerProducts[safeIndex]?.image)}
                    alt={bannerProducts[safeIndex]?.name}
                    className="w-full h-full object-cover object-center"
                    style={{ opacity: 0.55 }}
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.15) 100%)' }} />
                </div>

                {/* ── Desktop: split layout ── */}
                <div className="hidden lg:flex absolute inset-0">
                  {/* Left: text content */}
                  <div className="w-[45%] flex-shrink-0 flex flex-col justify-center px-12 xl:px-16 relative z-10 bg-gradient-to-r from-gray-950 via-gray-950/95 to-transparent">
                    <span className="bg-yellow-500 text-black text-[9px] font-semibold uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg w-fit mb-4 shadow-lg">
                      ✦ Featured Offer
                    </span>
                    <h2 className="text-product md:text-product-sm lg:text-[27px] font-semibold text-white tracking-normal leading-[1.3] mb-3 max-w-sm line-clamp-2" style={{ textTransform: 'none' }}>
                      {bannerProducts[safeIndex]?.name}
                    </h2>

                    {/* ── Desktop: Dual price + discount badge ── */}
                    <div className="flex flex-col gap-1.5 mb-5">
                      {bannerHasDiscount && (
                        <span className="text-[8px] font-semibold uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full w-fit">
                          ✦ {bannerDiscountPct}% OFF
                        </span>
                      )}
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-price lg:text-product font-semibold text-yellow-400">
                          ₹{bannerSalePrice.toLocaleString()}
                        </span>
                        {bannerHasDiscount ? (
                          <span className="text-sm text-gray-500 line-through font-normal">
                            ₹{bannerOrigPrice.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-600 font-normal text-xs">special price</span>
                        )}
                      </div>
                    </div>
                    {/* Desktop countdown timer */}
                    {offer && (
                      <div className="mb-6">
                        <BannerCountdown offer={offer} compact={false} />
                      </div>
                    )}
                    <button className="bg-yellow-500 text-black px-6 py-3.5 rounded-full text-[15px] font-semibold tracking-wider w-fit hover:bg-white transition-all duration-300 active:scale-95">
                      Shop Now →
                    </button>
                  </div>

                  {/* Right: product image */}
                  <div className="flex-1 relative overflow-hidden">
                    <img
                      src={getHDImage(bannerProducts[safeIndex]?.image)}
                      alt={bannerProducts[safeIndex]?.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-[5000ms] ease-out"
                    />
                    {/* Fade edge from left */}
                    <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-gray-950 to-transparent" />
                  </div>
                </div>

                {/* Mobile text overlay */}
                <div className="lg:hidden absolute inset-0 flex flex-col justify-center px-4 sm:px-10">
                  <span className="bg-yellow-500 text-black text-[9px] font-semibold uppercase tracking-[0.2em] px-3 py-1.5 rounded w-fit mb-2.5">
                    Featured Offer
                  </span>
                  <h2 className="text-product md:text-product-sm font-semibold text-white tracking-normal leading-[1.3] max-w-[85%] mb-2 line-clamp-2" style={{ textTransform: 'none' }}>
                    {bannerProducts[safeIndex]?.name}
                  </h2>

                  {/* ── Mobile: Dual price + discount badge ── */}
                  <div className="flex flex-col gap-1 mb-2 sm:mb-3">
                    {bannerHasDiscount && (
                      <span className="text-[8px] font-semibold uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-full w-fit">
                        {bannerDiscountPct}% OFF
                      </span>
                    )}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-price sm:text-product font-semibold text-yellow-400 leading-none">
                        ₹{bannerSalePrice.toLocaleString()}
                      </span>
                      {bannerHasDiscount && (
                        <span className="text-xs text-gray-400 line-through font-normal">
                          ₹{bannerOrigPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="bg-white text-black px-6 py-3 rounded-full text-[15px] font-semibold tracking-wider w-fit hover:bg-yellow-500 transition-colors shadow-lg active:scale-95">
                    Shop Now
                  </span>
                  {/* Mobile compact countdown — hidden when banner is very small */}
                  {offer && (
                    <div className="mt-1.5 sm:mt-3">
                      <BannerCountdown offer={offer} compact={true} />
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div key="no-banner" className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="text-yellow-500/20 text-5xl font-semibold tracking-widest">SMKP</div>
                <p className="text-gray-700 uppercase tracking-[0.5em] text-[10px] font-semibold">Curated Deals Coming Soon</p>
              </div>
            )}
          </AnimatePresence>

          {/* Slide dots */}
          {bannerProducts.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              {bannerProducts.map((_, idx) => (
                <button
                  key={`slide-dot-${idx}`}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 min-h-0 rounded-full transition-all duration-300 ${safeIndex === idx ? 'w-7 bg-yellow-500' : 'w-1.5 bg-gray-700'}`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Welcome Offer Banner ── */}
      <WelcomeOfferBanner welcomeOffer={welcomeOffer} />

      {/* ── Custom Offer Banner ── */}
      {settings?.banners?.offer && (
        <div className="w-full px-3 sm:px-8 lg:px-8 xl:px-12 mt-6">
          <div className="relative w-full lg:max-w-[1400px] lg:mx-auto rounded-2xl overflow-hidden border border-yellow-900/15">
            <img 
              src={settings.banners.offer} 
              alt="Special Offer" 
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      )}

      {/* ── 3. Flash Deals Section — all active offers ── */}
      {settings?.homepage?.showFlashDeals !== false && promoSettings?.offerActive && promoSettings?.activeOffers?.length > 0 && (
        <section className="mx-3 sm:mx-8 lg:mx-auto max-w-7xl mt-5 sm:mt-8">
          {/* Section header */}
          <div className="flex justify-between items-end mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-[15px] lg:text-[15px] font-semibold text-white leading-[1.3] tracking-normal">Flash Deals</h2>
              <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full">
                {promoSettings.activeOffers.length} Live
              </span>
            </div>
            <Link to="/products" className="text-gray-400 hover:text-white font-semibold text-[10px] uppercase tracking-widest transition-colors border-b border-white/10 pb-0.5">
              View All
            </Link>
          </div>

          {/* Offer cards grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-5">
            {promoSettings.activeOffers.map((activeOffer) => {
              const prod = offerProductsMap[activeOffer.id];
              if (!prod) {
                // Skeleton while product loads
                return (
                  <div key={activeOffer.id} className="animate-pulse bg-gray-900/50 rounded-xl sm:rounded-[1.5rem] border border-white/5 h-[180px] sm:h-[220px]" />
                );
              }

              const originalPrice = Number(prod.originalPrice ?? prod.price ?? 0);
              const discountPct = Number(activeOffer.discount || 0);
              const salePrice = Math.round(originalPrice * (1 - discountPct / 100));

              return (
                <div
                  key={activeOffer.id}
                  className="group bg-gray-900/40 backdrop-blur-xl rounded-xl sm:rounded-[1.5rem] border border-yellow-900/15 overflow-hidden shadow-xl hover:border-yellow-500/30 transition-all duration-300 flex flex-col min-h-[265px] xs:min-h-[285px] sm:min-h-[355px] lg:min-h-[380px] h-full"
                >
                  {/* Product image */}
                  <div className="relative h-[100px] sm:h-[140px] lg:h-[160px] overflow-hidden bg-black flex-shrink-0">
                    <LazyImage
                      src={getOptimizedImage(prod.image, 'card')}
                      alt={prod.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      wrapperClass="w-full h-full"
                    />
                    {/* Discount badge */}
                    <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 bg-yellow-500 text-black text-[6px] sm:text-[8px] font-semibold uppercase tracking-widest px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-lg">
                      {discountPct}% OFF
                    </div>
                    {/* Live pulse indicator */}
                    <div className="absolute top-1.5 right-1.5 sm:top-3 sm:right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm border border-red-500/20 rounded-full px-1.5 py-0.5 sm:px-2.5 sm:py-1">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[6px] sm:text-[7px] font-semibold text-red-400 uppercase tracking-widest hidden xs:inline">Live</span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-2.5 sm:p-4 flex flex-col gap-1.5 sm:gap-2 flex-1 justify-between">
                    <div>
                      <h3 className="type-product-title text-[#F8F8F8] line-clamp-2 mb-1 sm:mb-2" style={{ textTransform: 'none' }}>
                        {prod.name}
                      </h3>

                      {/* Prices */}
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-price lg:text-product font-semibold text-yellow-400 leading-none">₹{salePrice.toLocaleString()}</span>
                        <span className="text-xs text-gray-500 line-through font-normal">₹{originalPrice.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Individual countdown timer */}
                    <div className="py-2.5 my-auto flex items-center justify-center">
                      <BannerCountdown offer={activeOffer} compact={true} />
                    </div>

                    {/* CTA */}
                    <Link
                      to={`/product/${prod.id}`}
                      className="mt-auto inline-flex items-center justify-center gap-2 bg-yellow-500 text-black px-6 py-3 rounded-full text-[15px] font-semibold tracking-wider hover:bg-white transition-all duration-300 active:scale-95"
                    >
                      View Deal <ArrowRight size={14} className="hidden sm:inline" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Trending Section ── */}
      {settings?.homepage?.showTrending && products.length > 0 && (
        <section className="mx-3 sm:mx-8 lg:mx-auto max-w-7xl mt-5 sm:mt-8">
          <div className="flex justify-between items-end mb-4 sm:mb-6">
            <div className="space-y-1">
              <p className="text-yellow-500 text-[9px] font-semibold uppercase tracking-[0.25em] mb-1">Trending Now</p>
              <h2 className="text-[15px] lg:text-[15px] font-semibold text-white leading-[1.3] tracking-normal">Trending Collection</h2>
            </div>
            <Link to="/products" className="text-gray-400 hover:text-white font-semibold text-[10px] uppercase tracking-widest transition-colors border-b border-white/10 pb-0.5">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.slice(0, 4).map((p, i) => (
              <ProductCard key={`trending-${p.id}-${i}`} product={p} delay={i * 50} promoSettings={promoSettings} />
            ))}
          </div>
        </section>
      )}

      {/* ── Best Sellers Section ── */}
      {settings?.homepage?.showBestSeller && products.length > 0 && (
        <section className="mx-3 sm:mx-8 lg:mx-auto max-w-7xl mt-5 sm:mt-8">
          <div className="flex justify-between items-end mb-4 sm:mb-6">
            <div className="space-y-1">
              <p className="text-yellow-500 text-[9px] font-semibold uppercase tracking-[0.25em] mb-1">Customer Favorites</p>
              <h2 className="text-[15px] lg:text-[15px] font-semibold text-white leading-[1.3] tracking-normal">Best Sellers</h2>
            </div>
            <Link to="/products" className="text-gray-400 hover:text-white font-semibold text-[10px] uppercase tracking-widest transition-colors border-b border-white/10 pb-0.5">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.slice(Math.max(0, products.length - 4)).map((p, i) => (
              <ProductCard key={`bestseller-${p.id}-${i}`} product={p} delay={i * 50} promoSettings={promoSettings} />
            ))}
          </div>
        </section>
      )}

      {/* ── 4. New Arrivals / Featured Products ── */}
      {(settings?.homepage?.showNewArrival !== false || settings?.homepage?.showFeaturedProducts !== false) && (
        <section className="mx-3 sm:mx-8 lg:mx-auto max-w-7xl mt-5 sm:mt-8">
          <div className="flex justify-between items-end mb-4 sm:mb-6">
            <div className="space-y-1">
              <p className="text-yellow-500 text-[9px] font-semibold uppercase tracking-[0.25em] mb-1">The Elite List</p>
              <h2 className="text-[15px] lg:text-[15px] font-semibold text-white leading-[1.3] tracking-normal">New Arrivals</h2>
            </div>
            <Link to="/products" className="text-gray-400 hover:text-white font-semibold text-[10px] uppercase tracking-widest transition-colors border-b border-white/10 pb-0.5">
              View All
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={`new-arrival-skeleton-${i}`} className="animate-pulse bg-gray-900/50 h-[260px] rounded-2xl border border-white/5" />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {products.map((p, i) => (
                <ProductCard key={p.id || `new-arrival-${i}`} product={p} delay={i * 50} promoSettings={promoSettings} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-yellow-900/10">
              <p className="text-gray-500 font-semibold uppercase tracking-[0.2em] text-[10px]">No New Arrivals Available</p>
            </div>
          )}
        </section>
      )}

      {/* ── Daily Notes ── */}
      <DailyNotes />

      {/* ── 5. Recently Viewed Section ── */}
      {recentlyViewed && recentlyViewed.length > 0 && (
        <section className="mx-4 sm:mx-8 lg:mx-auto max-w-7xl mt-8">
          <div className="mb-6">
            <p className="text-yellow-500 text-[9px] font-semibold uppercase tracking-[0.25em] mb-1">Based on your activity</p>
            <h2 className="text-[15px] lg:text-[15px] font-semibold text-white leading-[1.3] tracking-normal">Recently Viewed</h2>
          </div>
          <div className="flex flex-nowrap gap-4 overflow-x-auto scrollbar-none pb-2 select-none touch-pan-x">
            {recentlyViewed.map((p, i) => (
              <div key={`recent-${p.id}-${i}`} className="w-[150px] flex-shrink-0">
                <ProductCard product={p} delay={i * 50} promoSettings={promoSettings} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-black py-32 border-t border-yellow-900/10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <img src={settings?.logoUrl || "/logo.png"} alt="Brand" className="h-20 w-auto mx-auto mb-10 opacity-40 grayscale" />
          <p className="text-gray-600 text-[10px] font-semibold uppercase tracking-[0.8em]">
            {settings?.storeName || "SMKP TRADERS"} — Est. {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;