import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Quote, Bookmark, Heart, Share2, Clipboard, ChevronDown, ChevronUp, X, Sparkles, Loader2 } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { journeyPillQuotes, quoteOfTheDayQuotes } from '../utils/dailyNotesData';

export default function DailyNotes() {
  const { showToast } = useNotification();
  const [kurals, setKurals] = useState([]);
  const [loadingKural, setLoadingKural] = useState(true);
  const [dayTrigger, setDayTrigger] = useState(0);

  // Card specific state
  const [kuralExpanded, setKuralExpanded] = useState(false);
  const [activeShareCard, setActiveShareCard] = useState(null); // 'journey', 'wisdom', 'quote'
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  
  // Bookmarks stored in local storage
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem('smkp_bookmarked_notes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Reference for share tooltips to handle click outside
  const shareRefs = {
    journey: useRef(null),
    wisdom: useRef(null),
    quote: useRef(null)
  };

  // Close share tooltips on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (activeShareCard) {
        const currentRef = shareRefs[activeShareCard];
        if (currentRef && currentRef.current && !currentRef.current.contains(event.target)) {
          setActiveShareCard(null);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeShareCard]);

  // Load Kurals on mount
  useEffect(() => {
    fetch('/kurals.json')
      .then(res => res.json())
      .then(data => {
        setKurals(data);
        setLoadingKural(false);
      })
      .catch(err => {
        console.error('Failed to load Kurals:', err);
        setLoadingKural(false);
      });
  }, []);

  // Midnight trigger setup
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const msToMidnight = midnight.getTime() - now.getTime();

    const timer = setTimeout(() => {
      setDayTrigger(prev => prev + 1);
    }, msToMidnight + 1000); // 1s buffer past midnight

    return () => clearTimeout(timer);
  }, [dayTrigger]);

  // Get current date offset (days since unix epoch in local timezone)
  const todayOffset = useMemo(() => {
    const now = new Date();
    // Offset calculation using local time coordinates
    return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
  }, [dayTrigger]);

  // Resolve today's items
  const todayJourneyQuote = useMemo(() => {
    const idx = todayOffset % journeyPillQuotes.length;
    return { ...journeyPillQuotes[idx], id: `journey_${idx}`, type: 'journey' };
  }, [todayOffset]);

  const todayKural = useMemo(() => {
    if (kurals.length === 0) return null;
    const kuralNum = (todayOffset % 1330) + 1; // sequentially wraps from 1330 back to 1
    const item = kurals.find(k => k.number === kuralNum) || kurals[0];
    return { ...item, id: `kural_${kuralNum}`, type: 'kural' };
  }, [kurals, todayOffset]);

  const todayQuote = useMemo(() => {
    const idx = todayOffset % quoteOfTheDayQuotes.length;
    return { ...quoteOfTheDayQuotes[idx], id: `quote_${idx}`, type: 'daily_quote' };
  }, [todayOffset]);

  // Toggle Bookmark logic
  const toggleBookmark = (item) => {
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
  };

  const isBookmarked = (id) => bookmarks.some(b => b.id === id);

  // Copy details to clipboard
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        showToast('Copied to clipboard!', 'success');
        setActiveShareCard(null);
      })
      .catch(() => showToast('Failed to copy', 'error'));
  };

  // Build Share Message
  const getShareText = (item) => {
    const storeLink = window.location.origin;
    if (item.type === 'kural') {
      return `Daily Wisdom - Kural ${item.number} from SMKP Traders\n\nTamil:\n${item.line1}\n${item.line2}\n\nEnglish:\n${item.translation}\n\nRead more daily notes at: ${storeLink}`;
    } else {
      return `Inspirational Quote of the Day from SMKP Traders\n\n"${item.quoteEn}"\n\n"${item.quoteTa}"\n- ${item.author}\n\nRead more daily notes at: ${storeLink}`;
    }
  };

  const shareToSocial = (platform, item) => {
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
  };

  return (
    <section className="mx-3 sm:mx-8 lg:mx-auto max-w-7xl mt-12 sm:mt-16 pb-6 select-none relative z-10">
      
      {/* Header with Title & Bookmark Drawer Button */}
      <div className="flex flex-row items-center justify-between border-b border-yellow-900/10 pb-4 mb-8">
        <div className="space-y-1 text-left">
          <p className="text-yellow-500 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.4em]">Daily Reading</p>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2">
            <Sparkles size={16} className="text-yellow-500 animate-pulse" /> Daily Notes
          </h2>
        </div>
        <button
          onClick={() => setIsSavedDrawerOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-yellow-600/10 to-yellow-600/20 hover:from-yellow-500 hover:to-yellow-600 text-yellow-500 hover:text-black border border-yellow-500/20 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 active:scale-95 shadow-md shadow-yellow-500/5 hover:shadow-yellow-500/20"
        >
          <Bookmark size={12} className="fill-current" />
          Saved Notes ({bookmarks.length})
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Card 1: Journey Pillar */}
        <motion.div
          layout
          className="group relative bg-gradient-to-br from-slate-950 via-slate-900 to-black border border-yellow-900/15 hover:border-yellow-500/40 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl transition-all duration-300 h-full min-h-[350px]"
        >
          <div>
            <div className="flex justify-between items-center mb-6">
              <span className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                <Quote size={9} className="fill-current" /> Journey Pillar
              </span>
              <div className="flex gap-2">
                <button
                  aria-label="Bookmark quote"
                  onClick={() => toggleBookmark(todayJourneyQuote)}
                  className={`p-2 rounded-xl border transition-all ${
                    isBookmarked(todayJourneyQuote.id)
                      ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500'
                      : 'border-white/5 bg-white/5 text-gray-500 hover:text-white'
                  }`}
                >
                  <Heart size={14} className={isBookmarked(todayJourneyQuote.id) ? 'fill-current' : ''} />
                </button>
                <div className="relative" ref={shareRefs.journey}>
                  <button
                    aria-label="Share options"
                    onClick={() => setActiveShareCard(activeShareCard === 'journey' ? null : 'journey')}
                    className="p-2 rounded-xl border border-white/5 bg-white/5 text-gray-500 hover:text-white transition-all"
                  >
                    <Share2 size={14} />
                  </button>
                  
                  {/* Share Tooltip */}
                  {activeShareCard === 'journey' && (
                    <div className="absolute right-0 top-10 z-50 bg-slate-950 border border-yellow-900/30 rounded-2xl p-2 flex flex-col gap-1 shadow-2xl min-w-[140px] animate-fadeIn">
                      <button onClick={() => shareToSocial('whatsapp', todayJourneyQuote)} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left">WhatsApp</button>
                      <button onClick={() => shareToSocial('facebook', todayJourneyQuote)} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left">Facebook</button>
                      <button onClick={() => handleCopy(getShareText(todayJourneyQuote))} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left flex items-center justify-between">Copy Text <Clipboard size={10} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quote content */}
            <div className="space-y-4 text-left">
              <p className="text-sm sm:text-base font-bold text-white leading-relaxed italic border-l border-yellow-500/20 pl-4">
                "{todayJourneyQuote.quoteEn}"
              </p>
              <p className="text-xs sm:text-sm font-semibold text-gray-400 leading-relaxed italic border-l border-yellow-500/20 pl-4">
                "{todayJourneyQuote.quoteTa}"
              </p>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 text-left">
            <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">— {todayJourneyQuote.author}</span>
          </div>
        </motion.div>

        {/* Card 2: Daily Wisdom (Thirukkural) */}
        <motion.div
          layout
          className="group relative bg-gradient-to-br from-slate-950 via-slate-900 to-black border border-yellow-900/15 hover:border-yellow-500/40 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl transition-all duration-300 h-full min-h-[350px]"
        >
          {loadingKural ? (
            <div className="flex items-center justify-center flex-1 h-full py-20">
              <Loader2 size={24} className="animate-spin text-yellow-500" />
            </div>
          ) : todayKural ? (
            <>
              <div>
                <div className="flex justify-between items-center mb-6">
                  <span className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                    <BookOpen size={9} /> Daily Wisdom
                  </span>
                  <div className="flex gap-2">
                    <button
                      aria-label="Bookmark Kural"
                      onClick={() => toggleBookmark(todayKural)}
                      className={`p-2 rounded-xl border transition-all ${
                        isBookmarked(todayKural.id)
                          ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500'
                          : 'border-white/5 bg-white/5 text-gray-500 hover:text-white'
                      }`}
                    >
                      <Heart size={14} className={isBookmarked(todayKural.id) ? 'fill-current' : ''} />
                    </button>
                    <div className="relative" ref={shareRefs.wisdom}>
                      <button
                        aria-label="Share Kural options"
                        onClick={() => setActiveShareCard(activeShareCard === 'wisdom' ? null : 'wisdom')}
                        className="p-2 rounded-xl border border-white/5 bg-white/5 text-gray-500 hover:text-white transition-all"
                      >
                        <Share2 size={14} />
                      </button>
                      
                      {activeShareCard === 'wisdom' && (
                        <div className="absolute right-0 top-10 z-50 bg-slate-950 border border-yellow-900/30 rounded-2xl p-2 flex flex-col gap-1 shadow-2xl min-w-[140px] animate-fadeIn">
                          <button onClick={() => shareToSocial('whatsapp', todayKural)} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left">WhatsApp</button>
                          <button onClick={() => shareToSocial('facebook', todayKural)} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left">Facebook</button>
                          <button onClick={() => handleCopy(getShareText(todayKural))} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left flex items-center justify-between">Copy Text <Clipboard size={10} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Thirukkural Content */}
                <div className="space-y-4 text-left">
                  <div className="space-y-1">
                    <p className="text-base sm:text-lg font-black text-white leading-relaxed tracking-wide font-tamil">
                      {todayKural.line1}
                    </p>
                    <p className="text-base sm:text-lg font-black text-white leading-relaxed tracking-wide font-tamil">
                      {todayKural.line2}
                    </p>
                  </div>
                  
                  <p className="text-xs text-gray-500 italic leading-relaxed border-l border-yellow-500/20 pl-4">
                    "{todayKural.translation}"
                  </p>

                  {/* Collapsible Meanings */}
                  <div className="pt-2">
                    <button
                      onClick={() => setKuralExpanded(!kuralExpanded)}
                      className="text-[10px] font-black text-yellow-500 hover:text-yellow-400 uppercase tracking-widest flex items-center gap-1 transition-all"
                    >
                      {kuralExpanded ? 'Hide Meanings' : 'Read Meaning'} 
                      {kuralExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    <AnimatePresence>
                      {kuralExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-3 mt-3 p-3 bg-white/5 border border-white/5 rounded-2xl"
                        >
                          <div>
                            <p className="text-[8px] font-black text-yellow-500/60 uppercase tracking-widest mb-1">பொருள் (Tamil Meaning)</p>
                            <p className="text-[11px] text-gray-300 font-bold leading-relaxed">{todayKural.tamilMeaning}</p>
                          </div>
                          <div className="border-t border-white/5 pt-2">
                            <p className="text-[8px] font-black text-yellow-500/60 uppercase tracking-widest mb-1">Explanation (English)</p>
                            <p className="text-[11px] text-gray-400 font-medium leading-relaxed">{todayKural.englishMeaning}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5 text-left">
                <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">Kural {todayKural.number}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-gray-600">No Kural available</div>
          )}
        </motion.div>

        {/* Card 3: Quote of the Day */}
        <motion.div
          layout
          className="group relative bg-gradient-to-br from-slate-950 via-slate-900 to-black border border-yellow-900/15 hover:border-yellow-500/40 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl transition-all duration-300 h-full min-h-[350px]"
        >
          <div>
            <div className="flex justify-between items-center mb-6">
              <span className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                <Quote size={9} className="fill-current" /> Quote of the Day
              </span>
              <div className="flex gap-2">
                <button
                  aria-label="Bookmark motivational quote"
                  onClick={() => toggleBookmark(todayQuote)}
                  className={`p-2 rounded-xl border transition-all ${
                    isBookmarked(todayQuote.id)
                      ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500'
                      : 'border-white/5 bg-white/5 text-gray-500 hover:text-white'
                  }`}
                >
                  <Heart size={14} className={isBookmarked(todayQuote.id) ? 'fill-current' : ''} />
                </button>
                <div className="relative" ref={shareRefs.quote}>
                  <button
                    aria-label="Share Quote of the Day"
                    onClick={() => setActiveShareCard(activeShareCard === 'quote' ? null : 'quote')}
                    className="p-2 rounded-xl border border-white/5 bg-white/5 text-gray-500 hover:text-white transition-all"
                  >
                    <Share2 size={14} />
                  </button>
                  
                  {activeShareCard === 'quote' && (
                    <div className="absolute right-0 top-10 z-50 bg-slate-950 border border-yellow-900/30 rounded-2xl p-2 flex flex-col gap-1 shadow-2xl min-w-[140px] animate-fadeIn">
                      <button onClick={() => shareToSocial('whatsapp', todayQuote)} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left">WhatsApp</button>
                      <button onClick={() => shareToSocial('facebook', todayQuote)} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left">Facebook</button>
                      <button onClick={() => handleCopy(getShareText(todayQuote))} className="text-[10px] font-bold text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl text-left flex items-center justify-between">Copy Text <Clipboard size={10} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quote content */}
            <div className="space-y-4 text-left">
              <p className="text-sm sm:text-base font-bold text-white leading-relaxed italic border-l border-yellow-500/20 pl-4">
                "{todayQuote.quoteEn}"
              </p>
              <p className="text-xs sm:text-sm font-semibold text-gray-400 leading-relaxed italic border-l border-yellow-500/20 pl-4">
                "{todayQuote.quoteTa}"
              </p>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 text-left">
            <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">— {todayQuote.author}</span>
          </div>
        </motion.div>

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
                    <p className="text-[10px] font-medium text-gray-600 max-w-[240px] text-center">Click the heart/bookmark icon on any daily note to save it here for offline reading.</p>
                  </div>
                ) : (
                  bookmarks.map((item, idx) => (
                    <div
                      key={`saved-${item.id}-${idx}`}
                      className="bg-black/60 border border-yellow-900/10 rounded-2xl p-4 sm:p-5 relative group"
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
                      <div className="text-left space-y-2.5">
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

    </section>
  );
}
