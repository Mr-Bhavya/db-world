import React from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { PlayArrow as PlayIcon } from '@mui/icons-material';

import { tmdbImg } from '@features/cinema/api/cinemaApi';
import { useT } from '@shared/theme';
import { clampTextSx } from '../../homeStyles';
import { recordRoute } from '../recordRoute';
import WidgetShell from '../WidgetShell';
import { Stat, StatRow, WidgetFallback, WidgetProgress } from '../widgetParts';

/** Below this a poster is too small to recognise, so the row stops shrinking and clips instead. */
const MIN_POSTER_HEIGHT = 38;

/**
 * A ceiling so an unusually tall tile cannot turn the row into three enormous posters. It sits
 * above what the 30/70 split below actually asks for, so in practice the split decides the size
 * and this only catches the extremes.
 */
const MAX_POSTER_HEIGHT = 220;

/**
 * How the large tile divides itself between the library figures and the posters.
 *
 * An even split gave the three figures as much height as the artwork, which left them floating in
 * whitespace while the posters stayed small. The figures need only enough room to read.
 */
const STATS_SHARE = 3;
const POSTERS_SHARE = 7;

/** "S2 · E4" for a series, nothing for a film. */
const episodeLabel = (item) => {
  if (item?.season == null && item?.episode == null) return null;
  return [item.season != null ? `S${item.season}` : null, item.episode != null ? `E${item.episode}` : null]
    .filter(Boolean)
    .join(' · ');
};

