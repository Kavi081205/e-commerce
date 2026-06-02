import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, startAfter, onSnapshot } from 'firebase/firestore';
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

const PRODUCTS_PER_PAGE = 20;
const CATEGORIES = ['all', 'sarees', 'kids dress', 'wheat', 'toys', 'gadgets', 'gifts'];

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */
const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get('category');
  const initialFilter = CATEGORIES.includes(urlCategory) ? urlCategory : 'all';

  // ── filter-state ─────────────────────────────────────────────────────────
  const [filter, setFilter] = useState(initialFilter);
  const [searchTerm, setSearchTerm] = useState('');
  const [maxPrice, setMaxPrice] = useState(100_000);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('none');

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

    const constraints = [orderBy('createdAt', 'desc')];

    if (filter && filter !== 'all') {
      constraints.push(where('category', '==', filter));
    }

    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    constraints.push(limit(PRODUCTS_PER_PAGE));

    const q = query(collection(db, 'products'), ...constraints);

    const unsub = onSnapshot(q, (snapshot) => {
      const productsList = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

      setProductsData({ products: productsList, lastDoc });
      setIsLoading(false);
    }, (err) => {
      console.error("Error subscribing to products catalog:", err);
      setIsError(true);
      setError(err);
      setIsLoading(false);
    });

    return () => unsub();
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-20 text-center lg:text-left">
          <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.6em] mb-4">
            Curated Selection
          </p>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter">
            The Collections
          </h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-16">
          {/* ── Sidebar Filters ─────────────────────────────────────────── */}
          <aside className="w-full lg:w-80 flex-shrink-0 space-y-10">
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
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={filter === cat}
                      onClick={() => handleFilterChange(cat)}
                      className={`w-full text-left px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${filter === cat
                        ? 'bg-yellow-500 text-black shadow-xl shadow-yellow-500/10'
                        : 'text-gray-500 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {cat}
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
            <div className="flex items-center justify-between mb-12 border-b border-yellow-900/10 pb-8">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-10">
                {[...Array(6)].map((_, i) => (
                  <ProductSkeleton key={i} />
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

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-10">
                  {sortedProducts.map((product, idx) => (
                    <div
                      key={product.id}
                      className="luxury-card p-4 rounded-[2.5rem] relative group"
                      style={{ animationDelay: `${(idx % 6) * 100}ms` }}
                    >
                      <button
                        onClick={e => { e.preventDefault(); toggleWishlist(product); }}
                        className={`absolute top-8 right-8 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${isInWishlist(product.id)
                          ? 'bg-yellow-500 text-black shadow-yellow-500/20'
                          : 'bg-black/60 backdrop-blur-md text-gray-500 hover:text-yellow-500 border border-white/10'
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
                        className="block h-full"
                      >
                        <div className="aspect-square overflow-hidden rounded-[2rem] mb-8 relative">
                          <LazyImage
                            src={getHDImage(product.image)}
                            alt={product.name}
                            className={`product-image transition-transform duration-1000 group-hover:scale-110 object-cover ${Number(product.stock) <= 0 ? 'grayscale opacity-50' : ''}`}
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
                        <div className="px-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-yellow-500/60 mb-3 block">
                            {product.category}
                          </span>
                          <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2 leading-tight group-hover:text-yellow-500 transition-colors">
                            {product.name}
                          </h3>
                          <div className="mb-4">
                            <ProductRating productId={product.id} />
                          </div>
                          <div className="flex items-center justify-between border-t border-white/5 pt-6">
                            {getEffectivePrice(product, promoSettings) < Number(product.price) ? (
                              <div className="flex items-center gap-3">
                                <span className="text-xl font-black text-white">
                                  ₹{getEffectivePrice(product, promoSettings).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-gray-600 line-through font-bold">
                                  ₹{Number(product.price).toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <p className="text-xl font-black text-white">
                                ₹{Number(product.price || 0).toLocaleString()}
                              </p>
                            )}
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-yellow-500 transition-all group-hover:scale-110 group-hover:text-black text-gray-600">
                              <ArrowRight size={14} />
                            </div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-16 pt-8 border-t border-yellow-900/20">
                  <button
                    type="button"
                    disabled={currentPageIndex === 0 || isLoading}
                    onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                    className="px-6 py-3 rounded-xl border border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10 transition-all font-semibold disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-xs uppercase tracking-widest"
                  >
                    Previous
                  </button>
                  <span className="text-gray-400 font-black text-xs uppercase tracking-widest">
                    Page {currentPageIndex + 1}
                  </span>
                  <button
                    type="button"
                    disabled={!hasMore || isLoading || isPlaceholderData}
                    onClick={() => setCurrentPageIndex(prev => prev + 1)}
                    className="px-6 py-3 rounded-xl bg-yellow-500 text-black hover:bg-yellow-400 transition-all font-semibold disabled:opacity-30 disabled:hover:bg-yellow-500 disabled:cursor-not-allowed text-xs uppercase tracking-widest"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Products;