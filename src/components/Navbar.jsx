import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Heart, Menu, X, User, Search
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
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
    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
      <Search size={14} className="text-gray-600" />
    </div>
    <input
      id={id}
      name={id || 'search'}
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

const getShortName = (user) => {
  if (!user) return '';
  if (user.displayName) {
    return user.displayName.trim().split(/\s+/)[0];
  }
  if (user.email) {
    return user.email.split('@')[0];
  }
  return 'User';
};

const getInitials = (user) => {
  if (!user) return 'U';
  if (user.displayName) {
    const parts = user.displayName.trim().split(/\s+/);
    if (parts.length > 0 && parts[0]) {
      return parts[0][0].toUpperCase();
    }
  }
  if (user.email) {
    return user.email[0].toUpperCase();
  }
  return 'U';
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Customer-only Navbar — never shows admin links.                             */
/* Admin users have their own sidebar in AdminLayout.jsx.                     */
/* ═══════════════════════════════════════════════════════════════════════════ */
const Navbar = () => {
  const { getCartCount, bump } = useCart();
  const { currentUser, logout, isAdmin } = useAuth();
  const { wishlistItems } = useWishlist();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [currentUser?.uid]);

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

  const handleLogout = useCallback(async () => {
    setMobileOpen(false);
    try { await logout(); navigate('/'); } catch (err) { console.error(err); }
  }, [logout, navigate]);

  const handleProfileClick = useCallback(() => {
    navigate('/profile');
  }, [navigate]);

  const handleProductClick = (product) => {
    const productId = product.id || product.docId || product._id || product.uid;
    navigate(`/product/${productId}`);
    setSearch("");
    setSuggestions([]);
  };

  /* ── nav link style helpers ── */
  const navCls = ({ isActive }) =>
    `text-xs font-black tracking-widest uppercase transition-all duration-300 relative group ${isActive ? 'text-yellow-500' : 'text-gray-400 hover:text-white'
    }`;
  const mobileCls = ({ isActive }) =>
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
              src="/logo.png"
              alt="SMKP Traders"
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

          <div className="hidden md:flex items-center space-x-10">
            <NavLink to="/" end className={navCls}>
              {({ isActive }) => (
                <> Home <span className={underline(isActive)} /> </>
              )}
            </NavLink>
            <NavLink to="/products" end className={navCls}>
              {({ isActive }) => (
                <> Products <span className={underline(isActive)} /> </>
              )}
            </NavLink>

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

            <div className="flex items-center gap-6">
              {currentUser ? (
                <>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="text-[10px] font-black uppercase tracking-widest text-yellow-500 hover:text-white transition-colors"
                    >
                      Dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleProfileClick}
                    className="flex items-center gap-2.5 group focus:outline-none"
                    aria-label="Profile"
                  >
                    {currentUser.photoURL && !imgFailed ? (
                      <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-yellow-500/30 group-hover:border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.1)] group-hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all duration-300 flex items-center justify-center bg-slate-950">
                        <img
                          src={currentUser.photoURL}
                          alt={currentUser.displayName || 'Profile'}
                          className="w-full h-full object-cover"
                          onError={() => setImgFailed(true)}
                        />
                      </div>
                    ) : currentUser.photoURL && imgFailed ? (
                      <div className="w-9 h-9 rounded-full bg-slate-950 flex items-center justify-center text-yellow-500 border-2 border-yellow-500/30 group-hover:border-yellow-500 group-hover:bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.1)] group-hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all duration-300">
                        <User size={16} className="text-yellow-500" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 font-black text-xs border-2 border-yellow-500/30 group-hover:border-yellow-500 group-hover:bg-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)] group-hover:shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all duration-300">
                        {getInitials(currentUser)}
                      </div>
                    )}
                    <span className="hidden lg:inline text-xs font-black text-gray-300 group-hover:text-yellow-500 uppercase tracking-widest transition-colors duration-300">
                      {getShortName(currentUser)}
                    </span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-yellow-500 transition-colors"
                  >
                    Exit
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="text-[10px] font-black uppercase tracking-widest text-yellow-500 border border-yellow-500/40 hover:bg-yellow-500 hover:text-black px-6 py-2.5 rounded-full transition-all hover:shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                >
                  Login
                </Link>
              )}
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
                  src="/logo.png"
                  alt="SMKP Traders"
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
              {currentUser ? (
                <button
                  onClick={handleProfileClick}
                  className="flex items-center gap-1.5 group focus:outline-none animate-fadeIn"
                  aria-label="Profile"
                >
                  {currentUser.photoURL && !imgFailed ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-yellow-500/30 shadow-[0_0_5px_rgba(234,179,8,0.1)] transition-all duration-300 flex items-center justify-center bg-slate-950">
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || 'Profile'}
                        className="w-full h-full object-cover"
                        onError={() => setImgFailed(true)}
                      />
                    </div>
                  ) : currentUser.photoURL && imgFailed ? (
                    <div className="w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center text-yellow-500 border-2 border-yellow-500/30 shadow-[0_0_5px_rgba(234,179,8,0.1)] transition-all duration-300">
                      <User size={14} className="text-yellow-500" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 font-black text-[10px] border-2 border-yellow-500/30 transition-all duration-300">
                      {getInitials(currentUser)}
                    </div>
                  )}
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider max-w-[60px] truncate">
                    {getShortName(currentUser)}
                  </span>
                </button>
              ) : (
                <Link
                  to="/login"
                  className="text-[9px] font-black uppercase tracking-widest text-yellow-500 border border-yellow-500/30 px-3 py-1.5 rounded-full hover:bg-yellow-500 hover:text-black transition-all"
                >
                  Login
                </Link>
              )}
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
          <NavLink to="/" end onClick={() => setMobileOpen(false)} className={mobileCls}>
            Home
          </NavLink>
          <NavLink to="/products" end onClick={() => setMobileOpen(false)} className={mobileCls}>
            Products
          </NavLink>
          <div className="pt-4 border-t border-yellow-900/10 space-y-4">
            {currentUser ? (
              <>
                <div className="flex items-center gap-4 pb-4 border-b border-yellow-900/10">
                  {currentUser.photoURL && !imgFailed ? (
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-yellow-500/30 flex items-center justify-center bg-slate-950">
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || 'Profile'}
                        className="w-full h-full object-cover"
                        onError={() => setImgFailed(true)}
                      />
                    </div>
                  ) : currentUser.photoURL && imgFailed ? (
                    <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center text-yellow-500 border-2 border-yellow-500/30">
                      <User size={20} className="text-yellow-500" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 font-black text-base border-2 border-yellow-500/30">
                      {getInitials(currentUser)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white uppercase tracking-wider truncate">{currentUser.displayName || 'User'}</p>
                    <p className="text-[10px] text-gray-500 font-medium tracking-wide truncate">{currentUser.email}</p>
                  </div>
                </div>

                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="block w-full py-3 bg-yellow-500 text-black text-center font-black uppercase tracking-widest rounded-xl text-xs"
                  >
                    Dashboard
                  </Link>
                )}
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 text-gray-400 font-bold uppercase tracking-widest text-xs py-2"
                >
                  <User size={16} /> Account
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 text-red-500 font-bold uppercase tracking-widest text-xs py-2 w-full text-left"
                >
                  <X size={16} /> Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="block w-full py-3 bg-yellow-500 text-black text-center font-black uppercase tracking-widest rounded-xl text-xs"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;