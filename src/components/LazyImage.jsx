import React, { useState } from 'react';
import { ImageSkeleton } from './Skeleton';

/**
 * LazyImage
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays a luxury dark-skeleton while the image is loading, then fades in
 * the actual image with a smooth transition.
 *
 * Props:
 *  src          – image URL
 *  alt          – accessible alt text
 *  className    – class names forwarded to the <img>
 *  wrapperClass – class names for the wrapper div (controls size)
 *  fallback     – fallback src if the image errors
 *  style        – inline styles forwarded to the <img>
 */
const LazyImage = ({
  src,
  alt = '',
  className = '',
  wrapperClass = 'w-full h-full',
  fallback = 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=75',
  style = {},
  ...rest
}) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const resolvedSrc = errored ? fallback : src;

  return (
    <div className={`relative overflow-hidden ${wrapperClass}`}>
      {/* Skeleton shown until image finishes loading */}
      {!loaded && (
        <ImageSkeleton className="absolute inset-0 w-full h-full" />
      )}

      <img
        src={resolvedSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`w-full h-full transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        style={style}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!errored) {
            setErrored(true);
            setLoaded(false);
          } else {
            setLoaded(true); // show fallback even if it errors
          }
        }}
        {...rest}
      />
    </div>
  );
};

export default LazyImage;
