import React, { useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Box, Typography, Avatar, Chip, useTheme, Divider, CircularProgress
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Warning as WarningIcon,
  Theaters as MovieIcon,
  LiveTv as TvIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDialog = motion(Dialog);
const MotionButton = motion(Button);

const DeleteConfirmationDialog = ({ 
  open, 
  onClose, 
  onConfirm, 
  record, 
  loading = false 
}) => {
  const theme = useTheme();


  // Move useCallback hooks to the top, before any conditional returns
  const handleClose = useCallback((event, reason) => {
    if (loading) {
      return;
    }
    if (onClose) {
      onClose();
    }
  }, [loading, onClose]);

  const handleConfirm = useCallback(() => {
    //console.log("DeleteConfirmationDialog - handleConfirm called");
    if (onConfirm) {
      onConfirm();
    }
  }, [onConfirm]);

  // Don't return null when no record - instead, handle it in the render
  // This ensures the dialog opens even if record is initially null
  const hasRecord = !!record;
  const hasFiles = hasRecord && record.stream_file_list && record.stream_file_list.length > 0;
  const hasTmdbLink = hasRecord && !!record.tmdb;
  const totalFileSize = hasFiles 
    ? record.stream_file_list.reduce((sum, file) => sum + (file.fileSize || 0), 0)
    : 0;

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  //console.log("DeleteConfirmationDialog - Rendering with hasRecord:", hasRecord);

  return (
    <MotionDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        //   background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.error.light}05 100%)`,
          border: `1px solid ${theme.palette.error.light}30`,
        }
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <DialogTitle sx={{ 
        textAlign: 'center', 
        pb: 1,
        background: `linear-gradient(135deg, ${theme.palette.error.main}15 0%, ${theme.palette.error.light}05 100%)`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1 }}>
          <Avatar
            sx={{
              bgcolor: theme.palette.error.main,
              width: 60,
              height: 60,
            }}
          >
            <WarningIcon sx={{ fontSize: 32 }} />
          </Avatar>
        </Box>
        <Typography variant="h5" fontWeight="bold" color="error">
          Delete Record
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This action cannot be undone
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {hasRecord ? (
          <>
            {/* Record Information */}
            <Box sx={{ 
              p: 2, 
              mb: 2, 
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.background.default
            }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: record.type === 'movie' ? theme.palette.primary.main : theme.palette.secondary.main,
                    width: 50,
                    height: 50,
                  }}
                >
                  {record.type === 'movie' ? <MovieIcon /> : <TvIcon />}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" fontWeight="600" gutterBottom>
                    {record.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={record.type === 'movie' ? 'Movie' : 'TV Show'}
                      color={record.type === 'movie' ? 'primary' : 'secondary'}
                      size="small"
                    />
                    <Chip
                      label={`ID: ${record.id}`}
                      variant="outlined"
                      size="small"
                    />
                    {hasTmdbLink && (
                      <Chip
                        icon={<LinkIcon />}
                        label="TMDB Linked"
                        color="success"
                        variant="outlined"
                        size="small"
                      />
                    )}
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Record Details */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {new Date(record.creation_date).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Modified
                  </Typography>
                  <Typography variant="body2">
                    {new Date(record.last_modified_date).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Files
                  </Typography>
                  <Typography variant="body2">
                    {hasFiles ? record.stream_file_list.length : 'No files'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Warning Sections */}
            <AnimatePresence>
              {hasFiles && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Box sx={{ 
                    p: 2, 
                    mb: 2, 
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.warning.light}`,
                    background: `${theme.palette.warning.light}10`
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <WarningIcon sx={{ color: theme.palette.warning.main }} />
                      <Typography variant="subtitle2" fontWeight="600" color="warning.main">
                        Media Files Warning
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      This record contains <strong>{record.stream_file_list.length} media files</strong> 
                      totaling <strong>{formatFileSize(totalFileSize)}</strong>. 
                      All associated files will be permanently deleted from the server.
                    </Typography>
                  </Box>
                </motion.div>
              )}

              {hasTmdbLink && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Box sx={{ 
                    p: 2, 
                    mb: 2, 
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.info.light}`,
                    background: `${theme.palette.info.light}10`
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <WarningIcon sx={{ color: theme.palette.info.main }} />
                      <Typography variant="subtitle2" fontWeight="600" color="info.main">
                        TMDB Data Loss
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      TMDB metadata and links will be permanently removed. 
                      You'll need to re-link if you recreate this record.
                    </Typography>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* Loading state when record is not available yet */
          <Box sx={{ 
            p: 4, 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}>
            <CircularProgress size={40} />
            <Typography variant="body1" color="text.secondary">
              Loading record details...
            </Typography>
          </Box>
        )}

        {/* Final Warning - Always show this */}
        <Box sx={{ 
          p: 2, 
          borderRadius: 2,
          border: `1px solid ${theme.palette.error.light}`,
          background: `${theme.palette.error.light}08`,
          mt: 2
        }}>
          <Typography variant="body2" color="error" textAlign="center" fontWeight="500">
            ⚠️ This action is permanent and cannot be undone. All data will be lost.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 2 }}>
        <MotionButton
          onClick={handleClose}
          disabled={loading}
          variant="outlined"
          sx={{ 
            minWidth: 100,
            borderColor: theme.palette.text.secondary,
            color: theme.palette.text.secondary
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Cancel
        </MotionButton>
        <MotionButton
          onClick={handleConfirm}
          disabled={loading || !hasRecord} // Also disable if no record
          variant="contained"
          color="error"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
          sx={{ 
            minWidth: 140,
            background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
            '&:hover': {
              background: `linear-gradient(135deg, ${theme.palette.error.dark} 0%, ${theme.palette.error.dark} 100%)`,
            }
          }}
          whileHover={{ scale: (loading || !hasRecord) ? 1 : 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {loading ? 'Deleting...' : 'Delete Permanently'}
        </MotionButton>
      </DialogActions>
    </MotionDialog>
  );
};

export default DeleteConfirmationDialog;