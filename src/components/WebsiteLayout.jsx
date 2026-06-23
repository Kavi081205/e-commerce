import React, { useEffect } from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigationType } from 'react-router-dom';
import Navbar from './Navbar';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Home, Grid, Heart, Package, ShoppingCart } from 'lucide-react';

const WebsiteLayout = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const { getCartCount } = useCart();
  const { wishlistItems } = useWishlist();
  const cartCount = getCartCount();
  const wishlistCount = wishlistItems.length;

  // Save scroll position as the user scrolls
  useEffect(() => {
    const handleScroll = () => {
      try {
        const scrollPositions = JSON.parse(sessionStorage.getItem('web_scroll_positions') || '{}');
        scrollPositions[location.pathname] = window.scrollY;
        sessionStorage.setItem('web_scroll_positions', JSON.stringify(scrollPositions));
      } catch (e) {
        console.warn('Scroll positions save error:', e);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  // Restore scroll position on back/forward (POP) navigation
  useEffect(() => {
    if (navigationType === 'POP') {
      try {
        const scrollPositions = JSON.parse(sessionStorage.getItem('web_scroll_positions') || '{}');
        const savedScroll = scrollPositions[location.pathname] || 0;

        window.scrollTo(0, savedScroll);

        const timers = [
          setTimeout(() => window.scrollTo(0, savedScroll), 50),
          setTimeout(() => window.scrollTo(0, savedScroll), 150),
          setTimeout(() => window.scrollTo(0, savedScroll), 300),
          setTimeout(() => window.scrollTo(0, savedScroll), 600),
        ];

        return () => timers.forEach(clearTimeout);
      } catch (e) {
        console.warn('Scroll position restore error:', e);
      }
    }
  }, [location.pathname, navigationType]);

  const isProductDetails = location.pathname.startsWith('/product/');
  const isCartPage = location.pathname === '/cart';
  // Pages that render their own full-width sticky checkout bar — hide the
  // shared bottom nav and give the footer extra bottom margin so it clears
  // the page-level fixed bar instead.
  const hasPageStickyBar = isProductDetails || isCartPage;

  return (
    <div className={`flex flex-col min-h-screen w-full max-w-full overflow-x-hidden ${hasPageStickyBar ? 'pb-20' : 'pb-16'} md:pb-0`}>
      <Navbar />
      <main className="flex-grow bg-black">
        <Outlet />
      </main>
      <footer className={`bg-gray-950 border-t border-yellow-900/20 text-gray-400 py-10 ${hasPageStickyBar ? 'mb-20' : 'mb-16'} md:mb-0`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="SMKP Traders" className="h-9 w-9 object-contain rounded-md" />
              <div>
                <p className="text-white font-extrabold tracking-widest text-sm">SMKP TRADERS</p>
                <p className="text-yellow-500/70 text-xs tracking-wider">Quality You Can Trust</p>
              </div>
            </div>
            {/* Nav links */}
            <nav aria-label="Footer navigation" className="flex items-center gap-6 text-sm">
              <Link to="/" className="hover:text-yellow-500 transition-colors">Home</Link>
              <Link to="/products" className="hover:text-yellow-500 transition-colors">Products</Link>
              <Link to="/about" className="hover:text-yellow-500 transition-colors">About Us</Link>
              <Link to="/cart" className="hover:text-yellow-500 transition-colors">Cart</Link>
            </nav>
            {/* WhatsApp support */}
            <a
              href="https://wa.me/919677417185"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] text-xs font-bold px-4 py-2 rounded-full transition-all"
              aria-label="WhatsApp Support"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Support: +91 96774 17185
            </a>
            {/* Copyright */}
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} SMKP TRADERS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Bottom Navigation (Mobile) — hidden on pages that have their own sticky checkout bar */}
      {!hasPageStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black/95 backdrop-blur-md border-t border-yellow-900/10 pt-3 px-4 flex justify-around items-center shadow-lg bottom-nav-mobile" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                isActive ? 'text-yellow-500 scale-105' : 'text-gray-500 hover:text-white'
              }`
            }
          >
            <Home size={18} />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/products"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                isActive ? 'text-yellow-500 scale-105' : 'text-gray-500 hover:text-white'
              }`
            }
          >
            <Grid size={18} />
            <span>Store</span>
          </NavLink>

          <NavLink
            to="/wishlist"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                isActive ? 'text-yellow-500 scale-105' : 'text-gray-500 hover:text-white'
              }`
            }
          >
            <Heart size={18} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-yellow-500 text-black text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center shadow-md">
                {wishlistCount}
              </span>
            )}
            <span>Wishlist</span>
          </NavLink>


          <NavLink
            to="/cart"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                isActive ? 'text-yellow-500 scale-105' : 'text-gray-500 hover:text-white'
              }`
            }
          >
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-yellow-600 text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center shadow-md">
                {cartCount}
              </span>
            )}
            <span>Cart</span>
          </NavLink>
        </div>
      )}
    </div>
  );
};

export default WebsiteLayout;
