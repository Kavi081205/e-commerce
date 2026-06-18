import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, query, orderBy, serverTimestamp, getCountFromServer, where
} from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadImage } from '../../firebase/services';
import {
  Plus, Pencil, Trash2, GripVertical, X, Check, Loader2,
  UploadCloud, Eye, EyeOff, Layers, AlertTriangle, ImageIcon, Package
} from 'lucide-react';

/* ─── Slug helper ─────────────────────────────────────────────────────────── */
const toSlug = (name) =>
  name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');

/* ─── Delete Confirmation Modal ───────────────────────────────────────────── */
const DeleteModal = ({ category, onConfirm, onCancel, loading }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
    <div className="relative z-10 bg-slate-900 border border-red-500/20 rounded-2xl p-8 max-w-sm w-full shadow-2xl shadow-red-500/10">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-wider">Delete Category?</h3>
          <p className="text-gray-400 text-sm mt-2 font-medium">
            Are you sure you want to delete <span className="text-white font-black">"{category?.name}"</span>?
            This will not affect existing products.
          </p>
        </div>
        <div className="flex gap-3 w-full mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/30 font-black text-xs uppercase tracking-widest transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Live Preview Card ───────────────────────────────────────────────────── */
const CategoryPreviewCard = ({ name, image, active }) => (
  <div className="flex flex-col items-center gap-2 p-4">
    <div className={`relative w-20 h-20 rounded-full border-2 overflow-hidden bg-slate-950 flex items-center justify-center transition-all duration-300 ${
      active
        ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]'
        : 'border-gray-700 opacity-50'
    }`}>
      {image ? (
        <img src={image} alt={name || 'Category'} className="w-full h-full object-cover rounded-full" />
      ) : (
        <ImageIcon size={28} className="text-gray-600" />
      )}
      {!active && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
          <EyeOff size={18} className="text-gray-400" />
        </div>
      )}
    </div>
    <span className={`text-[10px] font-black uppercase tracking-wider ${active ? 'text-gray-300' : 'text-gray-600'}`}>
      {name || 'Category Name'}
    </span>
    <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
      active
        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
        : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  </div>
);

