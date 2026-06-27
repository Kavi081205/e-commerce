import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNotification } from '../../context/NotificationContext';
import { useSiteSettings, defaultSettings } from '../../context/SiteSettingsContext';
import { 
  Save, Loader2, ShieldAlert, Globe, Palette, Megaphone, 
  Image as ImageIcon, Truck, Layout as LayoutIcon, Laptop, 
  Phone, Mail, MapPin, RefreshCw, FileText
} from 'lucide-react';

const Settings = () => {
  const { showToast } = useNotification();
  const { refreshSettings } = useSiteSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('brand');
  const [formData, setFormData] = useState(defaultSettings);

  useEffect(() => {
    const fetchAllSettings = async () => {
      try {
        const docRef = doc(db, 'site_settings', 'main');
        const docSnap = await getDoc(docRef);
        
        // Also fetch settings/store for backward compatibility of business details if site_settings is empty
        const storeRef = doc(db, 'settings', 'store');
        const storeSnap = await getDoc(storeRef);
        const storeData = storeSnap.exists() ? storeSnap.data() : {};

        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            ...defaultSettings,
            ...data,
            colors: { ...defaultSettings.colors, ...(data.colors || {}) },
            announcement: { ...defaultSettings.announcement, ...(data.announcement || {}) },
            banners: { ...defaultSettings.banners, ...(data.banners || {}) },
            delivery: { ...defaultSettings.delivery, ...(data.delivery || {}) },
            homepage: { ...defaultSettings.homepage, ...(data.homepage || {}) },
            productCard: { ...defaultSettings.productCard, ...(data.productCard || {}) },
            contact: { ...defaultSettings.contact, ...(data.contact || {}) },
            footer: { ...defaultSettings.footer, ...(data.footer || {}) },
            seo: { ...defaultSettings.seo, ...(data.seo || {}) }
          });
        } else if (storeSnap.exists()) {
          // Merge old store details into defaultSettings
          setFormData({
            ...defaultSettings,
            storeName: storeData.name || defaultSettings.storeName,
            contact: {
              ...defaultSettings.contact,
              phone: storeData.phone || defaultSettings.contact.phone,
              email: storeData.email || defaultSettings.contact.email,
              address: storeData.address || defaultSettings.contact.address
            }
          });
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        showToast("Failed to load settings from database", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchAllSettings();
  }, []);

  const handleChange = (e, section = null) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;

    if (section) {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [name]: val
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: val
      }));
    }
  };

  const handleNestedNumberChange = (e, section, field) => {
    const val = Number(e.target.value);
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: val
      }
    }));
  };

  const handleFileUpload = (e, section, field) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      showToast("File is too large. Please upload an image under 1MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      if (section) {
        setFormData(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            [field]: base64String
          }
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [field]: base64String
        }));
      }
      showToast("Image loaded successfully. Press Save to store it.", "success");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // 1. Save to site_settings/main
      const mainRef = doc(db, 'site_settings', 'main');
      await setDoc(mainRef, {
        ...formData,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Dual-write to settings/store for backward compatibility with invoice print logic
      const storeRef = doc(db, 'settings', 'store');
      await setDoc(storeRef, {
        name: formData.storeName,
        ownerName: formData.contact.ownerName || 'Kaviyarasan Murugan',
        phone: formData.contact.phone,
        email: formData.contact.email,
        address: formData.contact.address,
        state: formData.contact.state || 'Tamil Nadu',
        country: formData.contact.country || 'India',
        gstin: formData.contact.gstin || '33IMVPM1670M1Z9',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 3. Update global context cache
      await refreshSettings();

      showToast("Website settings saved successfully!", "success");
    } catch (error) {
      console.error("Failed to save website settings:", error);
      showToast("Failed to save settings to database", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all configurations to default settings? Your unsaved changes will be lost.")) {
      setFormData(defaultSettings);
      showToast("Reset to default settings. Press Save to store.", "success");
    }
  };

  const tabs = [
    { id: 'brand', label: 'Brand Settings', icon: Globe },
    { id: 'colors', label: 'Theme Colors', icon: Palette },
    { id: 'announcement', label: 'Announcement Bar', icon: Megaphone },
    { id: 'banners', label: 'Banner Settings', icon: ImageIcon },
    { id: 'delivery', label: 'Delivery Settings', icon: Truck },
    { id: 'homepage', label: 'Homepage & Cards', icon: LayoutIcon },
    { id: 'contact', label: 'Contact & Footer', icon: Phone },
    { id: 'seo', label: 'SEO Settings', icon: Laptop }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={36} className="text-yellow-500 animate-spin" />
        <p className="text-xs font-black uppercase text-gray-500 tracking-widest">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-yellow-900/10 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Website Settings</h1>
          <p className="text-[10px] text-yellow-600 font-bold uppercase tracking-widest mt-1">Configure layout, colors, tags, banners and delivery settings</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 border border-red-500/20 text-red-400 hover:bg-red-500/5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
          >
            <RefreshCw size={12} /> Reset to Default
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Navigation Tabs (3 cols) */}
        <div className="lg:col-span-3 space-y-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider text-left transition-all border ${
                  activeTab === tab.id
                    ? 'bg-yellow-500 border-yellow-500 text-black shadow-lg shadow-yellow-500/15'
                    : 'bg-gray-900/40 border-yellow-900/10 text-gray-400 hover:text-white hover:border-yellow-500/20'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center Column: Config Fields (5 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 bg-gray-900/40 border border-yellow-900/10 p-6 rounded-3xl space-y-6">
          
          {/* 1. BRAND SETTINGS */}
          {activeTab === 'brand' && (
            <div className="space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">Brand Settings</h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Store Name</label>
                <input
                  type="text"
                  name="storeName"
                  value={formData.storeName}
                  onChange={(e) => handleChange(e)}
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Store Tagline</label>
                <input
                  type="text"
                  name="storeTagline"
                  value={formData.storeTagline}
                  onChange={(e) => handleChange(e)}
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Logo Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, null, 'logoUrl')}
                    className="text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:bg-yellow-500/10 file:text-yellow-500 hover:file:bg-yellow-500/20"
                  />
                  {formData.logoUrl && (
                    <img src={formData.logoUrl} alt="Logo" className="h-10 object-contain self-start mt-2 border border-white/5 p-1 rounded bg-black" />
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Favicon (.ico/.png)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, null, 'faviconUrl')}
                    className="text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:bg-yellow-500/10 file:text-yellow-500 hover:file:bg-yellow-500/20"
                  />
                  {formData.faviconUrl && (
                    <img src={formData.faviconUrl} alt="Favicon" className="h-8 w-8 object-contain self-start mt-2 border border-white/5 p-1 rounded bg-black" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. THEME COLORS */}
          {activeTab === 'colors' && (
            <div className="space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">Theme Colors</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(formData.colors).map(colorKey => (
                  <div key={colorKey} className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest capitalize">{colorKey} Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        name={colorKey}
                        value={formData.colors[colorKey]}
                        onChange={(e) => handleChange(e, 'colors')}
                        className="h-10 w-12 bg-transparent border border-yellow-900/20 rounded-xl cursor-pointer"
                      />
                      <input
                        type="text"
                        name={colorKey}
                        value={formData.colors[colorKey]}
                        onChange={(e) => handleChange(e, 'colors')}
                        className="flex-1 bg-slate-950/60 border border-yellow-900/20 rounded-xl px-3 py-2 text-white text-xs font-mono uppercase focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. ANNOUNCEMENT BAR */}
          {activeTab === 'announcement' && (
            <div className="space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">Announcement Bar</h3>
              
              <div className="flex items-center justify-between bg-slate-950/30 border border-white/5 p-4 rounded-2xl">
                <div>
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">Enable Announcement Bar</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">Show/hide the live scrolling banner above the header</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={formData.announcement.enabled}
                    onChange={(e) => handleChange(e, 'announcement')}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-yellow-500 peer-checked:bg-yellow-500/10 peer-checked:border peer-checked:border-yellow-500/20"></div>
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Announcement Text</label>
                <textarea
                  name="text"
                  value={formData.announcement.text}
                  onChange={(e) => handleChange(e, 'announcement')}
                  rows="3"
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-yellow-500 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Background Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="bgColor"
                      value={formData.announcement.bgColor}
                      onChange={(e) => handleChange(e, 'announcement')}
                      className="h-10 w-12 bg-transparent border border-yellow-900/20 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      name="bgColor"
                      value={formData.announcement.bgColor}
                      onChange={(e) => handleChange(e, 'announcement')}
                      className="flex-1 bg-slate-950/60 border border-yellow-900/20 rounded-xl px-3 py-2 text-white text-xs font-mono uppercase focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Text Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="textColor"
                      value={formData.announcement.textColor}
                      onChange={(e) => handleChange(e, 'announcement')}
                      className="h-10 w-12 bg-transparent border border-yellow-900/20 rounded-xl cursor-pointer"
                    />
                    <input
                      type="text"
                      name="textColor"
                      value={formData.announcement.textColor}
                      onChange={(e) => handleChange(e, 'announcement')}
                      className="flex-1 bg-slate-950/60 border border-yellow-900/20 rounded-xl px-3 py-2 text-white text-xs font-mono uppercase focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Scroll Speed (seconds)</label>
                  <input
                    type="number"
                    name="scrollSpeed"
                    value={formData.announcement.scrollSpeed}
                    onChange={(e) => handleNestedNumberChange(e, 'announcement', 'scrollSpeed')}
                    className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
                  />
                  <span className="text-[8px] text-gray-500 font-bold uppercase">Slower speed = higher duration</span>
                </div>

                <div className="flex items-center justify-between bg-slate-950/30 border border-white/5 p-3 rounded-2xl self-center mt-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Infinite Loop</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="infinite"
                      checked={formData.announcement.infinite}
                      onChange={(e) => handleChange(e, 'announcement')}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-yellow-500 peer-checked:bg-yellow-500/10 peer-checked:border peer-checked:border-yellow-500/20"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 4. BANNER SETTINGS */}
          {activeTab === 'banners' && (
            <div className="space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">Banner Settings</h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Desktop Hero Banner</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'banners', 'desktop')}
                  className="text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:bg-yellow-500/10 file:text-yellow-500 hover:file:bg-yellow-500/20"
                />
                {formData.banners.desktop && (
                  <img src={formData.banners.desktop} alt="Desktop banner" className="w-full h-16 object-cover rounded-xl mt-2 border border-white/5" />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mobile Hero Banner</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'banners', 'mobile')}
                  className="text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:bg-yellow-500/10 file:text-yellow-500 hover:file:bg-yellow-500/20"
                />
                {formData.banners.mobile && (
                  <img src={formData.banners.mobile} alt="Mobile banner" className="w-1/3 h-16 object-cover rounded-xl mt-2 border border-white/5" />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">General Offer Banner</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'banners', 'offer')}
                  className="text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:bg-yellow-500/10 file:text-yellow-500 hover:file:bg-yellow-500/20"
                />
                {formData.banners.offer && (
                  <img src={formData.banners.offer} alt="Offer banner" className="w-full h-16 object-cover rounded-xl mt-2 border border-white/5" />
                )}
              </div>
            </div>
          )}

          {/* 5. DELIVERY SETTINGS */}
          {activeTab === 'delivery' && (
            <div className="space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">Delivery Settings</h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">Standard Delivery Charge (₹)</label>
                <input
                  type="number"
                  name="charge"
                  value={formData.delivery.charge}
                  onChange={(e) => handleNestedNumberChange(e, 'delivery', 'charge')}
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">Free Delivery For Orders Above (₹)</label>
                <input
                  type="number"
                  name="freeAbove"
                  value={formData.delivery.freeAbove}
                  onChange={(e) => handleNestedNumberChange(e, 'delivery', 'freeAbove')}
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 6. HOMEPAGE & PRODUCT CARDS */}
          {activeTab === 'homepage' && (
            <div className="space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">Homepage Sections</h3>
              
              <div className="space-y-3 bg-slate-950/20 p-4 border border-white/5 rounded-2xl">
                {Object.keys(formData.homepage).map(sectionKey => (
                  <div key={sectionKey} className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{sectionKey.replace('show', 'Show ')}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name={sectionKey}
                        checked={formData.homepage[sectionKey]}
                        onChange={(e) => handleChange(e, 'homepage')}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-yellow-500 peer-checked:bg-yellow-500/10 peer-checked:border peer-checked:border-yellow-500/20"></div>
                    </label>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2 pt-2">Product Card Badges & Actions</h3>
              
              <div className="space-y-3 bg-slate-950/20 p-4 border border-white/5 rounded-2xl">
                {Object.keys(formData.productCard).map(cardKey => (
                  <div key={cardKey} className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{cardKey.replace('show', 'Show ')}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name={cardKey}
                        checked={formData.productCard[cardKey]}
                        onChange={(e) => handleChange(e, 'productCard')}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-yellow-500 peer-checked:bg-yellow-500/10 peer-checked:border peer-checked:border-yellow-500/20"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. CONTACT DETAILS & FOOTER */}
          {activeTab === 'contact' && (
            <div className="space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">Support & Social Links</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phone Support</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.contact.phone}
                    onChange={(e) => handleChange(e, 'contact')}
                    className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">WhatsApp Number</label>
                  <input
                    type="text"
                    name="whatsapp"
                    value={formData.contact.whatsapp}
                    onChange={(e) => handleChange(e, 'contact')}
                    className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Support Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.contact.email}
                  onChange={(e) => handleChange(e, 'contact')}
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Store Address</label>
                <textarea
                  name="address"
                  value={formData.contact.address}
                  onChange={(e) => handleChange(e, 'contact')}
                  rows="2"
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-xs focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Instagram</label>
                  <input
                    type="text"
                    name="instagram"
                    value={formData.contact.instagram}
                    onChange={(e) => handleChange(e, 'contact')}
                    className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-3 py-2 text-white text-[10px] focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Facebook</label>
                  <input
                    type="text"
                    name="facebook"
                    value={formData.contact.facebook}
                    onChange={(e) => handleChange(e, 'contact')}
                    className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-3 py-2 text-white text-[10px] focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">YouTube</label>
                  <input
                    type="text"
                    name="youtube"
                    value={formData.contact.youtube}
                    onChange={(e) => handleChange(e, 'contact')}
                    className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-3 py-2 text-white text-[10px] focus:outline-none"
                  />
                </div>
              </div>

              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2 pt-2">Footer Details</h3>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Footer Tagline/Text</label>
                <input
                  type="text"
                  name="text"
                  value={formData.footer.text}
                  onChange={(e) => handleChange(e, 'footer')}
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Footer Copyright Text</label>
                <input
                  type="text"
                  name="copyright"
                  value={formData.footer.copyright}
                  onChange={(e) => handleChange(e, 'footer')}
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-xs focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 8. SEO SETTINGS */}
          {activeTab === 'seo' && (
            <div className="space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">SEO & Search Settings</h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Website Tab Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.seo.title}
                  onChange={(e) => handleChange(e, 'seo')}
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Meta Description</label>
                <textarea
                  name="description"
                  value={formData.seo.description}
                  onChange={(e) => handleChange(e, 'seo')}
                  rows="3"
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-xs focus:outline-none resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Keywords (comma separated)</label>
                <input
                  type="text"
                  name="keywords"
                  value={formData.seo.keywords}
                  onChange={(e) => handleChange(e, 'seo')}
                  className="bg-slate-950/60 border border-yellow-900/20 rounded-xl px-4 py-3 text-white text-xs focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-yellow-900/10">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 w-full sm:w-auto"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Settings
            </button>
          </div>
        </form>

        {/* Right Column: Live Website Mockup Preview (4 cols) */}
        <div className="lg:col-span-4 bg-gray-900/50 backdrop-blur-xl p-6 rounded-3xl border border-yellow-900/10 space-y-6 lg:sticky lg:top-6">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            Live Preview Mockup
          </h3>
          <p className="text-[10px] text-gray-500 font-medium">This shows a live representation of your changes before saving.</p>

          <div 
            className="border-2 rounded-2xl p-4 flex flex-col gap-4 shadow-2xl relative overflow-hidden transition-all text-left"
            style={{ 
              backgroundColor: formData.colors.background, 
              borderColor: formData.colors.border,
              color: formData.colors.text
            }}
          >
            {/* Header Tag */}
            <div className="text-[7px] font-black tracking-widest uppercase border-b pb-1 opacity-60" style={{ borderColor: formData.colors.border }}>
              Store Mockup
            </div>

            {/* Announcement bar mockup */}
            {formData.announcement.enabled && (
              <div 
                className="p-1 rounded text-center text-[8px] font-black uppercase overflow-hidden whitespace-nowrap transition-all"
                style={{ 
                  backgroundColor: formData.announcement.bgColor, 
                  color: formData.announcement.textColor 
                }}
              >
                <div className="animate-pulse">
                  {formData.announcement.text || "Announcement Message"}
                </div>
              </div>
            )}

            {/* Navbar mockup */}
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Store logo" className="h-6 object-contain" />
                ) : (
                  <div className="w-6 h-6 rounded bg-yellow-500 flex items-center justify-center text-black font-black text-[9px]">S</div>
                )}
                <span className="text-[10px] font-black tracking-wider uppercase">
                  {formData.storeName || "Store Name"}
                </span>
              </div>
              <span className="text-[7px] font-black uppercase opacity-60">Menu</span>
            </div>

            {/* Product Card mockup */}
            <div 
              className="rounded-xl border p-3 space-y-2 relative"
              style={{ 
                backgroundColor: formData.colors.card, 
                borderColor: formData.colors.border + '30' 
              }}
            >
              {/* Product Badges preview */}
              <div className="relative aspect-square w-full bg-slate-950/40 rounded-lg flex items-center justify-center overflow-hidden">
                <span className="text-[9px] font-black opacity-30 uppercase tracking-widest">Image</span>
                
                {/* Wishlist Icon */}
                {formData.productCard.showWishlistButton && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center text-red-500">
                    ♥
                  </div>
                )}

                {/* Best Seller Badge */}
                {formData.productCard.showStockBadge && (
                  <div className="absolute top-1.5 left-1.5 bg-yellow-500 text-black text-[5px] font-black uppercase px-1 rounded">
                    🏆 BEST SELLER
                  </div>
                )}

                {/* Quick view hover */}
                {formData.productCard.showQuickView && (
                  <div className="absolute bottom-1.5 inset-x-1.5 bg-black/70 py-1 text-center rounded text-[5px] font-black uppercase tracking-wider text-yellow-500">
                    Quick View
                  </div>
                )}
              </div>

              {/* Card Meta preview */}
              <div className="space-y-1">
                <span className="text-[7px] font-black uppercase tracking-widest text-yellow-500/70">Category</span>
                <p className="text-[10px] font-black uppercase tracking-wider truncate">Sample Product Name</p>
                
                {/* Rating */}
                {formData.productCard.showRating && (
                  <div className="text-[7px] text-yellow-500">★★★★★ (20)</div>
                )}

                {/* Prices */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-black" style={{ color: formData.colors.accent }}>₹399</span>
                  <span className="text-[8px] line-through text-gray-500">₹499</span>
                  
                  {/* Discount Badge */}
                  {formData.productCard.showDiscountBadge && (
                    <span className="text-[8px] font-black text-green-500">20% off</span>
                  )}
                </div>
              </div>
            </div>

            {/* Branded Button mockup */}
            <button 
              type="button"
              className="w-full py-2.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all"
              style={{ 
                backgroundColor: formData.colors.button, 
                color: '#000000' 
              }}
            >
              Add To Cart
            </button>
          </div>

          {/* Address warning box */}
          <div className="bg-yellow-950/20 border border-yellow-900/30 rounded-2xl p-4 flex gap-3 text-yellow-600 text-[10px] leading-relaxed">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-black block uppercase tracking-wider text-[9px] mb-1">Theme Overrides Notice</span>
              Changes to colors and tags will apply globally across all customer store pages instantly upon refresh.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
