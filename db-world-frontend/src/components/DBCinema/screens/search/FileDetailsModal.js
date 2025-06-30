import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  useTheme,
  Typography
} from '@mui/material';
import { motion } from 'framer-motion';
import { Close } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  loadStreamFileInfoByFiledId
} from '../../../ApiServices';
import Constants from '../../../Constants';
import CommonServices from '../../../CommonServices';
import { MediaInfoRender } from '../MediaFileInfo/MediaInfoRender';
import LoadingSpinner from '../../../LoadingSpinner';

const FileDetailsModal = ({ open, onClose, fileId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [mediaInfo, setMediaInfo] = useState(null);

  useEffect(() => {
    const fetchMediaInfo = async () => {
      if (open && fileId) {
        setLoading(true);
        try {
          const mediaInfoRes = await loadStreamFileInfoByFiledId(fileId);
          if (mediaInfoRes.httpStatusCode === 200) {
            const converted = CommonServices.convertMediaInfoToCustomFormat(mediaInfoRes.data, true);
            if (converted.length > 0) {
              setMediaInfo(converted[0]);
            }
          } else if (mediaInfoRes.httpStatusCode === 401 || mediaInfoRes.httpStatusCode === 403) {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          } else {
            Constants.showToast.error(mediaInfoRes.message);
          }
        } catch (error) {
          console.error(error);
          Constants.showToast.error('Failed to load media info');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchMediaInfo();
  }, [open, fileId, navigate, location]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      style={{ zIndex: 6000 }} // Ensure it appears above other dialogs
      PaperProps={{
        component: motion.div,
        initial: { opacity: 0, y: 50 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 50 },
        transition: { duration: 0.3 },
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 24,
          maxHeight: '100vh',
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: 'background.default',
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        <Typography variant="h6">Media Information</Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <MediaInfoRender 
            mediaInfo={mediaInfo} 
            expandCard={true}
            showActions={true}
            cardStyle={{ boxShadow: 'none', border: 'none' }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FileDetailsModal;