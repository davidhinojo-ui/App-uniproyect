import React from 'react';

interface CompanyHeaderProps {
  compact?: boolean;
}

export default function CompanyHeader({ compact = false }: CompanyHeaderProps) {
  return (
    <div 
      className={`bg-[#0F0F12] rounded-2xl border border-white/[0.08] shadow-premium transition-all duration-300 w-full ${
        compact 
          ? 'p-2.5 sm:p-3' 
          : 'p-4 sm:p-5'
      }`} 
      id="company-header-container"
    >
      <div className="flex items-center gap-3 sm:gap-4" id="logo-branding-wrapper">
        {/* Visual Logo Uniproyect */}
        <div 
          className="bg-gradient-to-tr from-[#10B981] to-[#047857] text-white p-2 sm:p-2.5 rounded-xl border border-[#10B981]/25 shadow-md flex items-center justify-center shrink-0" 
          id="logo-icon-box"
        >
          <svg className="w-8 h-7 sm:w-10 sm:h-8 stroke-black text-black" viewBox="0 0 100 60" fill="none" strokeWidth="2.5" id="logo-svg">
            <path d="M5 45h90M10 45V30h12v15M25 45V20h14v25M42 45V35h10V25h12v20M67 45V32h8v13M78 45V37h10v8M42 25V18h14V8h8v37" strokeLinecap="round" strokeLinejoin="round" id="logo-svg-path" className="stroke-white"/>
          </svg>
        </div>
        <div>
          <div className="text-lg sm:text-xl tracking-tight font-display" id="uniproyect-brand">
            <span className="font-extrabold text-white text-xl sm:text-2xl">Uni</span>
            <span className="font-normal text-emerald-400 text-xl sm:text-2xl">proyect</span>
          </div>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-widest font-extrabold text-[#10B981] leading-tight">
            Control de Obras y Costes
          </p>
        </div>
      </div>
    </div>
  );
}
