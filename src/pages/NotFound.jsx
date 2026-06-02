import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-20 bg-gray-50">
      {/* Glowing number */}
      <div className="relative select-none mb-2">
        <span
          className="text-[10rem] sm:text-[14rem] font-extrabold tracking-tighter leading-none"
          style={{
            background: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 50%, #134e4a 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 40px rgba(20,184,166,0.25))',
          }}
        >
          404
        </span>
        {/* subtle glow disc behind the number */}
        <div
          className="absolute inset-0 -z-10 mx-auto rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #14b8a6 0%, transparent 70%)' }}
        />
      </div>

      {/* Heading */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 text-center">
        Page Not Found
      </h1>
      <p className="text-gray-500 text-center max-w-sm mb-10 leading-relaxed">
        The page you're looking for doesn't exist or has been moved.
        Let's get you back on track.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 rounded-full border-2 border-teal-600 text-teal-700 font-semibold text-sm hover:bg-teal-50 transition-all duration-200"
        >
          ← Go Back
        </button>

        <Link
          to="/"
          className="px-6 py-3 rounded-full bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-all duration-200 shadow-md hover:shadow-teal-300/40"
        >
          Home
        </Link>

        <Link
          to="/products"
          className="px-6 py-3 rounded-full bg-gray-900 text-white font-semibold text-sm hover:bg-gray-700 transition-all duration-200 shadow-md"
        >
          Browse Products
        </Link>
      </div>

      {/* Decorative divider */}
      <div className="mt-16 flex items-center gap-3 text-gray-300">
        <div className="h-px w-16 bg-gray-200" />
        <span className="text-xs uppercase tracking-widest text-gray-400">SMKP TRADERS</span>
        <div className="h-px w-16 bg-gray-200" />
      </div>
    </div>
  );
}
