import React from 'react';
import { cn } from "../../lib/utils";

export const STSLogo = ({ className }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 200 280" 
      className={cn("w-10 h-10", className)} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Halo */}
      <circle cx="100" cy="27" r="9" stroke="currentColor" strokeWidth="6" fill="none" />
      
      {/* Head */}
      <circle cx="100" cy="62" r="20" stroke="currentColor" strokeWidth="7" fill="none" />
      <circle cx="109" cy="52" r="5" fill="currentColor" />
      
      {/* Left Wing */}
      <path d="M 80 50 C 45 45 30 40 30 48 C 45 70 65 72 80 64" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Right Wing */}
      <path d="M 120 50 C 155 45 170 40 170 48 C 155 70 135 72 120 64" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Central Body Flow */}
      <path d="M 100 82 C 125 105 125 145 92 180 C 85 155 95 140 105 120 C 112 105 108 92 100 82 Z" fill="currentColor" />
      
      {/* Left Little Flourish */}
      <path d="M 85 110 Q 75 130 84 155" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
      
      {/* e.V. text */}
      <text x="65" y="150" fontFamily="sans-serif" fontSize="16" fill="currentColor" textAnchor="middle">e.V.</text>
      
      {/* Triangle Base & Sites */}
      <line x1="30" y1="185" x2="170" y2="185" stroke="currentColor" strokeWidth="2" />
      <line x1="30" y1="185" x2="43" y2="160" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="170" y1="185" x2="145" y2="135" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      {/* STS */}
      <text x="60" y="222" fontFamily="sans-serif" fontSize="38" fill="currentColor" textAnchor="middle">S</text>
      <text x="100" y="222" fontFamily="sans-serif" fontSize="38" fill="currentColor" textAnchor="middle">T</text>
      <text x="140" y="222" fontFamily="sans-serif" fontSize="38" fill="currentColor" textAnchor="middle">S</text>
      
      {/* Divider */}
      <line x1="30" y1="233" x2="170" y2="233" stroke="currentColor" strokeWidth="3" />
      
      {/* MUSICALS */}
      <text x="100" y="260" fontFamily="sans-serif" fontSize="24" fontWeight="900" transform="scale(1, 1.2) translate(0, -4)" fill="currentColor" textAnchor="middle">MUSICALS</text>
      
      {/* Bottom Divider */}
      <line x1="30" y1="272" x2="170" y2="272" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
};
