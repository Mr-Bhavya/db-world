import React, { useMemo, useState } from 'react';
import { Box, Chip, Paper, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';
import StatRow from '../shared/StatRow';
import { formatCurrency, formatDate, formatRuntime } from '../helpers';

// Best-effort region detection. navigator.language returns "en-IN" / "en-US"
// etc.; pull the country half. Falls back to IN.
function detectUserRegion() {
  try {
    const lang = navigator.language || (navigator.languages && navigator.languages[0]) || '';
    const region = lang.split('-')[1]?.toUpperCase();
    if (region && region.length === 2) return region;
  } catch { /* ignore */ }
  return 'IN';
}

export default function OverviewSection({ record }) {
  const T = useT();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const providers = tmdb.providers ?? [];

  // Available regions from the record's provider list.
  const availableRegions = useMemo(() => {
    const set = new Set(providers.map((p) => p.regionCode).filter(Boolean));
    return Array.from(set);
  }, [providers]);

  const userRegion = useMemo(detectUserRegion, []);

  // Pick the region we actually want to show. Preference order:
  //   1. user's detected region (if the title has providers there)
  //   2. India (if available)
  //   3. US (common fallback)
  //   4. first region in the list
  const defaultRegion = useMemo(() => {
    if (availableRegions.includes(userRegion)) return userRegion;
    if (availableRegions.includes('IN')) return 'IN';
    if (availableRegions.includes('US')) return 'US';
    return availableRegions[0] ?? null;
  }, [availableRegions, userRegion]);

  const [selectedRegion, setSelectedRegion] = useState(defaultRegion);

  // Only show providers for the chosen region.
  const regionalProviders = useMemo(
    () => (selectedRegion ? providers.filter((p) => p.regionCode === selectedRegion) : []),
    [providers, selectedRegion],
  );

  const grouped = regionalProviders.reduce((acc, p) => {
    const type = p.providerType ?? 'OTHER';
    if (!acc[type]) acc[type] = [];
    acc[type].push(p);
    return acc;
  }, {});
  Object.values(grouped).forEach((arr) =>
    arr.sort((a, b) => (a.provider?.displayPriority ?? 99) - (b.provider?.displayPriority ?? 99))
  );
  const providerOrder = ['FLATRATE', 'NETWORK', 'RENT', 'BUY'];
  const typeLabel = { FLATRATE: 'Streaming', RENT: 'Rent', BUY: 'Buy', NETWORK: 'Network' };
  const sortedProviderKeys = [
    ...providerOrder.filter((k) => grouped[k]),
    ...Object.keys(grouped).filter((k) => !providerOrder.includes(k)),
  ];

  // Order region chips: user's region first, then IN, US, then alphabetic.
  const sortedRegionChips = useMemo(() => {
    const priority = (r) => {
      if (r === userRegion) return 0;
      if (r === 'IN') return 1;
      if (r === 'US') return 2;
      return 3;
    };
    return [...availableRegions].sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
  }, [availableRegions, userRegion]);

  const chipSx = { bgcolor: alpha(T.teal, 0.12), color: T.teal, fontSize: '0.72rem', border: `1px solid ${alpha(T.teal, 0.2)}` };
  const subChipSx = { bgcolor: T.glass, color: T.textMuted, fontSize: '0.72rem' };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 3 }}
    >

      {/* ── Mobile poster (floated, magazine-style text wrap) ── */}
      {isMobile && tmdb.posterPath && (
        <Box sx={{
          float: 'left',
          width: 100,
          mr: 2, mb: 1.5,
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <Box
            component="img"
            src={tmdbImg(tmdb.posterPath, 'w185')}
            alt={tmdb.title}
            draggable={false}
            sx={{ width: '100%', display: 'block' }}
          />
        </Box>
      )}

      {tmdb.overview && (
        <Typography variant="body1" sx={{
          color: T.textMuted, lineHeight: 1.85, mb: 4, maxWidth: 760,
          fontSize: { xs: '0.95rem', md: '1rem' },
        }}>
          {tmdb.overview}
        </Typography>
      )}

      {/* Clear float so the grid below doesn't overlap the poster */}
      {isMobile && tmdb.posterPath && <Box sx={{ clear: 'both' }} />}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 3, md: 5 } }}>
        <Box>
          <SectionHeading>Details</SectionHeading>
          {isMovie ? (
            <>
              <StatRow label="Release Date" value={formatDate(tmdb.releaseDate)} />
              <StatRow label="Runtime" value={formatRuntime(tmdb.runtime)} />
              <StatRow label="Status" value={tmdb.status} />
              <StatRow label="Language" value={tmdb.originalLanguage?.toUpperCase()} />
              <StatRow label="Budget" value={formatCurrency(tmdb.budget)} />
              <StatRow label="Revenue" value={formatCurrency(tmdb.revenue)} />
              {tmdb.imdbId && <StatRow label="IMDb" value={tmdb.imdbId} link={`https://www.imdb.com/title/${tmdb.imdbId}`} />}
              {tmdb.homepage && <StatRow label="Homepage" value="Visit website" link={tmdb.homepage} />}
              {tmdb.belongsToCollection && <StatRow label="Collection" value={tmdb.belongsToCollection.name} />}
            </>
          ) : (
            <>
              <StatRow label="First Air Date" value={formatDate(tmdb.firstAirDate)} />
              <StatRow label="Last Air Date" value={formatDate(tmdb.lastAirDate)} />
              <StatRow label="In Production" value={tmdb.inProduction != null ? (tmdb.inProduction ? 'Yes' : 'No') : null} />
              <StatRow label="Seasons" value={tmdb.numberOfSeasons} />
              <StatRow label="Episodes" value={tmdb.numberOfEpisodes} />
              <StatRow label="Episode Runtime" value={tmdb.episodeRunTimes?.length > 0 ? tmdb.episodeRunTimes.map(formatRuntime).join(', ') : null} />
              <StatRow label="Status" value={tmdb.status} />
              <StatRow label="Type" value={tmdb.type} />
              <StatRow label="Language" value={tmdb.originalLanguage?.toUpperCase()} />
              {tmdb.homepage && <StatRow label="Homepage" value="Visit website" link={tmdb.homepage} />}
            </>
          )}

          {(() => {
            const companies = (tmdb.productionCompanies ?? []).filter((c) => c?.name);
            if (!companies.length) return null;
            return (
              <Box sx={{ mt: 3 }}>
                <SectionHeading sx={{ fontSize: '0.9rem' }}>Companies</SectionHeading>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {companies.map((c, i) => (
                    <Chip key={i} label={`${c.name}${c.originCountry ? ` (${c.originCountry})` : ''}`} size="small" sx={subChipSx} />
                  ))}
                </Box>
              </Box>
            );
          })()}
        </Box>

        <Box>
          {(() => {
            const countries = (tmdb.productionCountries ?? []).filter((c) => c?.name);
            if (!countries.length) return null;
            return (
              <Box sx={{ mb: 3 }}>
                <SectionHeading sx={{ fontSize: '0.9rem' }}>Countries</SectionHeading>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {countries.map((c, i) => (
                    <Chip key={i} label={c.name} size="small" sx={subChipSx} />
                  ))}
                </Box>
              </Box>
            );
          })()}

          {(() => {
            const langs = (tmdb.spokenLanguages ?? [])
              .map((l) => ({ ...l, _label: l.englishName ?? l.name }))
              .filter((l) => l._label);
            if (!langs.length) return null;
            return (
              <Box sx={{ mb: 3 }}>
                <SectionHeading sx={{ fontSize: '0.9rem' }}>Languages</SectionHeading>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {langs.map((l, i) => (
                    <Chip key={i} label={l._label} size="small" sx={subChipSx} />
                  ))}
                </Box>
              </Box>
            );
          })()}

          {!isMovie && (() => {
            const creators = (tmdb.createdBy ?? []).filter((c) => c?.name);
            if (!creators.length) return null;
            return (
              <Box sx={{ mb: 3 }}>
                <SectionHeading sx={{ fontSize: '0.9rem' }}>Created By</SectionHeading>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {creators.map((c, i) => (
                    <Chip key={i} label={c.name} size="small" sx={chipSx} />
                  ))}
                </Box>
              </Box>
            );
          })()}

          {!isMovie && (tmdb.lastEpisodeToAir || tmdb.nextEpisodeToAir) && (
            <Box sx={{ mb: 3 }}>
              {tmdb.lastEpisodeToAir && (() => {
                const ep = tmdb.lastEpisodeToAir;
                const sn = ep.seasonNumber ?? tmdb.seasons?.find(s => s.episodes?.some(e => e.id === ep.id))?.seasonNumber;
                const s = sn != null ? String(sn).padStart(2, '0') : '??';
                const e = ep.episodeNumber != null ? String(ep.episodeNumber).padStart(2, '0') : '??';
                return (
                  <Paper sx={{ bgcolor: T.glass, p: 1.5, borderRadius: 1.5, mb: 1.5, border: `1px solid ${alpha(T.text, 0.08)}` }}>
                    <Typography variant="caption" sx={{ color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1 }}>Last Episode</Typography>
                    <Typography variant="body2" sx={{ color: T.text, mt: 0.5, fontWeight: 600 }}>
                      S{s}E{e}{ep.name ? ` — ${ep.name}` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(ep.airDate)}</Typography>
                  </Paper>
                );
              })()}
              {tmdb.nextEpisodeToAir && (() => {
                const ep = tmdb.nextEpisodeToAir;
                const sn = ep.seasonNumber ?? tmdb.seasons?.find(s => s.episodes?.some(e => e.id === ep.id))?.seasonNumber;
                const s = sn != null ? String(sn).padStart(2, '0') : '??';
                const e = ep.episodeNumber != null ? String(ep.episodeNumber).padStart(2, '0') : '??';
                return (
                  <Paper sx={{ bgcolor: T.glass, p: 1.5, borderRadius: 1.5, border: `1px solid ${alpha(T.teal, 0.25)}` }}>
                    <Typography variant="caption" sx={{ color: T.teal, textTransform: 'uppercase', letterSpacing: 1 }}>Next Episode</Typography>
                    <Typography variant="body2" sx={{ color: T.text, mt: 0.5, fontWeight: 600 }}>
                      S{s}E{e}{ep.name ? ` — ${ep.name}` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(ep.airDate)}</Typography>
                  </Paper>
                );
              })()}
            </Box>
          )}

          {availableRegions.length > 0 && (
            <Box>
              <SectionHeading>Where to Watch</SectionHeading>

              {/* Region selector — only shown when the title is available in 2+ regions */}
              {sortedRegionChips.length > 1 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                  {sortedRegionChips.map((r) => {
                    const isActive = r === selectedRegion;
                    return (
                      <Chip
                        key={r}
                        label={r === userRegion ? `${r} (you)` : r}
                        size="small"
                        onClick={() => setSelectedRegion(r)}
                        sx={{
                          height: 22, fontSize: '0.7rem', fontWeight: 700,
                          bgcolor: isActive ? T.teal : alpha(T.text, 0.06),
                          color: isActive ? '#fff' : T.textMuted,
                          border: `1px solid ${isActive ? T.teal : alpha(T.text, 0.1)}`,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: isActive ? T.teal : alpha(T.teal, 0.15), color: isActive ? '#fff' : T.teal },
                        }}
                      />
                    );
                  })}
                </Box>
              )}

              {sortedProviderKeys.length > 0 ? (
                sortedProviderKeys.map((type) => (
                  <Box key={type} sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, display: 'block', mb: 0.75 }}>
                      {typeLabel[type] ?? type}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {grouped[type].map((p, i) => {
                        const logoUrl = tmdbImg(p.provider?.logoPath, 'w92');
                        return (
                          <Box key={i} sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            bgcolor: T.glass, border: `1px solid ${alpha(T.text, 0.08)}`,
                            borderRadius: 1.5, px: 1.25, py: 0.75,
                            transition: 'border-color .15s, transform .15s',
                            '&:hover': { borderColor: alpha(T.teal, 0.4), transform: 'translateY(-1px)' },
                          }}>
                            {logoUrl && <Box component="img" src={logoUrl} alt={p.provider?.name} sx={{ width: 26, height: 26, borderRadius: 0.75, objectFit: 'cover' }} />}
                            <Typography variant="body2" sx={{ color: T.textMuted, fontWeight: 500, fontSize: '0.82rem' }}>{p.provider?.name}</Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" sx={{ color: T.textFaint }}>
                  Not available in {selectedRegion}.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}