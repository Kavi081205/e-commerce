import React, { createContext, useContext, useState, useEffect } from 'react';
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
    if (!currentUser) {
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
          await setDoc(wishlistRef, { items: [] });
        }
      } catch (err) {
        console.error("Wishlist Firestore Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlist();
  }, [currentUser]);

  // fix #2: use setDoc with merge to avoid NOT_FOUND if doc doesn't exist yet
  const saveItemsToFirestore = async (uid, items) => {
    const wishlistRef = doc(db, 'wishlist', uid);
    await setDoc(wishlistRef, { items }, { merge: true });
  };

  const addToWishlist = async (product) => {
    if (!currentUser) return;
    // fix #1: prevent duplicates
    if (isInWishlist(product.id)) return;
    try {
      const updated = [...wishlistItems, product];
      await saveItemsToFirestore(currentUser.uid, updated);
      setWishlistItems(updated);
    } catch (err) {
      console.error("Add to Wishlist Error:", err);
    }
  };

  const removeFromWishlist = async (productId) => {
    if (!currentUser) return;
    try {
      const updated = wishlistItems.filter(item => item.id !== productId);
      await saveItemsToFirestore(currentUser.uid, updated);
      setWishlistItems(updated);
    } catch (err) {
      console.error("Remove from Wishlist Error:", err);
    }
  };

  const isInWishlist = (productId) => {
    return wishlistItems.some(item => item.id === productId);
  };

  const toggleWishlist = async (product) => {
    if (isInWishlist(product.id)) {
      await removeFromWishlist(product.id);
    } else {
      await addToWishlist(product);
    }
  };

  return (
    <WishlistContext.Provider value={{ wishlistItems, loading, addToWishlist, removeFromWishlist, isInWishlist, toggleWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};