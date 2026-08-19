"use client";

import { useState, useEffect } from 'react';

/**
 * Responsive breakpoint hook for ObraSaaS.
 * Returns { isMobile, isTablet, isDesktop } based on window width.
 * 
 * Breakpoints:
 * - mobile:  ≤ 768px
 * - tablet:  769px – 1024px  
 * - desktop: > 1024px
 */
export function useBreakpoint() {
  const [bp, setBp] = useState({ isMobile: false, isTablet: false, isDesktop: true });

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      setBp({
        isMobile: w <= 768,
        isTablet: w > 768 && w <= 1024,
        isDesktop: w > 1024
      });
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return bp;
}
