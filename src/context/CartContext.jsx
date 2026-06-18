import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { usePromo } from './PromoContext';
import { getEffectivePrice } from '../utils/pricing';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

const safeParseCart = () => {
  try {
    const saved = localStorage.getItem('ecommerce_cart');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      console.warn('[CartContext] Cart is not an array. Clearing localStorage.');
      localStorage.removeItem('ecommerce_cart');
      return [];
    }
    // Schema validation and migration
    const migrated = parsed.map(item => {
      if (!item || typeof item !== 'object') return null;
      let id = item.id || item.productId || item.docId || item._id || item.uid;
      if (!id) return null;
      
      // Ensure basic properties exist, otherwise it's a broken old schema
      if (!item.name && !item.title) {
        console.warn('[CartContext] Cart item missing name/title. Filtering out.');
        return null;
      }
      
      return { 
        ...item, 
        id,
        quantity: Number(item.quantity) || 1
      };
    }).filter(Boolean);

    return migrated;
  } catch (err) {
    console.warn('[CartContext] Failed to parse cart from localStorage. Resetting.', err);
    localStorage.removeItem('ecommerce_cart');
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(safeParseCart);
  const [bump, setBump] = useState(false);
  const { promoSettings } = usePromo();

  const triggerBump = useCallback(() => {
    setBump(true);
    const timer = setTimeout(() => setBump(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Save cart to local storage
  useEffect(() => {
    localStorage.setItem('ecommerce_cart', JSON.stringify(cart));
  }, [cart]);

  // Startup cart items validation against Firestore
  useEffect(() => {
    const validateAndCleanupCart = async () => {
      if (cart.length === 0) return;
      console.log("[Cart Startup Validation] Starting validation of cart items:", cart.map(i => i.id));
      
      const validItems = [];
      let changed = false;

      for (const item of cart) {
        const id = item.id;
        const productId = item.productId || id.split('_')[0];
        const firestorePath = `products/${productId}`;
        console.log(`[Cart Startup Validation] Querying Firestore path: ${firestorePath}`);
        try {
          const productRef = doc(db, 'products', productId);
          const productSnap = await getDoc(productRef);
          
          if (productSnap.exists()) {
            validItems.push({
              ...item,
              ...productSnap.data(),
              id: id,
              productId: productId
            });
          } else {
            console.warn(`[Cart Startup Validation] Product ${productId} not found in Firestore. Removing from cart.`);
            changed = true;
          }
        } catch (err) {
          console.error(`[Cart Startup Validation] Failed to query Firestore path ${firestorePath}:`, err);
          // Keep item on network/permission error to prevent aggressive user cart loss
          validItems.push(item);
        }
      }

      if (changed) {
        setCart(validItems);
      }
    };

    validateAndCleanupCart();
  }, []);

  const addToCart = useCallback((product, color = '', size = '', quantity = 1) => {
    let productId = product?.id || product?.productId || product?.docId || product?._id || product?.uid;
    if (!productId) {
      console.error('[CartContext] addToCart called with a product missing an id:', product);
      return;
    }
    
    // Support selected variant options
    const colorName = typeof color === 'object' ? color.name : color;
    const cartItemId = `${productId}_${colorName || ''}_${size || ''}`;
    
    console.log("Cart Stored ID:", cartItemId);
    
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === cartItemId);
      if (existingItem) {
        // Enforce stock check
        let maxStock = Number(product.stock || 0);
        if (product.variants && product.variants.length > 0 && colorName) {
          const variant = product.variants.find(v => (v.colorName || v.color) === colorName);
          if (variant) {
            if (size && variant.sizes) {
              maxStock = Number(variant.sizes[size] || 0);
            } else {
              maxStock = Number(variant.stock || 0);
            }
          }
        }
        const newQuantity = Math.min(existingItem.quantity + quantity, maxStock);
        return prevCart.map((item) =>
          item.id === cartItemId ? { ...item, quantity: newQuantity } : item
        );
      }
      
      // Determine variant-specific image if available
      let itemImage = product.image;
      if (product.variants && product.variants.length > 0 && colorName) {
        const variant = product.variants.find(v => (v.colorName || v.color) === colorName);
        if (variant && variant.images && variant.images.length > 0) {
          itemImage = variant.images[0];
        }
      }

      const lightweightItem = {
        id: cartItemId,
        productId: productId,
        name: product.name || product.title || '',
        price: Number(product.price || 0),
        originalPrice: Number(product.originalPrice ?? product.price ?? 0),
        discount: Number(product.discount || 0),
        image: itemImage || '',
        color: color,
        selectedColor: color,
        size: size,
        quantity: quantity,
        stock: Number(product.stock || 0),
        priceDifference: Number(product.priceDifference || 0),
        variants: product.variants || []
      };
      return [...prevCart, lightweightItem];
    });
    triggerBump();
  }, [triggerBump]);

  const removeFromCart = useCallback((cartItemId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== cartItemId));
  }, []);

  const updateQuantity = useCallback((cartItemId, newQuantity) => {
    if (newQuantity < 1) {
      setCart((prevCart) => prevCart.filter((item) => item.id !== cartItemId));
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id === cartItemId) {
          let maxStock = Number(item.stock || 0);
          const colorName = typeof item.color === 'object' ? item.color.name : item.color;
          if (item.variants && item.variants.length > 0 && colorName) {
            const variant = item.variants.find(v => (v.colorName || v.color) === colorName);
            if (variant) {
              if (item.size && variant.sizes) {
                maxStock = Number(variant.sizes[item.size] || 0);
              } else {
                maxStock = Number(variant.stock || 0);
              }
            }
          }
          const targetQty = Math.min(newQuantity, maxStock);
          return { ...item, quantity: targetQty };
        }
        return item;
      })
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = useMemo(
    () => cart.reduce((total, item) => total + getEffectivePrice(item, promoSettings) * item.quantity, 0),
    [cart, promoSettings]
  );

  const cartCount = useMemo(
    () => cart.reduce((count, item) => count + item.quantity, 0),
    [cart]
  );

  const getCartTotal = useCallback(() => cartTotal, [cartTotal]);
  const getCartCount = useCallback(() => cartCount, [cartCount]);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartTotal,
        cartCount,
        bump,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        getCartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};