import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { uploadImage } from '../../firebase/services';
import { Save, X, Loader2, Image as ImageIcon, AlertCircle, FilePlus, CheckCircle, UploadCloud } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { getOptimizedImage } from '../../utils/cloudinary';

const getColorCode = (name) => {
  const cleanName = name.trim().toLowerCase();
  const colorMap = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
    pink: '#ec4899',
    yellow: '#eab308',
    orange: '#f97316',
    purple: '#a855f7',
    indigo: '#6366f1',
    black: '#000000',
    white: '#ffffff',
    gray: '#6b7280',
    grey: '#6b7280',
    brown: '#78350f',
    gold: '#d97706',
    silver: '#cbd5e1',
    bronze: '#b45309',
    cream: '#fef3c7',
    beige: '#f5f5dc',
    magenta: '#d946ef',
    cyan: '#06b6d4',
    teal: '#14b8a6',
    violet: '#8b5cf6',
    navy: '#1e3a8a',
    maroon: '#800000',
    peach: '#ffdab9',
    lavender: '#e6e6fa',
    mustard: '#e5a93b',
    emerald: '#10b981',
    turquoise: '#40e0d0'
  };
  if (colorMap[cleanName]) return colorMap[cleanName];
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).slice(-2);
  }
  return color;
};

// Strip any localhost:PORT prefix from image/redirect URLs before saving to Firestore
const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  return url.trim().replace(/https?:\/\/localhost:\d+/g, 'https://e-commerce-smkp-traders.vercel.app');
};

const mapVariantsFromDb = (variantsArray, category) => {
  return (variantsArray || []).map(v => {
    const sizes = v.sizes || {};
    const sizeKeys = Object.keys(sizes);
    
    let enableSizes = false;
    let stock = v.stock || 0;

    if (category === 'sarees') {
      enableSizes = false;
      stock = sizes['One Size'] || v.stock || 0;
    } else if (sizeKeys.length > 0) {
      enableSizes = true;
    }

    return {
      colorName: v.colorName || v.color || '',
      colorCode: v.colorCode || '#ffffff',
      images: v.images || [],
      priceDifference: v.priceDifference || 0,
      sizes: sizes,
      stock: stock,
      enableSizes: enableSizes,
      showAdvanced: v.priceDifference !== 0
    };
  });
};

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x400?text=No+Image';

const EditProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // fix #2: image and video included in initial state
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '',
    stock: '',
    description: '',
    costPrice: '',
    image: '',
    video: '',
  });

  // Read-only: soldCount from Firestore (never edited by admin)
  const [soldCount, setSoldCount] = useState(0);

  const [categories, setCategories] = useState([]);

  // Load active categories dynamically from Firestore
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const q = query(
          collection(db, 'categories'),
          where('active', '==', true),
          orderBy('order', 'asc')
        );
        const snap = await getDocs(q);
        setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Failed to load categories in EditProduct:', err);
      }
    };
    fetchCategories();
  }, []);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');

  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState([]);
  const [uploadingVariantColorIdx, setUploadingVariantColorIdx] = useState(null);
  const [tempSizes, setTempSizes] = useState({});
  const [tempUrls, setTempUrls] = useState({});

  // Variant helper functions
  const handleAddVariantColor = () => {
    setVariants(prev => [
      ...prev,
      {
        colorName: '',
        images: [],
        priceDifference: 0,
        sizes: {},
        stock: '',
        enableSizes: false,
        showAdvanced: false
      }
    ]);
  };

  const handleRemoveVariantColor = (colorIdx) => {
    setVariants(prev => prev.filter((_, idx) => idx !== colorIdx));
  };

  const handleUpdateVariantColorField = (colorIdx, field, value) => {
    setVariants(prev => prev.map((v, idx) => {
      if (idx === colorIdx) {
        return { ...v, [field]: value };
      }
      return v;
    }));
  };

  const handleAddVariantSize = (colorIdx, sizeName, sizeStock) => {
    if (!sizeName.trim()) return;
    setVariants(prev => prev.map((v, idx) => {
      if (idx === colorIdx) {
        return {
          ...v,
          sizes: {
            ...(v.sizes || {}),
            [sizeName.toUpperCase().trim()]: Number(sizeStock) || 0
          }
        };
      }
      return v;
    }));
  };

  const handleRemoveVariantSize = (colorIdx, sizeName) => {
    setVariants(prev => prev.map((v, idx) => {
      if (idx === colorIdx) {
        const newSizes = { ...(v.sizes || {}) };
        delete newSizes[sizeName];
        return { ...v, sizes: newSizes };
      }
      return v;
    }));
  };

  const handleVariantColorFileUpload = async (e, colorIdx) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setUploadingVariantColorIdx(colorIdx);
    try {
      const uploadedUrl = await uploadImage(selectedFile);
      if (uploadedUrl) {
        setVariants(prev => prev.map((v, idx) => {
          if (idx === colorIdx) {
            return {
              ...v,
              images: [...(v.images || []), uploadedUrl]
            };
          }
          return v;
        }));
      }
    } catch (err) {
      console.error("Variant image upload failed:", err);
      alert("Failed to upload image: " + err.message);
    } finally {
      setUploadingVariantColorIdx(null);
    }
  };

  const handleAddVariantImageUrl = (colorIdx, url) => {
    if (!url.trim()) return;
    const cleanUrl = sanitizeUrl(url);
    setVariants(prev => prev.map((v, idx) => {
      if (idx === colorIdx) {
        return {
          ...v,
          images: [...(v.images || []), cleanUrl]
        };
      }
      return v;
    }));
  };

  const handleRemoveVariantImage = (colorIdx, imgIdx) => {
    setVariants(prev => prev.map((v, idx) => {
      if (idx === colorIdx) {
        return {
          ...v,
          images: v.images.filter((_, i) => i !== imgIdx)
        };
      }
      return v;
    }));
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const fetchedCost = data.costPrice ?? data.cost ?? '';
          // stock = exact total stock admin set (never subtract soldCount)
          setSoldCount(data.soldCount || 0);
          setHasVariants(data.hasVariants || false);
          setVariants(mapVariantsFromDb(data.variants || [], data.category));
          setFormData({
            name: data.name || '',
            price: data.originalPrice !== undefined ? String(data.originalPrice) : (data.price !== undefined ? String(data.price) : ''),
            category: data.category || '',
            stock: data.stock !== undefined ? String(data.stock) : '',
            image: data.image || '',
            video: data.video || '',
            description: data.description || '',
            costPrice: fetchedCost !== '' ? String(fetchedCost) : '',
          });
        } else {
          setError("Product not found");
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        setError("Failed to load product data");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCostPriceChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      costPrice: value
    }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFormData(prev => ({ ...prev, image: '' }));
      if (errors.image) setErrors(prev => ({ ...prev, image: '' }));
    }
  };

  // Rejects low-resolution images before they reach Cloudinary
  const validateImageResolution = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        if (img.width < 1000) {
          reject(new Error("Upload HD images only"));
        } else {
          resolve(true);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not read image dimensions."));
      };
      img.src = objectUrl;
    });

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.price || formData.price <= 0) newErrors.price = 'Price must be greater than 0';
    if (!hasVariants) {
      if (formData.stock === '' || formData.stock < 0) newErrors.stock = 'Stock cannot be negative';
    } else {
      if (variants.length === 0) {
        newErrors.variants = 'Please add at least one color variant';
      } else {
        const invalidVariant = variants.some(v => !v.colorName.trim());
        if (invalidVariant) {
          newErrors.variants = 'All variants must have a color name';
        }
      }
    }
    if (formData.costPrice === '' || isNaN(Number(formData.costPrice)) || Number(formData.costPrice) < 0) newErrors.costPrice = 'Valid cost price is required';
    if (!formData.category) newErrors.category = 'Please select a category';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!file && !formData.image.trim()) newErrors.image = 'Please upload an image or provide a URL';
    if (formData.image && !formData.image.startsWith('http')) newErrors.image = 'Valid URL required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // fix #6: removed debug console.log statements

    if (!validate()) {
      setError("Please fix the validation errors below.");
      return;
    }

    setIsSaving(true);
    try {
      let imageUrl = formData.image;

      if (file) {
        try {
          await validateImageResolution(file);
        } catch (resErr) {
          setError(resErr.message || resErr);
          setIsSaving(false);
          return;
        }
        try {
          imageUrl = await uploadImage(file);
        } catch (uploadErr) {
          throw new Error(`Image upload failed: ${uploadErr.message}`, { cause: uploadErr });
        }
      }

      // Prepare variants with colors and correct stock/sizes mapping
      const preparedVariants = hasVariants ? variants.map(v => {
        let sizes = { ...(v.sizes || {}) };
        let stock = Number(v.stock || 0);

        if (formData.category === 'sarees') {
          sizes = { 'One Size': stock };
        } else if (v.enableSizes && Object.keys(sizes).length > 0) {
          stock = Object.values(sizes).reduce((s, qty) => s + Number(qty), 0);
        } else {
          sizes = {};
        }

        return {
          color: v.colorName.trim(),
          colorName: v.colorName.trim(),
          colorCode: getColorCode(v.colorName),
          images: v.images || [],
          priceDifference: Number(v.priceDifference || 0),
          sizes: sizes,
          stock: stock
        };
      }) : [];

      const totalStock = hasVariants
        ? preparedVariants.reduce((sum, v) => sum + Number(v.stock || 0), 0)
        : Number(formData.stock);

      // Save exact admin-entered values — NO derived calculations, NO legacy field writes
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, {
        name: formData.name || "",
        price: Number(formData.price) || 0,
        originalPrice: Number(formData.price) || 0,
        stock: totalStock,   // exact value admin typed — never auto-modified
        costPrice: Number(formData.costPrice),
        // NOTE: 'cost' legacy field removed — use 'costPrice' everywhere
        category: formData.category || "Uncategorized",
        video: formData.video || "",
        description: formData.description || "No description",
        image: imageUrl || "",
        variants: hasVariants ? preparedVariants : [],
        hasVariants: hasVariants
        // soldCount is NEVER touched here — only incremented by createOrder()
      });

      // Show success feedback
      setIsSaving(false);
      setSuccess("Product updated successfully!");
      
      // Force a small delay so UI "feels" fresh and listener has time to sync
      setTimeout(() => {
        navigate('/admin/products');
      }, 1500);
    } catch (err) {
      console.error("Error updating product:", err);
      setError("Failed to update product: " + err.message);
      setIsSaving(false);
    }
  };

  // Derived: how many units are still available
  const availableStock = formData.stock !== '' ? Number(formData.stock) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <Loader2 size={40} className="animate-spin text-yellow-500 mb-4" />
        <p className="font-black uppercase tracking-widest text-sm">Loading Product Data...</p>
      </div>
    );
  }

  if (error && !isSaving) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-white mb-2">Error</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <button
          onClick={() => navigate('/admin/products')}
          className="bg-gray-900 text-white font-bold py-3 px-8 rounded-xl"
        >
          Back to Products
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 min-w-0 w-full">
      <PageHeader
        title="Edit Product"
        breadcrumbs={[
          { label: 'Admin', path: '/admin' },
          { label: 'Products', path: '/admin/products' },
          { label: `Edit #${id.slice(-6).toUpperCase()}`, path: `/admin/edit-product/${id}` },
        ]}
      />
      <div className="mb-4 flex items-center gap-2 px-2">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Document ID:</span>
        <code className="text-[10px] font-mono text-yellow-500/50 bg-yellow-500/5 px-2 py-0.5 rounded border border-yellow-500/10">
          {id}
        </code>
      </div>

      <div className="bg-gray-900 rounded-[2rem] shadow-xl border border-yellow-900/10 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Image Preview Sidebar */}
          <div className="md:w-1/3 bg-slate-950 p-8 border-r border-yellow-900/10">
            <div className="sticky top-8">
              <h3 className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Image Preview</h3>
              <div className="aspect-square rounded-2xl bg-gray-900 border-2 border-dashed border-yellow-900/20 overflow-hidden flex items-center justify-center">
                {formData.image ? (
                  <img
                    src={getOptimizedImage(formData.image, 'thumbnail')}
                    alt="Preview"
                    loading="lazy"
                    className="w-full h-full object-cover"
                    // fix #3: use placeholder instead of empty string to avoid infinite error loop
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                  />
                ) : (
                  <div className="text-gray-300 flex flex-col items-center">
                    <ImageIcon size={48} strokeWidth={1.5} />
                    <p className="text-[10px] font-bold uppercase mt-2">No Image</p>
                  </div>
                )}
              </div>
              <p className="mt-4 text-[10px] text-gray-400 font-medium leading-relaxed italic">
                Enter a direct image URL in the form to see the preview update live.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 p-4 sm:p-8 md:p-12">
            <form onSubmit={handleSubmit} className="space-y-6">
              {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-xl flex items-center gap-3 animate-fadeIn">
                  <CheckCircle size={20} />
                  <p className="text-sm font-bold">{success}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="name" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Product Name</label>
                  <input
                    id="name" type="text" name="name" autoComplete="off"
                    value={formData.name} onChange={handleChange}
                    placeholder="e.g. Premium Wireless Headphones"
                    className={`w-full bg-slate-950 border rounded-xl py-4 px-5 text-white font-medium focus:ring-4 outline-none transition-all ${errors.name ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'}`}
                  />
                  {errors.name && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="price" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Price (₹)</label>
                  <input
                    id="price" type="number" name="price" autoComplete="off"
                    value={formData.price} onChange={handleChange} placeholder="2999"
                    className={`w-full bg-slate-950 border rounded-xl py-4 px-5 text-white font-medium focus:ring-4 outline-none transition-all ${errors.price ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'}`}
                  />
                  {errors.price && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.price}</p>}
                </div>

                <div>
                  <label htmlFor="costPrice" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Cost Price (₹)</label>
                  <input
                    id="costPrice"
                    type="number"
                    name="costPrice"
                    value={formData.costPrice || ""}
                    onChange={handleCostPriceChange}
                    placeholder="1500"
                    className={`w-full bg-slate-950 border rounded-xl py-4 px-5 text-white font-medium focus:ring-4 outline-none transition-all ${errors.costPrice ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'}`}
                  />
                  {errors.costPrice && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.costPrice}</p>}
                </div>

                <div>
                    <label htmlFor="stock" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Total Stock (Admin Entry)</label>
                    <input
                      id="stock" type="number" name="stock" autoComplete="off"
                      value={hasVariants ? variants.reduce((sum, v) => sum + (formData.category === 'sarees' ? Number(v.stock || 0) : (v.enableSizes ? Object.values(v.sizes || {}).reduce((s, qty) => s + Number(qty), 0) : Number(v.stock || 0))), 0) : formData.stock}
                      onChange={handleChange} placeholder="50" min="0"
                      disabled={hasVariants}
                      className={`w-full bg-slate-950 border rounded-xl py-4 px-5 text-white font-medium focus:ring-4 outline-none transition-all ${hasVariants ? 'opacity-50 cursor-not-allowed border-yellow-900/10' : (errors.stock ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500')}`}
                    />
                    {errors.stock && !hasVariants && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.stock}</p>}
                    {hasVariants && <p className="text-yellow-500/60 text-[9px] font-bold uppercase tracking-wider mt-1.5 ml-1">Managed via variants below</p>}
                    {/* Read-only inventory summary — never used in save logic */}
                    <div className="mt-2 flex gap-3 text-[10px] font-black uppercase tracking-widest">
                      <span className="text-gray-500">Sold: <span className="text-yellow-500">{soldCount}</span></span>
                      <span className="text-gray-500">Available: <span className="text-green-500">
                        {hasVariants 
                          ? variants.reduce((sum, v) => sum + (formData.category === 'sarees' ? Number(v.stock || 0) : (v.enableSizes ? Object.values(v.sizes || {}).reduce((s, qty) => s + Number(qty), 0) : Number(v.stock || 0))), 0)
                          : availableStock
                        }
                      </span></span>
                    </div>
                 </div>

                <div>
                  <label htmlFor="category" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Category</label>
                  <select
                    id="category" name="category" autoComplete="off"
                    value={formData.category} onChange={handleChange}
                    className={`w-full bg-slate-950 border rounded-xl py-4 px-5 text-white font-medium focus:ring-4 outline-none transition-all appearance-none ${errors.category ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'}`}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                  {errors.category && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.category}</p>}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="video" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Video URL (Optional)</label>
                  <input
                    id="video" type="url" name="video" autoComplete="url"
                    value={formData.video} onChange={handleChange}
                    placeholder="https://example.com/video.mp4"
                    className="w-full bg-slate-950 border border-yellow-900/20 rounded-xl py-4 px-5 text-white font-medium focus:ring-4 focus:ring-yellow-500/10 focus:border-yellow-500 outline-none transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <p className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Product Image
                  </p>

                  <label
                    htmlFor="file-upload"
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all relative ${file ? 'border-yellow-500 bg-yellow-500/10' : 'border-yellow-900/20 bg-slate-950 hover:bg-gray-800 hover:border-yellow-400'
                      }`}
                  >
                    <input
                      type="file"
                      id="file-upload"
                      name="file-upload"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                      <FilePlus className={`w-8 h-8 mb-2 ${file ? 'text-yellow-600' : 'text-gray-400'}`} />
                      <p className={`text-xs font-bold uppercase tracking-widest ${file ? 'text-yellow-700' : 'text-gray-500'}`}>
                        {file ? file.name : 'Select New Image File'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tighter">PNG, JPG, WEBP up to 5MB</p>
                    </div>
                  </label>

                  <div className="flex items-center gap-4 my-4">
                    <div className="h-[1px] flex-1 bg-gray-800" />
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">OR</span>
                    <div className="h-[1px] flex-1 bg-gray-800" />
                  </div>

                  <div className="relative">
                    <label htmlFor="image" className="sr-only">Product Image URL</label>
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <ImageIcon size={18} className="text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      id="image" type="url" name="image" autoComplete="url"
                      value={formData.image} onChange={handleChange}
                      placeholder="https://images.unsplash.com/..."
                      disabled={file}
                      className={`w-full bg-slate-950 border rounded-xl py-4 pl-12 pr-5 text-white font-medium focus:ring-4 outline-none transition-all ${file ? 'opacity-50 cursor-not-allowed' : ''
                        } ${errors.image ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'}`}
                    />
                  </div>
                  {errors.image && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.image}</p>}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="description" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Description</label>
                  <textarea
                    id="description" name="description" autoComplete="off"
                    rows="4" value={formData.description} onChange={handleChange}
                    placeholder="Describe the product features and specifications..."
                    className={`w-full bg-slate-950 border rounded-xl py-4 px-5 text-white font-medium focus:ring-4 outline-none transition-all resize-none ${errors.description ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'}`}
                  />
                  {errors.description && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.description}</p>}
                </div>
              </div>

              {/* Has Variants Toggle */}
              <div className="flex items-center justify-between p-4 sm:p-6 bg-slate-950/50 border border-yellow-900/10 rounded-2xl mb-8 mt-8 gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Product Variants</h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-1">This product has different colors or sizes</p>
                </div>
                <label htmlFor="has-variants" className="toggle-wrap shrink-0" aria-label="Enable product variants">
                  <input 
                    id="has-variants"
                    type="checkbox" 
                    checked={hasVariants} 
                    onChange={(e) => setHasVariants(e.target.checked)} 
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                </label>
              </div>

              {/* Variant Manager UI */}
              {hasVariants && (
                <div className="space-y-6 sm:space-y-8 p-4 sm:p-8 bg-slate-950/30 border border-yellow-900/10 rounded-3xl mb-8">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-yellow-900/10">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Variant Manager</h3>
                    <button
                      type="button"
                      onClick={handleAddVariantColor}
                      className="w-full sm:w-auto px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      + Add Color
                    </button>
                  </div>

                  {errors.variants && (
                    <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider">{errors.variants}</p>
                  )}

                  {variants.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-[10px] font-black uppercase tracking-widest">No Color Variants Added</p>
                      <p className="text-[9px] mt-1 font-medium text-gray-600">Click "+ Add Color" to define product variants</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                  {variants.map((v, colorIdx) => {
                    const tempSize = tempSizes[colorIdx]?.size || '';
                    const tempStock = tempSizes[colorIdx]?.stock || '';
                    const tempUrl = tempUrls[colorIdx] || '';

                    return (
                      <div key={colorIdx} className="p-4 sm:p-6 bg-gray-900/50 border border-white/5 rounded-2xl relative">
                        {/* Remove button at top right */}
                        <button
                          type="button"
                          onClick={() => handleRemoveVariantColor(colorIdx)}
                          className="absolute top-4 right-4 text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors"
                        >
                          ✕ Remove
                        </button>

                        {/* Main content: Color Name -> Upload Images -> Stock Quantity */}
                        <div className="space-y-6 pt-4">
                          
                          {/* 1. Color Name */}
                          <div>
                            <label htmlFor={`variant-color-name-${colorIdx}`} className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Color Name</label>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <input
                                id={`variant-color-name-${colorIdx}`}
                                name={`variantColorName-${colorIdx}`}
                                type="text"
                                value={v.colorName}
                                onChange={(e) => handleUpdateVariantColorField(colorIdx, 'colorName', e.target.value)}
                                placeholder="e.g. Red, Teal, Blue, Pink"
                                className="w-full bg-slate-950 border border-yellow-900/20 rounded-xl p-3 text-xs font-medium text-white outline-none focus:border-yellow-500"
                              />
                              {v.colorName.trim() && (
                                <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-950 p-2.5 rounded-xl border border-white/5 w-full sm:w-auto">
                                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Auto Color:</span>
                                  <div 
                                    className="w-6 h-6 rounded-full border border-white/20 shadow-md transition-all duration-300" 
                                    style={{ backgroundColor: v.colorCode || getColorCode(v.colorName) }}
                                    title={`Color code: ${v.colorCode || getColorCode(v.colorName)}`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 2. Upload Images (Primary File Upload box) */}
                          <div className="space-y-3">
                            <p className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Upload Images</p>
                            <label 
                              htmlFor={`variant-file-upload-${colorIdx}`} 
                              className={`flex flex-col items-center justify-center w-full h-28 border border-dashed rounded-xl cursor-pointer transition-all ${
                                uploadingVariantColorIdx === colorIdx 
                                  ? 'border-yellow-500 bg-yellow-500/10' 
                                  : 'border-yellow-900/20 bg-slate-950 hover:bg-gray-800 hover:border-yellow-500/40'
                              }`}
                            >
                              <input
                                id={`variant-file-upload-${colorIdx}`}
                                name={`variantFileUpload-${colorIdx}`}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleVariantColorFileUpload(e, colorIdx)}
                                className="sr-only"
                              />
                              <UploadCloud className="w-6 h-6 mb-1 text-gray-400" />
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {uploadingVariantColorIdx === colorIdx ? 'Uploading to Cloudinary...' : 'Select Variant Image File'}
                              </span>
                              <span className="text-[8px] text-gray-600 uppercase tracking-tight mt-0.5">PNG, JPG, WEBP up to 5MB</span>
                            </label>

                            {/* Image Thumbnail Previews */}
                            {v.images && v.images.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto py-2">
                                {v.images.map((imgUrl, imgIdx) => (
                                  <div key={imgIdx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 group/img">
                                    <img src={getOptimizedImage(imgUrl, 'thumbnail')} alt="Variant Thumbnail" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveVariantImage(colorIdx, imgIdx)}
                                      className="absolute inset-0 bg-red-600/80 text-white text-[9px] font-black uppercase tracking-wider flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 3. Stock Quantity / Sizing */}
                          <div className="border-t border-white/5 pt-4">
                            {formData.category === 'sarees' ? (
                              <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-2">
                                <label htmlFor={`variant-stock-${colorIdx}`} className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                  Stock Quantity
                                </label>
                                <input
                                  id={`variant-stock-${colorIdx}`}
                                  name={`variantStock-${colorIdx}`}
                                  type="number"
                                  min="0"
                                  value={v.stock}
                                  onChange={(e) => handleUpdateVariantColorField(colorIdx, 'stock', e.target.value)}
                                  placeholder="e.g. 10 (Sarees default to One Size)"
                                  className="w-full bg-slate-950 border border-yellow-900/20 rounded-xl p-3 text-xs text-white outline-none focus:border-yellow-500"
                                />
                                <p className="text-[9px] text-gray-500 font-medium italic">Note: Sarees default to a single size ("One Size") automatically.</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Enable sizes (for clothing)</span>
                                  <label htmlFor={`variant-enable-sizes-${colorIdx}`} className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                      id={`variant-enable-sizes-${colorIdx}`}
                                      name={`variantEnableSizes-${colorIdx}`}
                                      type="checkbox" 
                                      checked={v.enableSizes} 
                                      onChange={(e) => handleUpdateVariantColorField(colorIdx, 'enableSizes', e.target.checked)} 
                                      className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-750 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-600"></div>
                                  </label>
                                </div>

                                {v.enableSizes ? (
                                  <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-white/5">
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Add Sizes & Stock</p>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <label htmlFor={`variant-size-${colorIdx}`} className="sr-only">Variant Size</label>
                                      <input
                                        id={`variant-size-${colorIdx}`}
                                        name={`variantSize-${colorIdx}`}
                                        type="text"
                                        value={tempSize}
                                        onChange={(e) => setTempSizes(prev => ({
                                          ...prev,
                                          [colorIdx]: { ...prev[colorIdx], size: e.target.value }
                                        }))}
                                        placeholder="Size (e.g. S, M, L)"
                                        className="w-full bg-slate-950 border border-yellow-900/20 rounded-lg p-2 text-xs text-white outline-none focus:border-yellow-500"
                                      />
                                      <label htmlFor={`variant-stock-input-${colorIdx}`} className="sr-only">Variant Stock Qty</label>
                                      <input
                                        id={`variant-stock-input-${colorIdx}`}
                                        name={`variantStockInput-${colorIdx}`}
                                        type="number"
                                        value={tempStock}
                                        onChange={(e) => setTempSizes(prev => ({
                                          ...prev,
                                          [colorIdx]: { ...prev[colorIdx], stock: e.target.value }
                                        }))}
                                        placeholder="Qty"
                                        className="w-full sm:w-20 bg-slate-950 border border-yellow-900/20 rounded-lg p-2 text-xs text-white outline-none focus:border-yellow-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleAddVariantSize(colorIdx, tempSize, tempStock);
                                          setTempSizes(prev => ({
                                            ...prev,
                                            [colorIdx]: { size: '', stock: '' }
                                          }));
                                        }}
                                        className="w-full sm:w-auto px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                      >
                                        + Add
                                      </button>
                                    </div>

                                    {v.sizes && Object.keys(v.sizes).length > 0 && (
                                      <div className="flex flex-wrap gap-2 pt-2">
                                        {Object.entries(v.sizes).map(([szName, szQty]) => (
                                          <div key={szName} className="flex items-center gap-2 px-3 py-1 bg-black/60 border border-yellow-500/20 rounded-full">
                                            <span className="text-[10px] font-black text-white">{szName}</span>
                                            <span className="text-[10px] font-bold text-yellow-500">{szQty}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveVariantSize(colorIdx, szName)}
                                              className="text-red-500 hover:text-red-400 font-bold ml-1 text-xs"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-2 bg-slate-950/40 p-4 rounded-xl border border-white/5">
                                    <label htmlFor={`variant-stock-${colorIdx}`} className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                      Stock Quantity
                                    </label>
                                    <input
                                      id={`variant-stock-${colorIdx}`}
                                      name={`variantStock-${colorIdx}`}
                                      type="number"
                                      min="0"
                                      value={v.stock}
                                      onChange={(e) => handleUpdateVariantColorField(colorIdx, 'stock', e.target.value)}
                                      placeholder="e.g. 10"
                                      className="w-full bg-slate-950 border border-yellow-900/20 rounded-xl p-3 text-xs text-white outline-none focus:border-yellow-500"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 4. Collapsible Advanced Settings (HEX, Price Diff, Image URL) */}
                          <div className="border-t border-white/5 pt-4">
                            <button
                              type="button"
                              onClick={() => handleUpdateVariantColorField(colorIdx, 'showAdvanced', !v.showAdvanced)}
                              className="text-[10px] font-black text-yellow-500/80 hover:text-yellow-500 uppercase tracking-widest flex items-center gap-1 transition-colors"
                            >
                              {v.showAdvanced ? 'Hide Advanced Settings ▴' : 'Show Advanced Settings ▾'}
                            </button>

                            {v.showAdvanced && (
                              <div className="space-y-4 mt-4 p-4 bg-slate-950/50 border border-white/5 rounded-xl animate-fadeIn">
                                {/* Custom HEX override */}
                                <div>
                                  <label htmlFor={`variant-color-code-${colorIdx}`} className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Color Code (Hex Override)</label>
                                  <div className="flex gap-2">
                                    <input
                                      id={`variant-color-picker-${colorIdx}`}
                                      name={`variantColorPicker-${colorIdx}`}
                                      type="color"
                                      value={v.colorCode || getColorCode(v.colorName)}
                                      onChange={(e) => handleUpdateVariantColorField(colorIdx, 'colorCode', e.target.value)}
                                      className="w-8 h-8 bg-transparent border-0 cursor-pointer rounded"
                                      aria-label="Color Code Picker"
                                    />
                                    <input
                                      id={`variant-color-code-${colorIdx}`}
                                      name={`variantColorCode-${colorIdx}`}
                                      type="text"
                                      value={v.colorCode || ''}
                                      onChange={(e) => handleUpdateVariantColorField(colorIdx, 'colorCode', e.target.value)}
                                      placeholder={getColorCode(v.colorName)}
                                      className="flex-1 bg-slate-950 border border-yellow-900/20 rounded-lg p-2 text-xs font-mono text-white outline-none focus:border-yellow-500"
                                    />
                                  </div>
                                </div>

                                {/* Price Difference */}
                                <div>
                                  <label htmlFor={`variant-price-diff-${colorIdx}`} className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Price Difference (Optional)</label>
                                  <input
                                    id={`variant-price-diff-${colorIdx}`}
                                    name={`variantPriceDiff-${colorIdx}`}
                                    type="number"
                                    value={v.priceDifference || ''}
                                    onChange={(e) => handleUpdateVariantColorField(colorIdx, 'priceDifference', Number(e.target.value))}
                                    placeholder="e.g. 100 or -50"
                                    className="w-full bg-slate-950 border border-yellow-900/20 rounded-lg p-2.5 text-xs text-white outline-none focus:border-yellow-500"
                                  />
                                </div>

                                {/* Image URL fallback */}
                                <div>
                                  <label htmlFor={`variant-image-url-${colorIdx}`} className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Or Paste Image URL</label>
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                      id={`variant-image-url-${colorIdx}`}
                                      name={`variantImageUrl-${colorIdx}`}
                                      type="url"
                                      value={tempUrl}
                                      onChange={(e) => setTempUrls(prev => ({ ...prev, [colorIdx]: e.target.value }))}
                                      placeholder="https://example.com/image.jpg"
                                      className="w-full bg-slate-950 border border-yellow-900/10 rounded-lg p-2 text-xs text-white outline-none focus:border-yellow-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleAddVariantImageUrl(colorIdx, tempUrl);
                                        setTempUrls(prev => ({ ...prev, [colorIdx]: '' }));
                                      }}
                                      className="w-full sm:w-auto px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                                    >
                                      Add URL
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

              <div className="pt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit" disabled={isSaving}
                  className="w-full sm:flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white font-black uppercase tracking-widest py-4 px-8 rounded-xl transition-all shadow-lg shadow-yellow-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  {isSaving ? 'Updating...' : 'Update Product'}
                </button>
                <button
                  type="button" onClick={() => navigate('/admin/products')}
                  className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-gray-400 font-black uppercase tracking-widest py-4 px-8 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <X size={20} /> Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProduct;