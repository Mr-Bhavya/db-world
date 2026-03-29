import { Drawer, Box, Typography, Chip, Divider, IconButton, Rating } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useT } from '@shared/theme';
import { useRecordStore } from '../stores/useRecordStore';

const TMDB_IMG   = 'https://image.tmdb.org/t/p/w500';
const TMDB_SMALL = 'https://image.tmdb.org/t/p/w185';

const InfoRow = ({ label, value }) => {
  const T = useT();
  return value ? (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: .75, borderBottom: `1px solid ${T.border}` }}>
      <Typography sx={{ fontSize: 12, color: T.textMuted }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, color: T.textPrimary, textAlign: 'right', maxWidth: '60%' }}>{value}</Typography>
    </Box>
  ) : null;
};

const parseTags = (tags) => tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

export default function RecordDetailDrawer({ rows }) {
  const T = useT();
  const { drawerRecordId, closeDrawer } = useRecordStore();
  const open   = Boolean(drawerRecordId);
  const record = rows?.find(r => r.recordId === drawerRecordId);
  const tmdb   = record?.tmdb;
  const tags   = parseTags(record?.tags);

  const backdrop  = tmdb?.backdropPath ?? tmdb?.posterPath;
  const genres    = tmdb?.genres?.map(g => g.name).join(', ');
  const providers = [...new Set(tmdb?.providers?.map(p => p.providerName).filter(Boolean) ?? [])].join(', ') || null;

  return (
    <Drawer anchor="right" open={open} onClose={closeDrawer}
      PaperProps={{ sx: { width: { xs: '100vw', sm: 460 }, bgcolor: T.sidebar, borderLeft: `1px solid ${T.border}`, color: T.textPrimary, display: 'flex', flexDirection: 'column' } }}>

      {backdrop ? (
        <Box sx={{ position: 'relative', height: 180, overflow: 'hidden', flexShrink: 0 }}>
          <Box component="img" src={`${TMDB_IMG}${backdrop}`} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(.75)' }} />
          <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 40%, ${T.sidebar} 100%)` }} />
          <IconButton onClick={closeDrawer} sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.35)', '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' } }}><CloseIcon /></IconButton>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: T.textPrimary }}>Record Details</Typography>
          <IconButton onClick={closeDrawer} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
        </Box>
      )}

      <Box sx={{ p: 2, overflowY: 'auto', flex: 1, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>
        {!open ? null : !record ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', pt: 4 }}>
            <Typography sx={{ fontSize: 14, color: T.textMuted }}>Record not in current page.</Typography>
          </Box>
        ) : (
          <>
            <Typography sx={{ fontWeight: 700, fontSize: 20, mb: .5, color: T.textPrimary }}>{record.name}</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
              <Chip label={record.type} size="small" sx={{
                bgcolor: record.type === 'MOVIE' ? T.tealBg : `${T.success}20`,
                color: record.type === 'MOVIE' ? T.teal : T.success, fontWeight: 700,
              }} />
              {record.year && <Chip label={record.year} size="small" sx={{ bgcolor: T.glass, color: T.textMuted }} />}
            </Box>

            {tmdb?.voteAverage > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Rating value={tmdb.voteAverage / 2} precision={0.5} readOnly size="small" sx={{ color: T.warning }} />
                <Typography sx={{ fontSize: 13, color: T.textMuted }}>{tmdb.voteAverage?.toFixed(1)} / 10</Typography>
              </Box>
            )}

            {tmdb?.overview && (
              <Typography sx={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, mb: 2 }}>{tmdb.overview}</Typography>
            )}

            <InfoRow label="TMDB ID"   value={record.tmdbId} />
            <InfoRow label="Genres"    value={genres} />
            <InfoRow label="Runtime"   value={tmdb?.runtime ? `${tmdb.runtime} min` : null} />
            <InfoRow label="Status"    value={tmdb?.status} />
            <InfoRow label="Language"  value={tmdb?.originalLanguage?.toUpperCase()} />
            <InfoRow label="Providers" value={providers} />

            {tags.length > 0 && (
              <>
                <Divider sx={{ my: 2, borderColor: T.border }} />
                <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: .8, color: T.textFaint, mb: 1 }}>Tags</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .75 }}>
                  {tags.map(t => (
                    <Chip key={t} label={t.replace(/_/g, ' ')} size="small"
                      sx={{ fontSize: 11, fontWeight: 700, bgcolor: T.tealBg, color: T.teal }} />
                  ))}
                </Box>
              </>
            )}

            {tmdb?.credits?.cast?.length > 0 && (
              <>
                <Divider sx={{ my: 2, borderColor: T.border }} />
                <Typography sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: .8, color: T.textFaint, mb: 1 }}>Cast</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
                  {tmdb.credits.cast.slice(0, 10).map(c => (
                    <Box key={c.id} sx={{ flexShrink: 0, textAlign: 'center', width: 56 }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', bgcolor: T.glass, mx: 'auto' }}>
                        {c.profilePath
                          ? <Box component="img" src={`${TMDB_SMALL}${c.profilePath}`} alt={c.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: T.textFaint }}>{c.name?.[0]}</Box>
                        }
                      </Box>
                      <Typography sx={{ fontSize: 10, color: T.textMuted, mt: .5, lineHeight: 1.2,
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {c.name}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}
