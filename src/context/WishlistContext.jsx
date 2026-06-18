import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const WishlistContext = createContext();

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
};

export const WishlistProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setWishlistItems([]);
      setLoading(false);
      return;
    }

    const fetchWishlist = async () => {
      try {
        const wishlistRef = doc(db, 'wishlist', currentUser.uid);
        const docSnap = await getDoc(wishlistRef);

        if (docSnap.exists()) {
          setWishlistItems(docSnap.data().items || []);
        } else {
          setWishlistItems([]);
        }
      } catch (err) {
        console.error("Wishlist Firestore Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlist();
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
    if (!currentUser?.uid) return;
    // fix #1: prevent duplicates
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
      await saveItemsToFirestore(currentUser.uid, updated);
      setWishlistItems(updated);
    } catch (err) {
      console.error("Add to Wishlist Error:", err);
    }
  }, [currentUser?.uid, wishlistItems, isInWishlist, saveItemsToFirestore]);

  const removeFromWishlist = useCallback(async (productId) => {
    if (!currentUser?.uid) return;
    try {
      const updated = wishlistItems.filter(item => item.id !== productId);
      await saveItemsToFirestore(currentUser.uid, updated);
      setWishlistItems(updated);
    } catch (err) {
      console.error("Remove from Wishlist Error:", err);
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