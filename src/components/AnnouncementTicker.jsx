import React from 'react';
import { useSiteSettings } from '../context/SiteSettingsContext';

const AnnouncementTicker = () => {
  const { settings, loading } = useSiteSettings();

  if (loading || !settings || !settings.announcement || !settings.announcement.enabled) {
    return null;
  }

  const { text, bgColor, textColor, scrollSpeed, infinite } = settings.announcement;

  return (
    <div 
      className="ticker-wrap" 
      aria-label="Announcement Bar"
      style={{ backgroundColor: bgColor || '#FFC107' }}
    >
      <div 
        className="ticker-content"
        style={{ 
          animationDuration: `${scrollSpeed || 35}s`,
          animationIterationCount: infinite === false ? '1' : 'infinite'
        }}
      >
        <span className="ticker-item" style={{ color: textColor || '#000000' }}>{text}</span>
        <span className="ticker-item" style={{ color: textColor || '#000000' }}>{text}</span>
        <span className="ticker-item" style={{ color: textColor || '#000000' }}>{text}</span>
        <span className="ticker-item" style={{ color: textColor || '#000000' }}>{text}</span>
      </div>
    </div>
  );
};

export default AnnouncementTicker;
