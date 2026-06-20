async function run() {
  const url = 'https://firestore.googleapis.com/v1/projects/aurex-ecommerce/databases/(default)/documents/orders';
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.documents) {
      console.log('No documents found or error:', data);
      return;
    }

    const rootKeys = new Set();
    const itemKeys = new Set();

    for (const doc of data.documents) {
      const fields = doc.fields || {};
      Object.keys(fields).forEach(k => rootKeys.add(k));

      // Inspect items
      const itemsVal = fields.items?.arrayValue?.values || [];
      itemsVal.forEach(item => {
        const itemFields = item.mapValue?.fields || {};
        Object.keys(itemFields).forEach(k => itemKeys.add(k));
      });
      
      // Inspect orderedItems
      const oitemsVal = fields.orderedItems?.arrayValue?.values || [];
      oitemsVal.forEach(item => {
        const itemFields = item.mapValue?.fields || {};
        Object.keys(itemFields).forEach(k => itemKeys.add(k));
      });
    }

    console.log('Unique Root Keys in orders collection:', Array.from(rootKeys));
    console.log('Unique Item Keys in orders collection:', Array.from(itemKeys));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
