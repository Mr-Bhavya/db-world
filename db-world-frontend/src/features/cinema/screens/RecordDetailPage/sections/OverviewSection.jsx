import React from 'react';
import { Box, Chip, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme/ThemeContext';
import { tmdbImg } from '../../../api/cinemaApi';
import SectionHeading from '../shared/SectionHeading';
import StatRow from '../shared/StatRow';
import { formatCurrency, formatDate, formatRuntime } from '../helpers';

export default function OverviewSection({ record }) {
  const T = useT();
  const tmdb = record?.tmdb ?? {};
  const isMovie = record?.type === 'MOVIE';
  const providers = tmdb.providers ?? [];

  const grouped = providers.reduce((acc, p) => {
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

  const chipSx    = { bgcolor: alpha(T.teal, 0.12), color: T.teal, fontSize: '0.72rem', border: `1px solid ${alpha(T.teal, 0.2)}` };
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
      {tmdb.overview && (
        <Typography variant="body1" sx={{
          color: T.textMuted, lineHeight: 1.85, mb: 4, maxWidth: 760,
          fontSize: { xs: '0.95rem', md: '1rem' },
        }}>
          {tmdb.overview}
        </Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 3, md: 5 } }}>
        <Box>
          <SectionHeading>Details</SectionHeading>
          {isMovie ? (
            <>
              <StatRow label="Release Date" value={formatDate(tmdb.releaseDate)} />
              <StatRow label="Runtime"      value={formatRuntime(tmdb.runtime)} />
              <StatRow label="Status"       value={tmdb.status} />
              <StatRow label="Language"     value={tmdb.originalLanguage?.toUpperCase()} />
              <StatRow label="Budget"       value={formatCurrency(tmdb.budget)} />
              <StatRow label="Revenue"      value={formatCurrency(tmdb.revenue)} />
              {tmdb.imdbId && <StatRow label="IMDb" value={tmdb.imdbId} link={`https://www.imdb.com/title/${tmdb.imdbId}`} />}
              {tmdb.homepage && <StatRow label="Homepage" value="Visit website" link={tmdb.homepage} />}
              {tmdb.belongsToCollection && <StatRow label="Collection" value={tmdb.belongsToCollection.name} />}
            </>
          ) : (
            <>
              <StatRow label="First Air Date"   value={formatDate(tmdb.firstAirDate)} />
              <StatRow label="Last Air Date"    value={formatDate(tmdb.lastAirDate)} />
              <StatRow label="In Production"    value={tmdb.inProduction != null ? (tmdb.inProduction ? 'Yes' : 'No') : null} />
              <StatRow label="Seasons"          value={tmdb.numberOfSeasons} />
              <StatRow label="Episodes"         value={tmdb.numberOfEpisodes} />
              <StatRow label="Episode Runtime"  value={tmdb.episodeRunTimes?.length > 0 ? tmdb.episodeRunTimes.map(formatRuntime).join(', ') : null} />
              <StatRow label="Status"           value={tmdb.status} />
              <StatRow label="Type"             value={tmdb.type} />
              <StatRow label="Language"         value={tmdb.originalLanguage?.toUpperCase()} />
              {tmdb.homepage && <StatRow label="Homepage" value="Visit website" link={tmdb.homepage} />}
            </>
          )}

          {(tmdb.productionCompanies ?? []).length > 0 && (
            <Box sx={{ mt: 3 }}>
              <SectionHeading sx={{ fontSize: '0.9rem' }}>Companies</SectionHeading>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(tmdb.productionCompanies ?? []).map((c, i) => (
                  <Chip key={i} label={`${c.name}${c.originCountry ? ` (${c.originCountry})` : ''}`} size="small" sx={subChipSx} />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        <Box>
          {(tmdb.productionCountries ?? []).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <SectionHeading sx={{ fontSize: '0.9rem' }}>Countries</SectionHeading>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(tmdb.productionCountries ?? []).map((c, i) => (
                  <Chip key={i} label={c.name} size="small" sx={subChipSx} />
                ))}
              </Box>
            </Box>
          )}

          {(tmdb.spokenLanguages ?? []).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <SectionHeading sx={{ fontSize: '0.9rem' }}>Languages</SectionHeading>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(tmdb.spokenLanguages ?? []).map((l, i) => (
                  <Chip key={i} label={l.englishName ?? l.name} size="small" sx={subChipSx} />
                ))}
              </Box>
            </Box>
          )}

          {!isMovie && (tmdb.createdBy ?? []).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <SectionHeading sx={{ fontSize: '0.9rem' }}>Created By</SectionHeading>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(tmdb.createdBy ?? []).map((c, i) => (
                  <Chip key={i} label={c.name} size="small" sx={chipSx} />
                ))}
              </Box>
            </Box>
          )}

          {!isMovie && (tmdb.lastEpisodeToAir || tmdb.nextEpisodeToAir) && (
            <Box sx={{ mb: 3 }}>
              {tmdb.lastEpisodeToAir && (
                <Paper sx={{ bgcolor: T.glass, p: 1.5, borderRadius: 1.5, mb: 1.5, border: `1px solid ${alpha(T.text, 0.08)}` }}>
                  <Typography variant="caption" sx={{ color: T.textFaint, textTransform: 'uppercase', letterSpacing: 1 }}>Last Episode</Typography>
                  <Typography variant="body2" sx={{ color: T.text, mt: 0.5, fontWeight: 600 }}>
                    S{String(tmdb.lastEpisodeToAir.seasonNumber).padStart(2, '0')}E{String(tmdb.lastEpisodeToAir.episodeNumber).padStart(2, '0')} — {tmdb.lastEpisodeToAir.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(tmdb.lastEpisodeToAir.airDate)}</Typography>
                </Paper>
              )}
              {tmdb.nextEpisodeToAir && (
                <Paper sx={{ bgcolor: T.glass, p: 1.5, borderRadius: 1.5, border: `1px solid ${alpha(T.teal, 0.25)}` }}>
                  <Typography variant="caption" sx={{ color: T.teal, textTransform: 'uppercase', letterSpacing: 1 }}>Next Episode</Typography>
                  <Typography variant="body2" sx={{ color: T.text, mt: 0.5, fontWeight: 600 }}>
                    S{String(tmdb.nextEpisodeToAir.seasonNumber).padStart(2, '0')}E{String(tmdb.nextEpisodeToAir.episodeNumber).padStart(2, '0')} — {tmdb.nextEpisodeToAir.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: T.textFaint }}>{formatDate(tmdb.nextEpisodeToAir.airDate)}</Typography>
                </Paper>
              )}
            </Box>
          )}

          {sortedProviderKeys.length > 0 && (
            <Box>
              <SectionHeading>Where to Watch</SectionHeading>
              {sortedProviderKeys.map((type) => (
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
                          {p.regionCode && <Chip label={p.regionCode} size="small" sx={{ bgcolor: 'transparent', color: T.textFaint, fontSize: '0.6rem', height: 16 }} />}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
