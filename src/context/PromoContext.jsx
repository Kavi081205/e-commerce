import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, updateDoc } from 'firebase/firestore';

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
  const [tick, setTick] = useState(0);

  // Tick every second to evaluate offer exipries in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to main promotion doc (banner products)
  useEffect(() => {
    const promoDocRef = doc(db, 'promotions', 'main');
    const unsubscribe = onSnapshot(promoDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setMainPromo(snapshot.data());
      }
    }, (error) => {
      console.error('Error fetching main promo settings:', error);
    });
    return () => unsubscribe();
  }, []);

  // Listen to offers collection
  useEffect(() => {
    const offersRef = collection(db, 'offers');
    const unsubscribe = onSnapshot(offersRef, (snapshot) => {
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
      setLoading(false);
    }, (error) => {
      console.error('Error fetching offers:', error);
      setLoading(false);
    });
    return () => unsubscribe();
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
          console.log(`Automatically expired offer "${offer.title}" in Firestore`);
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
  }, [mainPromo, offers, tick]);

  return (
    <PromoContext.Provider value={{ promoSettings, loading }}>
      {children}
    </PromoContext.Provider>
  );
};