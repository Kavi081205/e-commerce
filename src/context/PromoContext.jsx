import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { doc, getDoc, getDocs, collection, updateDoc } from 'firebase/firestore';

const PromoContext = createContext();

export const usePromo = () => {
  const context = useContext(PromoContext);
  if (!context) {
    throw new Error('usePromo must be used within a PromoProvider');
  }
  return context;
};

export const PromoProvider = ({ children }) => {
  const [mainPromo, setMainPromo] = useState({
    bannerProductIds: []
  });
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  // Ref used only to skip double-auto-expire on identical offers list
  const lastOffersKeyRef = useRef('');

  // NOTE: No 1-second tick here. Countdowns are rendered locally by each
  // component using their own setInterval. This context only reacts to
  // actual Firestore data changes (onSnapshot), keeping reads minimal.

  // Fetch main promotion doc (banner products) once on mount
  useEffect(() => {
    const fetchPromo = async () => {
      try {
        const promoDocRef = doc(db, 'promotions', 'main');
        const snapshot = await getDoc(promoDocRef);
        if (snapshot.exists()) {
          setMainPromo(snapshot.data());
        }
      } catch (error) {
        console.error('Error fetching main promo settings:', error);
      }
    };
    fetchPromo();
  }, []);

  // Fetch offers collection once on mount
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const offersRef = collection(db, 'offers');
        const snapshot = await getDocs(offersRef);
        const list = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          // Normalize both possible expiry fields; replace space with T for correct Date parsing
          const rawExpiry = data.expiryDateTime || data.offerEndDate || '';
          const expiry = rawExpiry ? String(rawExpiry).replace(' ', 'T') : '';
          return {
            id: docSnap.id,
            ...data,
            expiryDateTime: expiry,
            offerEndDate: expiry
          };
        });
        setOffers(list);
      } catch (error) {
        console.error('Error fetching offers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOffers();
  }, []);

  // Auto-expire: only write to Firestore when the offers list changes,
  // NOT on every tick. The tick is used only for display (useMemo below).
  useEffect(() => {
    if (offers.length === 0) return;
    const now = Date.now();
    offers.forEach(async (offer) => {
      const expiry = offer.expiryDateTime || offer.offerEndDate;
      if (offer.isActive && expiry && new Date(expiry).getTime() <= now) {
        try {
          const offerDocRef = doc(db, 'offers', offer.id);
          await updateDoc(offerDocRef, { isActive: false });
          console.info(`[Promo] Auto-expired offer: "${offer.title}"`);
        } catch (e) {
          console.warn('Failed to auto-expire offer:', offer.title, e);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers]); // ← NOT tick — avoids 1 Firestore write per second

  // Recalculate active offer and handle expiration database updates
  const promoSettings = useMemo(() => {
    const now = Date.now();

    // Client-side filtering to get valid active offers (treating expired ones as inactive automatically)
    const activeOffers = offers.filter(o => {
      const expiry = o.expiryDateTime || o.offerEndDate;
      if (!o.isActive || !expiry) return false;
      const end = new Date(expiry).getTime();
      return end > now;
    });

    // Sort by expiryDateTime ascending (prioritize the one that expires first)
    activeOffers.sort((a, b) => {
      const endA = new Date(a.expiryDateTime || a.offerEndDate).getTime();
      const endB = new Date(b.expiryDateTime || b.offerEndDate).getTime();
      return endA - endB;
    });

    const currentOffer = activeOffers[0] || null;

    return {
      bannerProductIds: mainPromo.bannerProductIds || [],
      offerActive: activeOffers.length > 0,
      activeOffers: activeOffers,
      offerProductId: currentOffer?.productId || '',
      offerEnd: currentOffer?.expiryDateTime || currentOffer?.offerEndDate || '',
      discount: Number(currentOffer?.discount || 0),
      offerTitle: currentOffer?.title || '',
      activeOffer: currentOffer,
      allOffers: offers
    };
  // Only recompute when real Firestore data changes — NOT on a timer tick
  }, [mainPromo, offers]);

  return (
    <PromoContext.Provider value={{ promoSettings, loading }}>
      {children}
    </PromoContext.Provider>
  );
};