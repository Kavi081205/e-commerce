/**
 * colorUtils.js
 * Centralised colour helpers used across ProductDetails, AddProduct, EditProduct.
 *
 * Rules
 * ─────
 * • Multicolour variant names (see MULTICOLOR_NAMES) must NEVER be resolved to a
 *   single solid colour hex.  isMulticolor() is the single source of truth.
 * • All other variant names are passed through getColorCode() which maps known
 *   colour words to their hex equivalents (hash-fallback for unknowns).
 */

/** Canonical multicolour sentinel used throughout the UI. */
export const MULTICOLOR_LABEL = 'Multicolour';

/**
 * Returns true when the variant name represents a multicolour / assorted /
 * random colour option where auto-detection would be meaningless or wrong.
 *
 * @param {string} name  – colorName / color field from the variant object
 * @returns {boolean}
 */
export const isMulticolor = (name) => {
  if (!name) return false;
  const n = String(name).trim().toLowerCase().replace(/[\s\-_]+/g, '');
  return (
    n === 'multicolour'    ||
    n === 'multicolor'     ||
    n === 'multicolored'   ||
    n === 'multicoloured'  ||
    n === 'multicolors'    ||
    n === 'multi'          ||
    n === 'mixed'          ||
    n === 'assorted'       ||
    n === 'randomcolor'    ||
    n === 'random'
  );
};

/**
 * Returns a CSS hex colour for a known solid-colour name.
 * For multicolour names returns null – callers must render a rainbow swatch.
 * For unknown names falls back to a deterministic hash colour.
 *
 * @param {string} name  – colour name (e.g. "Red", "Navy Blue")
 * @returns {string|null}  hex string, or null when isMulticolor(name) is true
 */
export const getColorCode = (name) => {
  if (!name) return '#ffffff';

  // Never auto-detect a solid colour for multicolour variants.
  if (isMulticolor(name)) return null;

  const cleanName = String(name).trim().toLowerCase();

  const colorMap = {
    red:       '#ef4444',
    blue:      '#3b82f6',
    green:     '#22c55e',
    pink:      '#ec4899',
    yellow:    '#eab308',
    orange:    '#f97316',
    purple:    '#a855f7',
    indigo:    '#6366f1',
    black:     '#000000',
    white:     '#ffffff',
    gray:      '#6b7280',
    grey:      '#6b7280',
    brown:     '#78350f',
    gold:      '#d97706',
    silver:    '#cbd5e1',
    bronze:    '#b45309',
    cream:     '#fef3c7',
    beige:     '#f5f5dc',
    magenta:   '#d946ef',
    cyan:      '#06b6d4',
    teal:      '#14b8a6',
    violet:    '#8b5cf6',
    navy:      '#1e3a8a',
    maroon:    '#800000',
    peach:     '#ffdab9',
    lavender:  '#e6e6fa',
    mustard:   '#e5a93b',
    emerald:   '#10b981',
    turquoise: '#40e0d0',
  };

  if (colorMap[cleanName]) return colorMap[cleanName];

  // Partial-match for compound names like "Navy Blue", "Dark Green", etc.
  for (const [key, hex] of Object.entries(colorMap)) {
    if (cleanName.includes(key)) return hex;
  }

  // Deterministic hash fallback for truly unknown single colours.
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ('00' + value.toString(16)).slice(-2);
  }
  return color;
};

/**
 * Loads an image from a URL, draws it to a small canvas,
 * and extracts the average color in hex format.
 *
 * @param {string} imageUrl
 * @returns {Promise<string>} hex color code
 */
export const detectImageColor = (imageUrl) => {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve('#ffffff');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('#ffffff');
          return;
        }
        ctx.drawImage(img, 0, 0, 50, 50);
        const imgData = ctx.getImageData(0, 0, 50, 50).data;
        
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i+1];
          const b = imgData[i+2];
          const a = imgData[i+3];
          
          if (a < 200) continue; // skip transparent/semi-transparent pixels
          
          // Skip extremely white and extremely black pixels to find a more colorful average
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          if (brightness > 240 || brightness < 15) continue;
          
          rSum += r;
          gSum += g;
          bSum += b;
          count++;
        }
        
        // If all pixels were skipped, calculate average of all pixels
        if (count === 0) {
          for (let i = 0; i < imgData.length; i += 4) {
            rSum += imgData[i];
            gSum += imgData[i+1];
            bSum += imgData[i+2];
            count++;
          }
        }
        
        const rAvg = Math.round(rSum / count);
        const gAvg = Math.round(gSum / count);
        const bAvg = Math.round(bSum / count);
        
        const componentToHex = (c) => {
          const hex = c.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        };
        resolve('#' + componentToHex(rAvg) + componentToHex(gAvg) + componentToHex(bAvg));
      } catch (err) {
        console.error('Error extracting image color:', err);
        resolve('#ffffff');
      }
    };
    img.onerror = () => {
      resolve('#ffffff');
    };
    img.src = imageUrl;
  });
};

/**
 * Maps a hex color to the closest basic color name among Red, Blue, Black, White, Green, Yellow, Orange, Purple, Pink, Grey, Brown.
 *
 * @param {string} hexCode
 * @returns {string} nearest basic color name
 */
export const getNearestColorName = (hexCode) => {
  if (!hexCode) return '';
  const cleanHex = hexCode.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);

  const basicColors = [
    { name: 'Red', r: 239, g: 68, b: 68 },      // #ef4444
    { name: 'Blue', r: 59, g: 130, b: 246 },    // #3b82f6
    { name: 'Black', r: 0, g: 0, b: 0 },        // #000000
    { name: 'White', r: 255, g: 255, b: 255 },  // #ffffff
    { name: 'Green', r: 34, g: 197, b: 94 },    // #22c55e
    { name: 'Yellow', r: 234, g: 179, b: 8 },   // #eab308
    { name: 'Orange', r: 249, g: 115, b: 22 },  // #f97316
    { name: 'Purple', r: 168, g: 85, b: 247 },  // #a855f7
    { name: 'Pink', r: 236, g: 72, b: 153 },    // #ec4899
    { name: 'Grey', r: 107, g: 114, b: 128 },   // #6b7280
    { name: 'Brown', r: 120, g: 53, b: 15 }     // #78350f
  ];

  let nearest = basicColors[0];
  let minDistance = Infinity;

  for (const c of basicColors) {
    const distance = Math.sqrt(
      Math.pow(r - c.r, 2) +
      Math.pow(g - c.g, 2) +
      Math.pow(b - c.b, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = c;
    }
  }

  return nearest.name;
};

