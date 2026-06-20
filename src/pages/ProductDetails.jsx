import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Check, Loader2, AlertCircle, Star, Play, X, Minus, Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { usePromo } from '../context/PromoContext';
import { useNotification } from '../context/NotificationContext';
import { getEffectivePrice } from '../utils/pricing';
import { getOptimizedImage, getHDImage } from '../utils/cloudinary';
import { db } from '../firebase';
import { Helmet } from 'react-helmet-async';
import { logProductView } from '../utils/analytics';
import LazyImage from '../components/LazyImage';
import NotFound from './NotFound';
import {
  collection,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
  limit,
  doc,
  updateDoc,
  getDocs,
  getDoc
} from 'firebase/firestore';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800&q=80';
const STANDARD_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getColorCode = (name) => {
  const cleanName = String(name || '').trim().toLowerCase();
  const colorMap = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
    pink: '#ec4899',
    yellow: '#eab308',
    orange: '#f97316',
    purple: '#a855f7',
    indigo: '#6366f1',
    black: '#000000',
    white: '#ffffff',
    gray: '#6b7280',
    grey: '#6b7280',
    brown: '#78350f',
    gold: '#d97706',
    silver: '#cbd5e1',
    bronze: '#b45309',
    cream: '#fef3c7',
    beige: '#f5f5dc',
    magenta: '#d946ef',
    cyan: '#06b6d4',
    teal: '#14b8a6',
    violet: '#8b5cf6',
    navy: '#1e3a8a',
    maroon: '#800000',
    peach: '#ffdab9',
    lavender: '#e6e6fa',
    mustard: '#e5a93b',
    emerald: '#10b981',
    turquoise: '#40e0d0'
  };
  return colorMap[cleanName] || '#ffffff';
};

const getColorEmoji = (name) => {
  const cleanName = String(name || '').trim().toLowerCase();
  if (cleanName.includes('red')) return '🔴';
  if (cleanName.includes('green')) return '🟢';
  if (cleanName.includes('blue') || cleanName.includes('navy')) return '🔵';
  if (cleanName.includes('yellow') || cleanName.includes('gold')) return '🟡';
  if (cleanName.includes('orange')) return '🟠';
  if (cleanName.includes('purple') || cleanName.includes('violet') || cleanName.includes('lavender')) return '🟣';
  if (cleanName.includes('brown') || cleanName.includes('bronze')) return '🟤';
  if (cleanName.includes('black')) return '⚫';
  if (cleanName.includes('white') || cleanName.includes('silver') || cleanName.includes('cream')) return '⚪';
  if (cleanName.includes('pink') || cleanName.includes('rose') || cleanName.includes('peach')) return '🌸';
  return '🎨';
};


