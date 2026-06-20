/**
 * useValidatedProducts.js
 *
 * Validates a list of locally-stored product objects against Firestore.
 * Removes products that:
 *  - No longer exist (hard-deleted)
 *  - Are marked inactive (isActive === false)
 *  - Are marked deleted (deleted === true)
 *  - Are explicitly hidden (hidden === true / visibility === false)
 *
 * Updates the provided localStorage key automatically.
 *
 * Usage:
 *   const { validProducts, loading } = useValidatedProducts('recentlyViewed', rawList);
 */

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Checks whether a Firestore product document snapshot represents
 * a product that should be visible to customers.
 *
 * Returns true  → product is valid and should be shown
 * Returns false → product is deleted/inactive/hidden and must be removed
 */
const isProductValid = (data) => {
  if (!data) return false;

  // Hard checks — any of these conditions means "not displayable"
  if (data.deleted === true)    return false;
  if (data.isActive === false)  return false;
  if (data.hidden === true)     return false;
  if (data.visibility === false) return false;
  if (data.status === 'inactive' || data.status === 'deleted') return false;

  return true;
};

/**
 * Fetches a single product directly from Firestore (bypasses cache).
 * Returns the product data if valid, null otherwise.
 */
const fetchAndValidateProduct = async (productId) => {
  if (!productId) return null;
  try {
    const docRef = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log(`[ProductValidation] Product ${productId} not found — removing.`);
      return null;
    }

    const data = docSnap.data();
    if (!isProductValid(data)) {
      console.log(`[ProductValidation] Product ${productId} is inactive/deleted — removing.`);
      return null;
    }

    // Return merged data (preserves locally-stored fields like selectedColor/size)
    return { id: docSnap.id, ...data };
  } catch (err) {
    console.warn(`[ProductValidation] Failed to verify product ${productId}:`, err);
    // On network error: keep the item (don't aggressively remove on transient errors)
    return 'KEEP_ON_ERROR';
  }
};

/**
 * Hook: validates a list of stored product items against Firestore.
 *
 * @param {string}   storageKey  - localStorage key to read from / write to
 * @param {Array}    rawItems    - raw array of product objects from localStorage
 * @param {Function} [getItemId] - optional fn to extract product ID from an item (default: item.id)
 * @returns {{ validItems: Array, loading: boolean }}
 */
export const useValidatedProducts = (storageKey, rawItems, getItemId = (item) => item.id) => {
  const [validItems, setValidItems] = useState([]);
  const [loading, setLoading]       = useState(rawItems.length > 0);

  useEffect(() => {
    // Nothing to validate
    if (!rawItems || rawItems.length === 0) {
      setValidItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const validate = async () => {
      setLoading(true);

      const results = await Promise.all(
        rawItems.map(async (item) => {
          const productId = getItemId(item);
          if (!productId) return null;

          const freshData = await fetchAndValidateProduct(productId);

          // Network error → keep original item without refreshing fields
          if (freshData === 'KEEP_ON_ERROR') return item;

          // Deleted / not found
          if (freshData === null) return null;

          // Valid — merge fresh Firestore data with locally-stored variant info
          return {
            ...item,
            // Refresh volatile fields that may have changed (price, image, stock)
            name:          freshData.name          ?? item.name,
            price:         freshData.price         ?? item.price,
            originalPrice: freshData.originalPrice ?? item.originalPrice,
            image:         freshData.image         ?? item.image,
            stock:         freshData.stock         ?? item.stock,
            soldCount:     freshData.soldCount      ?? item.soldCount,
            category:      freshData.category      ?? item.category,
          };
        })
      );

      if (cancelled) return;

      const kept = results.filter(Boolean);
      setValidItems(kept);

      // Persist cleaned list back to localStorage
      if (storageKey && kept.length !== rawItems.length) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(kept));
          console.log(`[ProductValidation] Cleaned ${rawItems.length - kept.length} invalid item(s) from "${storageKey}".`);
        } catch (e) {
          console.warn('[ProductValidation] localStorage write failed:', e);
        }
      } else {
        // Even if count didn't change, store refreshed data
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(kept));
          } catch (e) { /* non-critical */ }
        }
      }

      setLoading(false);
    };

    validate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, rawItems.length]);

  return { validItems, loading };
};

/**
 * Standalone utility — validates an array of product IDs and returns only valid ones.
 * Does NOT update localStorage. Used in CartContext for startup validation.
 *
 * @param {string[]} ids
 * @returns {Promise<string[]>} valid product IDs
 */
export const filterValidProductIds = async (ids) => {
  if (!ids || ids.length === 0) return [];

  const results = await Promise.all(
    ids.map(async (id) => {
      const result = await fetchAndValidateProduct(id);
      if (result === 'KEEP_ON_ERROR') return id; // keep on network error
      if (result === null) return null;
      return id;
    })
  );

  return results.filter(Boolean);
};
