import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, LinearProgress, IconButton, List, ListItem, ListItemText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useState, useCallback, useRef } from 'react';
import { useSnackbar } from 'notistack';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { uploadFiles } from './fileManagerApi';

export default function UploadDialog() {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const { uploadOpen, setUploadOpen, currentPath } = useFileManagerStore();

  const [files, setFiles]         = useState([]);   // { file, progress, status }
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();
  const [dragging, setDragging]   = useState(false);

  const addFiles = (fileList) => {
    const newFiles = Array.from(fileList).map(f => ({ file: f, progress: 0, status: 'pending' }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const rawFiles = files.map(f => f.file);
      await uploadFiles(currentPath, rawFiles, (pct) => {
        setFiles(prev => prev.map(f => ({ ...f, progress: pct, status: pct === 100 ? 'done' : 'uploading' })));
      });
      qc.invalidateQueries({ queryKey: ['file-manager', currentPath] });
      enqueueSnackbar(`Uploaded ${files.length} file(s)`, { variant: 'success' });
      setFiles([]);
      setUploadOpen(false);
    } catch (e) {
      enqueueSnackbar('Upload failed', { variant: 'error' });
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' })));
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => { if (!uploading) { setFiles([]); setUploadOpen(false); } };

  return (
    <Dialog open={uploadOpen} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}` } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: T.textPrimary, pb: 1, fontSize: 16, fontWeight: 700 }}>
        Upload Files
        <IconButton size="small" onClick={handleClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {/* Drop zone */}
        <Box
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          sx={{
            border: `2px dashed ${dragging ? T.teal : T.border}`,
            borderRadius: 2, p: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            cursor: 'pointer', bgcolor: dragging ? T.tealBg : 'transparent',
            transition: 'all 0.15s',
            '&:hover': { borderColor: T.teal, bgcolor: T.tealBg },
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 36, color: dragging ? T.teal : T.textFaint }} />
          <Typography sx={{ fontSize: 14, color: T.textMuted }}>
            Drag & drop files or <span style={{ color: T.teal, fontWeight: 600 }}>click to browse</span>
          </Typography>
          <Typography sx={{ fontSize: 12, color: T.textFaint }}>Uploading to: {currentPath}</Typography>
          <input ref={inputRef} type="file" multiple hidden onChange={e => addFiles(e.target.files)} />
        </Box>

        {/* File list */}
        {files.length > 0 && (
          <List dense sx={{ mt: 1 }}>
            {files.map((f, idx) => (
              <ListItem key={idx} sx={{ px: 0, gap: 1 }}>
                <ListItemText
                  primary={f.file.name}
                  secondary={formatBytes(f.file.size)}
                  primaryTypographyProps={{ fontSize: 13, color: T.textPrimary, noWrap: true }}
                  secondaryTypographyProps={{ fontSize: 11, color: T.textFaint }}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                {f.status === 'uploading' && (
                  <Box sx={{ width: 80 }}>
                    <LinearProgress variant="determinate" value={f.progress}
                      sx={{ borderRadius: 1, bgcolor: T.border, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />
                  </Box>
                )}
                {f.status === 'done'  && <CheckCircleIcon sx={{ fontSize: 18, color: '#10b981' }} />}
                {f.status === 'error' && <ErrorIcon sx={{ fontSize: 18, color: '#ef4444' }} />}
                {!uploading && (
                  <IconButton size="small" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                    sx={{ color: T.textFaint }}>
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={uploading}
          sx={{ color: T.textMuted, fontSize: 13 }}>Cancel</Button>
        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          variant="contained"
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontSize: 13 }}
        >
          {uploading ? 'Uploading…' : `Upload ${files.length > 0 ? `(${files.length})` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
