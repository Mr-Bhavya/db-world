import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions,
  DialogContent, IconButton, InputAdornment, TextField, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import {
  LocationOnRounded, SearchRounded, MyLocationRounded, RefreshRounded, MapRounded,
  WbSunnyRounded, DarkModeRounded, CloudRounded, WbCloudyRounded, GrainRounded,
  BoltRounded, AcUnitRounded, BlurOnRounded, FilterDramaRounded, GpsFixedRounded,
  ThermostatRounded, WaterDropRounded, AirRounded, SpeedRounded,
  WbTwilightRounded, VisibilityRounded, NightlightRounded,
} from '@mui/icons-material';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import CommonServices from '@shared/services/CommonServices';
import Map from './Map';
import { notify } from '@shared/notify';
import { useT, getFieldSx } from '@shared/theme';
import usePageMeta from '@shared/hooks/usePageMeta';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { Aurora, GlassPanel } from '@shared/ui/surfaces';

const kelvinToC = (k) => Math.round(k - 273.15);

// OpenWeather icon code → MUI icon + accent colour (SVG, not emoji).
const weatherIcon = (code = '') => {
  const c = code.slice(0, 2);
  const night = code.endsWith('n');
  switch (c) {
    case '01': return night ? { Icon: DarkModeRounded, color: '#818cf8' } : { Icon: WbSunnyRounded, color: '#fbbf24' };
    case '02': return night ? { Icon: NightlightRounded, color: '#a5b4fc' } : { Icon: WbCloudyRounded, color: '#fbbf24' };
    case '03': return { Icon: CloudRounded, color: '#94a3b8' };
    case '04': return { Icon: FilterDramaRounded, color: '#94a3b8' };
    case '09':
    case '10': return { Icon: GrainRounded, color: '#38bdf8' };
    case '11': return { Icon: BoltRounded, color: '#fbbf24' };
    case '13': return { Icon: AcUnitRounded, color: '#7dd3fc' };
    case '50': return { Icon: BlurOnRounded, color: '#94a3b8' };
    default:   return { Icon: WbCloudyRounded, color: '#2dd4bf' };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Stat tile
// ─────────────────────────────────────────────────────────────────────────────
const StatTile = ({ icon: Icon, label, value, unit, T }) => (
  <Box
    sx={{
      p: { xs: 1.5, sm: 1.75 },
      display: 'flex',
      alignItems: 'center',
      gap: 1.25,
      borderRadius: 3,
      bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${T.glassBorder}`,
      minWidth: 0,
    }}
  >
    <Box sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: T.tealBg, color: T.teal }}>
      <Icon sx={{ fontSize: 19 }} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: T.textPrimary, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}{unit && <Box component="span" sx={{ fontSize: '0.72rem', color: T.textMuted, ml: 0.35 }}>{unit}</Box>}
      </Typography>
    </Box>
  </Box>
);

// ─────────────────────────────────────────────────────────────────────────────
// Location permission modal (works for web + Android)
// ─────────────────────────────────────────────────────────────────────────────
const PermissionModal = ({ open, denied, onAllow, onSkip, T }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onSkip}
      fullScreen={fullScreen}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: T.bg,
          backgroundImage: 'none',
          border: fullScreen ? 'none' : `1px solid ${T.glassBorder}`,
          borderRadius: fullScreen ? 0 : 4,
          m: fullScreen ? 0 : 2,
        },
      }}
    >
      <DialogContent sx={{ textAlign: 'center', px: { xs: 3, sm: 4 }, pt: { xs: 5, sm: 4 }, pb: 1 }}>
        <Box
          component={motion.div}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          sx={{
            width: 76, height: 76, mx: 'auto', mb: 2.5, borderRadius: '50%',
            display: 'grid', placeItems: 'center',
            bgcolor: T.tealBg, border: `1px solid ${T.teal}44`,
            boxShadow: `0 0 40px ${T.tealGlow}`,
          }}
        >
          <GpsFixedRounded sx={{ fontSize: 36, color: T.teal }} />
        </Box>

        <Typography sx={{ fontSize: '1.25rem', fontWeight: 900, color: T.textPrimary, mb: 1 }}>
          {denied ? 'Location is blocked' : 'Use your location?'}
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', color: T.textMuted, lineHeight: 1.6, maxWidth: 320, mx: 'auto' }}>
          {denied
            ? 'Location access is turned off. Enable it in your device or browser settings, or just search by city below.'
            : 'Allow location access for accurate weather where you are. You can always search by city instead — your location is never stored.'}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ flexDirection: 'column', gap: 1, px: { xs: 3, sm: 4 }, pb: { xs: 4, sm: 3.5 }, pt: 2, '& > button': { width: '100%', m: '0 !important' } }}>
        {!denied && (
          <Button
            onClick={onAllow}
            variant="contained"
            startIcon={<MyLocationRounded />}
            sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 800, minHeight: 48, borderRadius: 2.5, boxShadow: `0 10px 30px ${T.tealGlow}`, '&:hover': { bgcolor: '#0f766e' } }}
          >
            Allow Location
          </Button>
        )}
        <Button onClick={onSkip} sx={{ color: T.textMuted, fontWeight: 700, minHeight: 44, '&:hover': { color: T.textPrimary, bgcolor: T.hoverBg } }}>
          {denied ? 'Search by city instead' : 'Not now'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
function Weather() {
  usePageMeta('Weather', { description: 'Live local weather, current conditions and forecast on DB World.' });

  const T = useT();
  const FIELD = getFieldSx(T);
  const reduce = useReducedMotion();

  const [weatherData, setWeatherData] = useState(null);
  const [city, setCity] = useState('Pune');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permState, setPermState] = useState('prompt'); // granted | denied | prompt
  const [showModal, setShowModal] = useState(false);

  const fetchWeather = async (params) => {
    const res = await axiosInstance.get('/api/weather', { params });
    return res.data?.data ?? res.data;
  };

  const fetchByCity = useCallback(async (name) => {
    const q = name ?? city;
    setRefreshing(true);
    try {
      setWeatherData(await fetchWeather({ city: q }));
    } catch (err) {
      if (err?.response?.status === 404) notify.error('City not found. Please try another.');
      else notify.error('Failed to fetch weather. Check your connection.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [city]);

  const fetchByCoords = useCallback(async ({ latitude, longitude }) => {
    setRefreshing(true);
    try {
      setWeatherData(await fetchWeather({ lat: latitude, lon: longitude }));
    } catch {
      notify.error('Failed to fetch weather for your location.');
      await fetchByCity();
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchByCity]);

  const readPermState = async () => {
    try {
      const s = await Geolocation.checkPermissions();
      return s.location; // granted | denied | prompt | prompt-with-rationale
    } catch {
      return 'prompt';
    }
  };

  // Request permission (native) / trigger the browser prompt (web), then locate.
  const acquireAndFetch = useCallback(async () => {
    setRefreshing(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.requestPermissions();
        const ok = perm.location === 'granted' || perm.coarseLocation === 'granted';
        if (!ok) { setPermState('denied'); notify.error('Location permission denied.'); setRefreshing(false); return; }
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
      setPermState('granted');
      await fetchByCoords(pos.coords);
    } catch {
      setPermState('denied');
      notify.error('Could not get your location. Showing a default city.');
      fetchByCity();
    }
  }, [fetchByCoords, fetchByCity]);

  // On mount: show a default city right away, then prime for geolocation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await readPermState();
      if (cancelled) return;
      setPermState(state);
      if (state === 'granted') {
        acquireAndFetch();
      } else {
        fetchByCity();
        if (state !== 'denied') setShowModal(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => { e.preventDefault(); if (city.trim()) fetchByCity(); };

  const onLocateClick = () => {
    if (permState === 'denied') setShowModal(true);
    else acquireAndFetch();
  };

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ position: 'relative', bgcolor: T.bg, minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Aurora />
        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress sx={{ color: T.teal }} size={46} />
          <Typography sx={{ color: T.textMuted, fontSize: '0.9rem' }}>Loading weather…</Typography>
        </Box>
      </Box>
    );
  }

  const hero = weatherData ? weatherIcon(weatherData.weather?.[0]?.icon) : null;

  return (
    <Box sx={{ position: 'relative', bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary, pt: { xs: '56px', md: '64px' }, overflowX: 'hidden' }}>
      <Aurora />

      <PermissionModal
        open={showModal}
        denied={permState === 'denied'}
        onAllow={() => { setShowModal(false); acquireAndFetch(); }}
        onSkip={() => setShowModal(false)}
        T={T}
      />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, py: { xs: 3, sm: 4, md: 6 }, px: { xs: 2, sm: 3 } }}>
        {/* Header */}
        <motion.div initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: { xs: 2.5, md: 3 } }}>
            <Box sx={{ width: { xs: 48, sm: 54 }, height: { xs: 48, sm: 54 }, flexShrink: 0, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: T.tealBg, border: `1px solid ${T.teal}44`, boxShadow: `0 0 30px ${T.tealGlow}` }}>
              <WbSunnyRounded sx={{ fontSize: { xs: 24, sm: 27 }, color: T.teal }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 'clamp(1.5rem, 6vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, color: T.textPrimary }}>
                Weather
              </Typography>
              <Typography sx={{ fontSize: 'clamp(0.82rem, 2.6vw, 0.95rem)', color: T.textMuted, mt: 0.35 }}>
                Live conditions for any location
              </Typography>
            </Box>
          </Box>
        </motion.div>

        {/* Search */}
        <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <GlassPanel sx={{ p: { xs: 1.25, sm: 1.5 }, mb: { xs: 2.5, md: 3 } }}>
            <Box component="form" onSubmit={handleSearch} sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search a city…"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ fontSize: 19, color: T.textMuted }} /></InputAdornment>) }}
                sx={FIELD}
              />
              <Button type="submit" variant="contained" disabled={refreshing} sx={{ bgcolor: T.teal, color: '#fff', fontWeight: 800, px: { xs: 2, sm: 2.5 }, minHeight: 44, borderRadius: 2, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#0f766e' }, '&.Mui-disabled': { bgcolor: T.tealBg } }}>
                {refreshing ? <CircularProgress size={16} color="inherit" /> : 'Search'}
              </Button>
              <IconButton
                onClick={onLocateClick}
                disabled={refreshing}
                aria-label="Use my location"
                title="Use my location"
                sx={{ width: 44, height: 44, borderRadius: 2, border: `1px solid ${permState === 'denied' ? T.error : T.teal}`, color: permState === 'denied' ? T.error : T.teal, '&:hover': { bgcolor: T.tealBg } }}
              >
                <MyLocationRounded sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>

            {permState === 'denied' && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
                <Chip size="small" icon={<LocationOnRounded sx={{ fontSize: 15 }} />} label="Location off" sx={{ bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}44`, fontWeight: 700, '& .MuiChip-icon': { color: T.error } }} />
                <Typography sx={{ fontSize: '0.76rem', color: T.textMuted }}>Searching by city — enable location to auto-detect.</Typography>
              </Box>
            )}
          </GlassPanel>
        </motion.div>

        {/* Weather card */}
        <AnimatePresence mode="wait">
          {weatherData && (
            <motion.div
              key={weatherData.name}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              <GlassPanel sx={{ p: { xs: 2.5, sm: 3, md: 3.5 }, mb: { xs: 2.5, md: 3 }, overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                      <LocationOnRounded sx={{ fontSize: 18, color: T.teal }} />
                      <Typography sx={{ fontSize: 'clamp(1.1rem, 4vw, 1.4rem)', fontWeight: 800, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {weatherData.name}{weatherData.sys?.country ? `, ${weatherData.sys.country}` : ''}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 'clamp(3rem, 15vw, 4.5rem)', fontWeight: 900, color: T.teal, lineHeight: 0.95, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                      {kelvinToC(weatherData.main.temp)}°
                    </Typography>
                    <Typography sx={{ fontSize: '0.95rem', color: T.textMuted, textTransform: 'capitalize', mt: 0.5 }}>
                      {weatherData.weather?.[0]?.description}
                    </Typography>
                    <Chip size="small" label={CommonServices.getTimeDateFromTimeStamp(weatherData.dt * 1000).date} sx={{ mt: 1.5, bgcolor: T.tealBg, color: T.teal, border: `1px solid ${T.teal}33`, fontWeight: 700 }} />
                  </Box>

                  {hero && (
                    <Box
                      component={motion.div}
                      initial={reduce ? false : { scale: 0.7, opacity: 0, rotate: -8 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.1 }}
                      sx={{ ml: 'auto' }}
                    >
                      <hero.Icon sx={{ fontSize: 'clamp(76px, 22vw, 132px)', color: hero.color, filter: `drop-shadow(0 0 26px ${hero.color}55)` }} />
                    </Box>
                  )}
                </Box>

                {/* Stats */}
                <Box sx={{ mt: { xs: 2.5, md: 3 }, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: { xs: 1.25, sm: 1.5 } }}>
                  {[
                    { icon: ThermostatRounded, label: 'Feels', value: kelvinToC(weatherData.main.feels_like), unit: '°C' },
                    { icon: WaterDropRounded,  label: 'Humidity', value: weatherData.main.humidity, unit: '%' },
                    { icon: AirRounded,        label: 'Wind', value: weatherData.wind?.speed ?? 0, unit: 'm/s' },
                    { icon: SpeedRounded,      label: 'Pressure', value: weatherData.main.pressure, unit: 'hPa' },
                    { icon: WbTwilightRounded, label: 'Sunrise', value: CommonServices.getTimeDateFromTimeStamp(weatherData.sys.sunrise * 1000).time },
                    { icon: NightlightRounded, label: 'Sunset', value: CommonServices.getTimeDateFromTimeStamp(weatherData.sys.sunset * 1000).time },
                    { icon: VisibilityRounded, label: 'Visibility', value: (weatherData.visibility / 1000).toFixed(1), unit: 'km' },
                    { icon: CloudRounded,      label: 'Clouds', value: weatherData.clouds?.all ?? 0, unit: '%' },
                  ].map((s) => (
                    <StatTile key={s.label} {...s} T={T} />
                  ))}
                </Box>

                <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'center' }}>
                  <Button
                    startIcon={refreshing ? <CircularProgress size={14} color="inherit" /> : <RefreshRounded />}
                    onClick={() => (permState === 'granted' ? acquireAndFetch() : fetchByCity())}
                    disabled={refreshing}
                    sx={{ color: T.textMuted, fontWeight: 700, minHeight: 44, borderRadius: 2, px: 2, border: `1px solid ${T.glassBorder}`, '&:hover': { color: T.teal, borderColor: T.teal, bgcolor: T.tealBg } }}
                  >
                    Refresh
                  </Button>
                </Box>
              </GlassPanel>

              {/* Map */}
              {weatherData.coord && (
                <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <GlassPanel sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <MapRounded sx={{ fontSize: 18, color: T.teal }} />
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: T.textPrimary }}>Location on map</Typography>
                    </Box>
                    <Map lat={weatherData.coord.lat} lon={weatherData.coord.lon} name={weatherData.name} />
                  </GlassPanel>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </Box>
  );
}

export default Weather;
