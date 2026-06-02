import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Star, Truck, ShieldCheck, Loader2, Heart, Gift, Zap, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, doc, onSnapshot } from 'firebase/firestore';
import LazyImage from '../components/LazyImage';
import { useInView } from 'react-intersection-observer'; // FIX 1: use the canonical hook directly
import { useWishlist } from '../context/WishlistContext';
import { motion, AnimatePresence } from 'framer-motion';
import { usePromo } from '../context/PromoContext';
import logo from '../assets/logo.png';
import { getEffectivePrice } from '../utils/pricing';
import { getOptimizedImage, getHDImage } from '../utils/cloudinary';
import ProductRating from '../components/ProductRating';

/* ─────────────────────────────────────────────────────────────────
   STATIC DATA
───────────────────────────────────────────────────────────────── */
const categories = [
  { id: 1, name: 'Sarees', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80', comingSoon: false },
  { id: 2, name: 'Kids Dress', image: '/kids-dress.png', comingSoon: false },
  { id: 3, name: 'Wheat', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80', comingSoon: false },
  { id: 4, name: 'Toys', image: 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=800&q=80', comingSoon: false },
  { id: 5, name: 'Gadgets', image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80', comingSoon: true },
  { id: 6, name: 'Gifts', image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80', comingSoon: true },
];

const perks = [
  { icon: Truck, title: 'Logistics', desc: 'Fast & Secure Delivery' },
  { icon: ShieldCheck, title: 'Secure Payments', desc: 'End-to-end encrypted payments' },
  { icon: Star, title: 'Quality Products', desc: 'Only the finest trending products' },
];

/* ─────────────────────────────────────────────────────────────────
   COUNTDOWN TIMER
───────────────────────────────────────────────────────────────── */

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
          <div className="bg-yellow-500/10 backdrop-blur-md border border-yellow-500/20 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-yellow-500 text-sm shadow-[0_0_15px_rgba(234,179,8,0.1)]">
            {value.toString().padStart(2, '0')}
          </div>
          <span className="text-[7px] font-black text-yellow-600 mt-2 uppercase tracking-[0.2em]">{label}</span>
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
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const handleWishlist = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  }, [product, toggleWishlist]);

  const offerActive =
    promoSettings?.offerActive &&
    promoSettings.offerProductId === product.id &&
    (!promoSettings.offerEnd || Date.now() < new Date(promoSettings.offerEnd).getTime());

  return (
    <div
      ref={ref}
      className={`luxury-card p-4 rounded-3xl transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        } relative group h-full`}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      <button
        onClick={handleWishlist}
        className={`absolute top-6 right-6 z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${isInWishlist(product.id)
            ? 'bg-yellow-500 text-black'
            : 'bg-black/50 backdrop-blur-sm text-gray-400 hover:text-yellow-500 border border-white/10'
          }`}
      >
        <Heart size={16} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
      </button>

      <Link 
        to={`/product/${product.id}`} 
        onClick={() => {
          console.log("Product Card ID:", product.id);
          console.log("Navigating To:", `/product/${product.id}`);
        }}
        className="flex flex-col h-full"
      >
        <div className="overflow-hidden rounded-2xl aspect-square mb-6 relative">
          <LazyImage
            src={getHDImage(product.image)}
            alt={product.name}
            className="product-image group-hover:scale-110 transition-transform duration-700 object-cover"
            wrapperClass="w-full h-full"
          />
          {Number(product.soldCount || 0) >= 50 && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-yellow-500 text-black text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg shadow-yellow-500/30">
              🏆 Best Seller
            </div>
          )}
          {Number(product.stock || 0) <= 0 ? (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none bg-black/40">
              <span className="bg-red-600 text-white text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-[0.2em] shadow-xl rotate-[-12deg]">
                OUT OF STOCK
              </span>
            </div>
          ) : Number(product.stock || 0) <= 5 ? (
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">
              ⚠ LOW STOCK ({product.stock})
            </div>
          ) : (
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 bg-green-600 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">
              IN STOCK
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-tight">
            {product.name}
          </h3>
          <div className="mb-2">
            <ProductRating productId={product.id} />
          </div>
          <div className="mt-auto">
            {getEffectivePrice(product, promoSettings) < Number(product.price) ? (
              <div className="flex items-center gap-3">
                <span className="text-xl font-black text-yellow-500">
                  ₹{getEffectivePrice(product, promoSettings).toLocaleString()}
                </span>
                <span className="text-xs text-gray-600 line-through font-bold">
                  ₹{Number(product.price).toLocaleString()}
                </span>
              </div>
            ) : (
              <p className="text-xl font-black text-white">₹{Number(product.price).toLocaleString()}</p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   HOME PAGE
───────────────────────────────────────────────────────────────── */
const Home = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  const { promoSettings } = usePromo();

  // Local state for banner products
  const [bannerProducts, setBannerProducts] = useState([]);
  const [bannerLoading, setBannerLoading] = useState(true);

  // Local state for featured products (New Arrivals)
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  // Real-time listener for banner products
  useEffect(() => {
    const bannerIds = promoSettings?.bannerProductIds;
    if (!Array.isArray(bannerIds) || bannerIds.length === 0) {
      setBannerProducts([]);
      setBannerLoading(false);
      return;
    }

    setBannerLoading(true);
    const unsubscribes = [];
    const productsMap = {};

    let loadedCount = 0;
    const totalIds = bannerIds.length;

    bannerIds.forEach((id) => {
      const productRef = doc(db, 'products', id);
      const unsub = onSnapshot(productRef, (docSnap) => {
        if (docSnap.exists()) {
          productsMap[id] = { id: docSnap.id, ...docSnap.data() };
        } else {
          delete productsMap[id];
        }

        const orderedProducts = bannerIds
          .map(bid => productsMap[bid])
          .filter(Boolean);

        setBannerProducts(orderedProducts);

        if (loadedCount < totalIds) {
          loadedCount++;
          if (loadedCount === totalIds) {
            setBannerLoading(false);
          }
        }
      }, (error) => {
        console.error(`Error subscribing to banner product ${id}:`, error);
        if (loadedCount < totalIds) {
          loadedCount++;
          if (loadedCount === totalIds) {
            setBannerLoading(false);
          }
        }
      });
      unsubscribes.push(unsub);
    });

    const timeoutId = setTimeout(() => {
      setBannerLoading(false);
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      unsubscribes.forEach(unsub => unsub());
    };
  }, [promoSettings?.bannerProductIds]);

  // Real-time listener for featured products (New Arrivals) with fallback
  useEffect(() => {
    setFeaturedLoading(true);
    let fallbackUnsub = null;

    const q = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc'),
      limit(4)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        console.warn("Featured products query (ordered by createdAt) is empty. Trying fallback query.");
        if (fallbackUnsub) return;

        const fallbackQ = query(
          collection(db, 'products'),
          limit(4)
        );

        fallbackUnsub = onSnapshot(fallbackQ, (fallbackSnapshot) => {
          const productsList = fallbackSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          setFeaturedProducts(productsList);
          setFeaturedLoading(false);
        }, (error) => {
          console.error("Error with fallback featured products subscription:", error);
          setFeaturedLoading(false);
        });
      } else {
        if (fallbackUnsub) {
          fallbackUnsub();
          fallbackUnsub = null;
        }
        const productsList = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        setFeaturedProducts(productsList);
        setFeaturedLoading(false);
      }
    }, (error) => {
      console.error("Error with primary featured products subscription:", error);
      if (!fallbackUnsub) {
        const fallbackQ = query(
          collection(db, 'products'),
          limit(4)
        );
        fallbackUnsub = onSnapshot(fallbackQ, (fallbackSnapshot) => {
          const productsList = fallbackSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          setFeaturedProducts(productsList);
          setFeaturedLoading(false);
        }, (err) => {
          console.error("Error with fallback featured products subscription after primary error:", err);
          setFeaturedLoading(false);
        });
      }
    });

    return () => {
      unsub();
      if (fallbackUnsub) {
        fallbackUnsub();
      }
    };
  }, []);

  const products = featuredProducts;
  const loading = featuredLoading;

  console.log("New Arrivals Products:", products);
  console.log("Loading State:", loading);
  console.log("Products Count:", products?.length);

  // Local state for fetching the active offer product details in real-time
  const [offerProduct, setOfferProduct] = useState(null);

  useEffect(() => {
    if (!promoSettings?.offerActive || !promoSettings?.offerProductId) {
      setOfferProduct(null);
      return;
    }
    const productRef = doc(db, 'products', promoSettings.offerProductId);
    const unsub = onSnapshot(productRef, (docSnap) => {
      if (docSnap.exists()) {
        setOfferProduct({ id: docSnap.id, ...docSnap.data() });
      } else {
        setOfferProduct(null);
      }
    }, (error) => {
      console.error("Error subscribing to offer product details:", error);
      setOfferProduct(null);
    });
    return () => unsub();
  }, [promoSettings?.offerActive, promoSettings?.offerProductId]);

  /* ── FIX 7: Auto-advance slider — reset index when list changes ── */
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

  // FIX 7: clamp index so it never goes out of bounds
  const safeIndex = Math.min(currentIndex, Math.max(0, bannerProducts.length - 1));
  const normalHero = bannerProducts[safeIndex] ?? null;
  const featuredHero = (promoSettings?.offerActive && offerProduct) ? offerProduct : normalHero;

  const handleFeaturedClick = () => {
    console.log(featuredHero);
    if (featuredHero?.id) {
      console.log("Product Card ID:", featuredHero.id);
      console.log("Navigating To:", `/product/${featuredHero.id}`);
      navigate(`/product/${featuredHero.id}`);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black overflow-x-hidden">
      <Helmet>
        <title>SMKP TRADERS | Premium Online E-Commerce Store</title>
        <meta name="description" content="Shop luxury sarees, kids dresses, wheat grains, premium toys, gadgets, and luxury gifts at SMKP Traders. Exceptional quality guaranteed." />
        <meta property="og:title" content="SMKP TRADERS | Premium Online E-Commerce Store" />
        <meta property="og:description" content="Shop luxury sarees, kids dresses, wheat grains, premium toys, gadgets, and luxury gifts at SMKP Traders. Exceptional quality guaranteed." />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* ── HERO SLIDER ─────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-yellow-500/5 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-yellow-600/5 rounded-full blur-[120px] animate-pulse" />
        </div>

        <AnimatePresence mode="wait">
          {bannerLoading ? (
            <div key="loader" className="w-full flex items-center justify-center h-full">
              <Loader2 size={48} className="animate-spin text-yellow-500/50" />
            </div>
          ) : featuredHero ? (
            <motion.div
              key={featuredHero.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="w-full h-full"
            >
              <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-16 w-full h-full flex flex-col lg:flex-row items-center justify-between gap-12 pt-20">
                {/* Copy */}
                <div className="hero-content text-center lg:text-left">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="inline-flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 px-6 py-2 rounded-full text-yellow-500 text-[10px] font-black tracking-[0.4em] uppercase mb-10"
                  >
                    <Sparkles size={14} className="animate-pulse" />
                    Premium Collection
                  </motion.div>

                  <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6 tracking-tighter"
                  >
                    From Daily Needs to <br />
                    <span className="gold-shine font-black">Dream Living</span> — <br />
                    We Deliver Excellence
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="text-gray-400 text-base md:text-lg max-w-lg mb-12 leading-relaxed font-medium mx-auto lg:mx-0"
                  >
                    Discover premium products crafted to elevate your everyday lifestyle with quality, comfort, and trust.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="flex flex-wrap gap-6 items-center justify-center lg:justify-start mt-8"
                  >
                    <Link
                      to="/products"
                      className="btn-glow px-12 py-5 bg-yellow-500 text-black font-black uppercase tracking-[0.2em] text-xs rounded-full hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-yellow-500/20"
                    >
                      Explore the collection
                    </Link>

                      {promoSettings?.offerActive &&
                        promoSettings.offerProductId === featuredHero.id &&
                        promoSettings.offerEnd ? (
                          <div className="offer-timer">
                            <span className="text-yellow-500 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Offer Ends In</span>
                            <CountdownTimer expiryDate={promoSettings.offerEnd} />
                          </div>
                        ) : null}
                  </motion.div>
                </div>

                {/* Hero image */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 50 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="hero-image"
                >
                  <div className="hero-product-wrapper">
                    {/* Luxury glowing background */}
                    <div className="hero-glow" />

                    {/* Subtle rotating glow particles behind product */}
                    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[450px] h-[450px] rounded-full border border-yellow-500/10 animate-[spin_20s_linear_infinite]" />
                      <div className="w-[300px] h-[300px] absolute rounded-full border border-dashed border-yellow-500/5 animate-[spin_30s_linear_infinite_reverse]" />
                    </div>

                    <LazyImage
                       src={getHDImage(featuredHero.image)}
                       alt={featuredHero.name}
                       className="hero-product-image object-contain"
                       wrapperClass="w-full h-full flex items-center justify-center"
                     />

                    {/* Rating badge */}
                    <div className="absolute top-10 -left-6 bg-black border border-yellow-500/30 text-yellow-500 px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl shadow-yellow-500/20 z-20">
                      <ProductRating productId={featuredHero.id} compact={true} />
                    </div>

                    {/* Offer / Best Seller badge */}
                    {promoSettings?.offerActive && promoSettings.offerProductId === featuredHero.id ? (
                      <div className="offer-badge bg-yellow-500 text-black px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl shadow-yellow-500/40">
                        <Zap size={14} className="fill-black" />
                        <span className="text-xs font-black uppercase tracking-widest">
                          {promoSettings.discount}% OFF Flash Deal
                        </span>
                      </div>
                    ) : (
                      <div className="offer-badge bg-gray-900 border border-white/10 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl">
                        <span className="text-xs font-black uppercase tracking-widest text-yellow-500">Best Seller</span>
                      </div>
                    )}

                    {/* Price overlay ── uses helper */}
                    {promoSettings?.offerActive && promoSettings.offerProductId === featuredHero.id && (
                      <div
                        className="featured-offer-card featured-asset-card px-6 py-4 rounded-2xl z-20"
                        onClick={handleFeaturedClick}
                      >
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-black">Featured Offer</p>
                        <p className="text-sm text-white font-black uppercase tracking-widest mb-1">{featuredHero.name}</p>
                        {getEffectivePrice(featuredHero, promoSettings) < Number(featuredHero.price) ? (
                          <div className="flex items-center gap-3">
                            <span className="text-yellow-500 font-black text-xl">
                              ₹{getEffectivePrice(featuredHero, promoSettings).toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500 line-through font-bold">
                              ₹{Number(featuredHero.price).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <p className="text-yellow-500 font-black text-lg">
                            ₹{Number(featuredHero.price || 0).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      {/* ── PERKS ───────────────────────────────────────────────── */}
      <section className="bg-black py-20 border-y border-yellow-900/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {perks.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center group">
                <div className="inline-flex p-5 rounded-2xl bg-yellow-500/5 border border-yellow-500/10 text-yellow-500 mb-6 group-hover:scale-110 transition-transform duration-500">
                  <Icon size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-white font-black text-xs uppercase tracking-[0.3em] mb-3">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-[250px] mx-auto">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-16 py-32 space-y-40">

        {/* ── CATEGORIES ──────────────────────────────────────────── */}
        <section>
          <div className="flex flex-col items-center text-center mb-20">
            <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.5em] mb-4">Curated Selections</p>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
              Shop the <span className="gold-shine">collection</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-6 h-[800px] md:h-[600px]">
            {categories.map((cat, idx) => (
              <Link
                key={cat.id}
                to={cat.comingSoon ? '#' : `/products?category=${cat.name.toLowerCase()}`}
                className={`group relative rounded-3xl overflow-hidden border border-white/5 transition-all duration-700
                  ${idx === 0 ? 'md:col-span-3 md:row-span-2' : ''}
                  ${idx === 1 ? 'md:col-span-3' : ''}
                  ${idx === 2 ? 'md:col-span-1 md:row-span-1' : ''}
                  ${idx === 3 ? 'md:col-span-2' : ''}
                  ${cat.comingSoon ? 'cursor-not-allowed grayscale' : 'hover:border-yellow-500/40'}
                `}
              >
                <img
                  src={getOptimizedImage(cat.image, 'thumbnail')}
                  alt={cat.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{cat.name}</h3>
                  {cat.comingSoon ? (
                    <span className="text-yellow-500/60 text-[8px] font-black uppercase tracking-widest">Coming Soon</span>
                  ) : (
                    <span className="text-yellow-500 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                      Discover
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FEATURED PRODUCTS ───────────────────────────────────── */}
        <section>
          <div className="flex justify-between items-end mb-16">
            <div className="space-y-2">
              <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.5em]">The Elite List</p>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter">
                New <span className="gold-shine">Arrivals</span>
              </h2>
            </div>
            <Link
              to="/products"
              className="text-gray-400 hover:text-white font-black text-[10px] uppercase tracking-[0.2em] transition-colors border-b border-white/10 pb-1"
            >
              View All
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-900/50 h-[380px] rounded-3xl border border-white/5" />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} delay={i * 100} promoSettings={promoSettings} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-900/30 rounded-3xl border border-yellow-900/10">
              <p className="text-gray-500 font-black uppercase tracking-[0.2em] text-xs">No New Arrivals Available</p>
            </div>
          )}
        </section>

      </div>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-black py-32 border-t border-yellow-900/10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <img src={logo} alt="Brand" className="h-20 w-auto mx-auto mb-10 opacity-40 grayscale" />
          <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.8em]">
            SMKP TRADERS — Est. {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;