/** A poster image, or the title's initials when TMDB has no artwork for it. */
function PosterArt({ title, size }) {
  const T = useT();
  const src = tmdbImg(title.posterPath, 'w185');

  return (
    <Box
      sx={{
        ...size,
        aspectRatio: '2 / 3',
        borderRadius: 1.4,
        overflow: 'hidden',
        flexShrink: 0,
        bgcolor: T.glassHover,
        border: `1px solid ${T.glassBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt=""
          loading="lazy"
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Typography
          sx={{ color: T.textFaint, fontSize: '0.62rem', fontWeight: 900, px: 0.5, textAlign: 'center' }}
        >
          {title.name?.slice(0, 2)?.toUpperCase()}
        </Typography>
      )}
    </Box>
  );
}

/**
 * A captioned row of posters that grows into whatever height the tile has left.
 *
 * The posters take their size from the row (`height: 100%`, width follows the 2:3 aspect) rather
 * than the row taking its size from them. That is what lets one layout serve every case: with a
 * resume bar the single row simply grows taller, and without one two rows share the space — no
 * hand-tuned height table to drift out of step with the grid's row tracks.
 *
 * It scrolls horizontally, so a narrow tile reaches the same titles a wide one shows at once and a
 * poster is never cut off mid-row with nowhere to go.
 */
function PosterRow({ label, titles, onOpen, grow = 1 }) {
  const T = useT();

  return (
    <Box sx={{ flex: grow, minHeight: MIN_POSTER_HEIGHT + 18, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Typography
        sx={{
          color: T.textMuted,
          fontSize: '0.62rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          mb: 0.5,
          flexShrink: 0,
        }}
      >
        {label}
      </Typography>

      <Box
        sx={{
          flex: 1,
          minHeight: MIN_POSTER_HEIGHT,
          maxHeight: MAX_POSTER_HEIGHT,
          display: 'flex',
          alignItems: 'stretch',
          gap: { xs: 0.6, sm: 0.75 },
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          minWidth: 0,
        }}
      >
        {titles.map((title) => (
          <Box
            key={title.id}
            role="button"
            tabIndex={0}
            aria-label={`Open ${title.name}`}
            title={title.name}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(title);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onOpen(title);
            }}
            sx={{
              height: '100%',
              flexShrink: 0,
              cursor: 'pointer',
              borderRadius: 1.4,
              transition: 'transform 0.2s ease',
              '&:hover': { transform: 'translateY(-3px)' },
              '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
            }}
          >
            <PosterArt title={title} size={{ height: '100%' }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Cinema's tile.
 *
 * Resume comes first when there is something to resume — the one thing a returning viewer wants
 * from this app. When there isn't (a new user, a finished queue, anyone signed out) that row goes
 * to the shape of the library instead: how many films, how many series, how many arrived this
 * week. Figures, not a second row of posters — the same treatment IPO Radar gets, and a second
 * poster row only read as padding for the first.
 */
export default function CinemaWidget({ widget, summary, isLoading, onNavigate, ...shell }) {
  const T = useT();
  const cinema = summary?.cinema;
  const isLarge = widget.size === 'lg';

  const openTitle = (title) => onNavigate?.(recordRoute(title.type, title.name, title.id));

  if (!cinema && !isLoading) {
    return (
      <WidgetShell widget={widget} {...shell}>
        <WidgetFallback text={widget.description} />
      </WidgetShell>
    );
  }

  const resume = cinema?.continueWatching;
  const latest = cinema?.latest ?? [];

  const showResume = Boolean(resume) && widget.size !== 'sm';
  // The library figures take the row the resume bar would have used, so the tile is full either
  // way. Not on a small tile, where there is only room for the posters.
  const showStats = !showResume && widget.size !== 'sm' && Boolean(cinema);

  return (
    <WidgetShell widget={widget} {...shell}>
      {/* Loading. Mirrors the layout it is standing in for — figures over a poster row — so the
          tile does not visibly re-shape itself the moment the summary lands. */}
      {isLoading && (
        <>
          {isLarge && (
            <Box sx={{ display: 'flex', alignItems: 'center', flex: STATS_SHARE, minHeight: 0, mb: 1.25 }}>
              <Box sx={{ display: 'flex', width: '100%', gap: 1.5 }}>
                {[0, 1, 2].map((key) => (
                  <Box key={key} sx={{ flex: 1 }}>
                    <Skeleton
                      variant="text"
                      width="60%"
                      height={isLarge ? 34 : 26}
                      sx={{ bgcolor: T.glassHover, mx: 'auto' }}
                    />
                    <Skeleton variant="text" width="80%" height={14} sx={{ bgcolor: T.glassHover, mx: 'auto' }} />
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Box
            sx={{
              flex: isLarge ? POSTERS_SHARE : 1,
              minHeight: MIN_POSTER_HEIGHT + 18,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            <Skeleton variant="text" width={72} height={14} sx={{ bgcolor: T.glassHover, mb: 0.5 }} />

            <Box
              sx={{
                flex: 1,
                minHeight: MIN_POSTER_HEIGHT,
                maxHeight: MAX_POSTER_HEIGHT,
                display: 'flex',
                gap: { xs: 0.6, sm: 0.75 },
                overflow: 'hidden',
              }}
            >
              {[0, 1, 2, 3, 4, 5].map((key) => (
                <Skeleton
                  key={key}
                  variant="rounded"
                  sx={{ bgcolor: T.glassHover, height: '100%', aspectRatio: '2 / 3', flexShrink: 0 }}
                />
              ))}
            </Box>
          </Box>
        </>
      )}

      {/* Continue watching. Carries the poster art rather than a bare title, both because it is
          how you recognise where you were and because a text-only bar left the large tile with a
          hole under it that nothing else could reach. */}
      {!isLoading && showResume && (
        <Box
          role="button"
          tabIndex={0}
          aria-label={`Resume ${resume.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onNavigate?.(recordRoute(resume.type, resume.title, resume.recordId));
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            onNavigate?.(recordRoute(resume.type, resume.title, resume.recordId));
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.1,
            mb: 1.25,
            p: 0.85,
            flexShrink: 0,
            borderRadius: 2,
            cursor: 'pointer',
            bgcolor: T.glassHover,
            border: `1px solid ${T.glassBorder}`,
            minWidth: 0,
            '&:hover': { borderColor: `${widget.accent}88` },
            '&:focus-visible': { outline: `2px solid ${widget.accent}`, outlineOffset: 2 },
          }}
        >
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <PosterArt title={resume} size={{ height: { xs: 54, sm: 62, md: 68 } }} />

            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1.4,
                bgcolor: 'rgba(0,0,0,0.35)',
              }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: widget.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlayIcon sx={{ fontSize: 15, color: '#fff' }} />
              </Box>
            </Box>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                color: T.textMuted,
                fontSize: '0.6rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                mb: 0.2,
              }}
            >
              Continue watching
            </Typography>

            <Typography
              sx={{
                color: T.textPrimary,
                fontWeight: 800,
                fontSize: { xs: '0.8rem', sm: '0.88rem' },
                lineHeight: 1.3,
                ...clampTextSx(2),
              }}
            >
              {resume.title}
            </Typography>

            <Typography sx={{ color: T.textMuted, fontSize: '0.66rem', fontWeight: 600, mt: 0.2 }}>
              {[episodeLabel(resume), `${resume.progressPct}% watched`].filter(Boolean).join(' · ')}
            </Typography>

            <WidgetProgress value={resume.progressPct} color={widget.accent} />
          </Box>
        </Box>
      )}

      {!isLoading && showStats && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flex: isLarge ? STATS_SHARE : '0 0 auto',
            minHeight: 0,
            mb: 1.25,
          }}
        >
          <Box sx={{ width: '100%' }}>
          <StatRow>
            <Stat value={(cinema.movies ?? 0).toLocaleString()} label="Movies" compact={!isLarge} />
            <Stat value={(cinema.series ?? 0).toLocaleString()} label="Series" compact={!isLarge} />
            <Stat
              value={cinema.addedThisWeek ?? 0}
              label="New this week"
              color={cinema.addedThisWeek > 0 ? widget.accent : undefined}
              compact={!isLarge}
            />
          </StatRow>
          </Box>
        </Box>
      )}

      {!isLoading && latest.length > 0 && (
        <PosterRow
          label="Just added"
          titles={latest}
          onOpen={openTitle}
          grow={isLarge && showStats ? POSTERS_SHARE : 1}
        />
      )}

      {!isLoading && latest.length === 0 && !showResume && (
        <WidgetFallback text={widget.description} />
      )}

    </WidgetShell>
  );
}
