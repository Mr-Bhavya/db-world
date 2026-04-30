import {
  Dialog, DialogContent, Box, Typography, Chip, Divider,
  IconButton, CircularProgress, Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useT } from '@shared/theme';
import { getAdminRecordDetail } from '../api/adminApi';
import { useRecordStore } from '../stores/useRecordStore';

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

const SectionTitle = ({ children }) => {
  const T = useT();
  return (
    <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: T.textFaint, mt: 2, mb: 1 }}>
      {children}
    </Typography>
  );
};

export default function RecordFullDetailModal() {
  const T = useT();
  const { recordDetailId, closeRecordDetail } = useRecordStore();
  const open = Boolean(recordDetailId);

  const { data: record, isLoading, error } = useQuery({
    queryKey: ['recordDetail', recordDetailId],
    queryFn:  () => getAdminRecordDetail(recordDetailId),
    enabled:  open,
    staleTime: 2 * 60 * 1000,
  });

  const tmdb   = record?.tmdb;
  const isMovie = record?.type === 'MOVIE';

  return (
    <Dialog open={open} onClose={closeRecordDetail} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: T.sidebar, color: T.textPrimary, border: `1px solid ${T.glassBorder}`, borderRadius: 2, height: '80vh', display: 'flex', flexDirection: 'column' } }}>

      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isMovie
            ? <MovieIcon sx={{ fontSize: 18, color: T.teal }} />
            : <TvIcon    sx={{ fontSize: 18, color: T.success }} />}
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: T.textPrimary }}>
            {record?.name ?? `Record #${recordDetailId}`}
          </Typography>
        </Box>
        <IconButton onClick={closeRecordDetail} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
      </Box>

      <DialogContent sx={{ p: 3, overflowY: 'auto', flex: 1, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: T.teal }} />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}44`, '& .MuiAlert-icon': { color: T.error } }}>
            Failed to load record details
          </Alert>
        )}
        {record && (
          <>
            <SectionTitle>Record</SectionTitle>
            <KV label="Record ID"   value={record.id} />
            <KV label="Name"        value={record.name} />
            <KV label="Type"        value={record.type} />
            <KV label="TMDB ID"     value={record.tmdb_id} />
            <KV label="Created"     value={record.creationDate ? formatDistanceToNow(new Date(record.creationDate), { addSuffix: true }) : null} />
            <KV label="Updated"     value={record.lastModifiedDate ? formatDistanceToNow(new Date(record.lastModifiedDate), { addSuffix: true }) : null} />

            {record.tags?.length > 0 && (
              <>
                <SectionTitle>Tags ({record.tags.length})</SectionTitle>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .75 }}>
                  {record.tags.map(t => (
                    <Chip key={t.id ?? t.tagType} label={t.tagType?.replace(/_/g, ' ')} size="small"
                      sx={{ bgcolor: T.tealBg, color: T.teal, fontWeight: 600, fontSize: 11 }} />
                  ))}
                </Box>
              </>
            )}

            {tmdb && (
              <>
                <SectionTitle>TMDB Summary</SectionTitle>
                <KV label="TMDB ID"          value={tmdb.id} />
                <KV label="Title"            value={tmdb.title} />
                <KV label="Original Title"   value={tmdb.originalTitle} />
                <KV label="Status"           value={tmdb.status} />
                <KV label="Overview"         value={tmdb.overview} />
                <KV label="Language"         value={tmdb.originalLanguage?.toUpperCase()} />
                <KV label="Popularity"       value={tmdb.popularity?.toFixed(2)} />
                <KV label="Vote Average"     value={tmdb.voteAverage?.toFixed(1)} />
                <KV label="Vote Count"       value={tmdb.voteCount} />
                <KV label="Tagline"          value={tmdb.tagline} />
                <KV label="Homepage"         value={tmdb.homepage} />
                <PathText label="Poster Path"   value={tmdb.posterPath} />
                <PathText label="Backdrop Path" value={tmdb.backdropPath} />

                {isMovie && (
                  <>
                    <KV label="Release Date" value={tmdb.releaseDate} />
                    <KV label="Runtime"      value={tmdb.runtime ? `${tmdb.runtime} min` : null} />
                    <KV label="Budget"       value={tmdb.budget ? `$${tmdb.budget?.toLocaleString()}` : null} />
                    <KV label="Revenue"      value={tmdb.revenue ? `$${tmdb.revenue?.toLocaleString()}` : null} />
                    <KV label="IMDB ID"      value={tmdb.imdbId} />
                  </>
                )}

                {!isMovie && (
                  <>
                    <KV label="First Air Date"    value={tmdb.firstAirDate} />
                    <KV label="Last Air Date"     value={tmdb.lastAirDate} />
                    <KV label="Seasons"           value={tmdb.numberOfSeasons} />
                    <KV label="Episodes"          value={tmdb.numberOfEpisodes} />
                    <KV label="In Production"     value={String(tmdb.inProduction)} />
                  </>
                )}

                {tmdb.genres?.length > 0 && (
                  <>
                    <Divider sx={{ borderColor: T.border, my: 1.5 }} />
                    <Typography sx={{ fontSize: 10, color: T.textFaint, mb: .75 }}>GENRES</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5 }}>
                      {tmdb.genres.map(g => (
                        <Chip key={g.id ?? g.name} label={g.name} size="small"
                          sx={{ bgcolor: T.tealBg, color: T.teal, fontSize: 11 }} />
                      ))}
                    </Box>
                  </>
                )}

                {tmdb.providers?.length > 0 && (
                  <>
                    <Divider sx={{ borderColor: T.border, my: 1.5 }} />
                    <Typography sx={{ fontSize: 10, color: T.textFaint, mb: .75 }}>PROVIDERS</Typography>
                    <Typography sx={{ fontSize: 12, color: T.textPrimary }}>
                      {[...new Set(tmdb.providers.map(p => p.providerName).filter(Boolean))].join(', ')}
                    </Typography>
                  </>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
