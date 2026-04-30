import { Box, Chip, IconButton, Menu, MenuItem, ListItemIcon, Skeleton, Divider } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MovieIcon from '@mui/icons-material/Movie';
import TvIcon from '@mui/icons-material/Tv';
import InfoIcon from '@mui/icons-material/Info';
import DatasetIcon from '@mui/icons-material/Dataset';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import { useState } from 'react';
import { useT } from '@shared/theme';
import { useRecordStore } from '../stores/useRecordStore';
import { formatDistanceToNow } from 'date-fns';

const TMDB_THUMB = 'https://image.tmdb.org/t/p/w92';

function RecordRow({ record, onDelete }) {
  const T = useT();
  const { openDrawer, openModal, openTmdbModal, openRecordDetail, openMediaFiles } = useRecordStore();
  const [anchor, setAnchor] = useState(null);
  const poster = record.tmdb?.posterPath;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 16px', borderBottom: `1px solid ${T.border}`, bgcolor: T.sidebar }}>
      <Box sx={{ width: 34, height: 50, borderRadius: 1, overflow: 'hidden', flexShrink: 0, bgcolor: T.glass }}>
        {poster
          ? <Box component="img" src={`${TMDB_THUMB}${poster}`} alt={record.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {record.type === 'MOVIE' ? <MovieIcon sx={{ fontSize: 14, color: T.textFaint }} /> : <TvIcon sx={{ fontSize: 14, color: T.textFaint }} />}
            </Box>
        }
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ fontWeight: 600, fontSize: 14, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.name}</Box>
        <Box sx={{ display: 'flex', gap: 1, mt: .25, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={record.type === 'MOVIE' ? 'Movie' : 'Series'} size="small" sx={{
            height: 15, fontSize: 9, fontWeight: 700,
            bgcolor: record.type === 'MOVIE' ? T.tealBg : `${T.success}20`,
            color: record.type === 'MOVIE' ? T.teal : T.success,
          }} />
          {record.year && <Box sx={{ fontSize: 11, color: T.textFaint }}>{record.year}</Box>}
        </Box>
        {record.updatedAt && (
          <Box sx={{ fontSize: 11, color: T.textFaint, mt: .25 }}>{formatDistanceToNow(new Date(record.updatedAt), { addSuffix: true })}</Box>
        )}
      </Box>
      <IconButton size="small" sx={{ color: T.textMuted }} onClick={e => setAnchor(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, color: T.textPrimary, boxShadow: '0 4px 20px rgba(0,0,0,0.24)', minWidth: 200 } }}>
        <MenuItem onClick={() => { openDrawer(record.recordId); setAnchor(null); }} sx={{ '&:hover': { bgcolor: T.tealBg } }}>
          <ListItemIcon><VisibilityIcon fontSize="small" sx={{ color: T.teal }} /></ListItemIcon>
          <Box sx={{ color: T.textPrimary }}>View Details</Box>
        </MenuItem>
        <MenuItem onClick={() => { openRecordDetail(record.recordId); setAnchor(null); }} sx={{ '&:hover': { bgcolor: T.tealBg } }}>
          <ListItemIcon><InfoIcon fontSize="small" sx={{ color: T.teal }} /></ListItemIcon>
          <Box sx={{ color: T.textPrimary }}>Record Info</Box>
        </MenuItem>
        {record.tmdbId && (
          <MenuItem onClick={() => { openTmdbModal(record); setAnchor(null); }} sx={{ '&:hover': { bgcolor: T.tealBg } }}>
            <ListItemIcon><DatasetIcon fontSize="small" sx={{ color: T.teal }} /></ListItemIcon>
            <Box sx={{ color: T.textPrimary }}>TMDB Data</Box>
          </MenuItem>
        )}
        <MenuItem onClick={() => { openMediaFiles(record.recordId); setAnchor(null); }} sx={{ '&:hover': { bgcolor: T.tealBg } }}>
          <ListItemIcon><VideoFileIcon fontSize="small" sx={{ color: T.teal }} /></ListItemIcon>
          <Box sx={{ color: T.textPrimary }}>Media Files</Box>
        </MenuItem>
        <Divider sx={{ borderColor: T.border, my: .5 }} />
        <MenuItem onClick={() => { openModal('edit', record.recordId); setAnchor(null); }} sx={{ '&:hover': { bgcolor: T.tealBg } }}>
          <ListItemIcon><EditIcon fontSize="small" sx={{ color: T.success }} /></ListItemIcon>
          <Box sx={{ color: T.textPrimary }}>Edit</Box>
        </MenuItem>
        <MenuItem onClick={() => { onDelete(record.recordId); setAnchor(null); }} sx={{ '&:hover': { bgcolor: T.errorBg } }}>
          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: T.error }} /></ListItemIcon>
          <Box sx={{ color: T.error }}>Delete</Box>
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default function RecordMobileList({ rows, loading, onDelete }) {
  const T = useT();
  if (loading && rows.length === 0) return (
    <Box>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={70} sx={{ bgcolor: T.glass, mx: 2, mb: .5 }} />)}</Box>
  );
  return (
    <Box>{rows.map(r => <RecordRow key={r.recordId} record={r} onDelete={onDelete} />)}</Box>
  );
}
