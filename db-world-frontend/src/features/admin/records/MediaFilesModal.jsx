import { useState } from 'react';
import {
  Box, Typography, IconButton, CircularProgress, Alert, Chip, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { getMediaFiles, deleteMediaFileById, rescanMediaFile } from '../api/adminApi';

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

/**
 * Media file list for the unified record detail drawer's "Files" tab.
 * (Replaces the former standalone MediaFilesModal dialog.)
 */
export function MediaFilesBody({ recordId }) {
  const T = useT();
  const [deletingId, setDeletingId] = useState(null);
  const [rescanningId, setRescanningId] = useState(null);
  const [confirmFile, setConfirmFile] = useState(null); // file pending permanent delete

  const { data: files = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mediaFiles', recordId],
    queryFn:  () => getMediaFiles(recordId),
    enabled:  Boolean(recordId),
    staleTime: 30 * 1000,
  });

  const deleteMutation = useMutation({
    // purge=true → erase the physical file, its symlink and storyboard too, not just the DB row.
    mutationFn: (id) => deleteMediaFileById(id, true),
    onMutate: (id) => setDeletingId(id),
    // The backend returns a truthful per-step message (e.g. a warning if the file
    // couldn't be removed from disk) — surface it rather than a blanket "success".
    onSuccess: (res) => { refetch(); notify.success(res?.message || 'File deleted'); },
    onError: (e) => notify.error(e?.response?.data?.message || 'Delete failed'),
    onSettled: () => { setDeletingId(null); setConfirmFile(null); },
  });
  const rescanMutation = useMutation({
    mutationFn: rescanMediaFile,
    onMutate: (id) => setRescanningId(id),
    onSuccess: () => { refetch(); notify.success('Rescanned successfully'); },
    onError: () => notify.error('Rescan failed'),
    onSettled: () => setRescanningId(null),
  });

  const totalSize = files.reduce((sum, f) => sum + (f.fileSize ?? 0), 0);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} sx={{ color: T.teal }} /></Box>;
  if (error) return <Alert severity="error" sx={{ bgcolor: T.errorBg, color: T.error, border: `1px solid ${T.error}44`, '& .MuiAlert-icon': { color: T.error } }}>Failed to load media files</Alert>;
  if (files.length === 0) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1 }}>
      <VideoFileIcon sx={{ fontSize: 40, color: T.textFaint }} />
      <Typography sx={{ fontSize: 13, color: T.textMuted }}>No media files linked to this record.</Typography>
    </Box>
  );

  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: T.textMuted, mb: 1 }}>
        {files.length} file{files.length !== 1 ? 's' : ''} · {fmtSize(totalSize)} total
      </Typography>
      {files.map((file) => {
        const isDeleting   = deletingId   === file.id;
        const isRescanning = rescanningId === file.id;
        const videoTrack   = file.primaryVideoTrack ?? file.tracks?.find(t => t.type === 'Video' && t.defaultTrack === 'Yes') ?? file.tracks?.find(t => t.type === 'Video');
        const audioTrack   = file.primaryAudioTrack ?? file.tracks?.find(t => t.type === 'Audio');
        const generalTrack = file.generalTrack       ?? file.tracks?.find(t => t.type === 'General');
        const textTracks   = file.tracks?.filter(t => t.type === 'Text') ?? [];
        return (
          <Box key={file.id} sx={{ border: `1px solid ${T.glassBorder}`, borderRadius: 1.5, p: 1.5, mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, wordBreak: 'break-all' }}>{file.fileName}</Typography>
                <Typography sx={{ fontSize: 10, color: T.textMuted, fontFamily: 'monospace', mt: .25, wordBreak: 'break-all' }}>{file.filePath}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: .75, flexWrap: 'wrap' }}>
                  <Chip label={fmtSize(file.fileSize)} size="small" sx={{ height: 18, fontSize: 10, bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.glassBorder}` }} />
                  {file.mimeType && <Chip label={file.mimeType} size="small" sx={{ height: 18, fontSize: 10, bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.glassBorder}` }} />}
                  {generalTrack?.duration && <Chip label={fmtDuration(generalTrack.duration)} size="small" sx={{ height: 18, fontSize: 10, bgcolor: T.tealBg, color: T.teal }} />}
                  {generalTrack?.overallBitRate && <Chip label={fmtBitrate(generalTrack.overallBitRate)} size="small" sx={{ height: 18, fontSize: 10, bgcolor: T.glass, color: T.textMuted, border: `1px solid ${T.glassBorder}` }} />}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: .5, flexShrink: 0 }}>
                <Tooltip title="Rescan file info"><span><IconButton size="small" onClick={() => rescanMutation.mutate(file.id)} disabled={isRescanning} sx={{ color: T.textMuted, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>{isRescanning ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon sx={{ fontSize: 15 }} />}</IconButton></span></Tooltip>
                <Tooltip title="Delete file permanently"><span><IconButton size="small" onClick={() => setConfirmFile(file)} disabled={isDeleting} sx={{ color: T.textMuted, '&:hover': { color: T.error, bgcolor: T.errorBg } }}>{isDeleting ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon sx={{ fontSize: 15 }} />}</IconButton></span></Tooltip>
              </Box>
            </Box>
            {(videoTrack || audioTrack || textTracks.length > 0) && (
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: .25 }}>
                <TrackRow label="Video" track={videoTrack} />
                <TrackRow label="Audio" track={audioTrack} />
                {textTracks.map((t, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1, py: .25 }}>
                    <Typography sx={{ fontSize: 10, color: T.textFaint, minWidth: 56, flexShrink: 0 }}>Subtitle {i + 1}</Typography>
                    <Typography sx={{ fontSize: 11, color: T.textMuted, fontFamily: 'monospace' }}>{[t.format, t.language, t.title].filter(Boolean).join(' · ')}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        );
      })}

      {/* Confirm — this now permanently erases the file from disk, not just the DB row. */}
      <Dialog
        open={Boolean(confirmFile)}
        onClose={() => setConfirmFile(null)}
        PaperProps={{ sx: { bgcolor: T.surface || T.bg, color: T.textPrimary, borderRadius: 2, border: `1px solid ${T.glassBorder}`, maxWidth: 420 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: T.textPrimary, pb: 1 }}>Delete file?</DialogTitle>
        <DialogContent>
          {confirmFile && (
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, mb: 1, wordBreak: 'break-all' }}>
              {confirmFile.fileName}
            </Typography>
          )}
          <DialogContentText sx={{ color: T.textMuted, fontSize: 13 }}>
            This permanently deletes the file from disk and removes its library entry,
            symlink and preview thumbnails. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmFile(null)} sx={{ color: T.textMuted, textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(confirmFile.id)}
            sx={{ bgcolor: T.error, '&:hover': { bgcolor: T.error, filter: 'brightness(0.9)' }, fontWeight: 700, textTransform: 'none' }}
          >
            Delete permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
