import { useEffect, useState } from 'react';

const MOBILE_MAX = 768;

function getIsMobile() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= MOBILE_MAX;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    function onResize() { setIsMobile(getIsMobile()); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile;
}
