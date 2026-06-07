import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import Constants from '@shared/constants';

// Root routes where Back should EXIT the app (double-press) instead of navigating.
const EXIT_ROUTES = new Set([
  Constants.DB_WORLD_HOME_ROUTE,
  Constants.LOGIN_ROUTE,
]);

const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();

  // The native listener is registered once; read live values through refs so it
  // always sees the CURRENT route (not the one captured at registration time).
  const locationRef = useRef(location);
  locationRef.current = location;
  const lastFiredRef = useRef(0);
  const exitArmedRef = useRef(false);

  useEffect(() => {
    let cleanup;
    App.addListener('backButton', () => {
      // Gesture-nav can fire the event twice in quick succession — dedupe.
      const now = Date.now();
      if (now - lastFiredRef.current < 450) return;
      lastFiredRef.current = now;

      const path = locationRef.current.pathname;
      if (EXIT_ROUTES.has(path)) {
        // Double-press to exit from the home/login screen.
        if (exitArmedRef.current) { App.exitApp(); return; }
        exitArmedRef.current = true;
        enqueueSnackbar('Press back again to exit', { variant: 'default', autoHideDuration: 2000 });
        setTimeout(() => { exitArmedRef.current = false; }, 2000);
      } else {
        navigate(-1);
      }
    }).then((l) => { cleanup = l; });

    return () => { cleanup?.remove?.(); };
  }, [navigate, enqueueSnackbar]);

  return null;
};

export default BackButtonHandler;
