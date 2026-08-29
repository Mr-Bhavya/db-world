import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, Container, Typography } from '@mui/material';
import {
  CloudOffRounded, LocationOffRounded, MapRounded, WbSunnyRounded,
} from '@mui/icons-material';
import { motion, useReducedMotion } from 'framer-motion';

import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import { Aurora, GlassPanel } from '@shared/ui/surfaces';
import Map from './Map';
import useWeatherLocation, { LocationError, LocationPermission } from './useWeatherLocation';
import { usePlaceSearch, useWeather } from './weatherApi';
import { getWeatherCity, saveWeatherCity } from './weatherPrefs';
import {
  AirQualityPanel, CurrentHero, DailyOutlook, DetailGrid, HourlyStrip, LocationDialog,
  PlaceSearch, SunArc, WeatherSkeleton,
} from './weatherParts';
import { skyWash } from './weatherVisuals';

/** Remembers a "not now" for the tab, so the prompt does not reappear on every visit to the page. */
const DISMISS_KEY = 'dbworld_weather_location_dismissed';

const wasDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

const rememberDismissal = () => {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Private mode. The prompt reappearing is a smaller problem than crashing here.
  }
};

const fade = (reduce, delay = 0) => ({
  initial: reduce ? false : { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
});

export default function WeatherPage() {
  usePageMeta('Weather', {
    description: 'Live local weather, hourly and 5-day forecasts, and air quality on DB World.',
  });

  const T = useT();
  const reduce = useReducedMotion();
  const geo = useWeatherLocation();

  /**
   * `null` means "follow the device". Anything else is a place the reader explicitly chose, and it
   * stays chosen until they press the locate button — a background GPS fix arriving late should not
   * yank them away from the city they just searched for.
   */
  const [selection, setSelection] = useState(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null);

  // Read once. Re-reading every render would let the write below change the query key mid-flight
  // and refetch the place we just fetched, whenever the geocoder's spelling differs from the
  // reader's ("Bombay" resolving to "Mumbai").
  const [storedCity] = useState(getWeatherCity);

  const following = selection === null;
  const coords = following ? geo.coords : selection.coords ?? null;
  const city = coords ? null : following ? storedCity : selection.city;

  // Hold the request while the device is still deciding, otherwise a granted-permission visitor
  // fetches their fallback city and then immediately fetches again for where they actually are.
  const awaitingFix = following
    && (geo.resolving || (geo.permission === LocationPermission.GRANTED && !geo.coords && geo.locating));

  const { data, isLoading, isFetching, isError, error, refetch } = useWeather({
    coords,
    city,
    enabled: !awaitingFix,
  });

  // Suggestions lag the keystrokes: a request per character would be six requests to spell "Mumbai".
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 300);
    return () => clearTimeout(timer);
  }, [input]);
  const { data: places, isFetching: searching } = usePlaceSearch(query);

  // Remember where they actually looked, so the home dashboard's tile opens on their place.
  useEffect(() => {
    if (data?.place?.name) saveWeatherCity(data.place.name);
  }, [data?.place?.name]);

  // Ask once per tab, and only when there is a decision left to make.
  useEffect(() => {
    if (geo.permission === LocationPermission.PROMPT && !geo.unavailable && !wasDismissed()) {
      setDialog({ reason: null });
    }
  }, [geo.permission, geo.unavailable]);

  const locate = useCallback(async () => {
    setSelection(null);
    setInput('');
    // Only interrupt with a dialog when the attempt failed — a success speaks for itself. The
    // reason comes back from the call rather than off `geo`, which is a render old by this point.
    const { error: reason } = await geo.request();
    if (reason) setDialog({ reason });
  }, [geo]);

  const allow = useCallback(async () => {
    setDialog(null);
    await locate();
  }, [locate]);

  const dismiss = useCallback(() => {
    setDialog(null);
    rememberDismissal();
  }, []);

  // Coordinates rather than the name: a geocoding hit is already the exact place, and sending the
  // name back would make the server resolve "London" all over again and possibly land on a
  // different one. The search box's own text is set by the Autocomplete from the picked option.
  const pickPlace = (place) => setSelection({ coords: { latitude: place.lat, longitude: place.lon } });

  const submit = () => {
    const typed = input.trim();
    if (typed) setSelection({ city: typed });
  };

  const sky = data?.current?.condition?.icon;
  const showSkeleton = isLoading || awaitingFix;

  return (
    <Box
      sx={{
        position: 'relative', bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary,
        pt: { xs: '56px', md: '64px' }, overflowX: 'hidden',
      }}
    >
      <Aurora />

      {/* The sky behind the header takes its colour from the actual conditions, so the page looks
          different in a thunderstorm than it does under clear skies. Kept to a band at the top:
          repainting the whole page would make this route look like another product. */}
      {sky && (
        <Box
          aria-hidden
          component={motion.div}
          key={sky}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9 }}
          sx={{
            position: 'fixed', top: 0, left: 0, right: 0, height: { xs: 320, md: 420 },
            zIndex: 0, pointerEvents: 'none', background: skyWash(sky, T.bg === '#000000'),
          }}
        />
      )}

      <LocationDialog
        open={Boolean(dialog)}
        reason={dialog?.reason ?? null}
        onAllow={allow}
        onDismiss={dismiss}
      />

      <Container
        maxWidth="md"
        sx={{ position: 'relative', zIndex: 1, py: { xs: 3, sm: 4, md: 5 }, px: { xs: 2, sm: 3 } }}
      >
        <motion.div {...fade(reduce)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: { xs: 2.5, md: 3 } }}>
            <Box
              sx={{
                width: { xs: 48, sm: 54 }, height: { xs: 48, sm: 54 }, flexShrink: 0, borderRadius: 3,
                display: 'grid', placeItems: 'center', bgcolor: T.tealBg,
                border: `1px solid ${T.teal}44`, boxShadow: `0 0 30px ${T.tealGlow}`,
              }}
            >
              <WbSunnyRounded sx={{ fontSize: { xs: 24, sm: 27 }, color: T.teal }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="h1"
                sx={{
                  fontSize: 'clamp(1.5rem, 6vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.03em',
                  lineHeight: 1.05, color: T.textPrimary,
                }}
              >
                Weather
              </Typography>
              <Typography sx={{ fontSize: 'clamp(0.82rem, 2.6vw, 0.95rem)', color: T.textMuted, mt: 0.35 }}>
                Conditions, hourly and 5-day outlook, anywhere
              </Typography>
            </Box>
          </Box>
        </motion.div>

        <motion.div {...fade(reduce, 0.06)}>
          <PlaceSearch
            value={input}
            onValueChange={setInput}
            options={places}
            loading={searching}
            onPick={pickPlace}
            onSubmit={submit}
            onLocate={locate}
            locating={geo.locating}
            locationBlocked={Boolean(geo.unavailable) || geo.permission === LocationPermission.DENIED}
          />

          {(geo.unavailable || geo.permission === LocationPermission.DENIED) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25, px: 0.5, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                icon={<LocationOffRounded sx={{ fontSize: 15 }} />}
                label="Location off"
                sx={{
                  bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}44`, fontWeight: 700,
                  '& .MuiChip-icon': { color: T.error },
                }}
              />
              <Typography sx={{ fontSize: '0.76rem', color: T.textMuted }}>
                Showing a searched city.
              </Typography>
              <Button
                size="small"
                onClick={() => setDialog({ reason: geo.unavailable ?? geo.error ?? LocationError.DENIED })}
                sx={{ fontSize: '0.74rem', fontWeight: 800, color: T.teal, minHeight: 0, py: 0.25 }}
              >
                Why?
              </Button>
            </Box>
          )}
        </motion.div>

        <Box sx={{ mt: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 } }}>
          {showSkeleton && <WeatherSkeleton />}

          {!showSkeleton && isError && (
            <GlassPanel sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
              <CloudOffRounded sx={{ fontSize: 44, color: T.textFaint }} />
              <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: T.textPrimary, mt: 1.5 }}>
                {error?.response?.status === 404 ? 'No such place' : 'Weather is unavailable'}
              </Typography>
              <Typography sx={{ fontSize: '0.88rem', color: T.textMuted, mt: 0.75, maxWidth: 380, mx: 'auto', lineHeight: 1.6 }}>
                {error?.response?.status === 404
                  ? 'Nothing matched that search. Check the spelling, or pick one of the suggestions as you type.'
                  : 'The weather service did not answer. This is usually brief — try again in a moment.'}
              </Typography>
              <Button
                onClick={() => refetch()}
                variant="contained"
                sx={{ mt: 2.5, bgcolor: T.teal, color: '#fff', fontWeight: 800, borderRadius: 2.5, minHeight: 44, px: 3, '&:hover': { bgcolor: T.tealHover } }}
              >
                Try again
              </Button>
            </GlassPanel>
          )}

          {!showSkeleton && data && (
            <>
              <motion.div {...fade(reduce, 0.1)}>
                <CurrentHero
                  place={data.place}
                  current={data.current}
                  today={data.daily?.[0]}
                  onRefresh={() => refetch()}
                  refreshing={isFetching}
                  live={following && Boolean(geo.coords)}
                />
              </motion.div>

              {data.hourly?.length > 0 && (
                <motion.div {...fade(reduce, 0.14)}>
                  <HourlyStrip hours={data.hourly} timezoneOffsetSeconds={data.place.timezoneOffsetSeconds} />
                </motion.div>
              )}

              {data.daily?.length > 0 && (
                <motion.div {...fade(reduce, 0.18)}>
                  <DailyOutlook days={data.daily} timezoneOffsetSeconds={data.place.timezoneOffsetSeconds} />
                </motion.div>
              )}

              <motion.div {...fade(reduce, 0.22)}>
                <DetailGrid current={data.current} />
              </motion.div>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: data.air ? '1fr 1fr' : '1fr' }, gap: { xs: 2, md: 2.5 } }}>
                <motion.div {...fade(reduce, 0.26)}>
                  <SunArc current={data.current} timezoneOffsetSeconds={data.place.timezoneOffsetSeconds} />
                </motion.div>
                {data.air && (
                  <motion.div {...fade(reduce, 0.3)}>
                    <AirQualityPanel air={data.air} />
                  </motion.div>
                )}
              </Box>

              <motion.div {...fade(reduce, 0.34)}>
                <GlassPanel sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.75 }}>
                    <MapRounded sx={{ fontSize: 18, color: T.teal }} />
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      On the map
                    </Typography>
                  </Box>
                  <Map lat={data.place.lat} lon={data.place.lon} name={data.place.name} />
                </GlassPanel>
              </motion.div>
            </>
          )}
        </Box>
      </Container>
    </Box>
  );
}
