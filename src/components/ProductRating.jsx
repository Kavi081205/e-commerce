import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { Star } from 'lucide-react';

export default function ProductRating({ productId, compact = false }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;

    const reviewsRef = collection(db, 'products', productId, 'reviews');
    const q = query(reviewsRef, where("productId", "==", productId));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => docSnap.data());
      setReviews(list);
      setLoading(false);
    }, (error) => {
      console.error(`Error fetching reviews for product ${productId}:`, error);
      setLoading(false);
    });

    return () => unsub();
  }, [productId]);

  if (loading) {
    return (
      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">
        Loading rating...
      </span>
    );
  }

  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0
    ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / reviewCount).toFixed(1)
    : null;

  if (reviewCount === 0 || !averageRating) {
    return (
      <div className="flex items-center gap-1.5 text-yellow-500 text-[10px] font-black tracking-widest uppercase">
        <Star size={12} className="fill-yellow-500" />
        <span>New Product</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-yellow-500">
      <Star size={12} className="fill-yellow-500" />
      <span className="text-xs font-black tracking-widest uppercase">
        {averageRating}
      </span>
      {!compact && (
        <span className="text-gray-500 text-[10px] font-bold lowercase tracking-normal">
          ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
        </span>
      )}
    </div>
  );
}
