import { useEffect } from 'react';

/**
 * Custom hook to lock body and main container scroll when a modal/popup is active
 * @param {boolean} isOpen - Whether the modal or popup is open
 */
export default function useScrollLock(isOpen) {
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = window.getComputedStyle(document.body).overflow;
    const originalHtmlOverflow = window.getComputedStyle(document.documentElement).overflow;
    const mainEl = document.querySelector('main');
    let originalMainOverflow = '';

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    if (mainEl) {
      originalMainOverflow = window.getComputedStyle(mainEl).overflow;
      mainEl.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      if (mainEl) {
        mainEl.style.overflow = originalMainOverflow;
      }
    };
  }, [isOpen]);
}
