import React, { useMemo } from 'react';
import {
  Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  IconButton, InputAdornment, Skeleton, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import {
  AirRounded, CompressRounded, ExploreRounded, GpsFixedRounded, LocationOnRounded,
  MyLocationRounded, NavigationRounded, OpacityRounded, RefreshRounded, SearchRounded,
  ThermostatRounded, UmbrellaRounded, VisibilityRounded, WbTwilightRounded,
} from '@mui/icons-material';
import { motion, useReducedMotion } from 'framer-motion';

import { useT, getFieldSx } from '@shared/theme';
import { GlassPanel } from '@shared/ui/surfaces';
import { LocationError } from './useWeatherLocation';
import {
  aqiVisual, compassPoint, conditionVisual, dateLabel, dayLabel, placeDayKeys, placeHour,
  placeTime, POLLUTANT_LABELS, temperatureColor, windDescription,
} from './weatherVisuals';

const round = (value) => (Number.isFinite(value) ? Math.round(value) : null);
const clamp01 = (value) => Math.max(0, Math.min(1, value));

/** Section heading — one shape for every panel so the page reads as a single document. */
function SectionTitle({ icon: Icon, children, action }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.75 }}>
      <Icon sx={{ fontSize: 18, color: T.teal }} />
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </Typography>
      {action && <Box sx={{ ml: 'auto' }}>{action}</Box>}
    </Box>
  );
}

// -- Search -------------------------------------------------------------------

/**
 * City search with server-side suggestions, plus the "use my location" button.
 *
 * `freeSolo` so pressing Enter on a plain string still searches: the geocoder is a convenience,
 * not a gate, and it should never be the reason a real place cannot be looked up.
 */
