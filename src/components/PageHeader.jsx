import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';

const PageHeader = ({ title, breadcrumbs = [], showBack = true }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      const pathParts = location.pathname.split('/').filter(Boolean);
      if (pathParts.length > 1) {
        navigate(`/${pathParts[0]}`);
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div className="mb-16">
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-gray-700 mb-8 overflow-x-auto whitespace-nowrap pb-2 no-scrollbar"
      >
        <Link to="/" className="hover:text-yellow-500 transition-colors flex items-center gap-2">
          <Home size={12} />
          Origin
        </Link>

        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            <ChevronRight size={10} className="text-gray-800 flex-shrink-0" />
            {/* fix: last crumb is current page — render as non-interactive span */}
            {index === breadcrumbs.length - 1 ? (
              <span className="text-gray-400" aria-current="page">{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="hover:text-yellow-500 transition-colors">
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        {showBack && (
          <button
            onClick={handleBack}
            className="group inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 hover:border-yellow-500/30 hover:text-yellow-500 text-gray-600 transition-all active:scale-95 flex-shrink-0 backdrop-blur-sm"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
        )}

        <div>
          <p className="text-yellow-500 text-[9px] font-black uppercase tracking-[0.6em] mb-3">
            {breadcrumbs[breadcrumbs.length - 1]?.label || 'Section'}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter leading-none uppercase">
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
};

export default PageHeader;