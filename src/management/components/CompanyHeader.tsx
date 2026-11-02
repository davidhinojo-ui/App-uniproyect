import React, { useState } from 'react';
import { Building2, Phone, Mail, MapPin, ChevronDown, ChevronUp } from 'lucide-react';

interface CompanyHeaderProps {
  compact?: boolean;
}

export default function CompanyHeader({ compact = false }: CompanyHeaderProps) {
  const [showFiscalDetails, setShowFiscalDetails] = useState(false);

  return (
    <div 
      className={`bg-[#0F0F12] rounded-2xl border border-white/[0.08] shadow-premium transition-all duration-300 w-full ${
        compact 
          ? 'p-3 sm:p-4' 
          : 'p-4 sm:p-6'
      }`} 
      id="company-header-container"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
        {/* Visual Logo Uniproyect */}
        <div className="flex items-center gap-3 sm:gap-4" id="logo-branding-wrapper">
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
              José Real Construcciones, S.L.
            </p>
          </div>
        </div>

        {/* Mobile toggle button for fiscal details */}
        <div className="flex md:hidden w-full justify-end">
          <button
            type="button"
            onClick={() => setShowFiscalDetails(!showFiscalDetails)}
            className="touch-target px-3 py-1.5 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            aria-expanded={showFiscalDetails}
            aria-controls="corporate-details-grid"
          >
            <Building2 className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="text-[11px] font-medium">
              {showFiscalDetails ? 'Ocultar datos fiscales' : 'Datos de empresa'}
            </span>
            {showFiscalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Corporate Details - always visible on md+, collapsible on mobile */}
        <div 
          className={`grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-xs text-white/70 font-sans border-t border-white/[0.06] md:border-t-0 md:border-l md:border-white/[0.1] md:pl-6 pt-3 md:pt-0 w-full md:w-auto ${
            showFiscalDetails ? 'grid' : 'hidden md:grid'
          }`} 
          id="corporate-details-grid"
        >
          <div className="flex items-center gap-2" id="detail-cif">
            <Building2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
            <div>
              <span className="font-semibold text-white/90">C.I.F:</span> <span className="font-mono text-white/80">B-56755085</span>
            </div>
          </div>
          <div className="flex items-center gap-2" id="detail-phone">
            <Phone className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
            <div>
              <span className="font-semibold text-white/90">Telf:</span> <span className="font-mono text-white/80">+34 640 37 27 27</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2" id="detail-address">
            <MapPin className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
            <div>
              <span className="font-semibold text-white/90">Dir:</span> C/ Amapola 8, 11.630, Arcos de la Frontera (Cádiz)
            </div>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2" id="detail-email">
            <Mail className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
            <div>
              <span className="font-semibold text-white/90 font-mono">Correo:</span> jrealconstruccion@gmail.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
