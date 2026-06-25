import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, ChevronLeft, ChevronRight, Shuffle, Share2, Clipboard, 
  Calendar, Loader2, Bookmark, X, Sparkles, BookOpen
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

export default function DailyNotes() {
  const { showToast } = useNotification();
  const [kurals, setKurals] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeShareCard, setActiveShareCard] = useState(null);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [dayTrigger, setDayTrigger] = useState(0);

  // Bookmarks stored in local storage
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem('smkp_bookmarked_notes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const shareRef = useRef(null);

  // Close share tooltip on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (activeShareCard && shareRef.current && !shareRef.current.contains(event.target)) {
        setActiveShareCard(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeShareCard]);

  // Fetch all kurals
  useEffect(() => {
    fetch('/kurals.json')
      .then(res => res.json())
      .then(data => {
        setKurals(data);
        setLoading(false);

        // Get timezone-aware daily Kural index
        const now = new Date();
        const dayOffset = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
        const defaultIndex = dayOffset % 1330;
        setCurrentIndex(defaultIndex);
      })
      .catch(err => {
        console.error('Failed to load Kurals:', err);
        setLoading(false);
      });
  }, []);

  // Midnight trigger setup to auto-update index if open past midnight
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const msToMidnight = midnight.getTime() - now.getTime();

    const timer = setTimeout(() => {
      setDayTrigger(prev => prev + 1);
    }, msToMidnight + 1000);

    return () => clearTimeout(timer);
  }, [dayTrigger]);

  // Auto-update daily index when date changes
  useEffect(() => {
    if (kurals.length > 0) {
      const now = new Date();
      const dayOffset = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
      const defaultIndex = dayOffset % 1330;
      setCurrentIndex(defaultIndex);
    }
  }, [dayTrigger, kurals.length]);

  const currentKural = useMemo(() => {
    if (kurals.length === 0) return null;
    const item = kurals[currentIndex] || kurals[0];
    return { ...item, id: `kural_${item.number}`, type: 'kural' };
  }, [kurals, currentIndex]);

  // Handlers
  const handlePrev = useCallback(() => {
    if (kurals.length === 0) return;
    setCurrentIndex(prev => (prev - 1 + kurals.length) % kurals.length);
  }, [kurals.length]);

  const handleNext = useCallback(() => {
    if (kurals.length === 0) return;
    setCurrentIndex(prev => (prev + 1) % kurals.length);
  }, [kurals.length]);

  const handleRandom = useCallback(() => {
    if (kurals.length === 0) return;
    const rand = Math.floor(Math.random() * kurals.length);
    setCurrentIndex(rand);
  }, [kurals.length]);

  const toggleBookmark = useCallback((item) => {
    if (!item) return;
    setBookmarks(prev => {
      const isAlreadyBookmarked = prev.some(b => b.id === item.id);
      let updated;
      if (isAlreadyBookmarked) {
        updated = prev.filter(b => b.id !== item.id);
        showToast('Removed from Bookmarks!', 'info');
      } else {
        updated = [...prev, item];
        showToast('Saved to Bookmarks!', 'success');
      }
      localStorage.setItem('smkp_bookmarked_notes', JSON.stringify(updated));
      return updated;
    });
  }, [showToast]);

  const isBookmarked = useCallback((id) => bookmarks.some(b => b.id === id), [bookmarks]);

  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        showToast('Copied to clipboard!', 'success');
        setActiveShareCard(null);
      })
      .catch(() => showToast('Failed to copy', 'error'));
  }, [showToast]);

  const getShareText = useCallback((item) => {
    const storeLink = window.location.origin;
    return `Daily Wisdom - Kural ${item.number} from SMKP Traders\n\nChapter: ${item.chapterTamil} / ${item.chapterEnglish}\n\nTamil:\n${item.line1}\n${item.line2}\n\nEnglish:\n${item.translation}\n\nRead more daily wisdom at: ${storeLink}`;
  }, []);

  const shareToSocial = useCallback((platform, item) => {
    const text = getShareText(item);
    const storeLink = window.location.origin;
    let url = '';

    if (platform === 'whatsapp') {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    } else if (platform === 'facebook') {
      url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storeLink)}&quote=${encodeURIComponent(text)}`;
    }

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      setActiveShareCard(null);
    }
  }, [getShareText]);

  return (
    <div className="min-h-screen bg-black text-white px-4 py-16 overflow-x-hidden select-none">
      <Helmet>
        <title>Daily Notes | SMKP TRADERS</title>
        <meta name="description" content="Read one inspiring Thirukkural every day with Tamil & English meaning. Built to share timeless Tamil wisdom." />
      </Helmet>

      <div className="max-w-4xl mx-auto w-full">
        
        {/* Centered Hero Header */}
        <div className="text-center mb-12 space-y-3">
          <p className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.5em] mb-1 flex items-center justify-center gap-1.5">
            📖 DAILY WISDOM
          </p>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter text-white">
            DAILY NOTES
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm max-w-xl mx-auto font-medium leading-relaxed">
            "Read one inspiring Thirukkural every day with Tamil & English meaning."
          </p>
        </div>

        {/* Date and Saved Buttons Row */}
        <div className="flex flex-row items-center justify-between border-b border-yellow-900/10 pb-4 mb-8">
          <div className="flex items-center gap-2 text-gray-500 font-mono text-xs">
            <Calendar size={14} className="text-yellow-500/80" />
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <button
            onClick={() => setIsSavedDrawerOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-600/10 to-yellow-600/20 hover:from-yellow-500 hover:to-yellow-600 text-yellow-500 hover:text-black border border-yellow-500/20 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 active:scale-95 shadow-md shadow-yellow-500/5 hover:shadow-yellow-500/20"
          >
            <Bookmark size={11} className="fill-current" />
            Saved Notes ({bookmarks.length})
          </button>
        </div>

        {/* Card display */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-950/40 border border-yellow-900/15 rounded-3xl min-h-[350px]">
            <Loader2 size={32} className="animate-spin text-yellow-500 mb-2" />
            <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Wisdom...</p>
          </div>
        ) : currentKural ? (
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-black border border-yellow-900/15 rounded-[2.2rem] p-6 sm:p-10 relative shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-yellow-500/5 rounded-full blur-[100px] pointer-events-none" />
            
            {/* Card Header Info */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <div className="text-left space-y-1">
                <span className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest w-fit">
                  Kural {currentKural.number}
                </span>
                <div className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  {currentKural.chapterTamil} • {currentKural.chapterEnglish}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  aria-label="Bookmark wisdom"
                  onClick={() => toggleBookmark(currentKural)}
                  className={`p-2 rounded-xl border transition-all ${
                    isBookmarked(currentKural.id)
                      ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.1)]'
                      : 'border-white/5 bg-white/5 text-gray-500 hover:text-white'
                  }`}
                >
                  <Heart size={14} className={isBookmarked(currentKural.id) ? 'fill-current' : ''} />
                </button>
                <div className="relative" ref={shareRef}>
                  <button
                    aria-label="Share wisdom"
                    onClick={() => setActiveShareCard(activeShareCard === 'kural' ? null : 'kural')}
                    className="p-2 rounded-xl border border-white/5 bg-white/5 text-gray-500 hover:text-white transition-all"
                  >
                    <Share2 size={14} />
                  </button>
                  
                  {/* Share Dropdown */}
                  {activeShareCard === 'kural' && (
                    <div className="absolute right-0 top-10 z-50 bg-slate-950 border border-yellow-900/30 rounded-2xl p-2 flex flex-col gap-1 shadow-2xl min-w-[140px] animate-fadeIn">
                      <button onClick={() => shareToSocial('whatsapp', currentKural)} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left">WhatsApp</button>
                      <button onClick={() => shareToSocial('facebook', currentKural)} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left">Facebook</button>
                      <button onClick={() => handleCopy(getShareText(currentKural))} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left flex items-center justify-between">Copy Text <Clipboard size={10} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content Area with Fade/Slide Transition */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentKural.number}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="space-y-8 text-center"
              >
                {/* Kural Text (Tamil) */}
                <div className="bg-black/50 p-6 sm:p-8 rounded-[2rem] border border-white/5 inline-block mx-auto max-w-full shadow-lg">
                  <p className="text-lg sm:text-xl lg:text-2xl font-black text-yellow-400 font-serif leading-relaxed whitespace-pre-line tracking-wide font-tamil">
                    {currentKural.line1}<br />
                    {currentKural.line2}
                  </p>
                </div>

                {/* English Translation */}
                <div className="max-w-2xl mx-auto px-4">
                  <p className="text-xs sm:text-sm text-gray-400 font-medium italic leading-relaxed border-l-2 border-yellow-500/20 pl-4 py-1.5 inline-block text-left">
                    "{currentKural.translation}"
                  </p>
                </div>

                {/* Meanings / Explanations Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto pt-2">
                  <div className="bg-white/[0.03] p-5 sm:p-6 rounded-2xl border border-white/5 space-y-2 hover:border-yellow-500/10 transition-colors">
                    <span className="text-[8px] sm:text-[9px] font-black text-yellow-500 uppercase tracking-widest">தமிழ் உரை (Tamil Meaning):</span>
                    <p className="text-xs sm:text-sm text-gray-300 font-bold leading-relaxed">{currentKural.tamilMeaning}</p>
                  </div>
                  <div className="bg-white/[0.03] p-5 sm:p-6 rounded-2xl border border-white/5 space-y-2 hover:border-yellow-500/10 transition-colors">
                    <span className="text-[8px] sm:text-[9px] font-black text-yellow-500 uppercase tracking-widest">English Explanation:</span>
                    <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">{currentKural.englishMeaning}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Action Buttons Row */}
            <div className="flex items-center justify-between border-t border-white/5 mt-8 pt-6">
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 active:scale-95"
              >
                <ChevronLeft size={14} /> Prev
              </button>

              <button
                onClick={handleRandom}
                className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-600/10 to-yellow-600/20 hover:from-yellow-500 hover:to-yellow-600 text-yellow-500 hover:text-black border border-yellow-500/20 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-md shadow-yellow-500/5 hover:shadow-yellow-500/20"
              >
                <Shuffle size={12} /> Random Wisdom
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 active:scale-95"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-600">No Kural wisdom available at the moment.</div>
        )}
      </div>

      {/* Bookmarks slide-over Drawer */}
      <AnimatePresence>
        {isSavedDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSavedDrawerOpen(false)}
              className="fixed inset-0 bg-black z-[9998]"
            />
            
            {/* Drawer container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-slate-950 border-l border-yellow-900/20 z-[9999] shadow-2xl flex flex-col justify-between"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/40">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Bookmark size={14} className="fill-current text-yellow-500" /> Saved Notes
                  </h3>
                  <p className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Your Personal Readings Collection</p>
                </div>
                <button
                  onClick={() => setIsSavedDrawerOpen(false)}
                  className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
                  aria-label="Close saved notes drawer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
                {bookmarks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-600 gap-4">
                    <Bookmark size={40} className="opacity-20" />
                    <p className="text-xs font-black uppercase tracking-widest text-center">No saved notes yet</p>
                    <p className="text-[10px] font-medium text-gray-600 max-w-[240px] text-center">Click the heart/bookmark icon on any Kural note to save it here for offline reading.</p>
                  </div>
                ) : (
                  bookmarks.map((item, idx) => (
                    <div
                      key={`saved-${item.id}-${idx}`}
                      className="bg-black/60 border border-yellow-900/10 rounded-2xl p-4 sm:p-5 relative group text-left"
                    >
                      <button
                        onClick={() => toggleBookmark(item)}
                        className="absolute top-4 right-4 p-1.5 bg-red-950/20 text-red-500/80 hover:text-red-500 hover:bg-red-500/10 border border-red-500/10 rounded-lg transition-all text-[8px] font-black uppercase tracking-widest"
                      >
                        Remove
                      </button>

                      {/* Header */}
                      <div className="mb-3">
                        <span className="text-[8px] font-black text-yellow-500/70 uppercase tracking-wider bg-yellow-500/5 px-2 py-0.5 border border-yellow-500/10 rounded-full">
                          {item.type === 'kural' ? `Kural ${item.number}` : item.type === 'journey' ? 'Journey Quote' : 'Daily Quote'}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="space-y-2.5">
                        {item.type === 'kural' ? (
                          <>
                            <div className="text-xs sm:text-sm font-bold text-white font-tamil leading-relaxed">
                              <p>{item.line1}</p>
                              <p>{item.line2}</p>
                            </div>
                            <p className="text-[10px] text-gray-500 italic">"{item.translation}"</p>
                            <div className="mt-3 p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
                              <p className="text-[10px] text-gray-300 font-bold leading-relaxed">{item.tamilMeaning}</p>
                              <p className="text-[10px] text-gray-400 font-medium leading-relaxed">{item.englishMeaning}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-xs sm:text-sm font-bold text-white leading-relaxed italic">"{item.quoteEn}"</p>
                            <p className="text-[11px] font-semibold text-gray-400 leading-relaxed italic">"{item.quoteTa}"</p>
                            <p className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">— {item.author}</p>
                          </>
                        )}
                      </div>

                      {/* Social Action row */}
                      <div className="mt-4 pt-3 border-t border-white/5 flex gap-2 justify-end">
                        <button
                          onClick={() => handleCopy(getShareText(item))}
                          className="flex items-center gap-1 text-[8px] font-black text-gray-500 hover:text-white uppercase tracking-wider p-1"
                        >
                          <Clipboard size={10} /> Copy
                        </button>
                        <button
                          onClick={() => {
                            const text = getShareText(item);
                            const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                            window.open(url, '_blank');
                          }}
                          className="flex items-center gap-1 text-[8px] font-black text-gray-500 hover:text-white uppercase tracking-wider p-1"
                        >
                          <Share2 size={10} /> WhatsApp
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-white/5 bg-black/40 text-center text-[8px] sm:text-[9px] text-gray-600 font-black uppercase tracking-[0.2em]">
                SMKP Traders Daily Wisdom & Reading
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
