import React from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { GpsFixed as LiveLocationIcon, LocationOn as LocationIcon } from '@mui/icons-material';

import useWeatherLocation from '@features/weather/useWeatherLocation';
import { useWeather } from '@features/weather/weatherApi';
import { getWeatherCity } from '@features/weather/weatherPrefs';
import { conditionVisual } from '@features/weather/weatherVisuals';
import { useT } from '@shared/theme';
import { clampTextSx } from '../../homeStyles';
import WidgetShell from '../WidgetShell';
import { WidgetFallback } from '../widgetParts';

/**
 * Weather is the one widget the summary endpoint cannot serve: it needs a place, and the server
 * does not know where the reader is.
 *
 * So the tile resolves that itself — but silently. It reads a position only when location was
 * already granted, on the weather page or to the app; it never prompts. The hub is the landing
 * page, including for someone arriving for the first time from a search result, and a permission
 * dialog is not a welcome. When there is no position it falls back to the city they last looked
 * at on the weather page, and to the app default before that.
 *
 * No auth check: `/api/weather` is public, so this renders for signed-out visitors too.
 */
export default function WeatherWidget({ widget, ...shell }) {
  const T = useT();
  const geo = useWeatherLocation();
  const city = getWeatherCity();

  const { data, isLoading, isError } = useWeather({
    coords: geo.coords,
    city: geo.coords ? null : city,
    // Hold while the permission probe runs, so a granted visitor does not flash their fallback
    // city before their real one arrives.
    enabled: !geo.resolving && !(geo.locating && !geo.coords),
  });

  if (isError || (!data && !isLoading && !geo.resolving)) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text={widget.description} />
      </WidgetShell>
    );
  }

  const current = data?.current;
  const visual = current ? conditionVisual(current.condition?.icon) : null;
  const live = Boolean(geo.coords);
  const PlaceIcon = live ? LiveLocationIcon : LocationIcon;

  return (
    <WidgetShell widget={widget} {...shell}>
      {!current ? (
        <>
          <Skeleton variant="text" width={78} height={40} sx={{ bgcolor: T.glassHover }} />
          <Skeleton variant="text" width={110} height={18} sx={{ bgcolor: T.glassHover }} />
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Typography
              sx={{
                color: T.textPrimary,
                fontWeight: 900,
                fontSize: { xs: '1.7rem', sm: '2rem', xl: '2.3rem' },
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {Math.round(current.tempC)}°
            </Typography>
            {visual && (
              <visual.Icon sx={{ fontSize: { xs: 24, sm: 28 }, color: visual.color, flexShrink: 0 }} />
            )}
            {data.daily?.[0] && (
              <Typography
                sx={{
                  color: T.textFaint, fontSize: '0.68rem', fontWeight: 800, ml: 'auto',
                  fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                }}
              >
                {Math.round(data.daily[0].maxC)}° / {Math.round(data.daily[0].minC)}°
              </Typography>
            )}
          </Box>

          {current.condition?.description && (
            <Typography
              sx={{
                color: T.textMuted,
                fontSize: { xs: '0.72rem', sm: '0.78rem' },
                fontWeight: 700,
                textTransform: 'capitalize',
                mt: 0.4,
                ...clampTextSx(1),
              }}
            >
              {current.condition.description}
            </Typography>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.6, minWidth: 0 }}>
            <PlaceIcon sx={{ fontSize: 13, color: live ? T.teal : T.textFaint, flexShrink: 0 }} />
            <Typography
              sx={{ color: T.textFaint, fontSize: '0.68rem', fontWeight: 700, ...clampTextSx(1) }}
            >
              {data.place?.name ?? city}
            </Typography>
          </Box>
        </>
      )}
    </WidgetShell>
  );
}
