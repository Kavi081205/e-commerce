import React, { useState, useEffect } from 'react';
import { getStoreSettings, updateStoreSettings } from '../../firebase/services';
import { useNotification } from '../../context/NotificationContext';
import { Save, Loader2, Store, Phone, Mail, MapPin, User, ShieldAlert, FileText } from 'lucide-react';

const Settings = () => {
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    phone: '',
    email: '',
    address: '',
    state: '',
    country: '',
    gstin: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getStoreSettings();
        if (data) {
          setFormData({
            name: data.name || '',
            ownerName: data.ownerName || '',
            phone: data.phone || '',
            email: data.email || '',
            address: data.address || '',
            state: data.state || '',
            country: data.country || '',
            gstin: data.gstin || ''
          });
        } else {
          // Set initial placeholders if empty
          setFormData({
            name: 'SMKP TRADERS',
            ownerName: 'Kaviyarasan Murugan',
            phone: '9677417185',
            email: 'kaviyarasanmurugan78@gmail.com',
            address: 'Pommalappatti',
            state: 'Tamil Nadu',
            country: 'India',
            gstin: '33IMVPM1670M1Z9'
          });
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        showToast("Failed to load settings from database", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const playSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      // play a nice double chime (E5 then A5)
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn("Could not play success sound:", e.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validation (Prevent empty required fields)
    if (!formData.name?.trim()) {
      showToast("Store / Business Name is required", "error");
      return;
    }
    if (!formData.phone?.trim()) {
      showToast("Support Phone is required", "error");
      return;
    }
    if (!formData.email?.trim()) {
      showToast("Support Email is required", "error");
      return;
    }
    if (!formData.address?.trim()) {
      showToast("Street / Local Area Address is required", "error");
      return;
    }

    // 2. Network Check
    if (!navigator.onLine) {
      showToast("No internet connection", "error");
      return;
    }

    // 3. Prevent double-submit
    if (saving) return;

    setSaving(true);

    let attempts = 0;
    const maxAttempts = 2; // Auto retry once
    let saved = false;

    while (attempts < maxAttempts && !saved) {
      try {
        attempts++;
        await updateStoreSettings(formData);
        saved = true;
        showToast("Store settings saved successfully", "success");
        playSuccessSound();
      } catch (error) {
        if (attempts >= maxAttempts) {
          console.error("Failed to save settings after multiple attempts:", error);
          showToast("Failed to save store settings", "error");
        } else {
          console.warn(`Save attempt ${attempts} failed, retrying once...`, error.message);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    setSaving(false);
  };


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <Loader2 size={40} className="animate-spin text-yellow-500 mb-4" />
        <p className="font-black uppercase tracking-widest text-sm">Loading Store Configuration...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <Store className="text-yellow-500" size={32} /> Store Configuration
        </h1>
        <p className="text-gray-500 text-sm font-medium">Manage corporate identity, billing information, and shipping address headers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form (2 Cols Span) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="bg-gray-900/50 backdrop-blur-xl p-4 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] border border-yellow-900/10 space-y-8">
            <h2 className="text-lg font-black text-white uppercase tracking-widest border-b border-yellow-900/10 pb-4">
              Sender Details (Invoice FROM)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Business Name */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Store size={12} className="text-yellow-500" /> Store / Business Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. SMKP TRADERS"
                  required
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              {/* Owner Name */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <User size={12} className="text-yellow-500" /> Owner Name
                </label>
                <input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleChange}
                  placeholder="e.g. Kaviyarasan Murugan"
                  required
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Phone size={12} className="text-yellow-500" /> Support Phone
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. 9677417185"
                  required
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Mail size={12} className="text-yellow-500" /> Support Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. email@example.com"
                  required
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              {/* Address */}
              <div className="sm:col-span-2 flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin size={12} className="text-yellow-500" /> Street / Local Area Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="e.g. Pommalappatti"
                  required
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              {/* State */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  State / Territory
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="e.g. Tamil Nadu"
                  required
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              {/* Country */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  Country
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="e.g. India"
                  required
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              {/* GSTIN */}
              <div className="sm:col-span-2 flex flex-col gap-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText size={12} className="text-yellow-500" /> GSTIN Number (Tax Registry)
                </label>
                <input
                  type="text"
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleChange}
                  placeholder="e.g. 33IMVPM1670M1Z9"
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors uppercase font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-yellow-900/10">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save Store Settings
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Label Preview (1 Col Span) */}
        <div className="space-y-6">
          <div className="bg-gray-900/50 backdrop-blur-xl p-4 sm:p-8 rounded-3xl border border-yellow-900/10 space-y-6 sticky top-6">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              Live FROM Preview
            </h3>
            <p className="text-[10px] text-gray-500 font-medium">This is how your sender billing card appears on invoice PDFs and label prints.</p>

            {/* Courier label FROM preview box */}
            <div className="bg-white border-2 border-yellow-500 rounded-2xl p-6 text-black flex flex-col shadow-2xl relative overflow-hidden">
              {/* Box Tag */}
              <div className="absolute top-0 left-0 bg-yellow-500 text-white text-[7px] font-black tracking-widest px-3 py-1 uppercase rounded-br-lg">
                FROM (SENDER)
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <span className="text-sm font-black uppercase text-slate-950 tracking-tight leading-none">
                  {formData.name || 'SMKP TRADERS'}
                </span>
                <span className="text-[10px] font-semibold text-gray-500 leading-none">
                  Owner: {formData.ownerName || 'Kaviyarasan Murugan'}
                </span>

                <hr className="border-gray-150 my-1" />

                <div className="text-[9px] text-gray-600 leading-relaxed font-medium space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Phone size={8} className="text-yellow-600 shrink-0" />
                    <span>Phone: {formData.phone || '9677417185'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail size={8} className="text-yellow-600 shrink-0" />
                    <span className="truncate">Email: {formData.email || 'kaviyarasanmurugan78@gmail.com'}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin size={8} className="text-yellow-600 mt-0.5 shrink-0" />
                    <span>
                      {formData.address || 'Pommalappatti'}
                      {formData.state ? `, ${formData.state}` : ''}
                      {formData.country ? `, ${formData.country}` : ''}
                    </span>
                  </div>
                </div>

                {formData.gstin && (
                  <div className="mt-2 bg-yellow-50 border border-yellow-100 p-2 rounded-lg text-[9px] font-black uppercase tracking-wider text-yellow-800 font-mono text-center">
                    GSTIN: {formData.gstin}
                  </div>
                )}
              </div>
            </div>

            {/* Warning Message Card */}
            <div className="bg-yellow-950/20 border border-yellow-900/30 rounded-2xl p-4 flex gap-3 text-yellow-600 text-xs">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block uppercase tracking-wider text-[10px] mb-1">Important</span>
                Address updates will instantly apply to all future invoice generations and PDF downloads.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
