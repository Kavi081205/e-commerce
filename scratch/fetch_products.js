async function run() {
  const url = 'https://firestore.googleapis.com/v1/projects/aurex-ecommerce/databases/(default)/documents/products';
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.documents) {
      console.log('No documents found or error:', data);
      return;
    }
    console.log(`Found ${data.documents.length} products:`);
    for (const doc of data.documents) {
      const name = doc.fields?.name?.stringValue || doc.fields?.title?.stringValue || 'Unnamed';
      const id = doc.name.split('/').pop();
      const video = doc.fields?.video?.stringValue || doc.fields?.videoUrl?.stringValue || null;
      console.log(`- ID: ${id} | Name: ${name} | Video: ${video}`);
    }
  } catch (err) {
    console.error('Error fetching products:', err);
  }
}

run();
