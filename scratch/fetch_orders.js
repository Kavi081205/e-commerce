async function run() {
  const url = 'https://firestore.googleapis.com/v1/projects/aurex-ecommerce/databases/(default)/documents/orders';
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.documents) {
      console.log('No documents found or error:', data);
      return;
    }
    console.log(`Found ${data.documents.length} orders. Printing structure of first 2 orders:`);
    for (let i = 0; i < Math.min(2, data.documents.length); i++) {
      console.log(`--- Order #${i + 1} ---`);
      console.log(JSON.stringify(data.documents[i].fields, null, 2));
    }
  } catch (err) {
    console.error('Error fetching orders:', err);
  }
}

run();
