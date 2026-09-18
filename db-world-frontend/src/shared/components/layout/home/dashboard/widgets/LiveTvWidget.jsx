import React from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { LiveTv as LiveTvIcon } from '@mui/icons-material';

import { useT } from '@shared/theme';
import WidgetShell from '../WidgetShell';
import { Stat, StatRow, WidgetFallback } from '../widgetParts';

/**
 * Live TV's hub tile: how much there is to watch, and a strip of channel logos so the
 * card reads as television rather than as three numbers.
 *
 * <p>Fed by the `live` section of `/api/home/summary`, not by the channel list. That list
 * is megabytes on a real import and the hub has no use for any of it — the section is
 * three counts and six logos.
 *
 * <p>No auth check: the channel grid is public, so this renders for signed-out visitors.
 */
export default function LiveTvWidget({ widget, summary, ...shell }) {
  const T = useT();
  const live = summary?.live;

  // No section means nothing has been imported yet (or the section failed). Either way
  // the tile has nothing true to say, so it falls back to the app's blurb.
  if (!live) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text={widget.description} />
      </WidgetShell>
    );
  }

  const featured = live.featured ?? [];

  return (
    <WidgetShell widget={widget} {...shell}>
      <StatRow>
        <Stat value={live.channels?.toLocaleString() ?? '—'} label="Channels" color={widget.accent} />
        <Stat value={live.categories ?? '—'} label="Categories" />
        {live.countries > 0 && <Stat value={live.countries} label="Countries" />}
      </StatRow>

      {featured.length > 0 && (
        <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.75, rowGap: 0.75 }}>
          {featured.map((channel) => (
            <Tooltip key={channel.id} title={channel.name} enterDelay={400}>
              <Box sx={{
                width: 38, height: 38, flexShrink: 0,
                borderRadius: 1.5, bgcolor: T.inputBg, overflow: 'hidden',
                display: 'grid', placeItems: 'center',
                border: `1px solid ${T.glassBorder}`,
              }}>
                <Box
                  component="img"
                  src={channel.logoUrl}
                  alt=""
                  loading="lazy"
                  // Logos are hotlinked from the playlist's own host; hide a dead one
                  // rather than leave a broken-image glyph in the strip.
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.4 }}
                />
              </Box>
            </Tooltip>
          ))}
        </Stack>
      )}

      {featured.length === 0 && (
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.5, color: T.textFaint }}>
          <LiveTvIcon sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 12.5 }}>Browse every channel</Typography>
        </Stack>
      )}
    </WidgetShell>
  );
}
