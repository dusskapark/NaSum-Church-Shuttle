import { useEffect } from 'react';

export function useAppLoader(): void {
  // Remove app loading overlay
  useEffect(() => {
    const overlay = document.getElementById('app-loading');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.2s ease';
      setTimeout(() => overlay.remove(), 200);
    }
  }, []);
}