import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, Heart, Menu, X, Search
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { db } from '../firebase';
import { collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { getOptimizedImage } from '../utils/cloudinary';

/* ─── tiny debounce hook ──────────────────────────────────────────────────── */
const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

/* ─── Search Input (shared between desktop + mobile) ─────────────────────── */
const SearchInput = ({ id, value, onChange, onFocus, onBlur }) => (
  <div className="relative w-full">
    <label htmlFor={id} className="sr-only">Search products</label>
    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
      <Search size={14} className="text-gray-600" />
    </div>
    <input
      id={id}
      name={id}
      type="search"
      autoComplete="off"
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder="Search products..."
      className="w-full bg-white/5 border border-yellow-900/20 rounded-full pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-600 outline-none focus:border-yellow-500/50 focus:bg-white/8 transition-all"
    />
  </div>
);

/* ─── Suggestion Dropdown ─────────────────────────────────────────────────── */
const SuggestionDropdown = ({ suggestions, handleProductClick }) => (
  <div className="absolute top-full left-0 right-0 mt-3 bg-gray-950 border border-yellow-900/40 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl">
    {suggestions.map((product) => (
      <div
        key={product.id}
        onMouseDown={() => handleProductClick(product)}
        onClick={() => handleProductClick(product)}
        className="search-suggestion-item flex items-center gap-4 p-4 hover:bg-yellow-500/10 transition-colors border-b border-yellow-900/20 last:border-0"
      >
        <img src={product.image} className="w-12 h-12 rounded-lg object-cover border border-yellow-900/20 flex-shrink-0" />
        <span className="text-sm font-bold text-white">{product.name}</span>
      </div>
    ))}
  </div>
);



/* ═══════════════════════════════════════════════════════════════════════════ */
/* Customer-only Navbar — never shows admin links.                             */
/* Admin users have their own sidebar in AdminLayout.jsx.                     */
/* ═══════════════════════════════════════════════════════════════════════════ */
const Navbar = () => {
  const { getCartCount, bump } = useCart();
  const { wishlistItems } = useWishlist();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const isLinkActive = useCallback((path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/products') {
      return location.pathname === '/products';
    }
    if (path === '/daily-notes') {
      return location.pathname === '/daily-notes';
    }
    if (path === '/my-orders') {
      return location.pathname === '/my-orders';
    }
    if (path === '/my-complaints') {
      return location.pathname === '/my-complaints';
    }
    if (path === '/about') {
      return location.pathname === '/about';
    }
    return location.pathname === path;
  }, [location]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const debouncedSearch = useDebounce(search, 320);
  const searchRef = useRef(null);

  const cartCount = getCartCount();

  /* ── fetch search suggestions from Firestore ── */
  useEffect(() => {
    if (!debouncedSearch.trim()) { setSuggestions([]); return; }
    const term = debouncedSearch.toLowerCase();
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'products'), orderBy('name'), limit(30))
        );
        const results = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p =>
            p.name?.toLowerCase().includes(term) ||
            p.category?.toLowerCase().includes(term)
          )
          .slice(0, 6);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    })();
  }, [debouncedSearch]);

  /* ── close dropdown on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSuggestionClick = useCallback(() => {
    setSearch('');
    setSuggestions([]);
    setShowDropdown(false);
    setMobileOpen(false);
  }, []);



  const handleProductClick = (product) => {
    const productId = product.id || product.docId || product._id || product.uid;
    navigate(`/product/${productId}`);
    setSearch("");
    setSuggestions([]);
  };

  /* ── nav link style helpers ── */
  const getNavCls = (isActive) =>
    `text-xs font-black tracking-widest uppercase transition-all duration-300 relative group ${isActive ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
    }`;
  const getMobileCls = (isActive) =>
    `block text-lg font-black tracking-widest uppercase py-4 transition-all ${isActive ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
    }`;
  const underline = (isActive) =>
    `absolute -bottom-1 left-0 h-[1px] bg-yellow-500 transition-all duration-300 group-hover:w-full ${isActive ? 'w-full' : 'w-0'
    }`;

  return (
    <nav className="bg-black border-b border-yellow-900/30 sticky top-0 z-50 shadow-2xl shadow-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Desktop Layout ── */}
        <div className="hidden md:flex justify-between items-center h-20">
          <Link
            to="/"
            className="flex items-center flex-shrink-0 transition-transform hover:scale-105 active:scale-95"
          >
            <img
              src={settings?.logoUrl || "/logo.png"}
              alt={settings?.storeName || "SMKP Traders"}
              className="h-14 w-auto object-contain"
            />
          </Link>

          <div className="flex-1 max-w-xs mx-8 relative" ref={searchRef}>
            <SearchInput
              id="nav-search-desktop"
              value={search}
              onChange={setSearch}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            />
            {showDropdown && suggestions.length > 0 && (
              <SuggestionDropdown
                suggestions={suggestions}
                handleProductClick={handleProductClick}
              />
            )}
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className={getNavCls(isLinkActive('/'))}>
              Home <span className={underline(isLinkActive('/'))} />
            </Link>
            <Link to="/products" className={getNavCls(isLinkActive('/products'))}>
              Products <span className={underline(isLinkActive('/products'))} />
            </Link>
            <Link to="/daily-notes" className={getNavCls(isLinkActive('/daily-notes'))}>
              Daily Notes <span className={underline(isLinkActive('/daily-notes'))} />
            </Link>
            <Link to="/my-orders" className={getNavCls(isLinkActive('/my-orders'))}>
              My Orders <span className={underline(isLinkActive('/my-orders'))} />
            </Link>
            <Link to="/my-complaints" className={getNavCls(isLinkActive('/my-complaints'))}>
              My Complaints <span className={underline(isLinkActive('/my-complaints'))} />
            </Link>
            <Link to="/about" className={getNavCls(isLinkActive('/about'))}>
              About <span className={underline(isLinkActive('/about'))} />
            </Link>

            <div className="flex items-center gap-6 pl-8 border-l border-yellow-900/30">
              <Link
                to="/wishlist"
                className="relative group text-gray-400 hover:text-yellow-500 transition-all"
                aria-label="Wishlist"
              >
                <Heart
                  size={20}
                  className="group-hover:scale-110 transition-transform"
                />
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 bg-yellow-500 text-black text-[10px] font-black rounded-full h-4 w-4 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                    {wishlistItems.length}
                  </span>
                )}
              </Link>

              <Link
                to="/cart"
                className="relative group text-gray-400 hover:text-yellow-500 transition-all"
                aria-label="Cart"
              >
                <ShoppingCart
                  size={20}
                  className={`group-hover:scale-110 transition-transform ${bump ? 'animate-bounce text-yellow-500' : ''}`}
                />
                {cartCount > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 bg-yellow-600 text-white text-[10px] font-black rounded-full h-4 w-4 flex items-center justify-center shadow-lg shadow-yellow-600/30">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>


          </div>
        </div>

        {/* ── Flipkart-Style Mobile Header (Dual Row) ── */}
        <div className="md:hidden flex flex-col pt-3 pb-3.5 gap-3">
          {/* Row 1: Menu + Brand Logo + Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(p => !p)}
                className="text-gray-400 hover:text-yellow-500 focus:outline-none transition-colors"
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <Link
                to="/"
                className="flex items-center transition-transform hover:scale-105 active:scale-95"
              >
                <img
                  src={settings?.logoUrl || "/logo.png"}
                  alt={settings?.storeName || "SMKP Traders"}
                  className="h-10 w-auto object-contain"
                />
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/wishlist" className="relative text-gray-400 hover:text-yellow-500 transition-colors" aria-label="Wishlist">
                <Heart size={20} />
                {wishlistItems.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black text-[9px] font-black rounded-full h-3.5 w-3.5 flex items-center justify-center shadow-md">
                    {wishlistItems.length}
                  </span>
                )}
              </Link>
              <Link to="/cart" className="relative text-gray-400 hover:text-yellow-500 transition-colors" aria-label="Cart">
                <ShoppingCart size={20} className={bump ? 'animate-bounce text-yellow-500' : ''} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-yellow-600 text-white text-[9px] font-black rounded-full h-3.5 w-3.5 flex items-center justify-center shadow-md">
                    {cartCount}
                  </span>
                )}
              </Link>

            </div>
          </div>

          {/* Row 2: Search input centred below top bar */}
          <div className="relative w-full" ref={searchRef}>
            <SearchInput
              id="nav-search-mobile"
              value={search}
              onChange={setSearch}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            />
            {showDropdown && suggestions.length > 0 && (
              <SuggestionDropdown
                suggestions={suggestions}
                handleProductClick={handleProductClick}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile menu drawer ── */}
      <div
        className={`md:hidden bg-black border-t border-yellow-900/20 overflow-hidden transition-all duration-500 ease-in-out ${mobileOpen ? 'max-h-[90vh] opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="px-6 py-6 space-y-4">
          <Link to="/" onClick={() => setMobileOpen(false)} className={getMobileCls(isLinkActive('/'))}>
            Home
          </Link>
          <Link to="/products" onClick={() => setMobileOpen(false)} className={getMobileCls(isLinkActive('/products'))}>
            Products
          </Link>
          <Link to="/daily-notes" onClick={() => setMobileOpen(false)} className={getMobileCls(isLinkActive('/daily-notes'))}>
            Daily Notes
          </Link>
          <Link to="/my-orders" onClick={() => setMobileOpen(false)} className={getMobileCls(isLinkActive('/my-orders'))}>
            My Orders
          </Link>
          <Link to="/my-complaints" onClick={() => setMobileOpen(false)} className={getMobileCls(isLinkActive('/my-complaints'))}>
            My Complaints
          </Link>
          <Link to="/about" onClick={() => setMobileOpen(false)} className={getMobileCls(isLinkActive('/about'))}>
            About
          </Link>
          <Link to="/wishlist" onClick={() => setMobileOpen(false)} className={getMobileCls(isLinkActive('/wishlist'))}>
            Wishlist
          </Link>
          <Link to="/cart" onClick={() => setMobileOpen(false)} className={getMobileCls(isLinkActive('/cart'))}>
            Cart
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;