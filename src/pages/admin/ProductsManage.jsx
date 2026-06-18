import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Plus, Edit, Trash2, Search, Image as ImageIcon, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteProduct } from '../../firebase/services';
import { getOptimizedImage } from '../../utils/cloudinary';

// ✅ Single source of truth for low-stock threshold
const LOW_STOCK_THRESHOLD = 10;

const ProductsManage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState(null); // ✅ Renamed: no collision with handler
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');     // ✅ In-modal error instead of alert()

  // Fetch products once; refresh on navigate(0) or when component mounts
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optimistic delete: remove from local state immediately, then Firestore
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    setDeleteError('');
    // Optimistic update
    setProducts(prev => prev.filter(p => p.id !== deleteTargetId));
    try {
      await deleteProduct(deleteTargetId);
      setDeleteTargetId(null);
    } catch (error) {
      // Rollback on failure
      fetchProducts();
      setDeleteError(error.message || 'Failed to delete product. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteTargetId(null);
    setDeleteError('');
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Products Catalog</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Manage your inventory and stock levels</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(0)}
            className="p-3.5 bg-gray-900 border border-yellow-900/10 text-gray-400 hover:text-white rounded-2xl transition-all"
            title="Force UI Refresh"
          >
            <Clock size={18} />
          </button>
          <Link
            to="/admin/add-product"
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-yellow-600/20 active:scale-95 flex items-center gap-2 uppercase tracking-widest text-xs"
          >
            <Plus size={18} />
            Add Product
          </Link>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-gray-900 rounded-2xl shadow-sm border border-yellow-900/10 overflow-hidden">
        <div className="p-5 border-b border-yellow-900/10 bg-slate-950/50 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <label htmlFor="product-search" className="sr-only">Search Products</label>
            <input
              type="text"
              id="product-search"
              name="productSearch"
              autoComplete="off"
              placeholder="Search by name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-900 border border-yellow-900/20 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 outline-none transition-all text-sm font-medium"
            />
            <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest px-2">
            Total: {filteredProducts.length} Products
          </div>
        </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-gray-500 text-xs uppercase tracking-widest border-b border-yellow-900/10">
                  <th className="px-6 py-4 font-bold">Image</th>
                  <th className="px-6 py-4 font-bold">Details</th>
                  <th className="px-6 py-4 font-bold">Category</th>
                  <th className="px-6 py-4 font-bold">Price</th>
                  <th className="px-6 py-4 font-bold">Cost</th>
                  <th className="px-6 py-4 font-bold">Margin</th>
                  <th className="px-6 py-4 font-bold">Stock</th>
                  <th className="px-6 py-4 font-bold">Sold</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-20 text-center text-gray-400">
                      <Loader2 size={32} className="animate-spin mx-auto mb-2 text-yellow-500" />
                      <p className="font-medium">Loading catalog...</p>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-20 text-center text-gray-400 font-medium">
                      No products found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const stockNum = Number(product.stock ?? 0);
                    let stockStatus = 'Available';
                    let stockColor = 'text-green-600';
                    if (stockNum <= 0) {
                      stockStatus = 'Out of Stock';
                      stockColor = 'text-red-600';
                    } else if (stockNum <= 5) {
                      stockStatus = 'Low Stock';
                      stockColor = 'text-yellow-500';
                    }

                    return (
                      <tr key={product.id} className="hover:bg-slate-950/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="w-[60px] h-[60px] rounded-xl bg-gray-800 border border-yellow-900/20 overflow-hidden shadow-sm group-hover:shadow-md transition-shadow">
                            {product.image ? (
                              <img
                                src={getOptimizedImage(product.image, 'thumbnail')}
                                alt={product.name}
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <ImageIcon size={24} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-[200px]">
                            <div className="font-bold text-white text-base truncate" title={product.name}>
                              {product.name}
                            </div>
                            <div className="text-gray-400 text-xs mt-0.5 truncate" title={product.description || 'No description'}>
                              {product.description || 'No description'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-yellow-500/10 text-yellow-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-yellow-900/40">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="selling-price font-bold text-green-600 text-lg tracking-tight">
                            ₹{product.price}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="cost-price font-medium text-gray-500 text-sm tracking-tight">
                            ₹{product.costPrice}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`profit font-black text-xs uppercase tracking-widest ${(product.price - product.costPrice) > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                            ₹{product.price - product.costPrice}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`text-sm font-black uppercase tracking-tight ${stockColor}`}>
                              {product.stock} Units
                            </span>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              {stockStatus}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-black text-yellow-500">{product.soldCount || 0}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              to={`/admin/edit-product/${product.id}`}
                              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Product"
                            >
                              <Edit size={18} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setDeleteTargetId(product.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="block lg:hidden divide-y divide-yellow-900/10">
            {loading ? (
              <div className="px-6 py-20 text-center text-gray-400">
                <Loader2 size={32} className="animate-spin mx-auto mb-2 text-yellow-500" />
                <p className="font-medium">Loading catalog...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="px-6 py-20 text-center text-gray-400 font-medium">
                No products found matching your search.
              </div>
            ) : (
              filteredProducts.map((product) => {
                const stockNum = Number(product.stock ?? 0);
                let stockStatus = 'Available';
                let stockColor = 'text-green-600';
                if (stockNum <= 0) {
                  stockStatus = 'Out of Stock';
                  stockColor = 'text-red-600';
                } else if (stockNum <= 5) {
                  stockStatus = 'Low Stock';
                  stockColor = 'text-yellow-500';
                }

                return (
                  <div key={product.id} className="p-6 flex flex-col gap-4 hover:bg-slate-950/40 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-[60px] h-[60px] rounded-xl bg-gray-800 border border-yellow-900/20 overflow-hidden shadow-sm shrink-0">
                        {product.image ? (
                          <img
                            src={getOptimizedImage(product.image, 'thumbnail')}
                            alt={product.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <ImageIcon size={24} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-base truncate" title={product.name}>
                          {product.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-yellow-500/10 text-yellow-600 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-yellow-900/40">
                            {product.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/5">
                      <div>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Price</p>
                        <p className="font-bold text-green-600 text-base">₹{product.price}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Cost</p>
                        <p className="font-medium text-gray-400 text-sm">₹{product.costPrice}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Margin</p>
                        <p className={`font-black text-xs uppercase tracking-widest ${(product.price - product.costPrice) > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                          ₹{product.price - product.costPrice}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Stock</p>
                          <span className={`text-xs font-black uppercase tracking-tight ${stockColor}`}>
                            {product.stock} Units ({stockStatus})
                          </span>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Sold</p>
                          <span className="text-xs font-black text-yellow-500">{product.soldCount || 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/edit-product/${product.id}`}
                          className="p-3 text-blue-500 hover:bg-blue-50/10 rounded-xl transition-colors border border-blue-500/20"
                          title="Edit Product"
                        >
                          <Edit size={16} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(product.id)}
                          className="p-3 text-red-500 hover:bg-red-50/10 rounded-xl transition-colors border border-red-500/20"
                          title="Delete Product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-900 rounded-[2rem] w-full max-w-md p-8 shadow-2xl border border-yellow-900/10 animate-pop">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-black text-white text-center mb-2">Delete Product?</h3>
            <p className="text-gray-500 text-center text-sm font-medium mb-6">
              This action cannot be undone.
            </p>

            {/* ✅ Inline error — replaces blocking alert() */}
            {deleteError && (
              <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">
                {deleteError}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="flex-1 py-4 bg-gray-800 text-gray-400 font-bold rounded-2xl hover:bg-gray-700 transition-colors uppercase tracking-widest text-xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-4 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsManage;