import React from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

/**
 * ProductRating — cached via React Query.
 *
 * BEFORE: every render triggered a fresh getDocs() per product.
 * AFTER:  results are cached for 10 minutes. Re-navigating to the same
 *         product list page does NOT re-fire Firestore at all until the
 *         cache expires.
 */
export default function ProductRating({ productId, compact = false }) {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: async () => {
      if (!productId) return [];
      const reviewsRef = collection(db, 'products', productId, 'reviews');
      const snap = await getDocs(reviewsRef);
      return snap.docs.map(d => d.data());
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 10,  // 10 minutes — ratings change infrequently
    gcTime:    1000 * 60 * 15,  // keep in memory 15 minutes
  });

  if (isLoading) {
    return (
      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">
        —
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
        <span>New</span>
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
