import { db, collection, query, where, getDocs } from './utils/firebase.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { mobile } = req.query;
    console.log('[Backend] Incoming GET request to /api/complaints with mobile:', mobile);

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Missing mobile number parameter' });
    }

    // Clean phone number: remove non-digits, keep last 10 digits
    const cleanPhone = mobile.replace(/\D/g, '').slice(-10);

    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Mobile number must contain exactly 10 digits' });
    }

    console.log('[Backend] Fetching complaints for phone:', cleanPhone);

    const q = query(
      collection(db, 'complaints'),
      where('customerPhone', '==', cleanPhone)
    );
    const snap = await getDocs(q);
    const complaints = snap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
      };
    });

    // Sort complaints by newest first (createdAt desc) in-memory to avoid index requirement
    complaints.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    console.log(`[Backend] Found ${complaints.length} complaints for phone:`, cleanPhone);

    return res.status(200).json({
      success: true,
      complaints
    });
  } catch (error) {
    console.error('[Backend] Exception thrown in GET /api/complaints:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch complaints',
      error: error.toString()
    });
  }
}
