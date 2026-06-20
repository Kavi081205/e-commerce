import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Video, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitComplaint } from '../firebase/services';

const COMPLAINT_TYPES = [
  'Wrong Product Delivered',
  'Damaged / Defective Product',
  'Missing Item in Package',
  'Product Not as Described',
  'Late Delivery',
  'Package Not Received',
  'Quality Issue',
  'Refund / Return Request',
  'Other',
];

const MAX_IMAGES = 5;
const MAX_VIDEO_MB = 50;

export default function ComplaintForm({ order, customerPhone, onClose }) {
  const [form, setForm] = useState({
    complaintType: '',
    description: '',
    customerName: order?.customerName || order?.name || '',
    customerPhone: customerPhone || order?.phone || '',
  });
  const [images, setImages] = useState([]);       // File[]
  const [imagePreviews, setImagePreviews] = useState([]); // string[]
  const [video, setVideo] = useState(null);       // File
  const [videoPreview, setVideoPreview] = useState(''); // string
  const [step, setStep] = useState('form');        // 'form' | 'submitting' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const imageRef = useRef();
  const videoRef = useRef();

  const items = order?.items || order?.orderedItems || [];
  const productNames = items.map(i => i.name || i.productName || 'Product').join(', ');

  const handleField = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > MAX_IMAGES) {
      alert(`You can upload at most ${MAX_IMAGES} images.`);
      return;
    }
    const newFiles = files.slice(0, MAX_IMAGES - images.length);
    setImages(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setImagePreviews(p => [...p, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleVideo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
      alert(`Video must be under ${MAX_VIDEO_MB}MB.`);
      return;
    }
    setVideo(f);
    const reader = new FileReader();
    reader.onload = ev => setVideoPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.complaintType) { alert('Please select a complaint type.'); return; }
    if (!form.description.trim()) { alert('Please describe your issue.'); return; }
    if (!form.customerPhone) { alert('Phone number is required.'); return; }

    setStep('submitting');
    try {
      // Convert images to base64 for Firestore storage
      // In production you'd upload to Cloudinary/Storage, but base64 works for small files
      const imageData = await Promise.all(images.map(toBase64));
      const videoData = video ? await toBase64(video) : null;

      const payload = {
        orderId: order.id,
        orderShortId: order.id.slice(-8).toUpperCase(),
        customerName: form.customerName || 'Customer',
        customerPhone: form.customerPhone,
        complaintType: form.complaintType,
        description: form.description.trim(),
        productNames,
        images: imageData,        // base64 strings
        video: videoData,          // base64 string or null
        videoFileName: video?.name || null,
      };

      await submitComplaint(payload);
      setStep('success');
    } catch (err) {
      console.error('Complaint submission failed:', err);
      setErrorMsg(err.message || 'Submission failed. Please try again.');
      setStep('error');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-8"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-gray-950 border border-gray-800 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-5 flex items-center justify-between z-10 rounded-t-3xl">
            <div>
              <h2 className="text-lg font-black text-white">Raise a Complaint</h2>
              <p className="text-xs text-gray-500 mt-0.5">Order #{order.id.slice(-8).toUpperCase()}</p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
              <X size={20} />
            </button>
          </div>

          <div className="p-6">
            {/* SUCCESS */}
            {step === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12 space-y-4"
              >
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={40} className="text-green-400" />
                </div>
                <h3 className="text-xl font-black text-white">Complaint Submitted!</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Your complaint has been received. Our team will review it and respond within 24–48 hours.
                </p>
                <div className="bg-gray-900 rounded-2xl p-4 text-left text-xs space-y-2 mt-4">
                  <p className="text-gray-400">You can track your complaint status at:</p>
                  <a href="/my-complaints" className="text-yellow-400 font-bold underline">My Complaints →</a>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 bg-yellow-500 text-black px-8 py-3 rounded-xl font-black uppercase tracking-wider text-sm hover:bg-yellow-400 transition-all"
                >
                  Done
                </button>
              </motion.div>
            )}

            {/* ERROR */}
            {step === 'error' && (
              <div className="text-center py-12 space-y-4">
                <AlertTriangle size={48} className="text-red-400 mx-auto" />
                <h3 className="text-lg font-black text-white">Submission Failed</h3>
                <p className="text-red-400 text-sm">{errorMsg}</p>
                <button type="button" onClick={() => setStep('form')} className="bg-gray-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm">
                  Try Again
                </button>
              </div>
            )}

            {/* FORM */}
            {(step === 'form' || step === 'submitting') && (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Order Info Banner */}
                <div className="bg-gray-900 rounded-2xl p-4 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order ID</span>
                    <span className="text-white font-mono font-bold">#{order.id.slice(-8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Product(s)</span>
                    <span className="text-white font-medium text-right max-w-[60%] truncate">{productNames || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total</span>
                    <span className="text-yellow-400 font-black">₹{(order.totalPrice || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Complaint Type */}
                <div>
                  <label htmlFor="complaintType" className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                    Complaint Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="complaintType"
                    name="complaintType"
                    value={form.complaintType}
                    onChange={handleField}
                    required
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                  >
                    <option value="">Select complaint type...</option>
                    {COMPLAINT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Customer Name */}
                <div>
                  <label htmlFor="customerName" className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                    Your Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="customerName"
                    type="text"
                    name="customerName"
                    autoComplete="name"
                    value={form.customerName}
                    onChange={handleField}
                    required
                    placeholder="Enter your name"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={handleField}
                    required
                    rows={4}
                    placeholder="Describe your issue in detail..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors resize-none"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <p className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                    Images (up to {MAX_IMAGES})
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-700">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 text-white"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    {images.length < MAX_IMAGES && (
                      <button
                        type="button"
                        onClick={() => imageRef.current?.click()}
                        className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-yellow-500 hover:text-yellow-500 transition-colors"
                      >
                        <ImageIcon size={18} />
                        <span className="text-[9px] font-bold">Add</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={imageRef}
                    id="complaint-images"
                    name="complaint-images"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImages}
                  />
                </div>

                {/* Video Upload */}
                <div>
                  <p className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                    Video (optional, max {MAX_VIDEO_MB}MB)
                  </p>
                  {videoPreview ? (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-700">
                      <video src={videoPreview} controls className="w-full max-h-40 bg-black" />
                      <button
                        type="button"
                        onClick={() => { setVideo(null); setVideoPreview(''); }}
                        className="absolute top-2 right-2 bg-black/70 rounded-full p-1.5 text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => videoRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-700 rounded-2xl py-5 flex flex-col items-center gap-2 text-gray-500 hover:border-yellow-500 hover:text-yellow-500 transition-colors"
                    >
                      <Video size={24} />
                      <span className="text-xs font-bold">Upload Video</span>
                    </button>
                  )}
                  <input
                    ref={videoRef}
                    id="complaint-video"
                    name="complaint-video"
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideo}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={step === 'submitting'}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black py-4 rounded-2xl font-black uppercase tracking-wider text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {step === 'submitting' ? (
                    <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                  ) : (
                    'Submit Complaint'
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
