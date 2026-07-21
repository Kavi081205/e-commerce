/**
 * Product Utility Helpers
 * Centralized logic for product sold status & stock status across the application.
 */

/**
 * Checks if a product is explicitly marked as Sold / Sold Out by admin or system.
 * Returns true if product.sold === true, product.isSold === true, product.isSoldOut === true, or string 'true'.
 */
export const isProductSold = (product) => {
  if (!product) return false;
  if (
    product.sold === true ||
    product.isSold === true ||
    product.isSoldOut === true ||
    (typeof product.sold === 'string' && product.sold.toLowerCase() === 'true')
  ) {
    return true;
  }
  return false;
};

/**
 * Checks if a product is unavailable for purchase (either explicitly sold or stock <= 0).
 */
export const isProductUnavailable = (product) => {
  if (!product) return true;
  if (isProductSold(product)) return true;
  const stock = Number(product.stock ?? 0);
  return stock <= 0;
};