export function PlaceSearch({
  value, onValueChange, options, loading, onPick, onSubmit,
  onLocate, locating, locationBlocked,
}) {
  const T = useT();
  const FIELD = getFieldSx(T);

  const label = (place) =>
    typeof place === 'string'
      ? place
      : [place.name, place.state, place.country].filter(Boolean).join(', ');

  return (
    <GlassPanel sx={{ p: { xs: 1.25, sm: 1.5 } }}>
      <Box
        component="form"
        onSubmit={(event) => { event.preventDefault(); onSubmit(); }}
        sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}
      >
        <Autocomplete
          freeSolo
          fullWidth
          size="small"
          options={options ?? []}
          filterOptions={(x) => x}
          getOptionLabel={label}
          // Two hits can share a label (same name, same state), and the default key is the label —
          // so the key has to come from the one thing that is genuinely unique: the coordinates.
          renderOption={({ key: _key, ...rest }, place) => (
            <li key={`${place.lat},${place.lon}`} {...rest}>{label(place)}</li>
          )}
          loading={loading}
          inputValue={value}
          onInputChange={(event, next) => onValueChange(next)}
          onChange={(event, picked) => { if (picked && typeof picked !== 'string') onPick(picked); }}
          slotProps={{
            paper: {
              sx: {
                bgcolor: T.sidebar,
                border: `1px solid ${T.glassBorder}`,
                backgroundImage: 'none',
                '& .MuiAutocomplete-option': { color: T.textPrimary, fontSize: '0.88rem' },
                '& .MuiAutocomplete-option[aria-selected="true"], & .MuiAutocomplete-option.Mui-focused': {
                  bgcolor: T.tealBg,
                },
              },
            },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search a city…"
              sx={FIELD}
              slotProps={{
                input: {
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded sx={{ fontSize: 19, color: T.textMuted }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress size={15} sx={{ color: T.textMuted }} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />

        <Tooltip title={locationBlocked ? 'Location unavailable' : 'Use my location'}>
          <Box component="span">
            <IconButton
              onClick={onLocate}
              disabled={locating}
              aria-label="Use my location"
              sx={{
                width: 44, height: 44, borderRadius: 2,
                border: `1px solid ${locationBlocked ? T.error : T.teal}`,
                color: locationBlocked ? T.error : T.teal,
                '&:hover': { bgcolor: locationBlocked ? T.errorBg : T.tealBg },
              }}
            >
              {locating ? <CircularProgress size={17} color="inherit" /> : <MyLocationRounded sx={{ fontSize: 20 }} />}
            </IconButton>
          </Box>
        </Tooltip>
      </Box>
    </GlassPanel>
  );
}

// -- Current conditions -------------------------------------------------------

export function CurrentHero({ place, current, today, onRefresh, refreshing, live }) {
  const T = useT();
  const visual = conditionVisual(current.condition?.icon);

  // The current-conditions payload's own min/max are "lowest and highest reported right now across
  // the reporting area" — a couple of degrees apart, and nothing to do with the day's range. Read
  // next to a forecast row saying 28°/23°, a hero claiming 26°/25° just looks broken. The folded
  // forecast day is the real high and low, so prefer it.
  const high = today ? today.maxC : current.maxC;
  const low = today ? today.minC : current.minC;

  return (
    <GlassPanel sx={{ p: { xs: 2.5, sm: 3, md: 3.5 }, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
        <Box sx={{ minWidth: 0, flex: '1 1 220px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
            <LocationOnRounded sx={{ fontSize: 18, color: T.teal }} />
            <Typography
              component="h2"
              sx={{
                fontSize: 'clamp(1.1rem, 4vw, 1.45rem)', fontWeight: 800, color: T.textPrimary,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {place.name}{place.country ? `, ${place.country}` : ''}
            </Typography>
            {live && (
              <Chip
                size="small"
                icon={<GpsFixedRounded sx={{ fontSize: 13 }} />}
                label="Your location"
                sx={{
                  height: 22, fontSize: '0.65rem', fontWeight: 800, bgcolor: T.tealBg, color: T.teal,
                  border: `1px solid ${T.teal}33`, '& .MuiChip-icon': { color: T.teal },
                }}
              />
            )}
          </Box>

          <Typography
            sx={{
              fontSize: 'clamp(3.2rem, 16vw, 5rem)', fontWeight: 900, lineHeight: 0.92,
              letterSpacing: '-0.045em', color: T.textPrimary, fontVariantNumeric: 'tabular-nums',
            }}
          >
            {round(current.tempC)}°
          </Typography>

          <Typography sx={{ fontSize: '1rem', color: T.textMuted, textTransform: 'capitalize', mt: 0.75, fontWeight: 600 }}>
            {current.condition?.description}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1.25 }}>
            <Typography sx={{ fontSize: '0.82rem', color: T.textMuted, fontWeight: 700 }}>
              Feels like {round(current.feelsLikeC)}°
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: T.textFaint, fontWeight: 700 }}>
              H {round(high)}° · L {round(low)}°
            </Typography>
          </Box>
        </Box>

        <Box
          component={motion.div}
          initial={{ scale: 0.75, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 190, damping: 16, delay: 0.08 }}
          sx={{ ml: 'auto', flexShrink: 0 }}
        >
          <visual.Icon
            sx={{
              fontSize: 'clamp(84px, 24vw, 150px)',
              color: visual.color,
              filter: `drop-shadow(0 0 30px ${visual.color}55)`,
            }}
          />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2.5, pt: 2, borderTop: `1px solid ${T.glassBorder}` }}>
        <Typography sx={{ fontSize: '0.74rem', color: T.textFaint, fontWeight: 700 }}>
          Updated {placeTime(current.observedAtEpoch, place.timezoneOffsetSeconds)} local time
        </Typography>
        <Button
          size="small"
          onClick={onRefresh}
          disabled={refreshing}
          startIcon={refreshing ? <CircularProgress size={13} color="inherit" /> : <RefreshRounded sx={{ fontSize: 16 }} />}
          sx={{
            ml: 'auto', color: T.textMuted, fontWeight: 700, borderRadius: 2, px: 1.5, minHeight: 34,
            '&:hover': { color: T.teal, bgcolor: T.tealBg },
          }}
        >
          Refresh
        </Button>
      </Box>
    </GlassPanel>
  );
}

// -- Hourly -------------------------------------------------------------------

const HOUR_TILE_WIDTH = 74;

/**
 * The next three days in 3-hour steps.
 *
 * The curve behind the tiles is the point of this strip: a column of numbers makes you compare
 * them one at a time, whereas the line shows the shape of the day — where it peaks, when it drops —
 * before you have read a single figure.
 */
export function HourlyStrip({ hours, timezoneOffsetSeconds }) {
  const T = useT();

  const curve = useMemo(() => {
    if (hours.length < 2) return null;
    const temps = hours.map((hour) => hour.tempC);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const span = max - min || 1;
    const height = 34;
    const points = temps
      .map((temp, index) => {
        const x = index * HOUR_TILE_WIDTH + HOUR_TILE_WIDTH / 2;
        const y = height - ((temp - min) / span) * height;
        return `${x},${y.toFixed(1)}`;
      })
      .join(' ');
    return { points, width: hours.length * HOUR_TILE_WIDTH, height };
  }, [hours]);

  return (
    <GlassPanel sx={{ p: { xs: 2, md: 2.5 } }}>
      <SectionTitle icon={ThermostatRounded}>Next hours</SectionTitle>

      <Box
        sx={{
          overflowX: 'auto', overflowY: 'hidden', pb: 0.5,
          scrollbarWidth: 'thin', scrollbarColor: `${T.scrollThumb} transparent`,
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 3 },
        }}
      >
        <Box sx={{ position: 'relative', width: hours.length * HOUR_TILE_WIDTH, minWidth: '100%' }}>
          {curve && (
            <Box
              component="svg"
              aria-hidden
              viewBox={`0 0 ${curve.width} ${curve.height}`}
              preserveAspectRatio="none"
              sx={{ position: 'absolute', top: 44, left: 0, width: curve.width, height: curve.height, pointerEvents: 'none' }}
            >
              <polyline points={curve.points} fill="none" stroke={T.teal} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
            </Box>
          )}

          <Box sx={{ display: 'flex' }}>
            {hours.map((hour) => {
              const visual = conditionVisual(hour.condition?.icon);
              return (
                <Box
                  key={hour.atEpoch}
                  sx={{ width: HOUR_TILE_WIDTH, flexShrink: 0, textAlign: 'center', px: 0.5 }}
                >
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: T.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                    {placeHour(hour.atEpoch, timezoneOffsetSeconds)}
                  </Typography>
                  <visual.Icon sx={{ fontSize: 22, color: visual.color, mt: 0.75 }} />
                  {/* Leaves room for the curve to run between the icon and the temperature. */}
                  <Box sx={{ height: 34 }} />
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                    {round(hour.tempC)}°
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.65rem', fontWeight: 700, mt: 0.25,
                      // A zero stays invisible: "0%" on every dry hour is noise that hides the
                      // one hour that actually matters.
                      color: hour.popPct > 0 ? T.info : 'transparent',
                    }}
                  >
                    {hour.popPct}%
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </GlassPanel>
  );
}

// -- Daily --------------------------------------------------------------------

/**
 * The multi-day outlook.
 *
 * Each row's bar is positioned against the *week's* full range, not its own, so a cold Thursday
 * sits visibly to the left of a warm Tuesday. Per-row scaling would stretch every day to the same
 * width and destroy the only comparison the section exists to make.
 */
/**
 * One grid, shared by the scale header and every day row, so the columns line up exactly.
 *
 * The narrow day column is 82px rather than 68: "Tomorrow" is the longest label the column ever
 * has to hold, and at 68 it ellipsised to "Tomorr…" on every phone. The 14px comes off the bar,
 * which still has well over 100px to draw in at 375.
 */
const DAY_ROW_GRID = {
  display: 'grid',
  gridTemplateColumns: { xs: '82px 30px 1fr 72px', sm: '104px 34px 1fr 88px' },
  alignItems: 'center',
  gap: { xs: 1, sm: 1.5 },
};

export function DailyOutlook({ days, timezoneOffsetSeconds }) {
  const T = useT();
  const reduce = useReducedMotion();
  const { today, tomorrow } = placeDayKeys(timezoneOffsetSeconds);

  const weekMin = Math.min(...days.map((day) => day.minC));
  const weekMax = Math.max(...days.map((day) => day.maxC));
  const weekSpan = weekMax - weekMin || 1;

  const caption = {
    fontSize: { xs: '0.58rem', sm: '0.62rem' },
    fontWeight: 800,
    color: T.textFaint,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <GlassPanel sx={{ p: { xs: 2, md: 2.5 } }}>
      <SectionTitle icon={UmbrellaRounded}>{days.length}-day outlook</SectionTitle>

      {/* The scale, spelled out. Every bar below is drawn against this one fixed axis, and without
          its two end values on screen the bars look like unlabelled progress meters rather than a
          temperature range — which is exactly how they read before this row existed. */}
      <Box sx={{ ...DAY_ROW_GRID, pb: 1 }}>
        <Box />
        <Box />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={caption}>{round(weekMin)}°</Typography>
          <Typography sx={caption}>{round(weekMax)}°</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.6 }}>
          <Typography sx={caption}>Low</Typography>
          <Typography sx={{ ...caption, color: T.textMuted }}>High</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {days.map((day, index) => {
          const visual = conditionVisual(day.condition?.icon);
          const left = clamp01((day.minC - weekMin) / weekSpan) * 100;
          const width = Math.max(clamp01((day.maxC - day.minC) / weekSpan) * 100, 6);

          return (
            <Box
              key={day.date}
              sx={{
                ...DAY_ROW_GRID,
                py: 1.25,
                // Every row now has a rule above it, the first one separating it from the scale.
                borderTop: `1px solid ${T.glassBorder}`,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dayLabel(day.date, today, tomorrow)}
                </Typography>
                <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: T.textFaint }}>
                  {dateLabel(day.date)}
                </Typography>
              </Box>

              <Tooltip title={day.condition?.description ?? ''}>
                <Box sx={{ display: 'grid', placeItems: 'center' }}>
                  <visual.Icon sx={{ fontSize: 21, color: visual.color }} />
                  {day.popPct > 0 && (
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: T.info, lineHeight: 1 }}>
                      {day.popPct}%
                    </Typography>
                  )}
                </Box>
              </Tooltip>

              <Tooltip title={`${round(day.minC)}° to ${round(day.maxC)}°`}>
                <Box sx={{ position: 'relative', height: 6, borderRadius: 3, bgcolor: T.glassBorder }}>
                  <Box
                    component={motion.div}
                    // Guarded like every other animation on this page. Without it the bar's
                    // resting width depends on an animation having run, so anything that stops
                    // it mid-flight leaves a row looking empty rather than merely unanimated.
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    sx={{
                      position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${width}%`,
                      borderRadius: 3, transformOrigin: 'left',
                      // Both ends read off the same absolute ramp, so the colour at a given point
                      // means the same temperature on every row. The old gradient ended on the
                      // weather icon's colour, which made the bar look like it encoded rain.
                      background: `linear-gradient(90deg, ${temperatureColor(day.minC)}, ${temperatureColor(day.maxC)})`,
                    }}
                  />
                </Box>
              </Tooltip>

              {/* Low first, high second — the same direction the bar runs. Printing the high on the
                  left put the two halves of the row in contradiction with each other. */}
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                <Box component="span" sx={{ color: T.textFaint, mr: 0.6 }}>{round(day.minC)}°</Box>
                <Box component="span" sx={{ color: T.textPrimary }}>{round(day.maxC)}°</Box>
              </Typography>
            </Box>
          );
        })}
      </Box>
    </GlassPanel>
  );
}

// -- Detail tiles -------------------------------------------------------------

function DetailTile({ icon: Icon, label, value, unit, hint, children }) {
  const T = useT();
  return (
    <Box
      sx={{
        p: 1.75, borderRadius: 3, minWidth: 0,
        bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${T.glassBorder}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Icon sx={{ fontSize: 15, color: T.textMuted }} />
        <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: T.textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
        {unit && <Box component="span" sx={{ fontSize: '0.72rem', color: T.textMuted, ml: 0.4 }}>{unit}</Box>}
      </Typography>
      {hint && (
        <Typography sx={{ fontSize: '0.68rem', color: T.textFaint, fontWeight: 700, mt: 0.4 }}>
          {hint}
        </Typography>
      )}
      {children}
    </Box>
  );
}

export function DetailGrid({ current }) {
  const T = useT();

  // Both are rounded to whole degrees on screen, so the comparison has to be made on the rounded
  // values too — otherwise 25.6 and 26.4 both print as 26 under a caption insisting one is warmer.
  const feelsDelta = round(current.feelsLikeC) - round(current.tempC);

  return (
    <GlassPanel sx={{ p: { xs: 2, md: 2.5 } }}>
      <SectionTitle icon={ExploreRounded}>Conditions</SectionTitle>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1.25 }}>
        <DetailTile
          icon={AirRounded}
          label="Wind"
          value={current.windSpeedMs}
          unit="m/s"
          hint={[
            `${windDescription(current.windSpeedMs)} · ${compassPoint(current.windDeg)}`,
            current.windGustMs ? `gusts ${current.windGustMs} m/s` : null,
          ].filter(Boolean).join(' · ')}
        >
          <NavigationRounded
            aria-hidden
            sx={{
              fontSize: 17, color: T.teal, mt: 0.6,
              // Meteorological bearings name where the wind comes *from*, so the arrow showing
              // where it is going points the opposite way.
              transform: `rotate(${current.windDeg + 180}deg)`,
            }}
          />
        </DetailTile>

        <DetailTile icon={OpacityRounded} label="Humidity" value={current.humidity} unit="%" />
        <DetailTile
          icon={ThermostatRounded}
          label="Feels like"
          value={`${round(current.feelsLikeC)}°`}
          hint={feelsDelta > 0 ? 'Warmer than actual' : feelsDelta < 0 ? 'Cooler than actual' : 'As it reads'}
        />
        <DetailTile icon={CompressRounded} label="Pressure" value={current.pressure} unit="hPa" />
        <DetailTile
          icon={VisibilityRounded}
          label="Visibility"
          value={Number.isFinite(current.visibilityM) ? (current.visibilityM / 1000).toFixed(1) : '—'}
          unit={Number.isFinite(current.visibilityM) ? 'km' : ''}
        />
        <DetailTile icon={UmbrellaRounded} label="Cloud cover" value={current.cloudsPct} unit="%" />
      </Box>
    </GlassPanel>
  );
}

// -- Sun ----------------------------------------------------------------------

/**
 * Sunrise to sunset, with the sun where it currently is.
 *
 * Two timestamps in a list answer "when"; the arc answers "how much daylight is left", which is
 * the question people actually have when they glance at it.
 */
export function SunArc({ current, timezoneOffsetSeconds }) {
  const T = useT();
  const { sunriseEpoch, sunsetEpoch } = current;
  if (!sunriseEpoch || !sunsetEpoch || sunsetEpoch <= sunriseEpoch) return null;

  const now = Date.now() / 1000;
  const progress = clamp01((now - sunriseEpoch) / (sunsetEpoch - sunriseEpoch));
  const daylight = sunsetEpoch - sunriseEpoch;
  const isDay = now >= sunriseEpoch && now <= sunsetEpoch;

  // Semicircle from (10,60) to (190,60), apex at y=6.
  const angle = Math.PI * (1 - progress);
  const sun = { x: 100 + 90 * Math.cos(angle), y: 60 - 54 * Math.sin(angle) };

  return (
    <GlassPanel sx={{ p: { xs: 2, md: 2.5 } }}>
      <SectionTitle icon={WbTwilightRounded}>Sun</SectionTitle>

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Box component="svg" viewBox="0 0 200 74" sx={{ width: '100%', maxWidth: 320, height: 'auto' }}>
          <path d="M10 60 A 90 54 0 0 1 190 60" fill="none" stroke={T.glassBorder} strokeWidth="2" strokeDasharray="4 5" />
          <path
            d="M10 60 A 90 54 0 0 1 190 60"
            fill="none"
            stroke={T.warning}
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - progress}
            opacity={isDay ? 1 : 0.35}
          />
          <line x1="6" y1="60" x2="194" y2="60" stroke={T.glassBorder} strokeWidth="1" />
          {isDay && <circle cx={sun.x} cy={sun.y} r="6" fill={T.warning} />}
          {isDay && <circle cx={sun.x} cy={sun.y} r="11" fill={T.warning} opacity="0.22" />}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
        {[
          { label: 'Sunrise', value: placeTime(sunriseEpoch, timezoneOffsetSeconds) },
          { label: 'Daylight', value: `${Math.floor(daylight / 3600)}h ${Math.round((daylight % 3600) / 60)}m`, center: true },
          { label: 'Sunset', value: placeTime(sunsetEpoch, timezoneOffsetSeconds) },
        ].map((item) => (
          <Box key={item.label} sx={{ textAlign: item.center ? 'center' : 'inherit' }}>
            <Typography sx={{ fontSize: '0.63rem', fontWeight: 800, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {item.label}
            </Typography>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
              {item.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </GlassPanel>
  );
}

// -- Air quality --------------------------------------------------------------

export function AirQualityPanel({ air }) {
  const T = useT();
  const visual = aqiVisual(air.aqi);

  return (
    <GlassPanel sx={{ p: { xs: 2, md: 2.5 } }}>
      <SectionTitle icon={AirRounded}>Air quality</SectionTitle>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 62, height: 62, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center',
            border: `3px solid ${visual.color}`, boxShadow: `0 0 26px ${visual.color}44`,
          }}
        >
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: visual.color, lineHeight: 1 }}>
            {air.aqi}
          </Typography>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: visual.color }}>
            {visual.label}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: T.textMuted, lineHeight: 1.45, mt: 0.25 }}>
            {visual.advice}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 2 }}>
        {Object.entries(air.components ?? {}).map(([key, value]) => (
          <Chip
            key={key}
            size="small"
            label={`${POLLUTANT_LABELS[key] ?? key} ${value}`}
            sx={{
              bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.glassBorder}`,
              fontWeight: 700, fontSize: '0.68rem',
            }}
          />
        ))}
      </Box>

      <Typography sx={{ fontSize: '0.64rem', color: T.textFaint, mt: 1.25 }}>
        Concentrations in µg/m³. Index runs 1 (best) to 5 (worst).
      </Typography>
    </GlassPanel>
  );
}

// -- Permission dialog --------------------------------------------------------

/**
 * Copy per failure reason.
 *
 * The two silent failures get an explanation instead of advice the reader cannot act on: telling
 * someone to "enable location in settings" when the page is served over plain http, or when a
 * response header disabled the API, sends them to a switch that is already on.
 */
const EXPLANATION = {
  [LocationError.INSECURE]: {
    title: 'Location needs a secure connection',
    body: 'Browsers only share your position over https. This page is on a plain http address, so the request can never reach you. Search by city instead, or open the site over https.',
    retry: false,
  },
  [LocationError.BLOCKED]: {
    title: 'Location is blocked for this site',
    body: 'The site is being served with a policy that switches off location for the whole page, so no permission prompt can appear. Search by city while that is sorted out.',
    retry: false,
  },
  [LocationError.UNSUPPORTED]: {
    title: 'This browser has no location',
    body: 'Your browser does not expose a location API, so there is nothing to ask. Searching by city works exactly the same.',
    retry: false,
  },
  [LocationError.DENIED]: {
    title: 'Location is turned off',
    body: 'Location access was declined. Turn it back on for this site in your browser or device settings, or just search by city below.',
    retry: false,
  },
  [LocationError.UNAVAILABLE]: {
    title: 'Could not pin you down',
    body: 'Your device could not produce a position. This usually clears up on a second try, or once you have a better signal.',
    retry: true,
  },
  [LocationError.TIMEOUT]: {
    title: 'That took too long',
    body: 'Your device did not return a position in time. Trying again usually works — a first fix can be slow indoors.',
    retry: true,
  },
};

const ASK = {
  title: 'Use your location?',
  body: 'Allow location access for conditions exactly where you are. You can always search by city instead — your coordinates are never stored.',
  retry: true,
};

export function LocationDialog({ open, reason, onAllow, onDismiss }) {
  const T = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const copy = reason ? EXPLANATION[reason] ?? EXPLANATION[LocationError.UNAVAILABLE] : ASK;

  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      fullScreen={fullScreen}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: T.bg,
            backgroundImage: 'none',
            border: fullScreen ? 'none' : `1px solid ${T.glassBorder}`,
            borderRadius: fullScreen ? 0 : 4,
            m: fullScreen ? 0 : 2,
          },
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
            width: 76, height: 76, mx: 'auto', mb: 2.5, borderRadius: '50%', display: 'grid', placeItems: 'center',
            bgcolor: reason ? T.errorBg : T.tealBg,
            border: `1px solid ${reason ? T.error : T.teal}44`,
            boxShadow: `0 0 40px ${reason ? T.errorBg : T.tealGlow}`,
          }}
        >
          <GpsFixedRounded sx={{ fontSize: 36, color: reason ? T.error : T.teal }} />
        </Box>

        <Typography sx={{ fontSize: '1.25rem', fontWeight: 900, color: T.textPrimary, mb: 1 }}>
          {copy.title}
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', color: T.textMuted, lineHeight: 1.6, maxWidth: 340, mx: 'auto' }}>
          {copy.body}
        </Typography>
      </DialogContent>

      <DialogActions
        sx={{
          flexDirection: 'column', gap: 1, px: { xs: 3, sm: 4 }, pb: { xs: 4, sm: 3.5 }, pt: 2,
          '& > button': { width: '100%', m: '0 !important' },
        }}
      >
        {copy.retry && (
          <Button
            onClick={onAllow}
            variant="contained"
            startIcon={<MyLocationRounded />}
            sx={{
              bgcolor: T.teal, color: '#fff', fontWeight: 800, minHeight: 48, borderRadius: 2.5,
              boxShadow: `0 10px 30px ${T.tealGlow}`, '&:hover': { bgcolor: T.tealHover },
            }}
          >
            {reason ? 'Try again' : 'Allow location'}
          </Button>
        )}
        <Button
          onClick={onDismiss}
          sx={{ color: T.textMuted, fontWeight: 700, minHeight: 44, '&:hover': { color: T.textPrimary, bgcolor: T.hoverBg } }}
        >
          {reason ? 'Search by city instead' : 'Not now'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -- Loading ------------------------------------------------------------------

export function WeatherSkeleton() {
  const T = useT();
  const bar = { bgcolor: T.glassHover, borderRadius: 2 };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 } }}>
      <Skeleton variant="rounded" height={230} sx={bar} />
      <Skeleton variant="rounded" height={150} sx={bar} />
      <Skeleton variant="rounded" height={260} sx={bar} />
    </Box>
  );
}
