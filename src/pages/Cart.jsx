import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Trash2, Plus, Minus, ArrowRight, ShoppingCart } from 'lucide-react';

import { usePromo } from '../context/PromoContext';
import { getEffectivePrice } from '../utils/pricing';
import { getOptimizedImage } from '../utils/cloudinary';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=75';

const Cart = () => {
  const { cart, removeFromCart, updateQuantity, cartTotal, getCartTotal, clearCart } = useCart();
  const { promoSettings } = usePromo();
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
        <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">Your Cart is Empty</h2>
        <p className="text-gray-600 mb-10 text-center max-w-md font-medium">
          Your shopping cart is empty. Explore our collections to find your favorite products.
        </p>
        <Link
          to="/products"
          className="bg-white text-black font-black py-4 px-12 rounded-full transition-all hover:bg-yellow-500 active:scale-95 uppercase tracking-[0.2em] text-xs"
        >
          Explore Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-16">
          <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.6em] mb-4">Selection</p>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Shopping Cart</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-16">
          <div className="flex-1 space-y-8">
            <div className="bg-gray-900/30 backdrop-blur-xl rounded-[2.5rem] border border-yellow-900/10 overflow-hidden">
              <ul className="divide-y divide-yellow-900/10">
                {cart.map((item) => {
                  const maxStock = getMaxStock(item);
                  return (
                    <li key={item.id} className="p-8 flex flex-col sm:flex-row gap-8 group">
                      <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border border-white/5 flex-shrink-0">
                        <img
                          src={getOptimizedImage(item.image, 'thumbnail', FALLBACK_IMAGE)}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                        />
                      </div>

                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1">
                            <h3 className="text-lg font-black text-white uppercase tracking-wider group-hover:text-yellow-500 transition-colors">
                              <Link to={`/product/${item.productId || item.id}`}>{item.name}</Link>
                            </h3>
                            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">{item.category || 'Product'}</p>
                            {item.color && (
                              <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
                                Color: <span className="text-white font-bold">{typeof item.color === 'object' ? item.color.name : item.color}</span>
                              </p>
                            )}
                            {item.size && (
                              <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
                                Size: <span className="text-white font-bold">{item.size}</span>
                              </p>
                            )}
                          </div>
                          <p className="text-xl font-black text-white">Rs.{(getEffectivePrice(item, promoSettings) * item.quantity).toLocaleString()}</p>
                        </div>

                        <div className="mt-auto flex justify-between items-center">
                          <div className="flex items-center bg-black/50 border border-yellow-900/20 rounded-2xl overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              aria-label={`Decrease quantity of ${item.name}`}
                              className="p-3 text-gray-500 hover:text-yellow-500 transition-colors"
                            >
                              {item.quantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                            </button>
                            <span className="w-12 text-center text-xs font-black text-white">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= maxStock}
                              aria-label={`Increase quantity of ${item.name}`}
                              className="p-3 text-gray-500 hover:text-yellow-500 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <div className="flex items-center gap-6">
                            {item.quantity >= maxStock && (
                              <span className="text-[9px] text-red-500 font-black uppercase tracking-wider">
                                Max Stock ({maxStock})
                              </span>
                            )}
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-gray-600 hover:text-red-500 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              <Trash2 size={14} /> Remove
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
                  className="text-gray-700 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="bg-gray-900/50 backdrop-blur-2xl rounded-[2.5rem] border border-yellow-900/20 p-10 sticky top-32">
              <h2 className="text-[10px] font-black text-white uppercase tracking-[0.5em] mb-10">Order Summary</h2>

              <div className="space-y-6 mb-10">
                <div className="flex justify-between text-gray-500 text-xs font-black uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>Rs.{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-xs font-black uppercase tracking-widest">
                  <span>Shipping</span>
                  <span className="text-yellow-500 font-bold">Calculated at checkout</span>
                </div>
                <div className="border-t border-yellow-900/10 pt-8 flex justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Grand Total</span>
                  <span className="text-3xl font-black gold-text">Rs.{total.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => navigate('/checkout')}
                className="w-full bg-yellow-500 text-black font-black py-5 rounded-2xl flex items-center justify-center transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-yellow-500/10 uppercase tracking-[0.3em] text-[10px]"
              >
                Proceed to Checkout <ArrowRight size={16} className="ml-3" />
              </button>

              <div className="mt-8 text-center">
                <p className="text-[9px] text-gray-700 font-black uppercase tracking-[0.2em]">Secure End-to-End Encrypted Transfer</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;