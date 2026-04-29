import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  alpha,
  useTheme,
  Divider,
} from '@mui/material';
import {
  CloudUpload,
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Cancel as CancelIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { uploadFiles } from '../../adminv2/filemanager/fileManagerApi';

const STATUS = { PENDING: 'pending', UPLOADING: 'uploading', DONE: 'done', ERROR: 'error' };

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const FileUploadModal = ({ open, onClose, currentPath, onUploadSuccess }) => {
  const theme = useTheme();
  const [fileItems, setFileItems] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const fileInputRef = useRef(null);

  const addFiles = useCallback((newFiles) => {
    const items = Array.from(newFiles).map(f => ({
      id: `${f.name}-${f.size}-${Date.now()}`,
      file: f,
      status: STATUS.PENDING,
      progress: 0,
      error: null,
    }));
    setFileItems(prev => [...prev, ...items]);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleFileInput = useCallback((e) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }, [addFiles]);

  const removeFile = useCallback((id) => {
    setFileItems(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleUpload = useCallback(async () => {
    const pending = fileItems.filter(f => f.status === STATUS.PENDING);
    if (!pending.length) return;

    setUploading(true);
    setOverallProgress(0);

    setFileItems(prev => prev.map(f =>
      f.status === STATUS.PENDING ? { ...f, status: STATUS.UPLOADING, progress: 0 } : f
    ));

    const files = pending.map(f => f.file);

    try {
      const result = await uploadFiles(currentPath, files, (pct) => {
        setOverallProgress(pct);
        setFileItems(prev => prev.map(f =>
          f.status === STATUS.UPLOADING ? { ...f, progress: pct } : f
        ));
      });

      // Mark each file based on backend per-file result
      const errorMap = {};
      (result?.errors || []).forEach(e => { errorMap[e.fileName] = e.error; });

      setFileItems(prev => prev.map(f => {
        if (f.status !== STATUS.UPLOADING) return f;
        const err = errorMap[f.file.name];
        return err
          ? { ...f, status: STATUS.ERROR, error: err, progress: 0 }
          : { ...f, status: STATUS.DONE, progress: 100 };
      }));

      if (result?.successCount > 0) {
        onUploadSuccess?.();
      }
    } catch (err) {
      const msg = err?.response?.data?.errorMessage || err?.message || 'Upload failed';
      setFileItems(prev => prev.map(f =>
        f.status === STATUS.UPLOADING
          ? { ...f, status: STATUS.ERROR, error: msg, progress: 0 }
          : f
      ));
    } finally {
      setUploading(false);
      setOverallProgress(0);
    }
  }, [fileItems, currentPath, onUploadSuccess]);

  const handleClose = useCallback(() => {
    if (uploading) return;
    setFileItems([]);
    setOverallProgress(0);
    onClose();
  }, [uploading, onClose]);

  const pendingCount = fileItems.filter(f => f.status === STATUS.PENDING).length;
  const doneCount = fileItems.filter(f => f.status === STATUS.DONE).length;
  const errorCount = fileItems.filter(f => f.status === STATUS.ERROR).length;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <CloudUpload color="primary" />
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
          Upload Files
        </Typography>
        <Chip
          size="small"
          label={currentPath}
          sx={{ fontFamily: 'monospace', fontSize: '0.7rem', maxWidth: 200 }}
        />
        <IconButton onClick={handleClose} size="small" disabled={uploading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Drop zone */}
        <Box
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
          sx={{
            border: `2px dashed ${isDragOver ? theme.palette.primary.main : alpha(theme.palette.divider, 0.4)}`,
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            bgcolor: isDragOver
              ? alpha(theme.palette.primary.main, 0.06)
              : alpha(theme.palette.background.default, 0.6),
            transition: 'all 0.2s ease',
            '&:hover': uploading ? {} : {
              borderColor: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
        >
          <CloudUpload
            sx={{
              fontSize: 40,
              color: isDragOver ? 'primary.main' : 'text.secondary',
              mb: 1,
            }}
          />
          <Typography variant="body1" fontWeight={600} gutterBottom>
            {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            or click to browse — any size supported
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </Box>

        {/* Overall progress bar while uploading */}
        {uploading && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Uploading…</Typography>
              <Typography variant="caption" fontWeight={700}>{overallProgress}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={overallProgress} sx={{ borderRadius: 1 }} />
          </Box>
        )}

        {/* File list */}
        {fileItems.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {fileItems.length} file{fileItems.length !== 1 ? 's' : ''}
              </Typography>
              {doneCount > 0 && (
                <Chip size="small" label={`${doneCount} done`} color="success" />
              )}
              {errorCount > 0 && (
                <Chip size="small" label={`${errorCount} failed`} color="error" />
              )}
            </Box>
            <List dense disablePadding sx={{ maxHeight: 280, overflowY: 'auto' }}>
              {fileItems.map((item, idx) => (
                <React.Fragment key={item.id}>
                  {idx > 0 && <Divider component="li" />}
                  <ListItem
                    disablePadding
                    sx={{ py: 0.5, px: 1 }}
                    secondaryAction={
                      item.status === STATUS.PENDING && !uploading ? (
                        <IconButton edge="end" size="small" onClick={() => removeFile(item.id)}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      ) : null
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {item.status === STATUS.DONE && (
                        <CheckCircleIcon fontSize="small" color="success" />
                      )}
                      {item.status === STATUS.ERROR && (
                        <ErrorIcon fontSize="small" color="error" />
                      )}
                      {(item.status === STATUS.PENDING || item.status === STATUS.UPLOADING) && (
                        <FileIcon fontSize="small" color="action" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap fontWeight={500}>
                          {item.file.name}
                        </Typography>
                      }
                      secondary={
                        item.status === STATUS.ERROR ? (
                          <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                            {item.error}
                          </Typography>
                        ) : item.status === STATUS.UPLOADING ? (
                          <Box sx={{ mt: 0.5, mr: 2 }}>
                            <LinearProgress
                              variant="determinate"
                              value={item.progress}
                              sx={{ height: 4, borderRadius: 2 }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            {formatSize(item.file.size)}
                          </Typography>
                        )
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={uploading} variant="outlined" color="inherit">
          {uploading ? 'Uploading…' : 'Close'}
        </Button>
        <Button
          onClick={handleUpload}
          disabled={uploading || pendingCount === 0}
          variant="contained"
          startIcon={<UploadIcon />}
        >
          Upload {pendingCount > 0 ? `(${pendingCount})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(FileUploadModal);
