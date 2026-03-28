// useDynamicCSS.js - Custom hook for dynamic CSS injection
import { useEffect, useRef } from 'react';

/**
 * Hook to inject dynamic CSS styles into the document head
 * @param {string} css - The CSS string to inject
 * @param {string} id - Unique ID for the style element
 * @param {boolean} shouldCleanup - Whether to remove styles on unmount
 */
export const useDynamicCSS = (css, id, shouldCleanup = true) => {
  const styleRef = useRef(null);

  useEffect(() => {
    // Create or update style element
    let style = document.getElementById(id);
    
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      style.setAttribute('data-dynamic-css', 'true');
      document.head.appendChild(style);
      styleRef.current = style;
    }
    
    // Update CSS content
    style.textContent = css;
    
    // Cleanup function
    return () => {
      if (shouldCleanup && styleRef.current) {
        document.head.removeChild(styleRef.current);
        styleRef.current = null;
      }
    };
  }, [css, id, shouldCleanup]);

  return styleRef;
};