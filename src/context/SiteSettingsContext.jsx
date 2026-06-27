import React, { createContext, useState, useEffect, useContext } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const SiteSettingsContext = createContext();

export const useSiteSettings = () => useContext(SiteSettingsContext);

export const defaultSettings = {
  storeName: 'SMKP TRADERS',
  storeTagline: 'Quality You Can Trust',
  logoUrl: '/logo.png',
  faviconUrl: '/favicon.ico',
  colors: {
    primary: '#000000',
    secondary: '#FFC107',
    accent: '#FFD700',
    background: '#020617',
    card: '#0f172a',
    button: '#eab308',
    text: '#ffffff',
    border: '#facc15'
  },
  announcement: {
    enabled: true,
    text: '🚚 FREE DELIVERY on all orders ₹499 & above • 📦 Flat ₹29 Delivery for orders below ₹499 • 🎉 Secure Online Payments • ⭐ Quality Products • 🔥 New Products Added Every Week',
    bgColor: '#FFC107',
    textColor: '#000000',
    scrollSpeed: 35,
    infinite: true
  },
  banners: {
    desktop: '',
    mobile: '',
    offer: ''
  },
  delivery: {
    charge: 29,
    freeAbove: 499
  },
  homepage: {
    showTrending: true,
    showBestSeller: true,
    showFlashDeals: true,
    showNewArrival: true,
    showFeaturedProducts: true
  },
  productCard: {
    showRating: true,
    showDiscountBadge: true,
    showWishlistButton: true,
    showStockBadge: true,
    showQuickView: true
  },
  contact: {
    phone: '9677417185',
    whatsapp: '919677417185',
    email: 'kaviyarasanmurugan78@gmail.com',
    address: 'Pommalappatti',
    instagram: '',
    facebook: '',
    youtube: ''
  },
  footer: {
    text: 'Premium E-Commerce Store',
    copyright: '© 2026 SMKP TRADERS. All Rights Reserved.'
  },
  seo: {
    title: 'SMKP TRADERS - Premium E-Commerce Store',
    description: 'Explore premium products at SMKP TRADERS. Find luxury goods at unmatched wholesale prices.',
    keywords: 'ecommerce, SMKP Traders, luxury goods, wholesale'
  }
};

export const applyTheme = (settings) => {
  if (!settings) return;
  const colors = settings.colors || {};

  // Set css variables on :root
  const root = document.documentElement;
  root.style.setProperty('--primary-color', colors.primary || '#000000');
  root.style.setProperty('--secondary-color', colors.secondary || '#FFC107');
  root.style.setProperty('--accent-color', colors.accent || '#FFD700');
  root.style.setProperty('--bg-color', colors.background || '#020617');
  root.style.setProperty('--card-color', colors.card || '#0f172a');
  root.style.setProperty('--button-color', colors.button || '#eab308');
  root.style.setProperty('--text-color', colors.text || '#ffffff');
  root.style.setProperty('--border-color', colors.border || '#facc15');

  // Insert or update an overridden stylesheet in the head
  let styleTag = document.getElementById('dynamic-theme-overrides');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dynamic-theme-overrides';
    document.head.appendChild(styleTag);
  }

  styleTag.innerHTML = `
    body, html, #root {
      background-color: ${colors.background || '#020617'} !important;
      color: ${colors.text || '#ffffff'} !important;
    }
    .bg-black {
      background-color: ${colors.background || '#020617'} !important;
    }
    .bg-slate-950, .bg-slate-950\\/50 {
      background-color: ${colors.background || '#020617'} !important;
    }
    .bg-gray-900, .bg-gray-900\\/40 {
      background-color: ${colors.card || '#0f172a'} !important;
    }
    .bg-gray-950 {
      background-color: ${colors.card || '#0f172a'} !important;
    }
    .text-white {
      color: ${colors.text || '#ffffff'} !important;
    }
    .text-yellow-500, .text-yellow-500\\/70, .text-yellow-500\\/60 {
      color: ${colors.secondary || '#FFC107'} !important;
    }
    .border-yellow-500, .border-yellow-500\\/20, .border-yellow-500\\/30, .border-yellow-900\\/20, .border-yellow-900\\/30, .border-yellow-900\\/15 {
      border-color: ${colors.border || '#facc15'} !important;
    }
    .bg-yellow-500, .hover\\:bg-yellow-500\\/10:hover, .bg-yellow-600 {
      background-color: ${colors.button || '#eab308'} !important;
      color: #000000 !important;
    }
    .bg-yellow-600 {
      background-color: ${colors.button || '#eab308'} !important;
      opacity: 0.9;
    }
    .gold-shine, .gold-text {
      color: ${colors.accent || '#FFD700'} !important;
      background: none !important;
      -webkit-text-fill-color: ${colors.accent || '#FFD700'} !important;
    }
    .premium-gold-price {
      color: ${colors.accent || '#FFD700'} !important;
    }
    .border-white\\/5 {
      border-color: ${colors.border ? colors.border + '15' : '#facc1515'} !important;
    }
  `;

  // Update favicon and tab title if client-side
  if (typeof document !== 'undefined') {
    if (settings.seo && settings.seo.title) {
      document.title = settings.seo.title;
    }
    
    // Find or create description meta
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.name = 'description';
      document.head.appendChild(descMeta);
    }
    if (settings.seo && settings.seo.description) {
      descMeta.setAttribute('content', settings.seo.description);
    }

    // Find or create keywords meta
    let keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (!keywordsMeta) {
      keywordsMeta = document.createElement('meta');
      keywordsMeta.name = 'keywords';
      document.head.appendChild(keywordsMeta);
    }
    if (settings.seo && settings.seo.keywords) {
      keywordsMeta.setAttribute('content', settings.seo.keywords);
    }

    // Update favicon Link
    if (settings.faviconUrl) {
      let faviconLink = document.querySelector('link[rel*="icon"]');
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'shortcut icon';
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = settings.faviconUrl;
    }
  }
};

export const SiteSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'site_settings', 'main');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const merged = {
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
        };
        setSettings(merged);
        applyTheme(merged);
      } else {
        applyTheme(defaultSettings);
      }
    } catch (error) {
      console.error("Error loading site settings:", error);
      applyTheme(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
};