/* ─── Main Component ──────────────────────────────────────────────────────── */
const CategoryManage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productCounts, setProductCounts] = useState({});

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', slug: '', active: true });
  const [addFile, setAddFile] = useState(null);
  const [addPreview, setAddPreview] = useState('');
  const [addUploading, setAddUploading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  // Edit state
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', slug: '', active: true });
  const [editFile, setEditFile] = useState(null);
  const [editPreview, setEditPreview] = useState('');
  const [editUploading, setEditUploading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Drag state
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Refs for object URLs cleanup
  const addObjUrl = useRef(null);
  const editObjUrl = useRef(null);

  /* -- One-time categories fetch (static admin data, no real-time needed) -- */
  const fetchCategories = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'categories'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Category fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -- Product count per category (server-side count: 1 read per 1000 docs) -- */
  useEffect(() => {
    if (categories.length === 0) return;
    const fetchCounts = async () => {
      const counts = {};
      await Promise.all(
        categories.map(async (cat) => {
          try {
            const countSnap = await getCountFromServer(
              query(collection(db, 'products'), where('category', '==', cat.slug))
            );
            counts[cat.id] = countSnap.data().count;
          } catch {
            counts[cat.id] = 0;
          }
        })
      );
      setProductCounts(counts);
    };
    fetchCounts();
  }, [categories]);

  /* ── Object URL cleanup ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!addFile) { setAddPreview(''); return; }
    addObjUrl.current = URL.createObjectURL(addFile);
    setAddPreview(addObjUrl.current);
    return () => { if (addObjUrl.current) URL.revokeObjectURL(addObjUrl.current); };
  }, [addFile]);

  useEffect(() => {
    if (!editFile) { setEditPreview(''); return; }
    editObjUrl.current = URL.createObjectURL(editFile);
    setEditPreview(editObjUrl.current);
    return () => { if (editObjUrl.current) URL.revokeObjectURL(editObjUrl.current); };
  }, [editFile]);

  /* ── ADD ─────────────────────────────────────────────────────────────── */
  const handleAddNameChange = (e) => {
    const name = e.target.value;
    setAddForm(prev => ({ ...prev, name, slug: toSlug(name) }));
    setAddError('');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) { setAddError('Category name is required.'); return; }
    if (!addFile && !addPreview) { setAddError('Please upload a category image.'); return; }

    setAddUploading(true);
    setAddError('');
    try {
      let imageUrl = addPreview;
      if (addFile) {
        imageUrl = await uploadImage(addFile);
      }
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.order ?? 0), 0);
      await addDoc(collection(db, 'categories'), {
        name: addForm.name.trim(),
        slug: toSlug(addForm.name),
        image: imageUrl,
        active: addForm.active,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      });
      setAddSuccess('Category added!');
      setAddForm({ name: '', slug: '', active: true });
      setAddFile(null);
      setAddPreview('');
      setShowAddForm(false);
      setTimeout(() => setAddSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setAddError('Failed to add category: ' + err.message);
    } finally {
      setAddUploading(false);
    }
  };

  /* ── EDIT ────────────────────────────────────────────────────────────── */
  const startEdit = (cat) => {
    setEditId(cat.id);
    setEditForm({ name: cat.name, slug: cat.slug, active: cat.active ?? true });
    setEditPreview(cat.image || '');
    setEditFile(null);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditFile(null);
    setEditPreview('');
    setEditError('');
  };

  const handleEditNameChange = (e) => {
    const name = e.target.value;
    setEditForm(prev => ({ ...prev, name, slug: toSlug(name) }));
  };

  const handleEditSave = async (cat) => {
    if (!editForm.name.trim()) { setEditError('Name is required.'); return; }
    setEditSaving(true);
    setEditError('');
    try {
      let imageUrl = cat.image;
      if (editFile) {
        imageUrl = await uploadImage(editFile);
      } else if (editPreview && editPreview !== cat.image) {
        imageUrl = editPreview;
      }
      await updateDoc(doc(db, 'categories', cat.id), {
        name: editForm.name.trim(),
        slug: toSlug(editForm.name),
        image: imageUrl,
        active: editForm.active,
      });
      cancelEdit();
    } catch (err) {
      console.error(err);
      setEditError('Failed to save: ' + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  /* ── TOGGLE ACTIVE ───────────────────────────────────────────────────── */
  const toggleActive = async (cat) => {
    try {
      await updateDoc(doc(db, 'categories', cat.id), { active: !cat.active });
    } catch (err) {
      console.error('Toggle active failed:', err);
    }
  };

  /* ── DELETE ──────────────────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'categories', deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ── DRAG & DROP REORDER ─────────────────────────────────────────────── */
  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== draggedId) setDragOverId(id);
  };

  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const reordered = [...categories];
    const fromIdx = reordered.findIndex(c => c.id === draggedId);
    const toIdx = reordered.findIndex(c => c.id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Optimistic update
    setCategories(reordered);
    setDraggedId(null);
    setDragOverId(null);

    // Persist new order to Firestore
    try {
      await Promise.all(
        reordered.map((cat, idx) =>
          updateDoc(doc(db, 'categories', cat.id), { order: idx + 1 })
        )
      );
    } catch (err) {
      console.error('Reorder failed:', err);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  /* ─── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <Layers size={16} className="text-yellow-500" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Category Manager</h1>
          </div>
          <p className="text-gray-500 text-sm font-medium ml-11">
            {categories.length} categories · Drag rows to reorder · Changes reflect on homepage instantly
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAddForm(v => !v); setAddError(''); }}
          className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-yellow-500/20 active:scale-95"
        >
          {showAddForm ? <X size={15} /> : <Plus size={15} />}
          {showAddForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {/* Success toast */}
      {addSuccess && (
        <div className="mb-4 flex items-center gap-3 bg-green-500/10 border border-green-500/20 text-green-400 px-5 py-3 rounded-xl text-sm font-bold">
          <Check size={16} /> {addSuccess}
        </div>
      )}

      {/* ── ADD FORM ───────────────────────────────────────────────────────── */}
      {showAddForm && (
        <div className="mb-6 bg-gray-900 border border-yellow-500/20 rounded-2xl p-6 shadow-xl shadow-yellow-500/5">
          <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Plus size={14} className="text-yellow-500" /> New Category
          </h2>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: fields */}
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={handleAddNameChange}
                  placeholder="e.g. Sarees"
                  autoComplete="off"
                  className="w-full bg-slate-950 border border-yellow-900/20 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/10 rounded-xl p-4 text-white font-medium outline-none transition-all"
                />
              </div>
              {/* Slug (auto) */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  Slug (auto-generated)
                </label>
                <input
                  type="text"
                  value={addForm.slug}
                  onChange={e => setAddForm(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="e.g. sarees"
                  className="w-full bg-slate-950/50 border border-yellow-900/10 rounded-xl p-4 text-yellow-500/70 font-mono text-sm outline-none"
                />
                <p className="text-[10px] text-gray-600 mt-1.5 font-medium">
                  Must match the <code className="text-yellow-600/60">category</code> field in product documents
                </p>
              </div>
              {/* Active toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-950/50 border border-yellow-900/10 rounded-xl">
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-wider">Visible on Homepage</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Show this category to customers</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddForm(prev => ({ ...prev, active: !prev.active }))}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${addForm.active ? 'bg-yellow-500' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${addForm.active ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  Category Image *
                </label>
                <label
                  htmlFor="cat-add-file"
                  className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    addFile ? 'border-yellow-500 bg-yellow-500/10' : 'border-yellow-900/20 bg-slate-950 hover:bg-gray-800 hover:border-yellow-500/40'
                  }`}
                >
                  <input
                    id="cat-add-file"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={e => { if (e.target.files[0]) setAddFile(e.target.files[0]); }}
                  />
                  <UploadCloud size={22} className={addFile ? 'text-yellow-500' : 'text-gray-500'} />
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${addFile ? 'text-yellow-500' : 'text-gray-500'}`}>
                    {addFile ? addFile.name : 'Click to upload image'}
                  </p>
                  <p className="text-[9px] text-gray-600 mt-0.5">PNG, JPG, WEBP</p>
                </label>
                {addFile && (
                  <button type="button" onClick={() => setAddFile(null)}
                    className="mt-1.5 text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest transition-colors">
                    ✕ Remove
                  </button>
                )}
              </div>

              {addError && (
                <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider">{addError}</p>
              )}

              <button
                type="submit"
                disabled={addUploading}
                className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-60 shadow-lg shadow-yellow-500/20"
              >
                {addUploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Check size={14} /> Add Category</>}
              </button>
            </div>

            {/* Right: preview */}
            <div className="flex flex-col items-center justify-center bg-slate-950/50 border border-yellow-900/10 rounded-xl p-6">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4">Live Preview</p>
              <CategoryPreviewCard name={addForm.name} image={addPreview} active={addForm.active} />
              <p className="text-[8px] text-gray-600 mt-2 text-center">
                This is how the category will appear on the homepage
              </p>
            </div>
          </form>
        </div>
      )}

      {/* ── CATEGORIES TABLE ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={`cat-skeleton-${i}`} className="h-20 bg-gray-900/60 rounded-xl animate-pulse border border-white/5" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-gray-900/40 rounded-2xl border border-yellow-900/10 text-center">
          <Layers size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-500 font-black uppercase tracking-widest text-xs">No Categories Yet</p>
          <p className="text-gray-700 text-[10px] mt-2 font-medium">Click "Add Category" to create your first one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[40px_72px_1fr_120px_100px_100px_120px] gap-4 px-4 pb-2 border-b border-yellow-900/10">
            {['', '', 'Category', 'Slug', 'Products', 'Status', 'Actions'].map((h, i) => (
              <p key={h || `header-${i}`} className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{h}</p>
            ))}
          </div>

          {categories.map((cat) => {
            const isEditing = editId === cat.id;
            const isDragging = draggedId === cat.id;
            const isDragOver = dragOverId === cat.id;

            return (
              <div
                key={cat.id}
                draggable={!isEditing}
                onDragStart={e => handleDragStart(e, cat.id)}
                onDragOver={e => handleDragOver(e, cat.id)}
                onDrop={e => handleDrop(e, cat.id)}
                onDragEnd={handleDragEnd}
                className={`bg-gray-900 border rounded-xl transition-all duration-200 ${
                  isDragging ? 'opacity-40 scale-[0.98] border-yellow-500/40' :
                  isDragOver ? 'border-yellow-500/60 bg-yellow-500/5 scale-[1.01] shadow-lg shadow-yellow-500/10' :
                  'border-yellow-900/10 hover:border-yellow-900/30'
                }`}
              >
                {isEditing ? (
                  /* ── EDIT ROW ──────────────────────────────────────────── */
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Name</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={handleEditNameChange}
                          className="w-full bg-slate-950 border border-yellow-900/20 focus:border-yellow-500 rounded-lg p-3 text-white text-sm font-medium outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Slug</label>
                        <input
                          type="text"
                          value={editForm.slug}
                          onChange={e => setEditForm(prev => ({ ...prev, slug: e.target.value }))}
                          className="w-full bg-slate-950/50 border border-yellow-900/10 rounded-lg p-3 text-yellow-500/70 font-mono text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Image upload in edit */}
                      <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Category Image</label>
                        <label
                          htmlFor={`cat-edit-file-${cat.id}`}
                          className="flex items-center gap-3 px-4 py-3 border border-dashed border-yellow-900/20 hover:border-yellow-500/40 rounded-lg cursor-pointer bg-slate-950 hover:bg-gray-800 transition-all"
                        >
                          <input
                            id={`cat-edit-file-${cat.id}`}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={e => { if (e.target.files[0]) { setEditFile(e.target.files[0]); } }}
                          />
                          <UploadCloud size={16} className="text-gray-500 flex-shrink-0" />
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate">
                            {editFile ? editFile.name : 'Replace image'}
                          </span>
                        </label>
                        {editFile && (
                          <button type="button" onClick={() => setEditFile(null)}
                            className="mt-1 text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest">
                            ✕ Remove new file
                          </button>
                        )}
                      </div>
                      {/* Preview in edit */}
                      <div className="flex items-center gap-4 bg-slate-950/50 border border-yellow-900/10 rounded-lg p-3">
                        <div className="w-12 h-12 rounded-full border-2 border-yellow-500/30 overflow-hidden flex-shrink-0">
                          {(editPreview || editFile) ? (
                            <img
                              src={editPreview}
                              alt="preview"
                              className="w-full h-full object-cover"
                              onError={e => e.currentTarget.style.display = 'none'}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <ImageIcon size={16} className="text-gray-600" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-white">{editForm.name || 'Category'}</p>
                          <p className="text-[9px] text-gray-500 font-mono">{editForm.slug}</p>
                        </div>
                      </div>
                    </div>

                    {/* Active toggle in edit */}
                    <div className="flex items-center justify-between p-3 bg-slate-950/50 border border-yellow-900/10 rounded-lg">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Visible on Homepage</span>
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, active: !prev.active }))}
                        className={`relative w-11 h-5.5 rounded-full transition-all duration-300 ${editForm.active ? 'bg-yellow-500' : 'bg-gray-700'}`}
                        style={{ height: '22px' }}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${editForm.active ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {editError && <p className="text-red-400 text-[10px] font-bold">{editError}</p>}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleEditSave(cat)}
                        disabled={editSaving}
                        className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-60"
                      >
                        {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="flex items-center gap-2 border border-white/10 text-gray-400 hover:text-white px-5 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all"
                      >
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── DISPLAY ROW ───────────────────────────────────────── */
                  <div className="grid grid-cols-[32px_60px_1fr_auto] sm:grid-cols-[40px_72px_1fr_120px_100px_100px_120px] gap-3 sm:gap-4 items-center px-4 py-3">
                    {/* Drag handle */}
                    <div className="flex items-center cursor-grab active:cursor-grabbing">
                      <GripVertical size={16} className="text-gray-600 hover:text-gray-400 transition-colors" />
                    </div>

                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-full border-2 border-yellow-900/20 overflow-hidden flex-shrink-0 bg-slate-950">
                      {cat.image ? (
                        <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={16} className="text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Name + slug */}
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{cat.name}</p>
                      <p className="text-[10px] font-mono text-yellow-500/50 truncate">{cat.slug}</p>
                    </div>

                    {/* Slug — desktop only */}
                    <div className="hidden sm:block">
                      <span className="text-[10px] font-mono text-gray-500 bg-slate-950 px-2 py-1 rounded border border-white/5">{cat.slug}</span>
                    </div>

                    {/* Product count — desktop only */}
                    <div className="hidden sm:flex items-center gap-1.5">
                      <Package size={12} className="text-yellow-500/60" />
                      <span className="text-xs font-black text-gray-400">
                        {productCounts[cat.id] ?? '…'}
                      </span>
                    </div>

                    {/* Status toggle — desktop only */}
                    <div className="hidden sm:flex items-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(cat)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                          cat.active
                            ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                            : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                        }`}
                        title={cat.active ? 'Click to hide' : 'Click to show'}
                      >
                        {cat.active ? <Eye size={10} /> : <EyeOff size={10} />}
                        {cat.active ? 'Active' : 'Hidden'}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Mobile: active toggle */}
                      <button
                        type="button"
                        onClick={() => toggleActive(cat)}
                        className={`sm:hidden p-2 rounded-lg transition-all ${cat.active ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}
                        title={cat.active ? 'Hide' : 'Show'}
                      >
                        {cat.active ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="p-2 rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 border border-transparent hover:border-yellow-500/20 transition-all"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(cat)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Drag hint */}
      {categories.length > 1 && (
        <p className="text-center text-[9px] text-gray-700 font-black uppercase tracking-widest mt-4 flex items-center justify-center gap-2">
          <GripVertical size={10} /> Drag rows to reorder · Order updates homepage automatically
        </p>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          category={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
};

export default CategoryManage;
