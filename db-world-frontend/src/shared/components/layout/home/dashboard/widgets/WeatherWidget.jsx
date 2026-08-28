import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Skeleton, Typography } from '@mui/material';
import { LocationOn as LocationIcon } from '@mui/icons-material';

import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { getWeatherCity } from '@features/weather/weatherPrefs';
import { useT } from '@shared/theme';
import { clampTextSx } from '../../homeStyles';
import WidgetShell from '../WidgetShell';
import { SignedOutPanel, WidgetFallback } from '../widgetParts';

const kelvinToC = (kelvin) => Math.round(kelvin - 273.15);

/**
 * Weather is the one widget the summary endpoint cannot serve: it needs a place, and the server
 * does not know where the user is. So the tile fetches for the city they last looked at on the
 * weather page (see `weatherPrefs`).
 *
 * `/api/weather` requires a token — the key stays server-side — so this only fetches when signed
 * in, and shows the static description otherwise rather than firing a request that would 401.
 */
export default function WeatherWidget({ widget, isAuthenticated, onSignIn, ...shell }) {
  const T = useT();
  const city = getWeatherCity();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['home', 'weather', city],
    queryFn: () =>
      axiosInstance
        .get('/api/weather', { params: { city } })
        .then((response) => response.data?.data ?? response.data),
    enabled: isAuthenticated && Boolean(city),
    // Conditions move slowly and the hub is revisited constantly — ten minutes of staleness is
    // invisible to a reader and saves an upstream call on every return to the page.
    staleTime: 10 * 60_000,
    retry: 1,
  });

  // The weather endpoint proxies a key that stays server-side, so it needs a token. Rather than
  // showing a dead tile, say what it does and offer the way in.
  if (!isAuthenticated) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <SignedOutPanel
          widget={widget}
          onSignIn={onSignIn}
          blurb="Live conditions and forecasts for wherever you are."
          pitch={['Any city', 'Hourly detail']}
        />
      </WidgetShell>
    );
  }

  if (isError || (!data && !isLoading)) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text={widget.description} />
      </WidgetShell>
    );
  }

  const temperature = data?.main?.temp;
  const condition = data?.weather?.[0]?.description;

  return (
    <WidgetShell widget={widget} {...shell}>
      {isLoading ? (
        <>
          <Skeleton variant="text" width={78} height={40} sx={{ bgcolor: T.glassHover }} />
          <Skeleton variant="text" width={110} height={18} sx={{ bgcolor: T.glassHover }} />
        </>
      ) : (
        <>
          <Typography
            sx={{
              color: T.textPrimary,
              fontWeight: 900,
              fontSize: { xs: '1.7rem', sm: '2rem', xl: '2.3rem' },
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {Number.isFinite(temperature) ? `${kelvinToC(temperature)}°` : '—'}
          </Typography>

          {condition && (
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
              {condition}
            </Typography>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.6, minWidth: 0 }}>
            <LocationIcon sx={{ fontSize: 13, color: T.textFaint, flexShrink: 0 }} />
            <Typography sx={{ color: T.textFaint, fontSize: '0.68rem', fontWeight: 700, ...clampTextSx(1) }}>
              {data?.name ?? city}
            </Typography>
          </Box>
        </>
      )}
    </WidgetShell>
  );
}
