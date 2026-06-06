/**
 * Pricing Utility - Single Source of Truth for Product Calculations
 */

/**
 * Calculates the effective price of a product based on active promotions.
 * @param {Object} product - The product document from Firestore.
 * @param {Object} promoSettings - The global promotion settings.
 * @returns {number} The final price to display or charge.
 */
export const getEffectivePrice = (product, promoSettings) => {
  if (!product) return 0;
  
  let basePrice = Number(product.originalPrice ?? product.price ?? 0);

  // Apply variant price difference if color is selected and variants exist
  if (product.color && product.variants && product.variants.length > 0) {
    const colorName = typeof product.color === 'object' ? product.color.name : product.color;
    const variant = product.variants.find(v => (v.colorName || v.color) === colorName);
    if (variant && variant.priceDifference) {
      basePrice += Number(variant.priceDifference);
    }
  }
  
  // Check if there's an active global offer for this specific product
  const productId = product.productId || product.id;
  
  // Find matching offer from promoSettings.activeOffers first
  const activeOffers = promoSettings?.activeOffers || [];
  const matchingOffer = activeOffers.find(o => o.productId === productId);

  if (matchingOffer) {
    const expiry = matchingOffer.expiryDateTime || matchingOffer.offerEndDate;
    const isOfferActive = 
      matchingOffer.isActive !== false &&
      (!expiry || Date.now() < new Date(expiry).getTime());

    if (isOfferActive && Number(matchingOffer.discount) > 0) {
      const discountAmount = (basePrice * Number(matchingOffer.discount)) / 100;
      return basePrice - discountAmount;
    }
  }

  // Fallback check
  const isOfferActive = 
    promoSettings?.offerActive && 
    promoSettings?.offerProductId === productId &&
    (!promoSettings.offerEnd || Date.now() < new Date(promoSettings.offerEnd).getTime());

  if (isOfferActive && promoSettings.discount > 0) {
    const discountAmount = (basePrice * Number(promoSettings.discount)) / 100;
    // No rounding — return exact calculated price
    return basePrice - discountAmount;
  }

  return basePrice;
};

/**
 * Formats a numeric value into the local currency string (Rupees).
 * @param {number} value - The numeric value to format.
 * @returns {string} Formatted currency string.
 */
export const formatCurrency = (value) => {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
};

/**
 * Validates and converts an input value to a positive number.
 * @param {any} value - The value to parse.
 * @returns {number} A clean numeric value.
 */
export const parseNumericInput = (value) => {
  const parsed = Number(value);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
};
