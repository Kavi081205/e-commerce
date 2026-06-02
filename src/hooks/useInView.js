import { useEffect, useRef, useState, useMemo } from 'react';

/**
 * Returns [ref, isVisible].
 * Once the element enters the viewport it stays visible (no re-hide).
 */
const useInView = (options = {}) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  const threshold = options.threshold ?? 0.12;
  const rootMargin = options.rootMargin ?? '0px';  // ✅ Valid CSS string, never undefined
  const root = options.root ?? null;

  // Stabilize options so the effect doesn't re-run on every render
  const stableOptions = useMemo(
    () => ({ threshold, rootMargin, root }),
    [threshold, rootMargin, root]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // ✅ Guard: gracefully skip if IntersectionObserver is unavailable (SSR / old browsers)
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true); // Fail open — show content rather than hide it forever
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el); // Fire once, then stop watching
        }
      },
      stableOptions
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [stableOptions]);

  return [ref, isVisible];
};

export default useInView;