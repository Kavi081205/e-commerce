import { db } from './utils/firebase.js';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { productId, soldCount, sold } = req.body;
    console.log('[Backend] Update sold request body:', req.body);

    if (!productId || typeof productId !== 'string' || productId.trim() === '') {
      return res.status(400).json({ success: false, message: 'Invalid or missing Product ID' });
    }

    // Determine the raw value, supporting both field names
    const rawVal = soldCount !== undefined ? soldCount : sold;

    if (rawVal === undefined || rawVal === null || isNaN(rawVal)) {
      return res.status(400).json({ success: false, message: 'Missing or invalid sold count value' });
    }

    const numericVal = Number(rawVal);
    if (!Number.isInteger(numericVal) || numericVal < 0) {
      return res.status(400).json({ success: false, message: 'Sold count must be a non-negative whole number' });
    }

    console.log(`[Backend] Updating sold count for product ${productId} to ${numericVal}`);

    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, {
      sold: numericVal,
      soldCount: numericVal,
      updatedAt: serverTimestamp()
    });

    console.log(`[Backend] Product ${productId} updated successfully.`);

    return res.status(200).json({
      success: true,
      message: 'Sold count updated successfully.',
      productId,
      soldCount: numericVal
    });
  } catch (error) {
    console.error('[Backend] Exception thrown in POST /api/update-sold:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update sold count',
      error: error.toString()
    });
  }
}
