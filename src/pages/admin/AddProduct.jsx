import React, { useState, useEffect } from 'react';
import { addProduct, uploadImage } from '../../firebase/services';
import { db } from '../../firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import {
  Image as ImageIcon, UploadCloud, Loader2,
  CheckCircle, AlertCircle, FilePlus
} from 'lucide-react';
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

const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  // Strip any localhost:PORT prefix before saving to Firestore
  return url.trim().replace(/https?:\/\/localhost:\d+/g, 'https://e-commerce-smkp-traders.vercel.app');
};

const INITIAL_FORM = {
  name: '', price: '', description: '',
  category: '', image: '', video: '', stock: '', costPrice: '',
};

const AddProduct = () => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(''); // ✅ Managed object URL
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
        const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCategories(cats);
        if (cats.length > 0) {
          setFormData(prev => {
            if (!prev.category || !cats.some(c => c.slug === prev.category)) {
              return { ...prev, category: cats[0].slug };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Failed to load categories in AddProduct:', err);
      }
    };
    fetchCategories();
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState({});

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
    const sanitizedUrl = sanitizeUrl(url);
    setVariants(prev => prev.map((v, idx) => {
      if (idx === colorIdx) {
        return {
          ...v,
          images: [...(v.images || []), sanitizedUrl]
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

  // ✅ Create and revoke object URL to prevent memory leaks
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleCostPriceChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      costPrice: value
    }));
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setFormData(prev => ({ ...prev, image: '' }));
      setErrors(prev => ({ ...prev, image: '' }));
    }
  };

  // ✅ Clear file and preview together; also clear image error
  const handleFileClear = () => {
    setFile(null);
    setErrors(prev => ({ ...prev, image: '' }));
  };

  const handleImageError = (e) => {
    // ✅ Inline SVG data URI — no external dependency
    e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%231e293b'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='16' font-family='sans-serif'%3EInvalid Image URL%3C/text%3E%3C/svg%3E`;
  };

  // Rejects low-resolution images before they reach Cloudinary
  const validateImageResolution = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        if (img.width < 1000) {
          reject("Upload HD images only");
        } else {
          resolve(true);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject('Could not read image dimensions.');
      };
      img.src = objectUrl;
    });

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Product title is required';

    // ✅ Explicit empty check before numeric comparison
    if (formData.price === '' || Number(formData.price) <= 0)
      newErrors.price = 'Price must be greater than 0';

    if (!hasVariants) {
      if (formData.stock === '' || Number(formData.stock) < 0)
        newErrors.stock = 'Stock cannot be negative';
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

    if (formData.costPrice === '' || isNaN(Number(formData.costPrice)) || Number(formData.costPrice) < 0)
      newErrors.costPrice = 'Valid cost price is required';

    if (!formData.description.trim())
      newErrors.description = 'Description is required';

    if (!file && !formData.image.trim())
      newErrors.image = 'Please upload an image or provide a URL';

    if (formData.image && !formData.image.startsWith('http'))
      newErrors.image = 'Please enter a valid image URL';

    if (formData.image && (formData.image.includes('google.com/url') || formData.image.includes('imgres')))
      newErrors.image = 'Direct image links only (no Google redirects)';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!validate()) { setError('Please fix the errors before submitting.'); return; }

    setLoading(true);
    try {
      let imageUrl = formData.image;
      if (file) {
        // Block low-res uploads before hitting Cloudinary
        try {
          await validateImageResolution(file);
        } catch (resErr) {
          setError(resErr);
          setLoading(false);
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

      // Save exact admin-entered values — NO derived calculations
      await addProduct({
        name: formData.name.trim(),
        price: Number(formData.price),
        originalPrice: Number(formData.price),
        description: formData.description.trim(),
        category: formData.category,
        image: imageUrl,
        video: formData.video || '',
        stock: totalStock,
        costPrice: Number(formData.costPrice),
        variants: hasVariants ? preparedVariants : [],
        hasVariants: hasVariants
      });

      setSuccess('Product added successfully!');
      setFormData({
        ...INITIAL_FORM,
        category: categories.length > 0 ? categories[0].slug : ''
      });
      setFile(null);
      setVariants([]);
      setHasVariants(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error("Error adding product:", err);
      setError(
        err.code === 'permission-denied'
          ? 'Permission denied. Check your Firestore rules and ensure your account has admin role.'
          : `Failed to add product: ${err.message}`
      );
    } finally {
      // ✅ setLoading in finally — always runs even if success path throws
      setLoading(false);
    }
  };

  const imagePreviewSrc = preview || formData.image;

  return (
    <div className="max-w-4xl mx-auto min-w-0 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Add New Product</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Upload an image or provide a URL</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-3xl shadow-sm border border-yellow-900/10 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-8" noValidate>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 border border-red-100">
              <AlertCircle size={20} aria-hidden="true" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-yellow-500/10 text-yellow-600 p-4 rounded-2xl flex items-center gap-3 border border-yellow-900/40">
              <CheckCircle size={20} aria-hidden="true" />
              <p className="text-sm font-bold">{success}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">

            {/* Left Column: Details */}
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Product Title
                </label>
                <input
                  id="name" type="text" name="name" autoComplete="off"
                  value={formData.name} onChange={handleInputChange}
                  placeholder="e.g. Wireless Noise-Cancelling Headphones"
                  className={`w-full bg-slate-950 border rounded-2xl focus:ring-4 p-4 outline-none transition-all font-medium text-white ${errors.name
                    ? 'border-red-500 focus:ring-red-500/10'
                    : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'
                    }`}
                />
                {errors.name && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Price (₹)</label>
                  <input
                    id="price" type="number" name="price" autoComplete="off"
                    value={formData.price} onChange={handleInputChange} min="0" step="0.01" placeholder="0.00"
                    className={`w-full bg-slate-950 border rounded-2xl focus:ring-4 p-4 outline-none transition-all font-medium text-white ${errors.price ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'
                      }`}
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
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={`w-full bg-slate-950 border rounded-2xl focus:ring-4 p-4 outline-none transition-all font-medium text-white ${errors.costPrice ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'}`}
                  />
                  {errors.costPrice && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.costPrice}</p>}
                </div>
                <div>
                  <label htmlFor="stock" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Stock Level</label>
                  <input
                    id="stock" type="number" name="stock" autoComplete="off"
                    value={hasVariants ? variants.reduce((sum, v) => sum + (formData.category === 'sarees' ? Number(v.stock || 0) : (v.enableSizes ? Object.values(v.sizes || {}).reduce((s, qty) => s + Number(qty), 0) : Number(v.stock || 0))), 0) : formData.stock}
                    onChange={handleInputChange} min="0" placeholder="0"
                    disabled={hasVariants}
                    className={`w-full bg-slate-950 border rounded-2xl focus:ring-4 p-4 outline-none transition-all font-medium text-white ${hasVariants ? 'opacity-50 cursor-not-allowed border-yellow-900/10' : (errors.stock ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500')}`}
                  />
                  {errors.stock && !hasVariants && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.stock}</p>}
                  {hasVariants && <p className="text-yellow-500/60 text-[9px] font-bold uppercase tracking-wider mt-1.5 ml-1">Managed via variants below</p>}
                </div>
                <div>
                  <label htmlFor="category" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Category</label>
                  <select
                    id="category" name="category"
                    value={formData.category} onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-yellow-900/20 rounded-2xl focus:ring-4 focus:ring-yellow-500/10 focus:border-yellow-500 p-4 outline-none transition-all font-medium text-white appearance-none"
                  >
                    {categories.length > 0 ? (
                      categories.map(cat => (
                        <option key={cat.id} value={cat.slug}>{cat.name}</option>
                      ))
                    ) : (
                      <option value="">Loading categories...</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Description</label>
                <textarea
                  id="description" name="description" autoComplete="off"
                  value={formData.description} onChange={handleInputChange}
                  rows="4" placeholder="Describe the product features and details..."
                  className={`w-full bg-slate-950 border rounded-2xl focus:ring-4 p-4 outline-none transition-all font-medium text-white resize-none ${errors.description ? 'border-red-500 focus:ring-red-500/10' : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'
                    }`}
                />
                {errors.description && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.description}</p>}
              </div>
            </div>

            {/* Right Column: Image & Preview */}
            <div className="space-y-6">
              <div>
                <p className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Product Image
                </p>

                {/* ✅ Single label — no duplicate trigger; input is the only interactive element */}
                <label
                  htmlFor="file-upload"
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all ${file
                    ? 'border-yellow-500 bg-yellow-500/10'
                    : 'border-yellow-900/20 bg-slate-950 hover:bg-gray-800 hover:border-yellow-400'
                    }`}
                >
                  <input
                    type="file" id="file-upload" name="file-upload"
                    accept="image/*" onChange={handleFileChange}
                    className="sr-only" // ✅ sr-only instead of opacity-0 — cleaner, no overlap issue
                  />
                  <FilePlus className={`w-8 h-8 mb-2 ${file ? 'text-yellow-600' : 'text-gray-400'}`} />
                  <p className={`text-xs font-bold uppercase tracking-widest ${file ? 'text-yellow-700' : 'text-gray-500'}`}>
                    {file ? file.name : 'Select Image File'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tighter">PNG, JPG, WEBP up to 5MB</p>
                </label>

                {/* ✅ Clear file button */}
                {file && (
                  <button
                    type="button"
                    onClick={handleFileClear}
                    className="mt-2 text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-300 transition-colors"
                  >
                    ✕ Remove file
                  </button>
                )}

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
                    value={formData.image} onChange={handleInputChange}
                    placeholder="https://example.com/image.jpg"
                    disabled={file}
                    className={`w-full bg-slate-950 border rounded-2xl focus:ring-4 pl-12 pr-4 py-4 outline-none transition-all font-medium text-white ${file ? 'opacity-50 cursor-not-allowed' : ''
                      } ${errors.image
                        ? 'border-red-500 focus:ring-red-500/10'
                        : 'border-yellow-900/20 focus:ring-yellow-500/10 focus:border-yellow-500'
                      }`}
                  />
                </div>
                {errors.image && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-1.5 ml-1">{errors.image}</p>}
              </div>

              {/* Live Preview */}
              <div>
                <h3 className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Live Preview</h3>
                <div className="w-full bg-gray-900 rounded-3xl border border-yellow-900/10 shadow-xl overflow-hidden flex flex-col transition-all duration-300">
                  <div className="relative aspect-square overflow-hidden bg-slate-950 flex items-center justify-center">
                    {imagePreviewSrc ? (
                      <img
                        src={getOptimizedImage(imagePreviewSrc, 'thumbnail')}
                        alt="Product preview"
                        loading="lazy"
                        onError={handleImageError}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <ImageIcon size={48} className="mb-4 opacity-30" aria-hidden="true" />
                        <p className="font-bold text-xs uppercase tracking-widest">Image Preview</p>
                      </div>
                    )}
                    {(() => {
                      const stockVal = hasVariants
                        ? variants.reduce((sum, v) => sum + (formData.category === 'sarees' ? Number(v.stock || 0) : (v.enableSizes ? Object.values(v.sizes || {}).reduce((s, qty) => s + Number(qty), 0) : Number(v.stock || 0))), 0)
                        : (formData.stock !== '' ? Number(formData.stock) : null);

                      if (stockVal === null) return null;
                      if (stockVal <= 0) {
                        return (
                          <div className="absolute top-4 right-4 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">
                            Out of Stock
                          </div>
                        );
                      } else if (stockVal <= 5) {
                        return (
                          <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter animate-pulse">
                            Low Stock
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-black text-white line-clamp-1">{formData.name || 'Product Title'}</h3>
                      <span className="bg-yellow-500/10 text-yellow-600 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest">
                        {formData.category}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs line-clamp-2 mb-4 h-8">
                      {formData.description || 'Add a description to see how it looks here...'}
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <p className="text-2xl font-black text-orange-500">₹{formData.price || '0'}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Stock: <span className="text-white">
                          {hasVariants 
                            ? variants.reduce((sum, v) => sum + (formData.category === 'sarees' ? Number(v.stock || 0) : (v.enableSizes ? Object.values(v.sizes || {}).reduce((s, qty) => s + Number(qty), 0) : Number(v.stock || 0))), 0)
                            : (formData.stock || '0')
                          }
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="video" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Video URL (Optional)
                </label>
                <input
                  id="video" type="url" name="video" autoComplete="url"
                  value={formData.video} onChange={handleInputChange}
                  placeholder="https://example.com/video.mp4"
                  className="w-full bg-slate-950 border border-yellow-900/20 rounded-2xl focus:ring-4 focus:ring-yellow-500/10 focus:border-yellow-500 p-4 outline-none transition-all font-medium text-white"
                />
                <p className="mt-2 text-[10px] text-gray-400 font-medium italic">Supports MP4, YouTube, or direct video links.</p>
              </div>
            </div>
          </div>

          {/* Has Variants Toggle */}
          <div className="flex items-center justify-between p-4 sm:p-6 bg-slate-950/50 border border-yellow-900/10 rounded-2xl mb-8 gap-4">
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
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex-1">Enable sizes (for clothing)</span>
                                  <label htmlFor={`variant-enable-sizes-${colorIdx}`} className="toggle-wrap shrink-0" aria-label="Enable size variants">
                                    <input 
                                      id={`variant-enable-sizes-${colorIdx}`}
                                      name={`variantEnableSizes-${colorIdx}`}
                                      type="checkbox" 
                                      checked={v.enableSizes} 
                                      onChange={(e) => handleUpdateVariantColorField(colorIdx, 'enableSizes', e.target.checked)} 
                                      className="sr-only peer"
                                    />
                                    <div className="relative w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-600"></div>
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
                                      className="w-full bg-slate-950 border border-yellow-900/20 rounded-lg p-2 text-xs text-white outline-none focus:border-yellow-500"
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

          <div className="pt-8 border-t border-yellow-900/10">
            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-black py-4 rounded-2xl transition-all shadow-xl text-lg uppercase tracking-widest flex items-center justify-center ${loading
                ? 'bg-gray-600 cursor-not-allowed shadow-none'
                : 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-600/20 active:scale-[0.98]'
                }`}
            >
              {loading ? (
                <><Loader2 size={24} className="animate-spin mr-3" aria-hidden="true" /> Saving...</>
              ) : (
                <><UploadCloud size={24} className="mr-3" aria-hidden="true" /> Add Product</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProduct;