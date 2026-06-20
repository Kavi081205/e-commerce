import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const WishlistContext = createContext();

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
};

/**
 * Validates a product against Firestore — returns true if it should remain visible.
 * Returns null on definite deletion, 'keep' on network error.
 */
const validateWishlistProduct = async (item) => {
  const productId = item?.id;
  if (!productId) return null;
  try {
    const docRef = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log(`[WishlistValidation] Product ${productId} deleted — removing from wishlist.`);
      return null;
    }

    const data = docSnap.data();
    // Check all inactive/deleted/hidden flags
    if (
      data.deleted === true ||
      data.isActive === false ||
      data.hidden === true ||
      data.visibility === false ||
      data.status === 'inactive' ||
      data.status === 'deleted'
    ) {
      console.log(`[WishlistValidation] Product ${productId} is inactive — removing from wishlist.`);
      return null;
    }

    // Return item with refreshed volatile fields
    return {
      ...item,
      name:          data.name          ?? item.name,
      price:         data.price         ?? item.price,
      originalPrice: data.originalPrice ?? item.originalPrice,
      image:         data.image         ?? item.image,
      stock:         data.stock         ?? item.stock,
      soldCount:     data.soldCount      ?? item.soldCount,
    };
  } catch (err) {
    console.warn(`[WishlistValidation] Network error for ${productId} — keeping item:`, err);
    return item; // Keep on transient network errors
  }
};

export const WishlistProvider = ({ children }) => {
  const currentUser = null;
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initWishlist = async () => {
      let rawItems = [];

      if (!currentUser?.uid) {
        try {
          const stored = localStorage.getItem('wishlist');
          rawItems = stored ? JSON.parse(stored) : [];
          if (!Array.isArray(rawItems)) rawItems = [];
        } catch (err) {
          console.error('Wishlist LocalStorage Error:', err);
          rawItems = [];
        }
      } else {
        try {
          const wishlistRef = doc(db, 'wishlist', currentUser.uid);
          const docSnap = await getDoc(wishlistRef);
          rawItems = docSnap.exists() ? (docSnap.data().items || []) : [];
        } catch (err) {
          console.error('Wishlist Firestore Error:', err);
          setWishlistItems([]);
          setLoading(false);
          return;
        }
      }

      // Validate each item — remove deleted/inactive products
      if (rawItems.length > 0) {
        const results = await Promise.all(rawItems.map(validateWishlistProduct));
        const validItems = results.filter(Boolean);

        if (validItems.length !== rawItems.length) {
          console.log(`[WishlistValidation] Removed ${rawItems.length - validItems.length} invalid item(s).`);
          // Persist cleaned list
          if (!currentUser?.uid) {
            try { localStorage.setItem('wishlist', JSON.stringify(validItems)); }
            catch (e) { /* non-critical */ }
          } else {
            try {
              const wishlistRef = doc(db, 'wishlist', currentUser.uid);
              await setDoc(wishlistRef, { items: validItems }, { merge: true });
            } catch (e) { /* non-critical */ }
          }
        }

        setWishlistItems(validItems);
      } else {
        setWishlistItems([]);
      }

      setLoading(false);
    };

    initWishlist();
  }, [currentUser?.uid]);

  // fix #2: use setDoc with merge to avoid NOT_FOUND if doc doesn't exist yet
  const saveItemsToFirestore = useCallback(async (uid, items) => {
    const wishlistRef = doc(db, 'wishlist', uid);
    await setDoc(wishlistRef, { items }, { merge: true });
  }, []);

  const isInWishlist = useCallback((productId) => {
    return wishlistItems.some(item => item.id === productId);
  }, [wishlistItems]);

  const addToWishlist = useCallback(async (product) => {
    if (isInWishlist(product.id)) return;
    try {
      const lightweightItem = {
        id: product.id,
        name: product.name || product.title || '',
        price: Number(product.price || 0),
        originalPrice: Number(product.originalPrice ?? product.price ?? 0),
        image: product.image || '',
        category: product.category || '',
        stock: Number(product.stock || 0),
        soldCount: Number(product.soldCount || 0)
      };
      const updated = [...wishlistItems, lightweightItem];
      if (currentUser?.uid) {
        await saveItemsToFirestore(currentUser.uid, updated);
      } else {
        localStorage.setItem('wishlist', JSON.stringify(updated));
      }
      setWishlistItems(updated);
    } catch (err) {
      console.error('Add to Wishlist Error:', err);
    }
  }, [currentUser?.uid, wishlistItems, isInWishlist, saveItemsToFirestore]);

  const removeFromWishlist = useCallback(async (productId) => {
    try {
      const updated = wishlistItems.filter(item => item.id !== productId);
      if (currentUser?.uid) {
        await saveItemsToFirestore(currentUser.uid, updated);
      } else {
        localStorage.setItem('wishlist', JSON.stringify(updated));
      }
      setWishlistItems(updated);
    } catch (err) {
      console.error('Remove from Wishlist Error:', err);
    }
  }, [currentUser?.uid, wishlistItems, saveItemsToFirestore]);

  const toggleWishlist = useCallback(async (product) => {
    if (isInWishlist(product.id)) {
      await removeFromWishlist(product.id);
    } else {
      await addToWishlist(product);
    }
  }, [isInWishlist, addToWishlist, removeFromWishlist]);

  const value = useMemo(() => ({
    wishlistItems,
    loading,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    toggleWishlist
  }), [wishlistItems, loading, addToWishlist, removeFromWishlist, isInWishlist, toggleWishlist]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};