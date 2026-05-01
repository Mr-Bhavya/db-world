import { useState } from 'react';
import {
  Dialog, DialogContent, Box, Typography, IconButton,
  CircularProgress, Alert, Chip, Tooltip, Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import ScienceIcon from '@mui/icons-material/Science';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { getMediaFiles, deleteMediaFile, rescanMediaFile, seedMediaFiles } from '../api/adminApi';
import { useRecordStore } from '../stores/useRecordStore';

const fmtSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

// duration is stored as milliseconds by MediaInfo
const fmtDuration = (ms) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
};

const fmtBitrate = (bps) => {
  if (!bps) return null;
  return bps >= 1_000_000 ? `${(bps / 1_000_000).toFixed(1)} Mbps` : `${Math.round(bps / 1000)} kbps`;
};

const TrackRow = ({ label, track }) => {
  const T = useT();
  if (!track) return null;
  const info = track.type === 'Video'
    ? [track.format, track.width && track.height ? `${track.width}×${track.height}` : null, track.frameRate ? `${track.frameRate} fps` : null, track.bitRate ? `${Math.round(track.bitRate / 1000)} kbps` : null].filter(Boolean).join(' · ')
    : track.type === 'Audio'
      ? [track.format, track.channels ? `${track.channels}ch` : null, track.samplingRate ? `${track.samplingRate} Hz` : null, track.language].filter(Boolean).join(' · ')
      : track.duration;
  return (
    <Box sx={{ display: 'flex', gap: 1, py: .25 }}>
      <Typography sx={{ fontSize: 10, color: T.textFaint, minWidth: 56, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace' }}>{info || '—'}</Typography>
    </Box>
  );
};

export default function MediaFilesModal() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const { mediaFilesRecordId, closeMediaFiles } = useRecordStore();
  const open = Boolean(mediaFilesRecordId);

  const [deletingId, setDeletingId] = useState(null);
  const [rescanningId, setRescanningId] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const { data: files = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mediaFiles', mediaFilesRecordId],
    queryFn:  () => getMediaFiles(mediaFilesRecordId),
    enabled:  open,
    staleTime: 30 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMediaFile,
    onMutate: (path) => setDeletingId(path),
    onSuccess: () => {
      refetch();
      enqueueSnackbar('Media file info deleted', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Delete failed', { variant: 'error' }),
    onSettled: () => setDeletingId(null),
  });

  const rescanMutation = useMutation({
    mutationFn: rescanMediaFile,
    onMutate: (id) => setRescanningId(id),
    onSuccess: () => {
      refetch();
      enqueueSnackbar('Rescanned successfully', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Rescan failed', { variant: 'error' }),
    onSettled: () => setRescanningId(null),
  });

  const seedMutation = useMutation({
    mutationFn: () => seedMediaFiles(mediaFilesRecordId),
    onMutate: () => setSeeding(true),
    onSuccess: () => {
      refetch();
      enqueueSnackbar('Test media files seeded', { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Seeding failed', { variant: 'error' }),
    onSettled: () => setSeeding(false),
  });

  const totalSize = files.reduce((sum, f) => sum + (f.fileSize ?? 0), 0);

  return (
    <Dialog open={open} onClose={closeMediaFiles} fullWidth maxWidth="md"
      PaperProps={{ sx: { bgcolor: T.sidebar, color: T.textPrimary, border: `1px solid ${T.glassBorder}`, borderRadius: 2, height: '80vh', display: 'flex', flexDirection: 'column' } }}>

      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <VideoFileIcon sx={{ fontSize: 20, color: T.teal }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: T.textPrimary }}>Media Files</Typography>
            {files.length > 0 && (
              <Typography sx={{ fontSize: 11, color: T.textMuted }}>
                {files.length} file{files.length !== 1 ? 's' : ''} · {fmtSize(totalSize)} total
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Insert 2 realistic test MKV files for this record">
            <Button
              size="small"
              startIcon={seeding ? <CircularProgress size={12} color="inherit" /> : <ScienceIcon sx={{ fontSize: 15 }} />}
              onClick={() => seedMutation.mutate()}
              disabled={seeding}
              sx={{ fontSize: 11, color: T.textMuted, border: `1px dashed ${T.border}`, '&:hover': { color: T.teal, borderColor: T.teal } }}
            >
              Seed Test
            </Button>
          </Tooltip>
          <IconButton onClick={closeMediaFiles} sx={{ color: T.textMuted }}><CloseIcon /></IconButton>
        </Box>
      </Box>

      <DialogContent sx={{ p: 0, overflowY: 'auto', flex: 1, '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: T.teal }} />
          </Box>
        )}
        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}44`, '& .MuiAlert-icon': { color: T.error } }}>
              Failed to load media files
            </Alert>
          </Box>
        )}
        {!isLoading && !error && files.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1 }}>
            <VideoFileIcon sx={{ fontSize: 40, color: T.textFaint }} />
            <Typography sx={{ fontSize: 13, color: T.textMuted }}>No media files linked to this record.</Typography>
          </Box>
        )}

        {files.map((file) => {
          const isDeleting  = deletingId  === file.filePath;
          const isRescanning = rescanningId === file.id;
          // Prefer the convenience fields the API provides; fall back to scanning tracks
          const videoTrack   = file.primaryVideoTrack  ?? file.tracks?.find(t => t.type === 'Video' && t.defaultTrack === 'Yes') ?? file.tracks?.find(t => t.type === 'Video');
          const audioTrack   = file.primaryAudioTrack  ?? file.tracks?.find(t => t.type === 'Audio');
          const generalTrack = file.generalTrack        ?? file.tracks?.find(t => t.type === 'General');
          const textTracks   = file.tracks?.filter(t => t.type === 'Text') ?? [];

          return (
            <Box key={file.id} sx={{ borderBottom: `1px solid ${T.border}`, '&:last-child': { borderBottom: 'none' } }}>
              {/* File header */}
              <Box sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, wordBreak: 'break-all' }}>
                    {file.fileName}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: T.textMuted, fontFamily: 'monospace', mt: .25, wordBreak: 'break-all' }}>
                    {file.filePath}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: .75, flexWrap: 'wrap' }}>
                    <Chip label={fmtSize(file.fileSize)} size="small"
                      sx={{ height: 18, fontSize: 10, bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.glassBorder}` }} />
                    {file.mimeType && (
                      <Chip label={file.mimeType} size="small"
                        sx={{ height: 18, fontSize: 10, bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.glassBorder}` }} />
                    )}
                    {generalTrack?.duration && (
                      <Chip label={fmtDuration(generalTrack.duration)} size="small"
                        sx={{ height: 18, fontSize: 10, bgcolor: T.tealBg, color: T.teal }} />
                    )}
                    {generalTrack?.overallBitRate && (
                      <Chip label={fmtBitrate(generalTrack.overallBitRate)} size="small"
                        sx={{ height: 18, fontSize: 10, bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.glassBorder}` }} />
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: .5, flexShrink: 0 }}>
                  <Tooltip title="Rescan file info">
                    <span>
                      <IconButton size="small" onClick={() => rescanMutation.mutate(file.id)} disabled={isRescanning}
                        sx={{ color: T.textMuted, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
                        {isRescanning ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon sx={{ fontSize: 15 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Delete media info record">
                    <span>
                      <IconButton size="small" onClick={() => deleteMutation.mutate(file.filePath)} disabled={isDeleting}
                        sx={{ color: T.textMuted, '&:hover': { color: T.error, bgcolor: T.errorBg } }}>
                        {isDeleting ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon sx={{ fontSize: 15 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>

              {/* Track info */}
              {(videoTrack || audioTrack || textTracks.length > 0) && (
                <Box sx={{ px: 3, pb: 1.5, display: 'flex', flexDirection: 'column', gap: .25 }}>
                  <TrackRow label="Video"    track={videoTrack} />
                  <TrackRow label="Audio"    track={audioTrack} />
                  {textTracks.map((t, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1, py: .25 }}>
                      <Typography sx={{ fontSize: 10, color: T.textFaint, minWidth: 56, flexShrink: 0 }}>
                        Subtitle {i + 1}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace' }}>
                        {[t.format, t.language, t.title].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}
