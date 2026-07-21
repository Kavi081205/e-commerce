import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { useWishlist } from '../context/WishlistContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import {
  Search, Filter, SlidersHorizontal,
  Heart, AlertCircle, Loader2, ArrowRight,
  ChevronDown, Check, ShoppingCart
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useNotification } from '../context/NotificationContext';
import { usePromo } from '../context/PromoContext';
import { getEffectivePrice } from '../utils/pricing';
import { getOptimizedImage, getHDImage } from '../utils/cloudinary';
import LazyImage from '../components/LazyImage';
import { ProductSkeleton } from '../components/Skeleton';
import ProductRating from '../components/ProductRating';
import { motion, AnimatePresence } from 'framer-motion';
import { getCategories } from '../firebase/services';

const PRODUCTS_PER_PAGE = 20;

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */
const Products = () => {
  const { settings } = useSiteSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get('category');
  const [filter, setFilter] = useState(urlCategory || 'all');

  // Load categories via React Query — cached 10 min, serves instantly on revisit
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 1000 * 60 * 10, // 10 minutes — categories rarely change
    gcTime: 1000 * 60 * 30,    // keep in memory 30 minutes
  });

  // Sync URL category query param with filter state
  useEffect(() => {
    const urlCat = searchParams.get('category');
    setFilter(urlCat || 'all');
  }, [searchParams]);

  // ── filter-state ─────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [maxPrice, setMaxPrice] = useState(100_000);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('none');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const sortOptions = [
    { value: 'none', label: 'Newest' },
    { value: 'price-asc', label: 'Price: Low to High' },
    { value: 'price-desc', label: 'Price: High to Low' },
    { value: 'best-selling', label: 'Best Selling' },
    { value: 'highest-rated', label: 'Highest Rated' },
  ];
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── pagination state ──────────────────────────────────────────────────────
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState([]); // Array of DocumentSnapshot for page boundaries

  // Reset pagination when category changes
  useEffect(() => {
    setCurrentPageIndex(0);
    setPageCursors([]);
  }, [filter]);

  // ── query state ───────────────────────────────────────────────────────────
  const [productsData, setProductsData] = useState({ products: [], lastDoc: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const refetch = () => setRetryTrigger(prev => prev + 1);

  const cursor = currentPageIndex === 0 ? null : pageCursors[currentPageIndex - 1];

  useEffect(() => {
    setIsLoading(true);
    setIsError(false);
    setError(null);

    // IMPORTANT: where() must come before orderBy() for Firestore compound queries.
    // Putting orderBy first on a different field than where() requires a composite
    // index and causes a transport error if that index doesn't exist.
    const constraints = [];

    if (filter && filter !== 'all') {
      constraints.push(where('category', '==', filter));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    constraints.push(limit(PRODUCTS_PER_PAGE));

    const q = query(collection(db, 'products'), ...constraints);

    const fetchProducts = async () => {
      try {
        const snapshot = await getDocs(q);
        const productsList = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

        setProductsData({ products: productsList, lastDoc });
        setIsLoading(false);
      } catch (err) {
        console.error('Firestore products query error:', err.code, err.message);
        setIsError(true);
        setError(err);
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [filter, currentPageIndex, retryTrigger]);

  // Keep track of the page boundaries for back-paging
  useEffect(() => {
    if (productsData.lastDoc && currentPageIndex === pageCursors.length) {
      setPageCursors(prev => [...prev, productsData.lastDoc]);
    }
  }, [productsData.lastDoc, currentPageIndex, pageCursors.length]);

  const products = productsData.products || [];
  const hasMore = products.length === PRODUCTS_PER_PAGE;
  const isPlaceholderData = false;

  const { isInWishlist, toggleWishlist } = useWishlist();
  const { promoSettings } = usePromo();
  const { addToCart } = useCart();
  const { showToast } = useNotification();

  // Track which product IDs are in the brief "Added ✓" feedback state
  const [addingToCart, setAddingToCart] = useState(new Set());

  const handleQuickAdd = (e, product) => {
    e.preventDefault();
    e.stopPropagation();

    const hasVariants =
      (product.variants && product.variants.length > 0) ||
      (product.colors && product.colors.length > 0) ||
      (product.sizes && product.sizes.length > 0);

    if (hasVariants) {
      // Redirect to product page so user can pick their variant
      window.location.href = `/product/${product.id}`;
      return;
    }

    addToCart(product);
    showToast('Added to Cart 🛒', 'success');

    setAddingToCart(prev => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddingToCart(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 1500);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     Filter change handler – URL sync + state reset
  ───────────────────────────────────────────────────────────────────────── */
  const handleFilterChange = (cat) => {
    if (cat === filter) return;   // no-op if same category
    setFilter(cat);               // triggers page reset
    const next = new URLSearchParams(searchParams);
    if (cat === 'all') next.delete('category');
    else next.set('category', cat);
    setSearchParams(next, { replace: true });
  };

  const hasLocalFilters = searchTerm !== '' || maxPrice < 100_000 || inStockOnly;

  const processedProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const effectivePrice = getEffectivePrice(product, promoSettings);
    const matchesPrice = effectivePrice <= maxPrice;
    const matchesStock = !inStockOnly || Number(product.stock) > 0;
    return matchesSearch && matchesPrice && matchesStock;
  });

  const sortedProducts = [...processedProducts].sort((a, b) => {
    if (sort === 'price-asc') {
      const priceA = getEffectivePrice(a, promoSettings);
      const priceB = getEffectivePrice(b, promoSettings);
      return priceA - priceB;
    }
    if (sort === 'price-desc') {
      const priceA = getEffectivePrice(a, promoSettings);
      const priceB = getEffectivePrice(b, promoSettings);
      return priceB - priceA;
    }
    if (sort === 'best-selling') {
      return Number(b.soldCount || 0) - Number(a.soldCount || 0);
    }
    if (sort === 'highest-rated') {
      return Number(b.rating || 0) - Number(a.rating || 0);
    }
    return 0;
  });

  /* ─────────────────────────────────────────────────────────────────────────
     Render
  ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 pb-24">
        <div className="mb-8 lg:mb-20 text-center lg:text-left">
          <p className="text-yellow-500 text-[9px] font-semibold uppercase tracking-[0.25em] mb-4">
            Curated Selection
          </p>
          <h1 className="text-product md:text-product-sm lg:type-heading-lg text-white">
            Our Collections
          </h1>
        </div>

        {/* Horizontal scroll categories for mobile */}
        <div className="flex lg:hidden flex-nowrap gap-2 overflow-x-auto scrollbar-none py-3 mb-6 border-y border-yellow-900/10 select-none touch-pan-x">
          {[{ name: 'All', slug: 'all' }, ...categories].map(cat => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => handleFilterChange(cat.slug)}
              className={`px-4 py-2 rounded-full text-[9px] font-semibold uppercase tracking-widest border flex-shrink-0 transition-all ${filter === cat.slug
                ? 'bg-yellow-500 border-yellow-500 text-black shadow-lg shadow-yellow-500/10'
                : 'border-yellow-900/20 text-gray-400'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Mobile Sticky Sort/Filter bar */}
        <div className="sticky top-[72px] sm:top-[80px] z-20 bg-black border-y border-yellow-900/10 flex h-12 lg:hidden w-full mb-6">
          <button
            type="button"
            onClick={() => setIsSortOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 border-r border-yellow-900/10 active:bg-yellow-500/10"
          >
            <SlidersHorizontal size={12} /> Sort
          </button>
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 active:bg-yellow-500/10"
          >
            <Filter size={12} /> Filter
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-16">
          {/* ── Sidebar Filters ─────────────────────────────────────────── */}
          <aside className="hidden lg:block w-full lg:w-80 flex-shrink-0 space-y-10">
            <div className="bg-gray-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-yellow-900/20 space-y-12">

              {/* Search */}
              <div>
                <div className="flex items-center gap-3 mb-6 text-yellow-500">
                  <Search size={16} strokeWidth={3} />
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em]">Search</h3>
                </div>
                <div className="relative">
                  <label htmlFor="filter-search" className="sr-only">Search Filter</label>
                  <input
                    id="filter-search"
                    name="search"
                    type="text"
                    autoComplete="off"
                    placeholder="Find in collection..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-black/50 border border-yellow-900/30 text-white rounded-2xl py-3.5 px-5 text-sm focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/50 outline-none transition-all placeholder:text-gray-700 font-semibold"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <div className="flex items-center gap-3 mb-6 text-yellow-500">
                  <Filter size={16} strokeWidth={3} />
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em]">Category</h3>
                </div>
                <div className="space-y-3">
                  {[{ name: 'All Collections', slug: 'all' }, ...categories].map(cat => (
                    <button
                      key={cat.slug}
                      type="button"
                      aria-pressed={filter === cat.slug}
                      onClick={() => handleFilterChange(cat.slug)}
                      className={`w-full text-left px-5 py-3 rounded-2xl text-[11px] font-semibold uppercase tracking-widest transition-all ${filter === cat.slug
                        ? 'bg-yellow-500 text-black shadow-xl shadow-yellow-500/10'
                        : 'text-gray-500 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <div className="flex items-center gap-3 mb-6 text-yellow-500">
                  <SlidersHorizontal size={16} strokeWidth={3} />
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em]">Price Limit</h3>
                </div>
                <label htmlFor="filter-price" className="sr-only">Max Price</label>
                <input
                  id="filter-price"
                  name="price"
                  type="range"
                  min="0"
                  max="100000"
                  value={maxPrice}
                  onChange={e => setMaxPrice(Number(e.target.value))}
                  className="w-full h-1 bg-yellow-900/30 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
                <div className="flex justify-between mt-4 text-[10px] font-semibold text-gray-600">
                  <span>₹0</span>
                  <span className="text-yellow-500">₹{maxPrice.toLocaleString()}</span>
                </div>
              </div>

              {/* Stock */}
              <div>
                <button
                  type="button"
                  aria-pressed={inStockOnly}
                  onClick={() => setInStockOnly(v => !v)}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all ${inStockOnly ? 'border-yellow-500 bg-yellow-500/5' : 'border-yellow-900/20'
                    }`}
                >
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    In Stock Only
                  </span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${inStockOnly ? 'border-yellow-500' : 'border-gray-800'
                    }`}>
                    {inStockOnly && (
                      <div className="w-2 h-2 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          </aside>

          {/* ── Product Grid ─────────────────────────────────────────────── */}
          <main className="flex-1">
            <div className="flex items-center justify-between mb-8 border-b border-yellow-900/10 pb-4">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.2em]">
                {sortedProducts.length} items found
                {hasLocalFilters && hasMore && (
                  <span className="ml-2 text-yellow-600/60">· more may exist</span>
                )}
              </p>
              <div ref={dropdownRef} className="relative hidden lg:block">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(prev => !prev)}
                  className="bg-[#0B1020] border border-[#D4AF37] rounded-[12px] py-3 px-4 text-white text-[15px] font-medium flex items-center justify-between gap-4 cursor-pointer select-none min-w-[220px] transition-all hover:bg-[#1A2238]"
                >
                  <span>{sortOptions.find(opt => opt.value === sort)?.label || 'Newest'}</span>
                  <ChevronDown size={16} className={`text-[#D4AF37] transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
                      exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15, ease: 'easeIn' } }}
                      className="absolute right-0 mt-2 z-30 w-full min-w-[220px] bg-[#0B1020] border border-[#D4AF37] rounded-[12px] shadow-2xl py-1 overflow-hidden"
                    >
                      {sortOptions.map((opt) => {
                        const isSelected = sort === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setSort(opt.value);
                              setDropdownOpen(false);
                            }}
                            className={`w-full flex items-center text-left py-3 px-4 text-[15px] font-medium transition-all ${
                              isSelected
                                ? 'text-[#D4AF37] bg-[#1A2238]'
                                : 'text-white hover:bg-[#1A2238] hover:text-[#D4AF37]'
                            }`}
                          >
                            <span className="w-5 flex items-center justify-center mr-2">
                              {isSelected && <Check size={14} className="text-[#D4AF37]" />}
                            </span>
                            {opt.label}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Loading skeleton — uses ProductSkeleton for premium consistent UX */}
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {[...Array(8)].map((_, i) => (
                  <ProductSkeleton key={`product-skeleton-${i}`} />
                ))}
              </div>

              /* Error state */
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-32 bg-gray-900/30 rounded-[3rem] border border-red-900/20 text-center">
                <AlertCircle size={48} className="text-red-500/50 mb-6" />
                <p className="text-red-500 font-semibold uppercase tracking-widest text-[10px] mb-8">
                  {error?.message || 'Failed to load products.'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="btn-glow bg-red-500/10 border border-red-500/30 text-red-500 px-10 py-3 rounded-full text-xs font-semibold"
                >
                  Retry Fetch
                </button>
              </div>

              /* Empty state */
            ) : sortedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 bg-gray-900/30 rounded-[3rem] border border-yellow-900/10 text-center">
                <Search size={48} className="text-gray-800 mb-6" />
                <p className="text-gray-500 font-semibold uppercase tracking-widest text-[10px]">
                  No products found in the collection
                </p>
              </div>

            ) : (
              <>
                <Helmet>
                  <title>{filter === 'all' ? 'All Collections' : `${filter.toUpperCase()} Collection`} - SMKP TRADERS</title>
                  <meta name="description" content={`Explore premium products under ${filter} at SMKP TRADERS. Find luxury goods at unmatched wholesale prices.`} />
                </Helmet>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                  {sortedProducts.map((product, idx) => {
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
                        key={product.id}
                        className="bg-gray-900/40 rounded-2xl border border-yellow-900/10 overflow-hidden hover:border-yellow-500/30 transition-all flex flex-col relative group"
                      >
                        {showWishlist && (
                          <button
                            onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product); }}
                            className={`absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow transition-colors ${
                              isInWishlist(product.id)
                                ? 'bg-yellow-500 text-black'
                                : 'bg-black/50 backdrop-blur-sm text-gray-400 hover:text-yellow-500 border border-white/5'
                            }`}
                            aria-label="Toggle wishlist"
                          >
                            <Heart size={13} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
                          </button>
                        )}

                        <Link to={`/product/${product.id}`} className="flex flex-col">
                          <div className="overflow-hidden aspect-square relative bg-black">
                            <LazyImage
                              src={getOptimizedImage(product.image, idx < 4 ? 'card' : 'mobile')}
                              srcSet={
                                product.image && product.image.includes('/upload/')
                                  ? `${getOptimizedImage(product.image, 'mobile')} 200w, ${getOptimizedImage(product.image, 'card')} 400w`
                                  : undefined
                              }
                              sizes="(max-width: 640px) 200px, 400px"
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              wrapperClass="w-full h-full"
                              priority={idx < 4}
                            />
                            {showStock && (
                              <>
                                {Number(product.soldCount || 0) >= 50 && (
                                  <div className="absolute top-1.5 left-1.5 z-10 bg-yellow-500 text-black text-[6px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shadow">
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
                                      <div className="absolute bottom-1.5 left-1.5 z-10 bg-orange-600 text-white text-[8px] font-semibold px-2 py-0.5 rounded shadow uppercase tracking-wider">
                                        Only 1 Left
                                      </div>
                                    );
                                  }
                                  if (stock === 2) {
                                    return (
                                      <div className="absolute bottom-1.5 left-1.5 z-10 bg-orange-600 text-white text-[8px] font-semibold px-2 py-0.5 rounded shadow uppercase tracking-wider">
                                        Only 2 Left
                                      </div>
                                    );
                                  }
                                  if (stock === 3) {
                                    return (
                                      <div className="absolute bottom-1.5 left-1.5 z-10 bg-orange-600 text-white text-[8px] font-semibold px-2 py-0.5 rounded shadow uppercase tracking-wider">
                                        Only 3 Left
                                      </div>
                                    );
                                  }
                                  if (stock >= 4 && stock <= 10) {
                                    return (
                                      <div className="absolute bottom-1.5 left-1.5 z-10 bg-yellow-500 text-black text-[8px] font-semibold px-2 py-0.5 rounded shadow uppercase tracking-wider">
                                        Limited Stock
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </>
                            )}

                            {showQuickView && (
                              <div className="absolute bottom-2 inset-x-2 bg-black/70 backdrop-blur-sm py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                                <span className="text-[8px] font-semibold tracking-widest uppercase text-yellow-500">Quick View</span>
                              </div>
                            )}
                          </div>

                          <div className="p-2 flex-grow flex flex-col gap-2 bg-black/10 text-left">
                            <span className="text-[12px] font-semibold text-yellow-500 uppercase tracking-widest">{product.category}</span>
                            <h3 className="type-product-title text-[#F8F8F8] line-clamp-2 group-hover:text-yellow-500 transition-colors" style={{ textTransform: 'none' }}>
                              {product.name}
                            </h3>
                            
                            {showRating && (
                              <div className="flex items-center gap-1 my-0.5">
                                <ProductRating productId={product.id} compact={true} />
                              </div>
                            )}

                            <div className="mt-auto pt-1.5 border-t border-white/5 flex flex-wrap items-baseline gap-2">
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
                        </Link>

                        {/* ── Add to Cart / Out of Stock button ── */}
                        {Number(product.stock || 0) <= 0 ? (
                          <button
                            disabled
                            className="w-full py-3 bg-gray-800 text-gray-500 text-[10px] font-bold uppercase tracking-[0.15em] cursor-not-allowed flex items-center justify-center gap-2 border-t border-white/5"
                            aria-label="Out of stock"
                          >
                            Out of Stock
                          </button>
                        ) : (
                          <button
                            onClick={e => handleQuickAdd(e, product)}
                            className={`w-full py-3 text-[10px] font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 border-t ${
                              addingToCart.has(product.id)
                                ? 'bg-green-500 text-black border-t-green-600'
                                : 'bg-yellow-500 text-black hover:bg-yellow-400 border-t-yellow-600'
                            }`}
                            aria-label="Add to cart"
                          >
                            {addingToCart.has(product.id) ? (
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
                  })}
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-12 pt-8 border-t border-yellow-900/20">
                  <button
                    type="button"
                    disabled={currentPageIndex === 0 || isLoading}
                    onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                    className="px-4 py-2.5 rounded-xl border border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10 transition-all font-semibold disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-[10px] uppercase tracking-widest"
                  >
                    Prev
                  </button>
                  <span className="text-gray-400 font-semibold text-[10px] uppercase tracking-widest">
                    Page {currentPageIndex + 1}
                  </span>
                  <button
                    type="button"
                    disabled={!hasMore || isLoading || isPlaceholderData}
                    onClick={() => setCurrentPageIndex(prev => prev + 1)}
                    className="px-4 py-2.5 rounded-xl bg-yellow-500 text-black hover:bg-yellow-400 transition-all font-semibold disabled:opacity-30 disabled:hover:bg-yellow-500 disabled:cursor-not-allowed text-[10px] uppercase tracking-widest"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filter Drawer overlay */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="fixed inset-0 bg-black z-40 lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 max-h-[80vh] bg-slate-950 border-t border-yellow-950 rounded-t-[2rem] z-50 overflow-y-auto p-6 lg:hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-white">Filters</h3>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="text-yellow-500 text-[10px] font-semibold uppercase tracking-widest"
                >
                  Apply
                </button>
              </div>

              <div className="space-y-8 text-left">
                {/* Search */}
                <div>
                  <div className="flex items-center gap-3 mb-3 text-yellow-500">
                    <Search size={14} />
                    <span className="text-[9px] font-semibold uppercase tracking-widest">Search</span>
                  </div>
                  <label htmlFor="mobile-filter-search" className="sr-only">Search Filter</label>
                  <input
                    id="mobile-filter-search"
                    name="mobileSearch"
                    type="text"
                    placeholder="Find in collection..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-black/60 border border-yellow-900/30 text-white rounded-xl py-2.5 px-4 text-xs font-semibold focus:border-yellow-500 outline-none"
                  />
                </div>

                {/* Categories */}
                <div>
                  <div className="flex items-center gap-3 mb-3 text-yellow-500">
                    <Filter size={14} />
                    <span className="text-[9px] font-semibold uppercase tracking-widest">Category</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[{ name: 'All Collections', slug: 'all' }, ...categories].map(cat => (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => handleFilterChange(cat.slug)}
                        className={`px-3 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-widest border transition-all ${filter === cat.slug
                          ? 'bg-yellow-500 border-yellow-500 text-black'
                          : 'border-yellow-900/20 text-gray-400 hover:text-white'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Limit */}
                <div>
                  <div className="flex items-center gap-3 mb-3 text-yellow-500">
                    <SlidersHorizontal size={14} />
                    <span className="text-[9px] font-semibold uppercase tracking-widest">Price Limit</span>
                  </div>
                  <label htmlFor="mobile-filter-price" className="sr-only">Max Price</label>
                  <input
                    id="mobile-filter-price"
                    name="mobilePrice"
                    type="range"
                    min="0"
                    max="100000"
                    value={maxPrice}
                    onChange={e => setMaxPrice(Number(e.target.value))}
                    className="w-full h-1 bg-yellow-900/30 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                  />
                  <div className="flex justify-between mt-2 text-[9px] font-semibold text-gray-500">
                    <span>₹0</span>
                    <span className="text-yellow-500">₹{maxPrice.toLocaleString()}</span>
                  </div>
                </div>

                {/* In Stock status */}
                <div>
                  <button
                    type="button"
                    onClick={() => setInStockOnly(v => !v)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${inStockOnly ? 'border-yellow-500 bg-yellow-500/5' : 'border-yellow-900/20'}`}
                  >
                    <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">In Stock Only</span>
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${inStockOnly ? 'border-yellow-500' : 'border-gray-800'}`}>
                      {inStockOnly && <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />}
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Sort Drawer overlay */}
      <AnimatePresence>
        {isSortOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSortOpen(false)}
              className="fixed inset-0 bg-black z-40 lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-yellow-950 rounded-t-[2rem] z-50 p-6 lg:hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-white">Sort By</h3>
                <button
                  type="button"
                  onClick={() => setIsSortOpen(false)}
                  className="text-yellow-500 text-[10px] font-semibold uppercase tracking-widest"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setSort(opt.value); setIsSortOpen(false); }}
                    className={`w-full flex items-center justify-between py-3.5 px-4 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all ${sort === opt.value
                      ? 'bg-yellow-500 text-black'
                      : 'text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sort === opt.value && <Check size={12} className={sort === opt.value ? "text-black" : "text-[#D4AF37]"} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Products;