import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { useWishlist } from '../context/WishlistContext';
import {
  Search, Filter, SlidersHorizontal,
  Heart, AlertCircle, Loader2, ArrowRight
} from 'lucide-react';
import { usePromo } from '../context/PromoContext';
import { getEffectivePrice } from '../utils/pricing';
import { getOptimizedImage, getHDImage } from '../utils/cloudinary';
import LazyImage from '../components/LazyImage';
import { ProductSkeleton } from '../components/Skeleton';
import ProductRating from '../components/ProductRating';
import { motion, AnimatePresence } from 'framer-motion';

const PRODUCTS_PER_PAGE = 20;

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */
const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get('category');
  const [filter, setFilter] = useState(urlCategory || 'all');
  const [categories, setCategories] = useState([]);

  // Load categories once (static admin data — no real-time needed)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const q = query(
          collection(db, 'categories'),
          where('active', '==', true),
          orderBy('order', 'asc')
        );
        const snap = await getDocs(q);
        setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Firestore categories query error:', err.code, err.message);
      }
    };
    fetchCategories();
  }, []);

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
  }, [filter, currentPageIndex, cursor, retryTrigger]);

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
    const priceA = getEffectivePrice(a, promoSettings);
    const priceB = getEffectivePrice(b, promoSettings);
    if (sort === 'price-asc') return priceA - priceB;
    if (sort === 'price-desc') return priceB - priceA;
    return 0;
  });

  /* ─────────────────────────────────────────────────────────────────────────
     Render
  ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 pb-24">
        <div className="mb-8 lg:mb-20 text-center lg:text-left">
          <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.6em] mb-4">
            Curated Selection
          </p>
          <h1 className="text-3xl md:text-6xl font-black text-white tracking-tighter uppercase">
            The Collections
          </h1>
        </div>

        {/* Horizontal scroll categories for mobile */}
        <div className="flex lg:hidden flex-nowrap gap-2 overflow-x-auto scrollbar-none py-3 mb-6 border-y border-yellow-900/10 select-none touch-pan-x">
          {[{ name: 'All', slug: 'all' }, ...categories].map(cat => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => handleFilterChange(cat.slug)}
              className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border flex-shrink-0 transition-all ${filter === cat.slug
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
            className="flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 border-r border-yellow-900/10 active:bg-yellow-500/10"
          >
            <SlidersHorizontal size={12} /> Sort
          </button>
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 active:bg-yellow-500/10"
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
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Search</h3>
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
                    className="w-full bg-black/50 border border-yellow-900/30 text-white rounded-2xl py-3.5 px-5 text-sm focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/50 outline-none transition-all placeholder:text-gray-700 font-bold"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <div className="flex items-center gap-3 mb-6 text-yellow-500">
                  <Filter size={16} strokeWidth={3} />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Category</h3>
                </div>
                <div className="space-y-3">
                  {[{ name: 'All Collections', slug: 'all' }, ...categories].map(cat => (
                    <button
                      key={cat.slug}
                      type="button"
                      aria-pressed={filter === cat.slug}
                      onClick={() => handleFilterChange(cat.slug)}
                      className={`w-full text-left px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${filter === cat.slug
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
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Price Limit</h3>
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
                <div className="flex justify-between mt-4 text-[10px] font-black text-gray-600">
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
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
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
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                {sortedProducts.length} items found
                {hasLocalFilters && hasMore && (
                  <span className="ml-2 text-yellow-600/60">· more may exist</span>
                )}
              </p>
              <label htmlFor="product-sort" className="sr-only">Sort By</label>
              <select
                id="product-sort"
                name="sort"
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="bg-transparent border-0 text-[10px] font-black text-yellow-500 uppercase tracking-widest focus:ring-0 cursor-pointer"
              >
                <option value="none">Sort: Newest</option>
                <option value="price-asc">Price: Ascending</option>
                <option value="price-desc">Price: Descending</option>
              </select>
            </div>

            {/* Loading skeleton */}
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={`product-skeleton-${i}`} className="animate-pulse bg-gray-900/50 h-[260px] rounded-2xl border border-white/5" />
                ))}
              </div>

              /* Error state */
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-32 bg-gray-900/30 rounded-[3rem] border border-red-900/20 text-center">
                <AlertCircle size={48} className="text-red-500/50 mb-6" />
                <p className="text-red-500 font-black uppercase tracking-widest text-[10px] mb-8">
                  {error?.message || 'Failed to load products.'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="btn-glow bg-red-500/10 border border-red-500/30 text-red-500 px-10 py-3 rounded-full text-xs font-black"
                >
                  Retry Fetch
                </button>
              </div>

              /* Empty state */
            ) : sortedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 bg-gray-900/30 rounded-[3rem] border border-yellow-900/10 text-center">
                <Search size={48} className="text-gray-800 mb-6" />
                <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">
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
                    return (
                      <div
                        key={product.id}
                        className="bg-gray-900/40 rounded-2xl border border-yellow-900/10 overflow-hidden hover:border-yellow-500/30 transition-all flex flex-col h-full relative group"
                      >
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

                        <Link to={`/product/${product.id}`} className="flex flex-col h-full">
                          <div className="overflow-hidden aspect-square relative bg-black">
                            <LazyImage
                              src={getOptimizedImage(product.image, 'card')}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              wrapperClass="w-full h-full"
                            />
                            {Number(product.soldCount || 0) >= 50 && (
                              <div className="absolute top-1.5 left-1.5 z-10 bg-yellow-500 text-black text-[6px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow">
                                🏆 Best Seller
                              </div>
                            )}
                            {Number(product.stock || 0) <= 0 ? (
                              <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
                                <span className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider rotate-[-10deg]">
                                  OUT OF STOCK
                                </span>
                              </div>
                            ) : Number(product.stock || 0) <= 5 ? (
                              <div className="absolute bottom-1.5 left-1.5 z-10 bg-red-600 text-white text-[6px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow">
                                ⚠ LOW STOCK ({product.stock})
                              </div>
                            ) : null}
                          </div>

                          <div className="p-2 flex-grow flex flex-col gap-0.5 bg-black/10 text-left">
                            <span className="text-[7px] font-bold text-yellow-500/60 uppercase tracking-widest">{product.category}</span>
                            <h3 className="text-[11px] font-black text-white uppercase tracking-wide truncate group-hover:text-yellow-500 transition-colors">
                              {product.name}
                            </h3>
                            
                            <div className="flex items-center gap-1 my-0.5">
                              <ProductRating productId={product.id} compact={true} />
                            </div>

                            <div className="mt-auto pt-1.5 border-t border-white/5 flex flex-wrap items-baseline gap-1">
                              <span className="text-xs font-black text-white">₹{effPrice.toLocaleString()}</span>
                              {discountPercent > 0 && (
                                <>
                                  <span className="text-[9px] text-gray-500 line-through font-medium">₹{origPrice.toLocaleString()}</span>
                                  <span className="text-[9px] text-green-500 font-black">{discountPercent}% off</span>
                                </>
                              )}
                            </div>
                          </div>
                        </Link>
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
                  <span className="text-gray-400 font-black text-[10px] uppercase tracking-widest">
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
                <h3 className="text-xs font-black uppercase tracking-widest text-white">Filters</h3>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="text-yellow-500 text-[10px] font-black uppercase tracking-widest"
                >
                  Apply
                </button>
              </div>

              <div className="space-y-8 text-left">
                {/* Search */}
                <div>
                  <div className="flex items-center gap-3 mb-3 text-yellow-500">
                    <Search size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Search</span>
                  </div>
                  <label htmlFor="mobile-filter-search" className="sr-only">Search Filter</label>
                  <input
                    id="mobile-filter-search"
                    name="mobileSearch"
                    type="text"
                    placeholder="Find in collection..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-black/60 border border-yellow-900/30 text-white rounded-xl py-2.5 px-4 text-xs font-bold focus:border-yellow-500 outline-none"
                  />
                </div>

                {/* Categories */}
                <div>
                  <div className="flex items-center gap-3 mb-3 text-yellow-500">
                    <Filter size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Category</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[{ name: 'All Collections', slug: 'all' }, ...categories].map(cat => (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => handleFilterChange(cat.slug)}
                        className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${filter === cat.slug
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
                    <span className="text-[9px] font-black uppercase tracking-widest">Price Limit</span>
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
                  <div className="flex justify-between mt-2 text-[9px] font-bold text-gray-500">
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
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">In Stock Only</span>
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
                <h3 className="text-xs font-black uppercase tracking-widest text-white">Sort By</h3>
                <button
                  type="button"
                  onClick={() => setIsSortOpen(false)}
                  className="text-yellow-500 text-[10px] font-black uppercase tracking-widest"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { value: 'none', label: 'Sort: Newest' },
                  { value: 'price-asc', label: 'Price: Low to High' },
                  { value: 'price-desc', label: 'Price: High to Low' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setSort(opt.value); setIsSortOpen(false); }}
                    className={`w-full text-left py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${sort === opt.value
                      ? 'bg-yellow-500 text-black'
                      : 'text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    {opt.label}
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