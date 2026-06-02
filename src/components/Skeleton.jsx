import React from 'react';

// ── Base pulse block ────────────────────────────────────────────────────────
const Pulse = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-gray-800/60 ${className}`} />
);

// ── Product card skeleton (luxury dark theme) ───────────────────────────────
export const ProductSkeleton = () => (
  <div className="bg-gray-900/50 backdrop-blur-xl rounded-[2.5rem] border border-yellow-900/10 overflow-hidden p-4 animate-pulse">
    <Pulse className="aspect-square rounded-[2rem] mb-6 w-full" />
    <div className="px-2 space-y-4 pb-4">
      <Pulse className="h-2 w-16 rounded-full bg-yellow-900/30" />
      <Pulse className="h-4 w-3/4" />
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <Pulse className="h-6 w-24" />
        <Pulse className="h-8 w-8 rounded-full" />
      </div>
    </div>
  </div>
);

// ── Order card skeleton ─────────────────────────────────────────────────────
export const OrderSkeleton = () => (
  <div className="bg-gray-900/50 backdrop-blur-xl rounded-[2.5rem] border border-yellow-900/10 p-8 space-y-6 animate-pulse">
    <div className="flex justify-between items-center border-b border-yellow-900/10 pb-6">
      <div className="space-y-3">
        <Pulse className="h-2 w-20 bg-yellow-900/30" />
        <Pulse className="h-4 w-36" />
      </div>
      <Pulse className="h-8 w-24 rounded-full" />
    </div>
    <Pulse className="h-20 rounded-2xl w-full" />
    <div className="flex justify-between items-center pt-2">
      <Pulse className="h-3 w-40" />
      <Pulse className="h-5 w-20" />
    </div>
  </div>
);

// ── Stat card skeleton (admin dashboard) ────────────────────────────────────
export const StatSkeleton = () => (
  <div className="bg-gray-900 rounded-2xl border border-yellow-900/10 p-6 space-y-4 animate-pulse">
    <div className="flex justify-between items-center">
      <Pulse className="h-12 w-12 rounded-xl" />
      <Pulse className="h-4 w-12 rounded-full" />
    </div>
    <div className="space-y-2">
      <Pulse className="h-2 w-16 bg-yellow-900/30" />
      <Pulse className="h-8 w-28" />
    </div>
  </div>
);

// ── Full-page loading skeleton ───────────────────────────────────────────────
export const PageSkeleton = () => (
  <div className="min-h-screen bg-black flex flex-col justify-center items-center p-6 space-y-4">
    <div className="w-16 h-16 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
    <div className="h-3 bg-gray-800/80 rounded-full w-48 animate-pulse" />
  </div>
);

// ── Product detail image skeleton ───────────────────────────────────────────
export const ImageSkeleton = ({ className = '' }) => (
  <div className={`bg-gray-800/60 animate-pulse rounded-[2rem] ${className}`}>
    <div className="w-full h-full flex items-center justify-center">
      <svg className="w-16 h-16 text-gray-700" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" strokeWidth="1" strokeLinecap="round"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  </div>
);
