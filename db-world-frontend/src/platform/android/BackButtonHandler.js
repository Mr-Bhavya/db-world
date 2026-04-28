import React, { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';

const BackButtonHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let backButtonCleanup;
    let lastFired = 0; // debounce — gesture nav can fire events twice in quick succession

    const setupListener = async () => {
      const listener = await App.addListener(‘backButton’, () => {
        const now = Date.now();
        if (now - lastFired < 400) return; // ignore duplicate within 400 ms
        lastFired = now;
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          App.exitApp();
        }
      });

      // If the returned listener has a remove method, store a cleanup function for it.
      // Otherwise, assume listener is already the cleanup function.
      if (listener && typeof listener.remove === 'function') {
        backButtonCleanup = () => listener.remove();
      } else {
        backButtonCleanup = listener;
      }
    };

    setupListener();

    return () => {
      if (backButtonCleanup) {
        // If backButtonCleanup is a function, call it to remove the listener.
        if (typeof backButtonCleanup === 'function') {
          backButtonCleanup();
        } else if (backButtonCleanup && typeof backButtonCleanup.remove === 'function') {
          backButtonCleanup.remove();
        }
      }
    };
  }, [navigate]);

  return null;
};

export default BackButtonHandler;