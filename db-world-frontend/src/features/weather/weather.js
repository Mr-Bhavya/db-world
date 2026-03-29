import React, { useState, useEffect } from 'react';
import {
  Box, Button, Chip, CircularProgress, Container, Dialog,
  DialogActions, DialogContent, DialogContentText, DialogTitle,
  Divider, Grid, IconButton, InputAdornment, TextField, Typography,
} from '@mui/material';
import {
  LocationOn, Refresh, Search, GpsFixed, MapOutlined,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import CommonServices from '@shared/services/CommonServices';
import Map from './Map';
import { toast } from '@shared/components/ui/Toast';
import { useT, getFieldSx, getGlowProps } from '@shared/theme';

const WEATHER_ICONS = {
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '⛅',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️',
  '10d': '🌦️', '10n': '🌦️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️',
};

const kelvinToCelsius = (k) => Math.round(k - 273.15);

const StatCard = ({ emoji, label, value, unit }) => {
  const T = useT();
  return (
    <Box sx={{
      p: 2, textAlign: 'center',
      bgcolor: T.glass,
      border: `1px solid ${T.glassBorder}`,
      borderRadius: 2,
    }}>
      <Typography sx={{ fontSize: '1.4rem', mb: 0.5 }}>{emoji}</Typography>
      <Typography sx={{ fontSize: '0.72rem', color: T.textMuted, mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: T.textPrimary }}>
        {value}{unit && <Box component="span" sx={{ fontSize: '0.75rem', color: T.textMuted, ml: 0.25 }}>{unit}</Box>}
      </Typography>
    </Box>
  );
};

function Weather() {
  const T     = useT();
  const FIELD = getFieldSx(T);
  const GLOW  = getGlowProps(T);

  const [weatherData,      setWeatherData]      = useState(null);
  const [city,             setCity]             = useState('Pune');
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showDialog,       setShowDialog]       = useState(false);

  const fetchByCity = async () => {
    setRefreshing(true);
    try {
      const res  = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=5ac693a87e8bebb7c7b40655e85dde50`);
      const data = await res.json();
      if (res.status === 200) setWeatherData(data);
      else toast.error('City not found. Please try another location.');
    } catch {
      toast.error('Failed to fetch weather data. Please check your connection.');
    }
    setRefreshing(false);
    setLoading(false);
  };

  const fetchByCoords = async (coords) => {
    setLoading(true);
    try {
      const res  = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${coords.latitude}&lon=${coords.longitude}&appid=5ac693a87e8bebb7c7b40655e85dde50`);
      const data = await res.json();
      if (res.status === 200) { setWeatherData(data); setPermissionDenied(false); }
      else { toast.error('Unable to get location data.'); fetchByCity(); }
    } catch {
      toast.error('Failed to fetch location data.');
      fetchByCity();
    }
    setLoading(false);
  };

  const checkPermission = async () => {
    if (!navigator.permissions) return 'prompt';
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    } catch {
      return 'prompt';
    }
  };

  const getLocation = async (forcePrompt = false) => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported.'); fetchByCity(); return; }
    const state = await checkPermission();
    if (state === 'denied' && !forcePrompt) {
      setPermissionDenied(true);
      setShowDialog(true);
      fetchByCity();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchByCoords(pos.coords),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) { setPermissionDenied(true); setShowDialog(true); }
        else toast.error('Failed to get location. Using default city.');
        fetchByCity();
      },
      { timeout: 10000 }
    );
  };

  useEffect(() => { getLocation(); }, []);

  const handleSearch = (e) => { e.preventDefault(); fetchByCity(); };

  if (loading) {
    return (
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', gap: 2,
        bgcolor: T.bg,
      }}>
        <CircularProgress sx={{ color: T.teal }} size={48} />
        <Typography sx={{ color: T.textMuted, fontSize: '0.9rem' }}>Loading weather data...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary,
      pt: { xs: '56px', md: '64px' },
    }}>
      <motion.div {...GLOW} />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 4, md: 6 } }}>

        {/* Location permission dialog */}
        <Dialog
          open={showDialog}
          onClose={() => setShowDialog(false)}
          PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 3, color: T.textPrimary } }}
        >
          <DialogTitle sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pb: 1 }}>
            <GpsFixed sx={{ fontSize: 36, color: T.teal }} />
            <Typography sx={{ fontWeight: 700, color: T.textPrimary }}>Location Access</Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: T.textMuted, textAlign: 'center', fontSize: '0.875rem' }}>
              Allow location access for accurate local weather. You can also search by city name manually.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 3, gap: 1 }}>
            <Button onClick={() => setShowDialog(false)} sx={{ color: T.textMuted, '&:hover': { color: T.textPrimary } }}>
              Skip
            </Button>
            <Button
              onClick={() => { setShowDialog(false); getLocation(true); }}
              variant="contained"
              sx={{ bgcolor: T.teal, color: '#fff', '&:hover': { bgcolor: T.tealHover } }}
            >
              Allow Location
            </Button>
          </DialogActions>
        </Dialog>

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography sx={{
              fontWeight: 800, fontSize: { xs: '1.75rem', md: '2.25rem' },
              letterSpacing: '-0.02em', color: T.textPrimary,
            }}>
              🌤️ Weather
            </Typography>
            <Typography sx={{ color: T.textMuted, fontSize: '0.9rem', mt: 0.5 }}>
              Real-time weather for any location
            </Typography>
          </Box>
        </motion.div>

        {/* Search bar */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Box
            component="form"
            onSubmit={handleSearch}
            sx={{
              display: 'flex', gap: 1, mb: 4,
              p: 2.5,
              bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 3,
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Enter city name..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 18, color: T.textMuted }} />
                  </InputAdornment>
                ),
              }}
              sx={FIELD}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={refreshing}
              sx={{
                bgcolor: T.teal, color: '#fff', fontWeight: 600, px: 3,
                whiteSpace: 'nowrap', borderRadius: 1.5,
                '&:hover': { bgcolor: T.tealHover },
                '&:disabled': { bgcolor: T.tealBg },
              }}
            >
              {refreshing ? <CircularProgress size={16} color="inherit" /> : 'Search'}
            </Button>
            <IconButton
              onClick={() => getLocation(true)}
              disabled={refreshing}
              title="Use current location"
              sx={{
                border: `1px solid ${permissionDenied ? T.error : T.teal}`,
                color: permissionDenied ? T.error : T.teal,
                borderRadius: 1.5,
                '&:hover': { bgcolor: T.tealBg },
              }}
            >
              <LocationOn sx={{ fontSize: 20 }} />
            </IconButton>
            {permissionDenied && (
              <Chip
                label="Location denied"
                size="small"
                sx={{
                  bgcolor: T.errorBg, color: T.error,
                  border: `1px solid ${T.error}44`, alignSelf: 'center',
                }}
              />
            )}
          </Box>
        </motion.div>

        {/* Weather card */}
        <AnimatePresence mode="wait">
          {weatherData && (
            <motion.div
              key={weatherData.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <Box sx={{
                p: { xs: 3, md: 4 },
                bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 3,
                mb: 3,
              }}>
                {/* Location + main temp */}
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={7}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <LocationOn sx={{ fontSize: 18, color: T.teal }} />
                      <Typography sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 700, color: T.textPrimary }}>
                        {weatherData.name}, {weatherData.sys.country}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Typography sx={{ fontSize: '3.5rem', lineHeight: 1 }}>
                        {WEATHER_ICONS[weatherData.weather[0].icon] || '🌤️'}
                      </Typography>
                      <Box>
                        <Typography sx={{ fontSize: { xs: '2.5rem', md: '3rem' }, fontWeight: 800, color: T.teal, lineHeight: 1 }}>
                          {kelvinToCelsius(weatherData.main.temp)}°C
                        </Typography>
                        <Typography sx={{ fontSize: '0.9rem', color: T.textMuted, textTransform: 'capitalize' }}>
                          {weatherData.weather[0].description}
                        </Typography>
                      </Box>
                    </Box>

                    <Chip
                      label={CommonServices.getTimeDateFromTimeStamp(weatherData.dt * 1000).date}
                      size="small"
                      sx={{
                        bgcolor: T.tealBg, color: T.teal,
                        border: `1px solid ${T.tealBg}`, fontWeight: 600,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={5} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={`https://openweathermap.org/img/w/${weatherData.weather[0].icon}.png`}
                      alt={weatherData.weather[0].description}
                      style={{
                        width: 100, height: 100,
                        filter: 'drop-shadow(0 0 12px rgba(13,148,136,0.4))',
                      }}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3, borderColor: T.border }} />

                {/* Stats grid */}
                <Grid container spacing={1.5}>
                  {[
                    { emoji: '🌡️', label: 'Feels Like', value: kelvinToCelsius(weatherData.main.feels_like), unit: '°C'  },
                    { emoji: '💧', label: 'Humidity',   value: weatherData.main.humidity,                     unit: '%'   },
                    { emoji: '💨', label: 'Wind',        value: weatherData.wind.speed,                        unit: 'm/s' },
                    { emoji: '📊', label: 'Pressure',    value: weatherData.main.pressure,                     unit: 'hPa' },
                    { emoji: '🌅', label: 'Sunrise',     value: CommonServices.getTimeDateFromTimeStamp(weatherData.sys.sunrise * 1000).time, unit: '' },
                    { emoji: '🌇', label: 'Sunset',      value: CommonServices.getTimeDateFromTimeStamp(weatherData.sys.sunset  * 1000).time, unit: '' },
                    { emoji: '👀', label: 'Visibility',  value: (weatherData.visibility / 1000).toFixed(1),    unit: 'km'  },
                    { emoji: '☁️', label: 'Cloudiness',  value: weatherData.clouds?.all ?? 0,                  unit: '%'   },
                  ].map((s) => (
                    <Grid key={s.label} item xs={6} sm={3}>
                      <StatCard {...s} />
                    </Grid>
                  ))}
                </Grid>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    startIcon={refreshing ? <CircularProgress size={14} color="inherit" /> : <Refresh />}
                    onClick={() => getLocation(true)}
                    disabled={refreshing}
                    sx={{
                      borderColor: T.glassBorder, color: T.textMuted,
                      '&:hover': { borderColor: T.teal, color: T.teal, bgcolor: T.tealBg },
                    }}
                  >
                    Refresh
                  </Button>
                </Box>
              </Box>

              {/* Map */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Box sx={{
                  p: { xs: 2, md: 3 },
                  bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 3,
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <MapOutlined sx={{ fontSize: 18, color: T.teal }} />
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: T.textPrimary }}>
                      Location on Map
                    </Typography>
                  </Box>
                  <Map lat={weatherData.coord.lat} lon={weatherData.coord.lon} name={weatherData.name} />
                </Box>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Note */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <Box sx={{ mt: 3, p: 2, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 2 }}>
            <Typography sx={{ fontSize: '0.78rem', color: T.textFaint }}>
              Allow location permissions in your browser for accurate local weather data.
            </Typography>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
}

export default Weather;
