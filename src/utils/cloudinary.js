/**
 * Optimizes Cloudinary image URLs with quality + dimension presets.
 * Falls back to the original URL if it's not a Cloudinary image.
 *
 * Presets:
 *   hero      – Full-bleed banners.  q_100, w_1400, c_fill (smart crop)
 *   best      – Product detail view. q_auto:best, w_800, c_limit (no upscale)
 *   thumbnail – Square card images.  q_auto, w_300, h_300, c_fill (smart crop)
 *
 * @param {string} url      - The Cloudinary image URL to transform
 * @param {'best'|'hero'|'thumbnail'} type - The optimization profile
 * @param {string} fallback - Returned when url is empty / invalid
 * @returns {string} Transformed Cloudinary URL, or fallback
 */
export const getOptimizedImage = (url, type = 'best', fallback = '') => {
  if (!url || typeof url !== 'string') return fallback;

  // Only transform Cloudinary URLs; leave external URLs untouched
  if (!url.includes('/upload/')) return url;

  const presets = {
    // Full-width hero banners — max quality, fill 1400 px wide
    hero:      'f_auto,q_100,w_1400,c_fill,g_auto',
    // Product detail view — best quality, constrain to 800 px (never upscale)
    best:      'f_auto,q_auto:best,w_800,c_limit',
    // Square thumbnails for cards — auto quality, smart-crop to 300×300
    thumbnail: 'f_auto,q_auto,w_300,h_300,c_fill,g_auto',
  };

  const transform = presets[type] ?? presets.best;
  return url.replace('/upload/', `/upload/${transform}/`);
};

export const getHDImage=(url)=>{
  if (!url || typeof url !== 'string') return '';
  if (!url.includes('/upload/')) return url;
  return url.replace(
    "/upload/",
    "/upload/f_auto,q_auto:best,dpr_2.0/"
  );
};