const ProductDetails = () => {
  const { id } = useParams();
  const productId = id;

  // NOTE: previously this was hardcoded to `null`, which silently broke the
  // entire review/eligibility system (no logged-in user could ever submit
  // or edit a review). Wired in the real auth context here with a safe guest fallback.
  const auth = useAuth ? useAuth() : null;
  const currentUser = auth?.currentUser ?? null;

  const { showToast } = useNotification();
  const toast = {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error')
  };
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart } = useCart();
  const { promoSettings } = usePromo();

  // ── real-time product detail ─────────────────────────────────────────────
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState(null);

  // ── review eligibility ───────────────────────────────────────────────────
  const [isEligible, setIsEligible] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [matchingOrder, setMatchingOrder] = useState(null);

  useEffect(() => {
    let isMounted = true;

    setProduct(null); // Reset product state immediately when id changes to update immediately when navigating
    setLoading(true);
    setIsError(false);
    setError(null);

    const fetchProduct = async () => {
      try {
        const productRef = doc(db, 'products', id);
        const docSnap = await getDoc(productRef);
        if (!isMounted) return;

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (
            data.deleted === true ||
            data.isActive === false ||
            data.hidden === true ||
            data.visibility === false ||
            data.status === 'inactive' ||
            data.status === 'deleted'
          ) {
            setProduct(null);
            setIsError(true);
            setError(new Error("Product not found"));
          } else {
            setProduct({ id: docSnap.id, ...data });
          }
        } else {
          setProduct(null);
          setIsError(true);
          setError(new Error("Product not found"));
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error getting product details:", err);
        setIsError(true);
        setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const [added, setAdded] = useState(false);
  const [activeMedia, setActiveMedia] = useState(0);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const [isZooming, setIsZooming] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [modalVideoUrl, setModalVideoUrl] = useState('');
  const [videoError, setVideoError] = useState(null);

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('details');



  // Recently Viewed tracking
  useEffect(() => {
    if (product) {
      try {
        const list = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        const filtered = list.filter(p => p.id !== product.id);
        const itemToSave = {
          id: product.id,
          name: product.name,
          price: product.price,
          originalPrice: product.originalPrice ?? product.price,
          image: product.image,
          category: product.category,
          stock: product.stock,
          soldCount: product.soldCount
        };
        const nextList = [itemToSave, ...filtered].slice(0, 10);
        localStorage.setItem('recentlyViewed', JSON.stringify(nextList));
      } catch (e) {
        console.error("Error updating recently viewed:", e);
      }
    }
  }, [product]);

  // Swipe support states
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Initialize selected variant options when product changes
  // Auto-select first variant if any variants exist
  useEffect(() => {
    if (product) {
      if (product.variants && product.variants.length > 0) {
        const firstVariant = product.variants[0];
        setSelectedColor(firstVariant);
        const sizesMap = firstVariant.sizes || {};
        const sizeKeys = Object.keys(sizesMap);
        if (sizeKeys.length > 0) {
          const firstInStockSize = sizeKeys.find(s => Number(sizesMap[s]) > 0) || sizeKeys[0] || '';
          setSelectedSize(firstInStockSize);
        } else {
          setSelectedSize('');
        }
      } else {
        setSelectedColor(null);
        setSelectedSize('');
      }
      setQuantity(1);
    }
  }, [product]);

  const handleVariantChange = (variant) => {
    setSelectedColor(variant);
    setActiveMedia(0);
    const sizesMap = variant.sizes || {};
    const sizeKeys = Object.keys(sizesMap);
    if (sizeKeys.length > 0) {
      const inStockSizes = sizeKeys.filter(s => Number(sizesMap[s]) > 0);
      const nextSize = inStockSizes.includes(selectedSize)
        ? selectedSize
        : (inStockSizes[0] || sizeKeys[0] || '');
      setSelectedSize(nextSize);
    } else {
      setSelectedSize('');
    }
    setQuantity(1);
  };

  const getSelectedVariantStock = () => {
    if (!product) return 0;
    if (!product.variants || product.variants.length === 0) {
      return Number(product.stock || 0);
    }
    if (!selectedColor) return 0;
    const sizesMap = selectedColor.sizes || {};
    if (selectedSize && sizesMap) {
      const qty = sizesMap[selectedSize] ?? sizesMap[selectedSize.toLowerCase()] ?? sizesMap[selectedSize.toUpperCase()];
      if (qty !== undefined) return Number(qty);
    }
    return Number(selectedColor.stock || 0);
  };

  const selectedVariantStock = getSelectedVariantStock();

  const selectedColorName = selectedColor ? (selectedColor.colorName || selectedColor.color || '') : '';

  const currentPrice = product ? getEffectivePrice({
    ...product,
    color: selectedColorName,
    variants: product.variants
  }, promoSettings) : 0;

  const originalPrice = product ? (Number(product.originalPrice ?? product.price ?? 0) + (selectedColor?.priceDifference || 0)) : 0;

  const discountPercent = originalPrice > currentPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0;

  const [reviewForm, setReviewForm] = useState({ userName: '', rating: 5, comment: '', productName: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);

  // ── review eligibility check ─────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const checkEligibility = async () => {
      if (!currentUser?.uid) {
        if (isMounted) {
          setIsEligible(false);
          setEligibilityLoading(false);
        }
        return;
      }
      setEligibilityLoading(true);
      try {
        const q = query(
          collection(db, 'orders'),
          where('userId', '==', currentUser.uid),
          where('status', '==', 'delivered')
        );
        const snapshot = await getDocs(q);
        if (!isMounted) return;

        let eligible = false;
        let foundOrderId = null;
        for (const docSnap of snapshot.docs) {
          const orderData = docSnap.data();
          const hasProduct = orderData.items?.some(item => {
            const itemProdId = (item.productId || item.id || '').split('_')[0];
            return itemProdId === productId;
          });
          if (hasProduct) {
            eligible = true;
            foundOrderId = docSnap.id;
            break;
          }
        }
        setIsEligible(eligible);
        setMatchingOrder(foundOrderId);
      } catch (err) {
        if (!isMounted) return;
        console.error("Error checking review eligibility:", err);
        setIsEligible(false);
      } finally {
        if (isMounted) setEligibilityLoading(false);
      }
    };

    checkEligibility();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid, productId]);

  // ── real-time reviews ───────────────────────────────────────────────────
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    setReviewForm(prev => ({
      ...prev,
      productName: product?.name || ''
    }));
  }, [product?.id]);

  useEffect(() => {
    let isMounted = true;

    const fetchReviews = async () => {
      try {
        const q = query(
          collection(db, 'products', productId, 'reviews')
        );
        const snapshot = await getDocs(q);
        if (!isMounted) return;

        const reviewsList = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }));
        reviewsList.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        setReviews(reviewsList);
      } catch (err) {
        if (!isMounted) return;
        console.error("Error getting reviews:", err);
      }
    };

    fetchReviews();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  // ── real-time related products ──────────────────────────────────────────
  const [relatedProducts, setRelatedProducts] = useState([]);

  useEffect(() => {
    if (!product?.category) {
      setRelatedProducts([]);
      return;
    }

    let isMounted = true;

    const fetchRelated = async () => {
      try {
        const q = query(
          collection(db, 'products'),
          where('category', '==', product.category),
          limit(10) // fetch more to account for filters
        );
        const snapshot = await getDocs(q);
        if (!isMounted) return;

        const list = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => {
            if (p.id === id) return false;
            if (p.deleted === true) return false;
            if (p.isActive === false) return false;
            if (p.hidden === true) return false;
            if (p.visibility === false) return false;
            if (p.status === 'inactive' || p.status === 'deleted') return false;
            return true;
          })
          .slice(0, 4);
        setRelatedProducts(list);
      } catch (err) {
        if (!isMounted) return;
        console.error("Error getting related products:", err);
      }
    };

    fetchRelated();

    return () => {
      isMounted = false;
    };
  }, [product?.category, id]);

  // ── Analytics: fire view_item once when product data loads ────────────────
  useEffect(() => {
    if (product?.id) {
      logProductView(product);
    }
  }, [product?.id]);

  const isButtonDisabled = () => {
    if (added) return true;
    const hasVars = product?.variants && product.variants.length > 0;
    if (hasVars) {
      if (selectedColor) {
        return selectedVariantStock === 0;
      }
      return false; // Keep active to trigger select variant toast
    }
    return Number(product?.stock || 0) === 0;
  };

  const isBuyNowDisabled = () => {
    const hasVars = product?.variants && product.variants.length > 0;
    if (hasVars) {
      if (selectedColor) {
        return selectedVariantStock === 0;
      }
      return false; // Keep active to trigger select variant toast
    }
    return Number(product?.stock || 0) === 0;
  };

  const handleAddToCart = () => {
    if (!product || added) return;
    if (product.variants && product.variants.length > 0 && !selectedColor) {
      toast.error("Please select a color first!");
      return;
    }
    if (selectedVariantStock === 0) {
      toast.error("Selected variant is out of stock!");
      return;
    }
    addToCart(product, selectedColorName, selectedSize, quantity);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
    }, 2000);
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (product.variants && product.variants.length > 0 && !selectedColor) {
      toast.error("Please select a color first!");
      return;
    }
    if (selectedVariantStock === 0) {
      toast.error("Selected variant is out of stock!");
      return;
    }
    const variantId = `${product.id}_${selectedColorName || ''}_${selectedSize || ''}`;
    const buyNowItem = {
      id: variantId,
      productId: product.id,
      name: product.name || product.title || '',
      price: Number(product.price || 0),
      originalPrice: Number(product.originalPrice ?? product.price ?? 0),
      discount: Number(product.discount || 0),
      image: (selectedColor?.images && Array.isArray(selectedColor.images) && selectedColor.images.length > 0) ? selectedColor.images[0] : (product?.image || ''),
      color: selectedColorName,
      selectedColor: selectedColorName,
      size: selectedSize,
      quantity: quantity,
      stock: Number(product.stock || 0),
      priceDifference: Number(selectedColor?.priceDifference || 0),
      variants: product.variants || []
    };
    localStorage.setItem('buyNow', JSON.stringify(buyNowItem));
    navigate('/checkout');
  };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)
    : 0;

  const displayRating = reviews.length > 0 ? averageRating : 0;
  const displayReviewCount = reviews.length;

  const userReview = useMemo(() => {
    if (!currentUser?.uid) return null;
    return reviews.find(r => r.userId === currentUser.uid) || null;
  }, [reviews, currentUser?.uid]);

  useEffect(() => {
    if (userReview) {
      setReviewForm(prev => ({
        ...prev,
        rating: Number(userReview.rating) || 5,
        comment: userReview.reviewText || userReview.comment || '',
        userName: userReview.userName || prev.userName || ''
      }));
    } else {
      setReviewForm(prev => ({
        ...prev,
        rating: 5,
        comment: ''
      }));
    }
  }, [userReview]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.userName.trim() || !reviewForm.comment.trim()) return;

    if (!currentUser?.uid) {
      toast.error("Please sign in to submit a review.");
      return;
    }

    setSubmittingReview(true);
    try {
      if (userReview) {
        // Edit existing review
        const reviewId = userReview.id;
        const updatedReview = {
          rating: Number(reviewForm.rating),
          reviewText: reviewForm.comment,
          comment: reviewForm.comment,
          userName: reviewForm.userName,
          updatedAt: serverTimestamp()
        };

        if (!reviewId) {
          throw new Error("Review ID is missing.");
        }
        if (userReview.userId !== currentUser.uid) {
          throw new Error("Unauthorized: You do not own this review.");
        }

        const reviewRef = doc(db, 'products', product?.id || productId, 'reviews', reviewId);
        await updateDoc(reviewRef, updatedReview);

        setIsEditingReview(false);
        toast.success("Review updated successfully");
      } else {
        // Create new review
        const newReview = {
          productId: product?.id || productId,
          productName: product?.name || '',
          userId: currentUser.uid,
          orderId: matchingOrder,
          rating: Number(reviewForm.rating),
          reviewText: reviewForm.comment,
          comment: reviewForm.comment,
          verifiedPurchase: true,
          createdAt: serverTimestamp(),
          userName: reviewForm.userName
        };

        await addDoc(collection(db, 'products', product?.id || productId, 'reviews'), newReview);
        setReviewForm({ userName: '', rating: 5, comment: '', productName: product?.name || '' });
        toast.success("Review submitted successfully");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.pageX - left) / width) * 100;
    const y = ((e.pageY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  // ── Video helpers ────────────────────────────────────────────────────────
  // All YouTube/Vimeo/iframe logic has been removed.
  // Videos are now Cloudinary MP4s — played natively via HTML5 <video>.

  const getMp4VideoUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (url.includes('cloudinary.com') && url.includes('/video/upload/')) {
      const [baseUrl, queryStr] = url.split('?');
      const lastDotIdx = baseUrl.lastIndexOf('.');
      const lastSlashIdx = baseUrl.lastIndexOf('/');
      if (lastDotIdx > lastSlashIdx) {
        const ext = baseUrl.slice(lastDotIdx).toLowerCase();
        if (ext !== '.mp4') {
          return baseUrl.slice(0, lastDotIdx) + '.mp4' + (queryStr ? `?${queryStr}` : '');
        }
      }
    }
    return url;
  };

  const openVideoModal = (url) => {
    if (!url) {
      setVideoError('No video available for this product.');
      setVideoModalOpen(true);
      return;
    }
    const mp4Url = getMp4VideoUrl(url);
    console.log("Opening Video Modal with URL (MP4 requested):", mp4Url);
    setModalVideoUrl(mp4Url);
    setVideoError(null);
    setVideoModalOpen(true);
  };

  const closeVideoModal = () => {
    setVideoModalOpen(false);
    setModalVideoUrl('');
    setVideoError(null);
  };

  const getMediaItems = () => {
    if (!product) return [];
    const videoUrl = product.video ? getMp4VideoUrl(product.video) : '';
    if (selectedColor && selectedColor.images && Array.isArray(selectedColor.images) && selectedColor.images.length > 0) {
      return [
        ...selectedColor.images.map(url => ({ type: 'image', url })),
        ...(videoUrl ? [{ type: 'video', url: videoUrl }] : [])
      ];
    }
    return product.images && Array.isArray(product.images) && product.images.length > 0
      ? [
        ...product.images.map(url => ({ type: 'image', url })),
        ...(videoUrl ? [{ type: 'video', url: videoUrl }] : [])
      ]
      : [
        { type: 'image', url: product.image || FALLBACK_IMAGE },
        ...(videoUrl ? [{ type: 'video', url: videoUrl }] : [])
      ];
  };

  const mediaItems = getMediaItems();
  const currentMedia = mediaItems[activeMedia] || mediaItems[0] || { type: 'image', url: FALLBACK_IMAGE };

  // Mobile swipe support
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      setActiveMedia(prev => (prev + 1) % mediaItems.length);
    } else if (isRightSwipe) {
      setActiveMedia(prev => (prev - 1 + mediaItems.length) % mediaItems.length);
    }
  };

  const getAvailableSizes = () => {
    if (!selectedColor || !selectedColor.sizes) return [];
    const sizesObj = selectedColor.sizes;
    const keys = Object.keys(sizesObj);

    const normalizedToOriginal = new Map();
    keys.forEach(k => normalizedToOriginal.set(k.toUpperCase(), k));

    const ordered = [];
    const seen = new Set();

    STANDARD_SIZES.forEach(sz => {
      const originalKey = normalizedToOriginal.get(sz);
      if (originalKey !== undefined) {
        ordered.push({ name: originalKey, stock: Number(sizesObj[originalKey] || 0) });
        seen.add(originalKey);
      }
    });

    keys.forEach(k => {
      if (!seen.has(k)) {
        ordered.push({ name: k, stock: Number(sizesObj[k] || 0) });
      }
    });

    return ordered;
  };



  const renderStars = (rating) => {
    const stars = [];
    const floor = Math.floor(Number(rating));
    const hasHalf = Number(rating) - floor >= 0.5;
    for (let i = 1; i <= 5; i++) {
      if (i <= floor) {
        stars.push(<Star key={`rating-star-${i}`} size={14} fill="#eab308" className="text-yellow-500 animate-pulse" />);
      } else if (i === floor + 1 && hasHalf) {
        stars.push(<Star key={`rating-star-${i}`} size={14} fill="#eab308" className="text-yellow-500 opacity-60" />);
      } else {
        stars.push(<Star key={`rating-star-${i}`} size={14} fill="none" className="text-gray-700" />);
      }
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-black text-gray-600">
        <Loader2 size={48} className="animate-spin text-yellow-500 mb-6" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Retrieving Details...</p>
      </div>
    );
  }

  if (isError || !product) {
    return <NotFound />;
  }

  return (
    <div className="bg-black min-h-screen">
      <Helmet>
        <title>{product.name} | SMKP TRADERS</title>
        <meta name="description" content={product.description || `Buy ${product.name} in ${product.category} at SMKP Traders — quality products at wholesale prices.`} />

        {/* Open Graph */}
        <meta property="og:type" content="product" />
        <meta property="og:title" content={`${product.name} | SMKP TRADERS`} />
        <meta property="og:description" content={product.description || `Buy ${product.name} in ${product.category} at SMKP Traders.`} />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        {product.image && <meta property="og:image" content={getHDImage(product.image)} />}
        <meta property="og:site_name" content="SMKP TRADERS" />
        <meta property="og:locale" content="en_IN" />

        {/* Twitter Cards */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${product.name} | SMKP TRADERS`} />
        <meta name="twitter:description" content={product.description || `Buy ${product.name} at SMKP Traders.`} />
        {product.image && <meta name="twitter:image" content={getHDImage(product.image)} />}

        {/* JSON-LD — Google Product Rich Results */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org/',
            '@type': 'Product',
            name: product.name,
            image: product.image ? [getHDImage(product.image)] : [],
            description: product.description || `Premium ${product.name}`,
            sku: product.id,
            brand: {
              '@type': 'Brand',
              name: 'SMKP TRADERS',
            },
            seller: {
              '@type': 'Organization',
              name: 'SMKP TRADERS',
              url: 'https://smkptraders.com',
            },
            offers: {
              '@type': 'Offer',
              url: typeof window !== 'undefined' ? window.location.href : '',
              priceCurrency: 'INR',
              price: currentPrice,
              priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              availability: selectedVariantStock > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              seller: { '@type': 'Organization', name: 'SMKP TRADERS' },
            },
            ...(reviews.length > 0 && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: displayRating,
                reviewCount: displayReviewCount,
              },
            }),
          })}
        </script>
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title={product.name}
          breadcrumbs={[
            { label: 'Collection', path: '/products' },
            { label: product.category, path: `/products?category=${product.category.toLowerCase()}` },
            { label: 'Details', path: location.pathname }
          ]}
        />

        <div className="bg-gray-900/30 backdrop-blur-xl rounded-[3rem] overflow-hidden flex flex-col lg:flex-row border border-yellow-900/10 shadow-2xl">

          {/* Left Column: Image Gallery */}
          <div className="lg:w-1/2 p-4 md:p-10 flex flex-col border-b lg:border-b-0 lg:border-r border-yellow-900/10">
            <div
              className="relative aspect-[4/5] bg-black rounded-[2.5rem] overflow-hidden border border-white/5 group select-none"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <AnimatePresence mode="wait">
                {currentMedia.type === 'image' ? (
                  <motion.div
                    key={currentMedia.url}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full h-full relative cursor-zoom-in overflow-hidden"
                    onMouseMove={handleMouseMove}
                    onMouseEnter={() => setIsZooming(true)}
                    onMouseLeave={() => setIsZooming(false)}
                  >
                    <LazyImage
                      src={getHDImage(currentMedia.url)}
                      alt={product.name}
                      className={`product-detail-image w-full h-full transition-all duration-300 ${isZooming ? 'scale-150' : 'scale-100'} object-contain`}
                      wrapperClass="w-full h-full"
                      fallback={FALLBACK_IMAGE}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="video"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full h-full cursor-pointer group/video"
                    onClick={() => openVideoModal(currentMedia.url)}
                  >
                    {/* Cloudinary video — show play button overlay on dark background */}
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 border border-yellow-900/10 text-gray-500 p-6 text-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center group-hover/video:bg-yellow-500/20 transition-all duration-300">
                        <Play size={32} className="text-yellow-500 ml-1" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-widest text-white">Watch Product Video</p>
                      <p className="text-[10px] text-gray-500 max-w-xs">Click to open video player</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mobile pagination dots */}
              {mediaItems.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10 lg:hidden">
                  {mediaItems.map((_, idx) => (
                    <div
                      key={`media-indicator-${idx}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${activeMedia === idx ? 'w-4 bg-yellow-500' : 'w-1.5 bg-gray-600'}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {mediaItems.length > 1 && (
              <div className="flex flex-nowrap gap-4 mt-8 px-2 overflow-x-auto custom-scrollbar pb-4 select-none touch-pan-x">
                {mediaItems.map((item, idx) => {
                  const isVideo = item.type === 'video';
                  const thumbSrc = isVideo
                    ? null
                    : getOptimizedImage(item.url, 'thumbnail');

                  return (
                    <button
                      key={`media-thumb-${idx}`}
                      onClick={() => {
                        setActiveMedia(idx);
                        if (isVideo) openVideoModal(item.url);
                      }}
                      className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 flex-shrink-0 transition-all ${activeMedia === idx ? 'border-yellow-500 scale-105 shadow-md shadow-yellow-500/10' : 'border-white/5 opacity-40 hover:opacity-100'
                        }`}
                    >
                      {thumbSrc ? (
                        <LazyImage
                          src={thumbSrc}
                          alt={isVideo ? 'Video preview' : ''}
                          className="w-full h-full object-cover"
                          wrapperClass="w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                          <Play size={20} className="text-yellow-500" />
                        </div>
                      )}
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition-all">
                          <div className="w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg">
                            <Play size={12} fill="black" className="text-black ml-0.5" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="hidden lg:block text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-4">
              Swipe left/right on image for next view
            </p>
          </div>

          {/* Right Column: Specifications */}
          <div className="lg:w-1/2 p-8 md:p-16 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500/10 text-yellow-500 rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.3em] border border-yellow-500/20">
                  {product.category}
                </div>
                {Number(product.soldCount || 0) >= 50 && (
                  <div className="flex items-center gap-1 bg-yellow-500 text-black text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg shadow-yellow-500/30 animate-pulse">
                    🏆 Best Seller
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {displayReviewCount > 0 ? (
                  <>
                    <div className="flex gap-0.5">
                      {renderStars(displayRating)}
                    </div>
                    <span className="text-yellow-500 text-[10px] font-black tracking-widest uppercase">
                      {Number(displayRating).toFixed(1)} Rating
                    </span>
                    <span className="text-gray-500 text-[10px] font-bold">
                      ({displayReviewCount} {displayReviewCount === 1 ? 'Review' : 'Reviews'})
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-yellow-500">
                    <Star size={12} className="fill-yellow-500" />
                    <span className="text-[10px] font-black tracking-widest uppercase">
                      New Product
                    </span>
                  </div>
                )}
              </div>
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-white mb-6 leading-[1.1] tracking-tighter uppercase">
              {product.name}
            </h1>

            {/* Dynamic Price Block */}
            <div className="flex flex-col gap-3 mb-10 pb-10 border-b border-white/5">
              <div className="flex items-center flex-wrap gap-4">
                {discountPercent > 0 ? (
                  <>
                    <span className="text-5xl font-black gold-shine">
                      ₹{currentPrice.toLocaleString()}
                    </span>
                    <span className="text-xl text-gray-600 line-through font-bold">
                      ₹{originalPrice.toLocaleString()}
                    </span>
                    <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                      {discountPercent}% OFF
                    </span>
                  </>
                ) : (
                  <span className="text-5xl font-black text-white">
                    ₹{currentPrice.toLocaleString()}
                  </span>
                )}
              </div>

              {(() => {
                const stockVal = (product.variants && product.variants.length > 0 && selectedColor)
                  ? selectedVariantStock
                  : Number(product.stock ?? 0);
                if (stockVal <= 0) {
                  return (
                    <div className="flex items-center gap-3 mt-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
                        OUT OF STOCK
                      </span>
                    </div>
                  );
                } else if (stockVal <= 5) {
                  return (
                    <div className="flex items-center gap-3 mt-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 w-fit">
                      <span className="text-red-400 text-lg">⚠</span>
                      <span className="text-red-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                        Only {stockVal} Left In Stock (LOW STOCK)
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div className="flex items-center gap-3 mt-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                        IN STOCK ({stockVal} Units Available)
                      </span>
                    </div>
                  );
                }
              })()}
            </div>


            {/* Color Switcher */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-8 mb-10 pb-10 border-b border-white/5">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-yellow-500/40 uppercase tracking-[0.4em]">Select Color</h3>
                    {selectedColorName && (
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Active: {selectedColorName}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {product.variants.map((v, idx) => {
                      const vName = v.colorName || v.color || '';
                      const isSelected = selectedColorName === vName;
                      const colorCode = v.colorCode || getColorCode(vName);
                      return (
                        <button
                          key={`variant-${vName}-${idx}`}
                          type="button"
                          onClick={() => handleVariantChange(v)}
                          className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-300 ${isSelected
                              ? 'border-yellow-500 bg-yellow-500/10 text-white shadow-lg shadow-yellow-500/20'
                              : 'border-white/5 bg-gray-900/30 text-gray-400 hover:border-white/20 hover:text-white'
                            }`}
                        >
                          {/* Color dot swatch */}
                          <span
                            className="w-5 h-5 rounded-full border border-white/30 flex-shrink-0"
                            style={{ backgroundColor: colorCode }}
                          />
                          {/* Color name */}
                          <span className="text-[11px] font-black uppercase tracking-widest">{vName}</span>
                          {/* Active checkmark */}
                          {isSelected && <Check size={12} className="text-yellow-400 font-bold ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Size Selection */}
                {getAvailableSizes().length > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-black text-yellow-500/40 uppercase tracking-[0.4em]">Select Size</h3>
                      {selectedSize && (
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                          Size: {selectedSize}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {getAvailableSizes().map((szObj) => {
                        const isOutOfStock = szObj.stock === 0;
                        const isSelected = selectedSize === szObj.name;
                        return (
                          <button
                            key={szObj.name}
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => {
                              setSelectedSize(szObj.name);
                              setQuantity(1);
                            }}
                            className={`px-6 py-3.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all duration-300 ${isSelected
                                ? 'border-yellow-500 bg-yellow-500 text-black shadow-lg shadow-yellow-500/15'
                                : isOutOfStock
                                  ? 'border-white/5 bg-gray-900/10 text-gray-700 cursor-not-allowed line-through opacity-30'
                                  : 'border-white/5 bg-gray-900/30 text-white hover:border-yellow-500/50 hover:bg-yellow-500/5'
                              }`}
                          >
                            {szObj.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quantity Selector */}
            {selectedVariantStock > 0 && (
              <div className="flex items-center gap-6 mb-10 bg-gray-900/20 p-4 rounded-2xl border border-white/5 w-fit select-none">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Quantity:</span>
                <div className="flex items-center bg-black border border-yellow-900/20 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                    className="p-3 text-gray-500 hover:text-yellow-500 disabled:opacity-20 disabled:hover:text-gray-500 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-12 text-center text-xs font-black text-white">{quantity}</span>
                  <button
                    type="button"
                    disabled={quantity >= selectedVariantStock}
                    onClick={() => setQuantity(prev => Math.min(selectedVariantStock, prev + 1))}
                    className="p-3 text-gray-500 hover:text-yellow-500 disabled:opacity-20 disabled:hover:text-gray-500 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Buy / Cart Buttons */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isButtonDisabled()}
                  className={`flex-1 flex justify-center items-center py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 ${added
                      ? 'bg-white text-black font-black'
                      : selectedVariantStock === 0 && selectedColor
                        ? 'bg-gray-900 text-gray-700 cursor-not-allowed'
                        : 'bg-transparent border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/5 hover:border-yellow-500'
                    }`}
                >
                  {added ? 'Secured in Cart' : (product.variants && product.variants.length > 0 && !selectedColor) ? 'SELECT COLOR' : 'ADD TO CART'}
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={isBuyNowDisabled()}
                  className={`flex-1 flex justify-center items-center py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 ${selectedVariantStock === 0 && selectedColor
                      ? 'bg-gray-900 text-gray-700 cursor-not-allowed'
                      : 'bg-yellow-500 text-black shadow-2xl shadow-yellow-500/10 hover:scale-105 active:scale-95'
                    }`}
                >
                  {(product.variants && product.variants.length > 0 && !selectedColor) ? 'SELECT COLOR' : 'BUY NOW'}
                </button>
              </div>
            </div>

            {/* Product Information Tabs */}
            <div className="mt-16 border-t border-white/5 pt-12">
              <div className="flex flex-nowrap border-b border-white/5 mb-8 overflow-x-auto scrollbar-none select-none touch-pan-x">
                {[
                  { id: 'details', label: 'Details' },
                  { id: 'sizeguide', label: 'Size Guide' },
                  { id: 'shipping', label: 'Shipping & Returns' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`pb-4 px-6 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all duration-300 whitespace-nowrap ${activeTab === t.id
                        ? 'border-yellow-500 text-yellow-500'
                        : 'border-transparent text-gray-500 hover:text-white'
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="bg-gray-900/20 border border-white/5 rounded-3xl p-8 min-h-48 text-sm leading-relaxed text-gray-400 font-medium">
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    <p className="text-gray-300 leading-relaxed font-medium">
                      {product.description || 'Premium curated product from SMKP Traders.'}
                    </p>
                  </div>
                )}

                {activeTab === 'sizeguide' && (
                  <div className="space-y-6">
                    {String(product.category || '').toLowerCase().includes('saree') ? (
                      <div className="space-y-4">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest">Saree Dimensions (Free Size)</h4>
                        <ul className="list-disc pl-5 space-y-2 text-gray-400 text-xs">
                          <li>Saree Length: <span className="text-white font-bold">5.5 Metres</span> (approx)</li>
                          <li>Blouse Piece: <span className="text-white font-bold">0.8 Metres</span> (unstitched)</li>
                          <li>Total Width: <span className="text-white font-bold">44 Inches</span> (approx)</li>
                          <li>Fits all standard heights and builds gracefully.</li>
                        </ul>
                      </div>
                    ) : String(product.category || '').toLowerCase().includes('kids') || String(product.category || '').toLowerCase().includes('dress') ? (
                      <div className="space-y-4">
                        <h4 className="text-white font-black text-xs uppercase tracking-widest mb-4">Clothing Size Measurement Guide</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[10px] uppercase tracking-wider border-collapse">
                            <thead>
                              <tr className="border-b border-white/15 text-yellow-500 font-black">
                                <th className="py-2">Size</th>
                                <th className="py-2">Chest (Inches)</th>
                                <th className="py-2">Length (Inches)</th>
                                <th className="py-2">Recommended Age</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-400 font-bold">
                              <tr className="border-b border-white/5">
                                <td className="py-2 text-white">S</td>
                                <td className="py-2">34-36</td>
                                <td className="py-2">26</td>
                                <td className="py-2">4-6 Yrs</td>
                              </tr>
                              <tr className="border-b border-white/5">
                                <td className="py-2 text-white">M</td>
                                <td className="py-2">36-38</td>
                                <td className="py-2">27</td>
                                <td className="py-2">7-9 Yrs</td>
                              </tr>
                              <tr className="border-b border-white/5">
                                <td className="py-2 text-white">L</td>
                                <td className="py-2">38-40</td>
                                <td className="py-2">28</td>
                                <td className="py-2">10-12 Yrs</td>
                              </tr>
                              <tr className="border-b border-white/5">
                                <td className="py-2 text-white">XL</td>
                                <td className="py-2">40-42</td>
                                <td className="py-2">29</td>
                                <td className="py-2">Teen / Adult</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-xs font-black uppercase tracking-widest text-center py-6">
                        Size guide is not applicable for this category.
                      </p>
                    )}
                  </div>
                )}

                {activeTab === 'shipping' && (
                  <div className="space-y-6 text-xs uppercase tracking-wider text-gray-400 font-bold">
                    <div>
                      <h4 className="text-white font-black text-xs uppercase tracking-widest mb-2">Delivery Information</h4>
                      <p className="leading-relaxed mb-4 text-gray-400">
                        Complimentary luxury delivery across India on orders above ₹999. Dispatched within 24-48 hours. Delivered in 3-5 business days.
                      </p>
                    </div>
                    <div className="border-t border-white/5 pt-6">
                      <h4 className="text-white font-black text-xs uppercase tracking-widest mb-2">Return & Exchange Policy</h4>
                      <p className="leading-relaxed text-gray-400">
                        We offer a complimentary 7-day return and size exchange window. Items must be in their original, unwashed, and unworn condition with tags attached in original luxury packaging.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="mt-32">
            <div className="flex flex-col items-center text-center mb-16">
              <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.5em] mb-4">More From This Category</p>
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase">You May Also Like</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {relatedProducts.map((rp) => {
                const rpPrice = getEffectivePrice(rp, promoSettings);
                return (
                  <div
                    key={rp.id}
                    onClick={() => navigate(`/product/${rp.id}`)}
                    className="luxury-card p-4 rounded-[2.5rem] cursor-pointer group relative"
                  >
                    <div className="aspect-square overflow-hidden rounded-[2rem] mb-6 relative">
                      <LazyImage
                        src={getOptimizedImage(rp.image, 'card')}
                        alt={rp.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        wrapperClass="w-full h-full"
                      />
                      {Number(rp.soldCount || 0) >= 50 && (
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-yellow-500 text-black text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg shadow-yellow-500/30">
                          🏆 Best Seller
                        </div>
                      )}
                      {Number(rp.stock || 0) <= 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none bg-black/40">
                          <span className="bg-red-600 text-white text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-xl rotate-[-12deg]">
                            OUT OF STOCK
                          </span>
                        </div>
                      ) : Number(rp.stock || 0) <= 5 ? (
                        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                          ⚠ LOW STOCK ({rp.stock})
                        </div>
                      ) : (
                        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 bg-green-600 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                          IN STOCK
                        </div>
                      )}
                    </div>
                    <div className="px-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-yellow-500/60 mb-2 block">{rp.category}</span>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider mb-3 leading-tight group-hover:text-yellow-500 transition-colors line-clamp-2">
                        {rp.name}
                      </h3>
                      {(() => {
                        const rpOrigPrice = Number(rp.originalPrice ?? rp.price ?? 0);
                        const rpDiscountPercent = rpOrigPrice > rpPrice ? Math.round(((rpOrigPrice - rpPrice) / rpOrigPrice) * 100) : 0;
                        return (
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-lg font-black text-white">₹{rpPrice.toLocaleString()}</span>
                            {rpDiscountPercent > 0 && (
                              <>
                                <span className="text-xs text-gray-500 line-through font-semibold">₹{rpOrigPrice.toLocaleString()}</span>
                                <span className="text-xs text-green-500 font-black">{rpDiscountPercent}% OFF</span>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="mt-40">
          <div className="flex flex-col items-center text-center mb-20">
            <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.5em] mb-4">The Verdict</p>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Customer Reviews</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-20">
            <div className="lg:col-span-2 space-y-8">
              {reviews.length === 0 ? (
                <div className="py-20 text-center border-t border-yellow-900/10 flex flex-col items-center justify-center gap-3">
                  <Star size={16} className="text-yellow-500 fill-yellow-500 animate-pulse" />
                  <p className="text-yellow-500 font-black uppercase tracking-[0.3em] text-[10px]">New Product</p>
                </div>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="p-8 bg-gray-900/10 border border-white/5 rounded-3xl hover:border-yellow-500/20 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center font-black text-yellow-500 text-xs">
                          {String(r.userName || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-white text-[11px] uppercase tracking-widest">{r.userName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {r.verifiedPurchase ? (
                              <span className="text-[9px] text-green-500 font-bold uppercase tracking-tighter flex items-center gap-0.5 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-full">
                                ✓ Verified Purchase
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">
                                Guest Review
                              </span>
                            )}
                            {r.createdAt && (
                              <span className="text-[9px] text-yellow-500/40 font-bold tracking-tighter">
                                • {formatDate(r.createdAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {[...Array(Number(r.rating || 5))].map((_, i) => (
                          <Star key={`review-star-${i}`} size={10} fill="#eab308" className="text-yellow-500" />
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed font-medium italic pl-14">"{r.reviewText || r.comment}"</p>
                  </div>
                ))
              )}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-gray-900/50 p-10 rounded-[2.5rem] border border-yellow-900/20">
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] mb-10">
                  {userReview && !isEditingReview ? 'Your Review' : (userReview ? 'Edit Review' : 'Submit Review')}
                </h3>
                {!currentUser?.uid ? (
                  <div className="py-10 text-center flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/5 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
                      <AlertCircle size={20} />
                    </div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider leading-relaxed">
                      Please sign in to write a review.
                    </p>
                  </div>
                ) : eligibilityLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 size={24} className="animate-spin text-yellow-500" />
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Checking permissions...</p>
                  </div>
                ) : isEligible ? (
                  userReview && !isEditingReview ? (
                    <div className="space-y-6">
                      <div className="p-6 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[9px] text-green-500 font-bold uppercase tracking-tighter flex items-center gap-0.5 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-full">
                            ✓ Your Review
                          </span>
                          <div className="flex gap-0.5">
                            {[...Array(Number(userReview.rating || 5))].map((_, i) => (
                              <Star key={`user-review-star-${i}`} size={10} fill="#eab308" className="text-yellow-500" />
                            ))}
                          </div>
                        </div>
                        <p className="text-white text-xs font-black uppercase tracking-widest mb-2">{userReview.userName}</p>
                        <p className="text-gray-400 text-xs italic font-medium">"{userReview.reviewText || userReview.comment}"</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditingReview(true)}
                        className="w-full bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase tracking-[0.3em] hover:bg-yellow-500 transition-all"
                      >
                        Edit Review
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleReviewSubmit} className="space-y-8">
                      <div className="space-y-3">
                        <label htmlFor="reviewProduct" className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Product</label>
                        <input
                          id="reviewProduct"
                          name="reviewProduct"
                          readOnly
                          value={product?.name || ''}
                          className="w-full bg-black/50 border border-yellow-900/20 rounded-xl p-4 text-white/80 text-xs outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-3">
                        <label htmlFor="reviewName" className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Your Name</label>
                        <input
                          id="reviewName"
                          name="reviewName"
                          required
                          value={reviewForm.userName}
                          onChange={(e) => setReviewForm(prev => ({ ...prev, userName: e.target.value }))}
                          className="w-full bg-black/50 border border-yellow-900/20 rounded-xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all"
                          placeholder="Your Name"
                        />
                      </div>
                      <div className="space-y-3">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Rating</p>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              type="button"
                              aria-label={`Rate ${n} out of 5 stars`}
                              aria-pressed={reviewForm.rating === n}
                              onClick={() => setReviewForm(p => ({ ...p, rating: n }))}
                              className={`flex-1 py-3 rounded-lg border transition-all ${reviewForm.rating >= n ? 'border-yellow-500 text-yellow-500 bg-yellow-500/5' : 'border-white/5 text-gray-800'}`}
                            >
                              <Star size={12} fill={reviewForm.rating >= n ? 'currentColor' : 'none'} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label htmlFor="reviewComment" className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Review</label>
                        <textarea
                          id="reviewComment"
                          name="reviewComment"
                          required
                          rows="4"
                          value={reviewForm.comment}
                          onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                          className="w-full bg-black/50 border border-yellow-900/20 rounded-xl p-4 text-white text-xs outline-none focus:border-yellow-500 transition-all resize-none"
                          placeholder="Share your experience with this product..."
                        />
                      </div>
                      <div className="flex gap-3">
                        {userReview && (
                          <button
                            type="button"
                            onClick={() => setIsEditingReview(false)}
                            className="flex-1 bg-transparent border border-white/10 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-[0.3em] hover:bg-white/5 transition-all"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={submittingReview}
                          className={`${userReview ? 'flex-1' : 'w-full'} bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase tracking-[0.3em] hover:bg-yellow-500 transition-all`}
                        >
                          {submittingReview ? 'Processing...' : (userReview ? 'UPDATE REVIEW' : 'SUBMIT REVIEW')}
                        </button>
                      </div>
                    </form>
                  )
                ) : (
                  <div className="py-10 text-center flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/5 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
                      <AlertCircle size={20} />
                    </div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider leading-relaxed">
                      You can review this product after it has been delivered.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky CTA Footer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-950 border-t border-yellow-900/20 p-3 flex gap-3 shadow-2xl">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isButtonDisabled()}
          className={`flex-1 flex justify-center items-center py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${added
              ? 'bg-white text-black border border-white'
              : selectedVariantStock === 0 && selectedColor
                ? 'bg-gray-900 text-gray-700 border border-gray-900 cursor-not-allowed'
                : 'bg-black border border-yellow-500/30 text-yellow-500 active:bg-yellow-500/5'
            }`}
        >
          {added ? 'In Cart' : (product.variants && product.variants.length > 0 && !selectedColor) ? 'SELECT COLOR' : 'ADD TO CART'}
        </button>

        <button
          type="button"
          onClick={handleBuyNow}
          disabled={isBuyNowDisabled()}
          className={`flex-1 flex justify-center items-center py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${selectedVariantStock === 0 && selectedColor
              ? 'bg-gray-900 text-gray-700 cursor-not-allowed'
              : 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/10 active:bg-yellow-400'
            }`}
        >
          {(product.variants && product.variants.length > 0 && !selectedColor) ? 'SELECT COLOR' : 'BUY NOW'}
        </button>
      </div>

      {/* ── Video Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {videoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={closeVideoModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl aspect-video rounded-3xl bg-black overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={closeVideoModal}
                className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/40 hover:bg-black/80 text-white/60 hover:text-white border border-white/5 hover:border-white/20 transition-all"
              >
                <X size={16} />
              </button>

              {videoError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-8 text-center gap-4 rounded-3xl">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
                    <AlertCircle size={22} />
                  </div>
                  <h3 className="text-white font-black text-xs uppercase tracking-widest">Unable to Play Video</h3>
                  <p className="text-gray-400 text-xs max-w-md leading-relaxed">{videoError}</p>
                  <button
                    onClick={closeVideoModal}
                    className="mt-2 px-6 py-2.5 rounded-xl bg-white text-black font-black text-[9px] uppercase tracking-widest hover:bg-yellow-500 transition-all"
                  >
                    Close Player
                  </button>
                </div>
              ) : modalVideoUrl ? (
                <video
                  key={modalVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain rounded-3xl"
                  onError={() => setVideoError('Video playback failed. The format may not be supported by your browser.')}
                >
                  <source src={modalVideoUrl} type="video/mp4" />
                  Your browser does not support HTML5 video.
                </video>
              ) : null}
            </motion.div>
            <p className="absolute bottom-6 text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              Click outside to close
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductDetails;