import { useState } from 'react';
import {
  Dialog, DialogContent, Box, Typography, Chip, Divider,
  IconButton, CircularProgress, Tab, Tabs, Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { getTmdbDetail } from '../api/adminApi';

// ── Shared sub-components (each calls useT internally) ────────────

const SectionTitle = ({ children }) => {
  const T = useT();
  return (
    <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: T.textFaint, mb: 1 }}>
      {children}
    </Typography>
  );
};

const KV = ({ label, value }) => {
  const T = useT();
  if (value === null || value === undefined || value === '') return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, py: .5, borderBottom: `1px solid ${T.border}` }}>
      <Typography sx={{ fontSize: 11, color: T.textFaint, minWidth: 140, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color: T.textPrimary, wordBreak: 'break-all' }}>{String(value)}</Typography>
    </Box>
  );
};

const PathText = ({ label, value }) => {
  const T = useT();
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, py: .5, borderBottom: `1px solid ${T.border}` }}>
      <Typography sx={{ fontSize: 11, color: T.textFaint, minWidth: 140, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 11, color: T.teal, fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  );
};

// ── Overview Tab ──────────────────────────────────────────────────

function OverviewTab({ tmdb, isMovie }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: .25 }}>
      <SectionTitle>Basic Info</SectionTitle>
      <KV label="Title"            value={tmdb.title} />
      <KV label="Original Title"   value={tmdb.originalTitle} />
      <KV label="TMDB ID"          value={tmdb.id} />
      <KV label="Status"           value={tmdb.status} />
      <KV label="Tagline"          value={tmdb.tagline} />
      <KV label="Overview"         value={tmdb.overview} />
      <KV label="Homepage"         value={tmdb.homepage} />
      <KV label="Language"         value={tmdb.originalLanguage?.toUpperCase()} />
      <KV label="Adult"            value={String(tmdb.adult)} />
      <KV label="Popularity"       value={tmdb.popularity?.toFixed(2)} />
      <KV label="Vote Average"     value={`${tmdb.voteAverage?.toFixed(1)} / 10 (${tmdb.voteCount} votes)`} />

      {isMovie ? (
        <>
          <KV label="Release Date"   value={tmdb.releaseDate} />
          <KV label="Runtime"        value={tmdb.runtime ? `${tmdb.runtime} min` : null} />
          <KV label="Budget"         value={tmdb.budget ? `$${tmdb.budget?.toLocaleString()}` : null} />
          <KV label="Revenue"        value={tmdb.revenue ? `$${tmdb.revenue?.toLocaleString()}` : null} />
          <KV label="IMDB ID"        value={tmdb.imdbId} />
        </>
      ) : (
        <>
          <KV label="First Air Date"    value={tmdb.firstAirDate} />
          <KV label="Last Air Date"     value={tmdb.lastAirDate} />
          <KV label="In Production"     value={String(tmdb.inProduction)} />
          <KV label="Number of Seasons" value={tmdb.numberOfSeasons} />
          <KV label="Number of Episodes"value={tmdb.numberOfEpisodes} />
          <KV label="Episode Run Times" value={tmdb.episodeRunTimes?.join(', ')} />
          <KV label="Type"              value={tmdb.type} />
        </>
      )}

      <PathText label="Poster Path"   value={tmdb.posterPath} />
      <PathText label="Backdrop Path" value={tmdb.backdropPath} />

      {tmdb.genres?.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <SectionTitle>Genres</SectionTitle>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5 }}>
            {tmdb.genres.map(g => (
              <Chip key={g.id ?? g.name} label={g.name} size="small"
                sx={{ bgcolor: T.tealBg, color: T.teal, fontWeight: 600, fontSize: 11 }} />
            ))}
          </Box>
        </Box>
      )}

      {tmdb.productionCompanies?.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <SectionTitle>Production Companies</SectionTitle>
          {tmdb.productionCompanies.map((c, i) => (
            <KV key={i} label={`Company ${i + 1}`} value={`${c.name}${c.originCountry ? ` (${c.originCountry})` : ''}`} />
          ))}
        </Box>
      )}

      {tmdb.productionCountries?.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <SectionTitle>Production Countries</SectionTitle>
          <Typography sx={{ fontSize: 12, color: T.textPrimary }}>
            {tmdb.productionCountries.map(c => c.name ?? c.iso_3166_1).join(', ')}
          </Typography>
        </Box>
      )}

      {tmdb.spokenLanguages?.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <SectionTitle>Spoken Languages</SectionTitle>
          <Typography sx={{ fontSize: 12, color: T.textPrimary }}>
            {tmdb.spokenLanguages.map(l => l.name ?? l.englishName ?? l.iso_639_1).join(', ')}
          </Typography>
        </Box>
      )}

      {tmdb.belongsToCollection && (
        <Box sx={{ mt: 1.5 }}>
          <SectionTitle>Collection</SectionTitle>
          <KV label="Name"        value={tmdb.belongsToCollection.name} />
          <KV label="TMDB ID"     value={tmdb.belongsToCollection.id} />
          <PathText label="Poster"    value={tmdb.belongsToCollection.posterPath} />
          <PathText label="Backdrop"  value={tmdb.belongsToCollection.backdropPath} />
        </Box>
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
          {videos.map((v, i) => (
            <Box key={i} sx={{ mb: 1, p: 1, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 1 }}>
              <KV label="Name"    value={v.name} />
              <KV label="Type"    value={v.type} />
              <KV label="Site"    value={v.site} />
              <KV label="Size"    value={v.size} />
              <KV label="Official" value={String(v.official)} />
              <Box sx={{ display: 'flex', gap: 1, py: .5 }}>
                <Typography sx={{ fontSize: 11, color: T.textFaint, minWidth: 140, flexShrink: 0 }}>Key / URL</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: .5 }}>
                  <Typography sx={{ fontSize: 11, color: T.teal, fontFamily: 'monospace' }}>{v.key}</Typography>
                  {v.site === 'YouTube' && (
                    <Box component="a"
                      href={`https://www.youtube.com/watch?v=${v.key}`}
                      target="_blank" rel="noreferrer"
                      sx={{ color: T.teal, display: 'flex', alignItems: 'center', '&:hover': { color: T.tealHover } }}>
                      <OpenInNewIcon sx={{ fontSize: 13 }} />
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
          <Divider sx={{ borderColor: T.border, my: 2 }} />
        </>
      )}

      {images.length > 0 && (
        <>
          <SectionTitle>Images ({images.length})</SectionTitle>
          {images.map((img, i) => (
            <Box key={i} sx={{ mb: .5, py: .5, borderBottom: `1px solid ${T.border}` }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Typography sx={{ fontSize: 11, color: T.textFaint, minWidth: 60, flexShrink: 0 }}>
                  {img.imageType ?? '—'}
                </Typography>
                <Typography sx={{ fontSize: 11, color: T.teal, fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>
                  {img.filePath}
                </Typography>
                <Typography sx={{ fontSize: 10, color: T.textFaint, flexShrink: 0 }}>
                  {img.width && img.height ? `${img.width}×${img.height}` : ''}
                </Typography>
              </Box>
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

// ── Credits Tab ───────────────────────────────────────────────────

function CreditsTab({ tmdb }) {
  const T = useT();
  // CreditDto shape: { person: {name, profilePath, ...}, creditType, character, job, department, castOrder, creditId }
  const cast = (tmdb.credits ?? []).filter(c => c.creditType === 'CAST');
  const crew = (tmdb.credits ?? []).filter(c => c.creditType === 'CREW');

  // Sort cast by order
  const sortedCast = [...cast].sort((a, b) => (a.castOrder ?? 999) - (b.castOrder ?? 999));

  return (
    <Box>
      {sortedCast.length > 0 && (
        <>
          <SectionTitle>Cast ({sortedCast.length})</SectionTitle>
          {sortedCast.map((c, i) => (
            <Box key={c.creditId ?? i} sx={{ display: 'flex', gap: 1, py: .5, borderBottom: `1px solid ${T.border}` }}>
              <Box sx={{ minWidth: 140, flexShrink: 0 }}>
                <Typography sx={{ fontSize: 12, color: T.textPrimary, fontWeight: 600 }}>
                  {c.person?.name ?? '—'}
                </Typography>
                {c.character && (
                  <Typography sx={{ fontSize: 11, color: T.textMuted }}>as {c.character}</Typography>
                )}
              </Box>
              <Box sx={{ flex: 1 }}>
                {c.person?.profilePath && (
                  <Typography sx={{ fontSize: 10, color: T.teal, fontFamily: 'monospace' }}>
                    {c.person.profilePath}
                  </Typography>
                )}
                {c.castOrder != null && (
                  <Typography sx={{ fontSize: 10, color: T.textFaint }}>Order: {c.castOrder}</Typography>
                )}
              </Box>
            </Box>
          ))}
          <Divider sx={{ borderColor: T.border, my: 2 }} />
        </>
      )}

      {crew.length > 0 && (
        <>
          <SectionTitle>Crew ({crew.length})</SectionTitle>
          {crew.map((c, i) => (
            <Box key={c.creditId ?? i} sx={{ display: 'flex', gap: 1, py: .5, borderBottom: `1px solid ${T.border}` }}>
              <Box sx={{ minWidth: 140, flexShrink: 0 }}>
                <Typography sx={{ fontSize: 12, color: T.textPrimary, fontWeight: 600 }}>
                  {c.person?.name ?? '—'}
                </Typography>
                <Typography sx={{ fontSize: 11, color: T.textMuted }}>
                  {[c.job, c.department].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              {c.person?.profilePath && (
                <Typography sx={{ fontSize: 10, color: T.teal, fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>
                  {c.person.profilePath}
                </Typography>
              )}
            </Box>
          ))}
        </>
      )}

      {cast.length === 0 && crew.length === 0 && (
        <Typography sx={{ fontSize: 13, color: T.textMuted }}>No credits linked.</Typography>
      )}
    </Box>
  );
}

// ── Providers Tab ─────────────────────────────────────────────────

// Group providers by type for better readability
const PROVIDER_TYPE_LABEL = { FLATRATE: 'Streaming', RENT: 'Rent', BUY: 'Buy', NETWORK: 'Network' };

function ProvidersTab({ tmdb }) {
  const T = useT();
  // TmdbProviderDto shape: { id, provider: {id, name, logoPath, displayPriority}, providerType, regionCode }
  const providers = tmdb.providers ?? [];
  if (providers.length === 0) {
    return <Typography sx={{ fontSize: 13, color: T.textMuted }}>No providers linked.</Typography>;
  }

  // Group by providerType
  const grouped = providers.reduce((acc, p) => {
    const type = p.providerType ?? 'OTHER';
    (acc[type] = acc[type] ?? []).push(p);
    return acc;
  }, {});

  return (
    <Box>
      {Object.entries(grouped).map(([type, list]) => (
        <Box key={type} sx={{ mb: 2 }}>
          <SectionTitle>{PROVIDER_TYPE_LABEL[type] ?? type} ({list.length})</SectionTitle>
          {list
            .sort((a, b) => (a.provider?.displayPriority ?? 99) - (b.provider?.displayPriority ?? 99))
            .map((p, i) => (
              <Box key={p.id ?? i} sx={{ display: 'flex', gap: 1, py: .5, borderBottom: `1px solid ${T.border}` }}>
                <Box sx={{ minWidth: 200, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: 12, color: T.textPrimary, fontWeight: 600 }}>
                    {p.provider?.name ?? '—'}
                  </Typography>
                  {p.regionCode && (
                    <Typography sx={{ fontSize: 10, color: T.textMuted }}>Region: {p.regionCode}</Typography>
                  )}
                </Box>
                {p.provider?.logoPath && (
                  <Typography sx={{ fontSize: 10, color: T.teal, fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>
                    {p.provider.logoPath}
                  </Typography>
                )}
              </Box>
            ))}
        </Box>
      ))}

      {tmdb.reviews?.length > 0 && (
        <>
          <Divider sx={{ borderColor: T.border, my: 2 }} />
          <SectionTitle>Reviews ({tmdb.reviews.length})</SectionTitle>
          {tmdb.reviews.map((r, i) => (
            <Box key={i} sx={{ mb: 1.5, p: 1.5, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: .5 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>{r.authorDetails?.username ?? r.author}</Typography>
                {r.authorDetails?.rating && (
                  <Typography sx={{ fontSize: 12, color: T.warning }}>★ {r.authorDetails.rating}</Typography>
                )}
              </Box>
              {r.content && (
                <Typography sx={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                  {r.content}
                </Typography>
              )}
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}

// ── Seasons Tab (TV only) ─────────────────────────────────────────

function SeasonsTab({ tmdb }) {
  const T = useT();
  const seasons = tmdb.seasons ?? [];
  if (seasons.length === 0) {
    return <Typography sx={{ fontSize: 13, color: T.textMuted }}>No seasons data.</Typography>;
  }
  return (
    <Box>
      {tmdb.createdBy?.length > 0 && (
        <>
          <SectionTitle>Created By</SectionTitle>
          {tmdb.createdBy.map((p, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, py: .5, borderBottom: `1px solid ${T.border}` }}>
              <Typography sx={{ fontSize: 12, color: T.textPrimary, minWidth: 140 }}>{p.name}</Typography>
              {p.profilePath && <Typography sx={{ fontSize: 10, color: T.teal, fontFamily: 'monospace' }}>{p.profilePath}</Typography>}
            </Box>
          ))}
          <Divider sx={{ borderColor: T.border, my: 2 }} />
        </>
      )}

      {tmdb.lastEpisodeToAir && (
        <>
          <SectionTitle>Last Episode</SectionTitle>
          <KV label="Name"    value={tmdb.lastEpisodeToAir.name} />
          <KV label="Air Date" value={tmdb.lastEpisodeToAir.airDate} />
          <KV label="Season"  value={tmdb.lastEpisodeToAir.seasonNumber} />
          <KV label="Episode" value={tmdb.lastEpisodeToAir.episodeNumber} />
          <Divider sx={{ borderColor: T.border, my: 2 }} />
        </>
      )}

      <SectionTitle>Seasons ({seasons.length})</SectionTitle>
      {seasons.map((s, i) => (
        <Box key={i} sx={{ mb: 1.5, p: 1.5, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, mb: .5 }}>
            Season {s.seasonNumber} — {s.name}
          </Typography>
          <KV label="Air Date"      value={s.airDate} />
          <KV label="Episode Count" value={s.episodeCount ?? s.episodes?.length} />
          <PathText label="Poster"  value={s.posterPath} />

          {s.episodes?.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography sx={{ fontSize: 10, color: T.textFaint, mb: .5 }}>Episodes ({s.episodes.length})</Typography>
              {s.episodes.map((e, j) => (
                <Box key={j} sx={{ display: 'flex', gap: 1, py: .4, borderBottom: `1px solid ${T.border}` }}>
                  <Typography sx={{ fontSize: 11, color: T.textFaint, minWidth: 36 }}>E{e.episodeNumber}</Typography>
                  <Typography sx={{ fontSize: 11, color: T.textPrimary, flex: 1 }}>{e.name}</Typography>
                  <Typography sx={{ fontSize: 10, color: T.textFaint }}>{e.airDate}</Typography>
                  <Typography sx={{ fontSize: 10, color: T.textFaint }}>{e.runtime ? `${e.runtime}m` : ''}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

// ── Main Modal ────────────────────────────────────────────────────

export default function TmdbDetailModal({ record, onClose }) {
  const T = useT();
  const [tab, setTab] = useState(0);

  const open    = Boolean(record);
  const isMovie = record?.type === 'MOVIE';

  const { data: tmdb, isLoading, error } = useQuery({
    queryKey: ['tmdbDetail', record?.type, record?.tmdbId],
    queryFn:  () => getTmdbDetail(record.type, record.tmdbId),
    enabled:  open && Boolean(record?.tmdbId) && Boolean(record?.type),
    staleTime: 5 * 60 * 1000,
  });

  const tabs = isMovie
    ? ['Overview', 'Media', 'Credits', 'Providers']
    : ['Overview', 'Media', 'Credits', 'Providers', 'Seasons'];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"
      PaperProps={{ sx: { bgcolor: T.sidebar, color: T.textPrimary, border: `1px solid ${T.glassBorder}`, borderRadius: 2, height: '85vh', display: 'flex', flexDirection: 'column' } }}>

      {/* Header */}
      <Box sx={{ px: 3, pt: 2.5, pb: 1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: .5 }}>
              {isMovie
                ? <MovieIcon sx={{ fontSize: 16, color: T.teal }} />
                : <TvIcon    sx={{ fontSize: 16, color: T.success }} />}
              <Chip
                label={isMovie ? 'Movie' : 'Series'} size="small"
                sx={{ bgcolor: isMovie ? T.tealBg : `${T.success}20`, color: isMovie ? T.teal : T.success, fontWeight: 700, fontSize: 10 }}
              />
              {record?.year && <Typography sx={{ fontSize: 12, color: T.textFaint }}>{record.year}</Typography>}
              {record?.tmdbId && (
                <Box component="a"
                  href={`https://www.themoviedb.org/${isMovie ? 'movie' : 'tv'}/${record.tmdbId}`}
                  target="_blank" rel="noreferrer"
                  sx={{ display: 'flex', alignItems: 'center', gap: .25, color: T.teal, textDecoration: 'none', fontSize: 12, '&:hover': { textDecoration: 'underline' } }}>
                  TMDB #{record.tmdbId} <OpenInNewIcon sx={{ fontSize: 11 }} />
                </Box>
              )}
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: T.textPrimary }}>{record?.name}</Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: T.textMuted, mt: -.5 }}><CloseIcon /></IconButton>
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
          minHeight: 36,
          '& .MuiTab-root': { minHeight: 36, fontSize: 12, color: T.textMuted, textTransform: 'none', py: 0 },
          '& .Mui-selected': { color: `${T.teal} !important` },
          '& .MuiTabs-indicator': { bgcolor: T.teal },
        }}>
          {tabs.map(t => <Tab key={t} label={t} />)}
        </Tabs>
      </Box>

      {/* Content */}
      <DialogContent sx={{ p: 3, overflowY: 'auto', flex: 1, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: T.teal }} />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}44`, '& .MuiAlert-icon': { color: T.error } }}>
            Failed to load TMDB details
          </Alert>
        )}
        {tmdb && (
          <>
            {tab === 0 && <OverviewTab tmdb={tmdb} isMovie={isMovie} />}
            {tab === 1 && <MediaTab    tmdb={tmdb} />}
            {tab === 2 && <CreditsTab  tmdb={tmdb} />}
            {tab === 3 && <ProvidersTab tmdb={tmdb} />}
            {tab === 4 && !isMovie && <SeasonsTab tmdb={tmdb} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
