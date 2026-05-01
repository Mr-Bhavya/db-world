import { useState } from 'react';
import {
  Dialog, DialogContent, Box, Typography, Chip, Divider,
  IconButton, CircularProgress, Tab, Tabs, Alert, Avatar,
  Collapse, useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MovieIcon from '@mui/icons-material/Movie';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { getTmdbDetail } from '../api/adminApi';

// ── Utilities ─────────────────────────────────────────────────────

const TMDB_BASE = 'https://image.tmdb.org/t/p/';
const tmdbPoster   = (p) => p ? `${TMDB_BASE}w342${p}`  : null;
const tmdbBackdrop = (p) => p ? `${TMDB_BASE}w1280${p}` : null;
const ratingColor  = (v) => v >= 7 ? '#4caf50' : v >= 5 ? '#ff9800' : '#f44336';
const fmtRuntime   = (m) => !m ? null : `${Math.floor(m / 60)}h ${m % 60}m`;
const fmtMoney     = (n) => n > 0 ? `$${n.toLocaleString()}` : null;
const fmtMs        = (ms) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

// ── Shared helpers ────────────────────────────────────────────────

const SectionTitle = ({ children }) => {
  const T = useT();
  return (
    <Typography sx={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 1, color: T.textFaint, mb: 1, mt: 0.5,
    }}>
      {children}
    </Typography>
  );
};

const KV = ({ label, value }) => {
  const T = useT();
  if (value === null || value === undefined || value === '') return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, py: 0.5, borderBottom: `1px solid ${T.border}` }}>
      <Typography sx={{ fontSize: 11, color: T.textFaint, minWidth: 160, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color: T.textPrimary, wordBreak: 'break-word', flex: 1 }}>{String(value)}</Typography>
    </Box>
  );
};

// ── Overview Tab ──────────────────────────────────────────────────

function OverviewTab({ tmdb, isMovie }) {
  const T = useT();

  const leftStats = isMovie
    ? [
        ['Release Date',  tmdb.releaseDate],
        ['Runtime',       fmtRuntime(tmdb.runtime)],
        ['Status',        tmdb.status],
        ['Language',      tmdb.originalLanguage?.toUpperCase()],
        ['Popularity',    tmdb.popularity?.toFixed(2)],
        ['Budget',        fmtMoney(tmdb.budget)],
        ['Revenue',       fmtMoney(tmdb.revenue)],
        ['IMDB ID',       tmdb.imdbId],
        ['Adult',         tmdb.adult != null ? String(tmdb.adult) : null],
      ]
    : [
        ['First Air Date',       tmdb.firstAirDate],
        ['Last Air Date',        tmdb.lastAirDate],
        ['In Production',        tmdb.inProduction != null ? String(tmdb.inProduction) : null],
        ['Seasons',              tmdb.numberOfSeasons],
        ['Episodes',             tmdb.numberOfEpisodes],
        ['Episode Runtimes',     tmdb.episodeRunTimes?.join(', ')],
        ['Type',                 tmdb.type],
        ['Status',               tmdb.status],
        ['Language',             tmdb.originalLanguage?.toUpperCase()],
        ['Popularity',           tmdb.popularity?.toFixed(2)],
        ['Adult',                tmdb.adult != null ? String(tmdb.adult) : null],
      ];

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
      {/* Left column — key stats */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <SectionTitle>Details</SectionTitle>
        {leftStats.map(([label, val]) => (
          <KV key={label} label={label} value={val} />
        ))}

        {tmdb.voteAverage != null && (
          <KV label="Vote Average" value={`${tmdb.voteAverage.toFixed(1)} / 10 (${tmdb.voteCount?.toLocaleString() ?? 0} votes)`} />
        )}

        {/* Collection (movie only) */}
        {isMovie && tmdb.belongsToCollection && (
          <Box sx={{ mt: 2 }}>
            <SectionTitle>Collection</SectionTitle>
            <Box sx={{ p: 1.5, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.teal, mb: 0.5 }}>
                {tmdb.belongsToCollection.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.textFaint }}>
                TMDB ID: {tmdb.belongsToCollection.id}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Last / next episode (TV only) */}
        {!isMovie && tmdb.lastEpisodeToAir && (
          <Box sx={{ mt: 2 }}>
            <SectionTitle>Last Episode to Air</SectionTitle>
            <Box sx={{ p: 1, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 1 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
                S{tmdb.lastEpisodeToAir.seasonNumber}E{tmdb.lastEpisodeToAir.episodeNumber} — {tmdb.lastEpisodeToAir.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.textFaint }}>{tmdb.lastEpisodeToAir.airDate}</Typography>
            </Box>
          </Box>
        )}

        {!isMovie && tmdb.nextEpisodeToAir && (
          <Box sx={{ mt: 1.5 }}>
            <SectionTitle>Next Episode to Air</SectionTitle>
            <Box sx={{ p: 1, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 1 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
                S{tmdb.nextEpisodeToAir.seasonNumber}E{tmdb.nextEpisodeToAir.episodeNumber} — {tmdb.nextEpisodeToAir.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.textFaint }}>{tmdb.nextEpisodeToAir.airDate}</Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Right column — overview + production info */}
      <Box sx={{ flex: 1.2, minWidth: 0 }}>
        {tmdb.tagline && (
          <Typography sx={{ fontSize: 13, fontStyle: 'italic', color: T.textMuted, mb: 1.5, lineHeight: 1.5 }}>
            "{tmdb.tagline}"
          </Typography>
        )}

        {tmdb.overview && (
          <>
            <SectionTitle>Overview</SectionTitle>
            <Typography sx={{ fontSize: 13, color: T.textPrimary, lineHeight: 1.7, mb: 2 }}>
              {tmdb.overview}
            </Typography>
          </>
        )}

        {tmdb.homepage && (
          <Box sx={{ mb: 2 }}>
            <SectionTitle>Homepage</SectionTitle>
            <Box component="a" href={tmdb.homepage} target="_blank" rel="noreferrer"
              sx={{ fontSize: 12, color: T.teal, wordBreak: 'break-all', textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' } }}>
              {tmdb.homepage}
            </Box>
          </Box>
        )}

        {tmdb.productionCompanies?.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <SectionTitle>Production Companies</SectionTitle>
            {tmdb.productionCompanies.map((c, i) => (
              <Typography key={i} sx={{ fontSize: 12, color: T.textPrimary, py: 0.3 }}>
                {c.name}{c.originCountry ? ` (${c.originCountry})` : ''}
              </Typography>
            ))}
          </Box>
        )}

        {tmdb.productionCountries?.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <SectionTitle>Production Countries</SectionTitle>
            <Typography sx={{ fontSize: 12, color: T.textPrimary }}>
              {tmdb.productionCountries.map(c => c.name).filter(Boolean).join(', ')}
            </Typography>
          </Box>
        )}

        {tmdb.spokenLanguages?.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <SectionTitle>Spoken Languages</SectionTitle>
            <Typography sx={{ fontSize: 12, color: T.textPrimary }}>
              {tmdb.spokenLanguages.map(l => l.englishName ?? l.name).filter(Boolean).join(', ')}
            </Typography>
          </Box>
        )}

        {!isMovie && tmdb.createdBy?.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <SectionTitle>Created By</SectionTitle>
            {tmdb.createdBy.map((p, i) => (
              <Typography key={i} sx={{ fontSize: 12, color: T.textPrimary }}>{p.name}</Typography>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Cast & Crew Tab ───────────────────────────────────────────────

function CastCard({ credit }) {
  const T = useT();
  const posterUrl = credit.person?.profilePath ? tmdbPoster(credit.person.profilePath) : null;
  const initials  = (credit.person?.name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: 88, flexShrink: 0,
    }}>
      <Avatar
        src={posterUrl ?? undefined}
        sx={{ width: 64, height: 64, bgcolor: T.tealBg, color: T.teal, fontSize: 18, fontWeight: 700, mb: 0.5 }}
      >
        {!posterUrl && initials}
      </Avatar>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textPrimary, textAlign: 'center', lineHeight: 1.3 }}>
        {credit.person?.name ?? '—'}
      </Typography>
      {credit.character && (
        <Typography sx={{ fontSize: 10, color: T.textMuted, textAlign: 'center', lineHeight: 1.3, mt: 0.25 }}>
          {credit.character}
        </Typography>
      )}
    </Box>
  );
}

function CastCrewTab({ tmdb }) {
  const T = useT();

  const cast = [...(tmdb.credits ?? []).filter(c => c.creditType === 'CAST')]
    .sort((a, b) => (a.castOrder ?? 9999) - (b.castOrder ?? 9999));

  const crew = (tmdb.credits ?? []).filter(c => c.creditType === 'CREW');

  // Group crew by department
  const crewByDept = crew.reduce((acc, c) => {
    const dept = c.department ?? 'Other';
    (acc[dept] = acc[dept] ?? []).push(c);
    return acc;
  }, {});

  return (
    <Box>
      {cast.length > 0 && (
        <>
          <SectionTitle>Cast ({cast.length})</SectionTitle>
          <Box sx={{
            display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1.5,
            '&::-webkit-scrollbar': { height: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 },
          }}>
            {cast.map((c, i) => <CastCard key={c.creditId ?? i} credit={c} />)}
          </Box>
          <Divider sx={{ borderColor: T.border, my: 2 }} />
        </>
      )}

      {Object.keys(crewByDept).length > 0 && (
        <>
          <SectionTitle>Crew ({crew.length})</SectionTitle>
          {Object.entries(crewByDept).map(([dept, members]) => (
            <Box key={dept} sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: T.teal, mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {dept}
              </Typography>
              {members.map((c, i) => (
                <Box key={c.creditId ?? i} sx={{ py: 0.4, borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, minWidth: 180, flexShrink: 0 }}>
                    {c.person?.name ?? '—'}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: T.textMuted }}>
                    {c.job ?? ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          ))}
        </>
      )}

      {cast.length === 0 && crew.length === 0 && (
        <Typography sx={{ fontSize: 13, color: T.textMuted }}>No credits available.</Typography>
      )}
    </Box>
  );
}

// ── Media Tab ─────────────────────────────────────────────────────

function MediaTab({ tmdb }) {
  const T = useT();
  const videos = tmdb.videos ?? [];
  const images = tmdb.images ?? [];

  return (
    <Box>
      {videos.length > 0 && (
        <>
          <SectionTitle>Videos ({videos.length})</SectionTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {videos.map((v, i) => (
              <Box key={i} sx={{ p: 1.5, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, flex: 1 }}>{v.name}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, ml: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {v.type && (
                      <Chip label={v.type} size="small"
                        sx={{ fontSize: 9, height: 18, bgcolor: T.tealBg, color: T.teal }} />
                    )}
                    {v.site && (
                      <Chip label={v.site} size="small"
                        sx={{ fontSize: 9, height: 18, bgcolor: `${T.success}22`, color: T.success }} />
                    )}
                    {v.official && (
                      <Chip label="Official" size="small"
                        sx={{ fontSize: 9, height: 18, bgcolor: `${T.warning}22`, color: T.warning }} />
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography sx={{ fontSize: 11, color: T.textFaint, fontFamily: 'monospace' }}>{v.key}</Typography>
                  {v.site === 'YouTube' && v.key && (
                    <Box component="a"
                      href={`https://www.youtube.com/watch?v=${v.key}`}
                      target="_blank" rel="noreferrer"
                      sx={{ display: 'flex', alignItems: 'center', color: T.teal, '&:hover': { color: T.tealHover } }}>
                      <OpenInNewIcon sx={{ fontSize: 14 }} />
                    </Box>
                  )}
                  {v.size && (
                    <Typography sx={{ fontSize: 10, color: T.textFaint }}>{v.size}p</Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
          <Divider sx={{ borderColor: T.border, my: 2 }} />
        </>
      )}

      {images.length > 0 && (
        <>
          <SectionTitle>Images ({images.length})</SectionTitle>
          {/* Header row */}
          <Box sx={{ display: 'flex', gap: 1, py: 0.5, borderBottom: `1px solid ${T.border}` }}>
            <Typography sx={{ fontSize: 10, color: T.textFaint, minWidth: 80, flexShrink: 0, fontWeight: 700 }}>Type</Typography>
            <Typography sx={{ fontSize: 10, color: T.textFaint, flex: 1, fontWeight: 700 }}>Path</Typography>
            <Typography sx={{ fontSize: 10, color: T.textFaint, minWidth: 80, flexShrink: 0, textAlign: 'right', fontWeight: 700 }}>Dimensions</Typography>
          </Box>
          {images.map((img, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, py: 0.4, borderBottom: `1px solid ${T.border}` }}>
              <Typography sx={{ fontSize: 11, color: T.textMuted, minWidth: 80, flexShrink: 0 }}>
                {img.imageType ?? '—'}
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.teal, fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>
                {img.filePath}
              </Typography>
              <Typography sx={{ fontSize: 10, color: T.textFaint, minWidth: 80, flexShrink: 0, textAlign: 'right' }}>
                {img.width && img.height ? `${img.width}×${img.height}` : ''}
              </Typography>
            </Box>
          ))}
        </>
      )}

      {videos.length === 0 && images.length === 0 && (
        <Typography sx={{ fontSize: 13, color: T.textMuted }}>No media files linked.</Typography>
      )}
    </Box>
  );
}

// ── Providers Tab ─────────────────────────────────────────────────

const PROVIDER_TYPE_LABEL = { FLATRATE: 'Streaming', RENT: 'Rent', BUY: 'Buy', NETWORK: 'Network' };

function ProvidersTab({ tmdb }) {
  const T = useT();
  const providers = tmdb.providers ?? [];

  const grouped = providers.reduce((acc, p) => {
    const type = p.providerType ?? 'OTHER';
    (acc[type] = acc[type] ?? []).push(p);
    return acc;
  }, {});

  return (
    <Box>
      {providers.length === 0 && (
        <Typography sx={{ fontSize: 13, color: T.textMuted, mb: 2 }}>No providers linked.</Typography>
      )}

      {Object.entries(grouped).map(([type, list]) => (
        <Box key={type} sx={{ mb: 2.5 }}>
          <SectionTitle>{PROVIDER_TYPE_LABEL[type] ?? type} ({list.length})</SectionTitle>
          {[...list]
            .sort((a, b) => (a.provider?.displayPriority ?? 99) - (b.provider?.displayPriority ?? 99))
            .map((p, i) => (
              <Box key={i} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                py: 0.75, borderBottom: `1px solid ${T.border}`,
              }}>
                <Typography sx={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, flex: 1 }}>
                  {p.provider?.name ?? '—'}
                </Typography>
                {p.regionCode && (
                  <Chip label={p.regionCode} size="small"
                    sx={{ fontSize: 10, height: 20, bgcolor: T.tealBg, color: T.teal }} />
                )}
              </Box>
            ))}
        </Box>
      ))}
    </Box>
  );
}

// ── Reviews Tab ───────────────────────────────────────────────────

function ReviewCard({ review }) {
  const T = useT();
  const [expanded, setExpanded] = useState(false);
  const longContent = review.content && review.content.length > 300;

  return (
    <Box sx={{ mb: 1.5, p: 1.5, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
          {review.authorDetails?.username ?? review.author ?? 'Anonymous'}
        </Typography>
        {review.authorDetails?.rating != null && (
          <Typography sx={{ fontSize: 12, color: ratingColor(review.authorDetails.rating / 10 * 10) }}>
            ★ {review.authorDetails.rating}
          </Typography>
        )}
      </Box>
      {review.content && (
        <>
          <Typography sx={{
            fontSize: 12, color: T.textMuted, lineHeight: 1.6,
            ...(longContent && !expanded
              ? { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }
              : {}),
          }}>
            {review.content}
          </Typography>
          {longContent && (
            <Box component="button" onClick={() => setExpanded(e => !e)}
              sx={{
                mt: 0.5, background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: T.teal, p: 0, '&:hover': { color: T.tealHover },
              }}>
              {expanded ? 'Show less' : 'Show more'}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

function ReviewsTab({ tmdb }) {
  const T = useT();
  const reviews = tmdb.reviews ?? [];

  if (reviews.length === 0) {
    return <Typography sx={{ fontSize: 13, color: T.textMuted }}>No reviews available.</Typography>;
  }

  return (
    <Box>
      <SectionTitle>Reviews ({reviews.length})</SectionTitle>
      {reviews.map((r, i) => <ReviewCard key={i} review={r} />)}
    </Box>
  );
}

// ── Seasons Tab (TV only) ─────────────────────────────────────────

function SeasonRow({ season }) {
  const T = useT();
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ mb: 1, border: `1px solid ${T.glassBorder}`, borderRadius: 1, overflow: 'hidden' }}>
      {/* Season header — clickable */}
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 1.5, py: 1, bgcolor: T.glass, cursor: 'pointer',
          '&:hover': { bgcolor: T.tealBg },
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
            Season {season.seasonNumber}{season.name ? ` — ${season.name}` : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
            {season.airDate && (
              <Typography sx={{ fontSize: 10, color: T.textFaint }}>{season.airDate}</Typography>
            )}
            {(season.episodeCount ?? season.episodes?.length) != null && (
              <Typography sx={{ fontSize: 10, color: T.textFaint }}>
                {season.episodeCount ?? season.episodes?.length} episodes
              </Typography>
            )}
            {season.voteAverage > 0 && (
              <Typography sx={{ fontSize: 10, color: ratingColor(season.voteAverage) }}>
                ★ {season.voteAverage.toFixed(1)}
              </Typography>
            )}
          </Box>
        </Box>
        {open ? <ExpandLessIcon sx={{ color: T.textFaint, fontSize: 18 }} /> : <ExpandMoreIcon sx={{ color: T.textFaint, fontSize: 18 }} />}
      </Box>

      {/* Episode list */}
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1, pt: 0.5 }}>
          {season.overview && (
            <Typography sx={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6, mb: 1 }}>{season.overview}</Typography>
          )}
          {season.episodes?.length > 0 ? (
            season.episodes.map((ep, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, py: 0.4, borderBottom: `1px solid ${T.border}`, alignItems: 'flex-start' }}>
                <Typography sx={{ fontSize: 11, color: T.textFaint, minWidth: 36, flexShrink: 0, fontFamily: 'monospace' }}>
                  E{String(ep.episodeNumber).padStart(2, '0')}
                </Typography>
                <Typography sx={{ fontSize: 12, color: T.textPrimary, flex: 1 }}>{ep.name}</Typography>
                <Typography sx={{ fontSize: 10, color: T.textFaint, flexShrink: 0 }}>{ep.airDate}</Typography>
                {ep.runtime && (
                  <Typography sx={{ fontSize: 10, color: T.textFaint, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>
                    {ep.runtime}m
                  </Typography>
                )}
              </Box>
            ))
          ) : (
            <Typography sx={{ fontSize: 12, color: T.textFaint }}>No episode data.</Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

function SeasonsTab({ tmdb }) {
  const T = useT();
  const seasons = tmdb.seasons ?? [];

  if (seasons.length === 0) {
    return <Typography sx={{ fontSize: 13, color: T.textMuted }}>No season data available.</Typography>;
  }

  return (
    <Box>
      <SectionTitle>Seasons ({seasons.length})</SectionTitle>
      {seasons.map((s, i) => <SeasonRow key={i} season={s} />)}
    </Box>
  );
}

// ── Dialog Header ─────────────────────────────────────────────────

function ModalHeader({ record, tmdb, isMovie, onClose }) {
  const T = useT();

  const posterUrl   = tmdb ? tmdbPoster(tmdb.posterPath)     : null;
  const backdropUrl = tmdb ? tmdbBackdrop(tmdb.backdropPath) : null;
  const rating      = tmdb?.voteAverage ?? 0;
  const genres      = tmdb?.genres ?? [];
  const titleDiffers = tmdb && tmdb.originalTitle && tmdb.originalTitle !== tmdb.title;

  return (
    <Box sx={{ position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
      {/* Backdrop blur layer */}
      {backdropUrl && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${backdropUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.18, filter: 'blur(4px)', transform: 'scale(1.05)',
        }} />
      )}
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 1, bgcolor: T.sidebar, opacity: backdropUrl ? 0.7 : 1 }} />

      {/* Close button */}
      <IconButton onClick={onClose} size="small"
        sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10, color: T.textMuted, bgcolor: `${T.sidebar}cc`,
          '&:hover': { bgcolor: T.glass } }}>
        <CloseIcon fontSize="small" />
      </IconButton>

      {/* Content */}
      <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', gap: 2, px: 2.5, pt: 2, pb: 1.5 }}>
        {/* Poster */}
        <Box sx={{ flexShrink: 0 }}>
          {posterUrl ? (
            <Box component="img" src={posterUrl} alt="poster"
              sx={{ height: { xs: 100, sm: 120 }, borderRadius: 1, objectFit: 'cover', display: 'block', boxShadow: 3 }} />
          ) : (
            <Box sx={{
              width: { xs: 68, sm: 80 }, height: { xs: 100, sm: 120 },
              bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MovieIcon sx={{ color: T.textFaint, fontSize: 32 }} />
            </Box>
          )}
        </Box>

        {/* Title area */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={isMovie ? 'Movie' : 'Series'} size="small"
              sx={{ fontSize: 9, height: 18, fontWeight: 700,
                bgcolor: isMovie ? T.tealBg : `${T.success}22`,
                color: isMovie ? T.teal : T.success }} />
            {record?.year && (
              <Chip label={record.year} size="small"
                sx={{ fontSize: 9, height: 18, bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.border}` }} />
            )}
            {tmdb?.imdbId && (
              <Box component="a"
                href={`https://www.imdb.com/title/${tmdb.imdbId}`}
                target="_blank" rel="noreferrer"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.25, fontSize: 10,
                  color: '#f5c518', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                IMDb <OpenInNewIcon sx={{ fontSize: 10 }} />
              </Box>
            )}
            {record?.tmdbId && (
              <Box component="a"
                href={`https://www.themoviedb.org/${isMovie ? 'movie' : 'tv'}/${record.tmdbId}`}
                target="_blank" rel="noreferrer"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.25, fontSize: 10,
                  color: T.teal, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                TMDB <OpenInNewIcon sx={{ fontSize: 10 }} />
              </Box>
            )}
          </Box>

          <Typography sx={{ fontWeight: 700, fontSize: { xs: 16, sm: 20 }, color: T.textPrimary, lineHeight: 1.2 }}>
            {tmdb?.title ?? record?.name}
          </Typography>

          {titleDiffers && (
            <Typography sx={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>
              {tmdb.originalTitle}
            </Typography>
          )}

          {genres.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
              {genres.map(g => (
                <Chip key={g.id ?? g.name} label={g.name} size="small"
                  sx={{ fontSize: 10, height: 20, bgcolor: T.tealBg, color: T.teal }} />
              ))}
            </Box>
          )}
        </Box>

        {/* Rating badge */}
        {tmdb && rating > 0 && (
          <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
            <Box sx={{
              width: 52, height: 52, borderRadius: '50%',
              border: `3px solid ${ratingColor(rating)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: `${ratingColor(rating)}22`,
            }}>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: ratingColor(rating), lineHeight: 1 }}>
                {rating.toFixed(1)}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 9, color: T.textFaint, textAlign: 'center' }}>
              ★ {tmdb.voteCount?.toLocaleString() ?? 0}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Main Modal ────────────────────────────────────────────────────

const MOVIE_TABS = ['Overview', 'Cast & Crew', 'Media', 'Providers', 'Reviews'];
const TV_TABS    = ['Overview', 'Cast & Crew', 'Media', 'Providers', 'Reviews', 'Seasons'];

export default function TmdbDetailModal({ record, onClose }) {
  const T = useT();
  const [tab, setTab] = useState(0);
  const isXs = useMediaQuery('(max-width:600px)');

  const open    = Boolean(record);
  const isMovie = record?.type === 'MOVIE';

  const { data: tmdb, isLoading, error } = useQuery({
    queryKey: ['tmdbDetail', record?.type, record?.tmdbId],
    queryFn:  () => getTmdbDetail(record.type, record.tmdbId),
    enabled:  open && Boolean(record?.tmdbId) && Boolean(record?.type),
    staleTime: 5 * 60 * 1000,
  });

  const tabs = isMovie ? MOVIE_TABS : TV_TABS;

  const handleClose = () => {
    setTab(0);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="lg"
      fullScreen={isXs}
      PaperProps={{
        sx: {
          bgcolor: T.sidebar,
          color: T.textPrimary,
          border: isXs ? 'none' : `1px solid ${T.glassBorder}`,
          borderRadius: isXs ? 0 : 2,
          height: isXs ? '100%' : '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header with backdrop + poster + title */}
      <ModalHeader record={record} tmdb={tmdb} isMovie={isMovie} onClose={handleClose} />

      {/* Tab bar */}
      <Box sx={{ borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 38,
            '& .MuiTab-root': {
              minHeight: 38, fontSize: 12, color: T.textMuted,
              textTransform: 'none', py: 0, px: 1.5,
            },
            '& .Mui-selected': { color: `${T.teal} !important` },
            '& .MuiTabs-indicator': { bgcolor: T.teal },
          }}
        >
          {tabs.map(t => <Tab key={t} label={t} />)}
        </Tabs>
      </Box>

      {/* Scrollable content */}
      <DialogContent sx={{
        p: { xs: 2, sm: 2.5 }, overflowY: 'auto', flex: 1,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 },
      }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
            <CircularProgress size={30} sx={{ color: T.teal }} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{
            bgcolor: T.errorBg, color: T.error,
            border: `1px solid ${T.error}44`,
            '& .MuiAlert-icon': { color: T.error },
          }}>
            Failed to load TMDB details. Please try again.
          </Alert>
        )}

        {!isLoading && !error && !tmdb && open && (
          <Typography sx={{ fontSize: 13, color: T.textMuted }}>No data available.</Typography>
        )}

        {tmdb && (
          <>
            {tab === 0 && <OverviewTab  tmdb={tmdb} isMovie={isMovie} />}
            {tab === 1 && <CastCrewTab  tmdb={tmdb} />}
            {tab === 2 && <MediaTab     tmdb={tmdb} />}
            {tab === 3 && <ProvidersTab tmdb={tmdb} />}
            {tab === 4 && <ReviewsTab   tmdb={tmdb} />}
            {tab === 5 && !isMovie && <SeasonsTab tmdb={tmdb} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
