import React from 'react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShoppingCart, Trash2, ArrowRight } from 'lucide-react'; // removed unused PackageSearch
import PageHeader from '../components/PageHeader';
import { Link } from 'react-router-dom';
import { getOptimizedImage } from '../utils/cloudinary';
import { usePromo } from '../context/PromoContext';
import { getEffectivePrice } from '../utils/pricing';

const Wishlist = () => {
  const { wishlistItems, removeFromWishlist, loading } = useWishlist();
  const { addToCart } = useCart();
  const { promoSettings } = usePromo();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-black">
        <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 font-black uppercase tracking-[0.4em] text-[9px]">Loading Wishlist...</p>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <PageHeader
          title="My Wishlist"
          breadcrumbs={[{ label: 'Wishlist', path: '/wishlist' }]}
        />

        {wishlistItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-32 bg-gray-900/30 rounded-[3rem] border border-yellow-900/10 text-center mt-12 shadow-2xl"
          >
            <div className="w-32 h-32 bg-yellow-500/5 text-yellow-500 rounded-full flex items-center justify-center mb-10 border border-yellow-500/20">
              <Heart size={48} strokeWidth={1} />
            </div>
            <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Wishlist is Empty</h2>
            <p className="text-gray-600 font-medium mb-12 max-w-sm uppercase text-[10px] tracking-[0.2em] leading-relaxed">
              Your curated wishlist awaits its first selection. Discover our products to build your wishlist.
            </p>
            <Link
              to="/products"
              className="group flex items-center gap-4 bg-white text-black font-black py-4 px-12 rounded-full transition-all hover:bg-yellow-500 active:scale-95 uppercase tracking-[0.2em] text-[10px]"
            >
              Browse Products
              <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mt-12">
            <AnimatePresence>
              {wishlistItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="luxury-card p-4 rounded-[2.5rem] group"
                >
                  <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-6">
                    <img
                      src={getOptimizedImage(item.image, 'best')}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-110"
                      onError={(e) => { e.currentTarget.src = '/placeholder.png'; }} // fix #2
                    />
                    <button
                      onClick={() => removeFromWishlist(item.id)}
                      className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-md text-gray-400 rounded-full flex items-center justify-center border border-white/10 hover:text-red-500 transition-all"
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="px-2 pb-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2 truncate group-hover:text-yellow-500 transition-colors">
                      {item.name}
                    </h3>
                    {/* Dynamic offer calculation */}
                    {(() => {
                      const effPrice = getEffectivePrice(item, promoSettings);
                      const origPrice = Number(item.originalPrice ?? item.price ?? 0);
                      const discountPercent = origPrice > effPrice ? Math.round(((origPrice - effPrice) / origPrice) * 100) : 0;
                      return (
                        <div className="flex items-baseline gap-2 mb-6">
                          <span className="text-xl font-black text-white">₹{effPrice.toLocaleString()}</span>
                          {discountPercent > 0 && (
                            <>
                              <span className="text-xs text-gray-500 line-through font-semibold">₹{origPrice.toLocaleString()}</span>
                              <span className="text-xs text-green-500 font-black">{discountPercent}% OFF</span>
                            </>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          addToCart(item);
                          removeFromWishlist(item.id);
                        }}
                        className="flex-1 bg-white text-black font-black py-3.5 rounded-2xl flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest hover:bg-yellow-500 transition-all"
                      >
                        <ShoppingCart size={14} /> Add to Cart
                      </button>
                      <Link
                        to={`/product/${item.id}`}
                        className="w-12 h-12 bg-gray-900/50 border border-yellow-900/10 text-yellow-500 rounded-2xl flex items-center justify-center hover:bg-yellow-500 hover:text-black transition-all"
                        aria-label={`View ${item.name}`}
                      >
                        <ArrowRight size={18} />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;