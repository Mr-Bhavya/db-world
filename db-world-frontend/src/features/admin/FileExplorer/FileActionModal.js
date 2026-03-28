import React, { useState, useEffect } from 'react';
import {
  Modal,
  Box,
  Typography,
  Button,
  TextField,
  Divider,
  Paper,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Alert,
  IconButton,
  alpha,
  useTheme,
  Fade,
  Zoom
} from '@mui/material';
import { 
  motion, 
  AnimatePresence,
  LazyMotion,
  domAnimation 
} from 'framer-motion';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  DriveFileMove as MoveIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import DestinationPicker from './DestinationPicker';
import { styled, keyframes } from '@mui/material/styles';

// Animations
const fadeInUp = {
  initial: { opacity: 0, y: 30, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 20, scale: 0.95 }
};

const slideIn = {
  initial: { x: -100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 100, opacity: 0 }
};

const pulseAnimation = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const shimmerAnimation = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
`;

// Styled Components
const GlassModal = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(500px, 95vw)',
  maxHeight: '90vh',
  background: `linear-gradient(135deg, 
    ${alpha(theme.palette.background.paper, 0.95)} 0%, 
    ${alpha(theme.palette.background.default, 0.9)} 100%)`,
  backdropFilter: 'blur(20px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  boxShadow: `0 25px 50px -12px ${alpha(theme.palette.common.black, 0.25)}`,
  borderRadius: theme.spacing(3),
  overflow: 'hidden',
  outline: 'none',
  display: 'flex',
  flexDirection: 'column',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #2196f3, #00c853, #ff9800)',
    opacity: 0.8,
  }
}));

const ActionIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color'
})(({ theme, color = 'primary' }) => ({
  width: 60,
  height: 60,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 20px',
  background: `linear-gradient(135deg, 
    ${alpha(theme.palette[color].main, 0.15)} 0%, 
    ${alpha(theme.palette[color].light, 0.05)} 100%)`,
  border: `2px solid ${alpha(theme.palette[color].main, 0.3)}`,
  boxShadow: `0 8px 32px ${alpha(theme.palette[color].main, 0.2)}`,
  '& .MuiSvgIcon-root': {
    fontSize: 28,
    color: theme.palette[color].main,
  }
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(1.5),
    backgroundColor: alpha(theme.palette.background.paper, 0.7),
    backdropFilter: 'blur(5px)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      backgroundColor: alpha(theme.palette.background.paper, 0.9),
      transform: 'translateY(-2px)',
      boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
    },
    '&.Mui-focused': {
      backgroundColor: alpha(theme.palette.background.paper, 0.95),
      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
    },
  },
  '& .MuiInputLabel-root': {
    color: alpha(theme.palette.text.primary, 0.7),
    '&.Mui-focused': {
      color: theme.palette.primary.main,
    },
  }
}));

const ActionButton = styled(motion(Button))(({ theme, actiontype }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(1.5, 3),
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '1rem',
  transition: 'all 0.3s ease',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '-100%',
    width: '100%',
    height: '100%',
    background: `linear-gradient(90deg, 
      transparent, 
      ${alpha(theme.palette.common.white, 0.2)}, 
      transparent)`,
    transition: 'left 0.7s ease',
  },
  '&:hover::before': {
    left: '100%',
  },
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: actiontype === 'delete' 
      ? `0 8px 25px ${alpha(theme.palette.error.main, 0.3)}`
      : `0 8px 25px ${alpha(theme.palette.primary.main, 0.3)}`,
  },
}));

const LoadingShimmer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  background: `linear-gradient(90deg, 
    ${alpha(theme.palette.background.paper, 0.8)} 25%, 
    ${alpha(theme.palette.primary.light, 0.1)} 50%, 
    ${alpha(theme.palette.background.paper, 0.8)} 75%)`,
  backgroundSize: '400px 100%',
  animation: `${shimmerAnimation} 2s infinite linear`,
}));

const FileActionModal = ({
  open,
  onClose,
  title,
  action,
  onSubmit,
  selectedFile,
  currentPath,
  fetchFiles
}) => {
  const theme = useTheme();
  const [destination, setDestination] = useState(currentPath);
  const [newName, setNewName] = useState(selectedFile?.fileName || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [success, setSuccess] = useState(false);

  const actionConfig = {
    rename: {
      icon: EditIcon,
      color: 'primary',
      gradient: 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)',
    },
    move: {
      icon: MoveIcon,
      color: 'warning',
      gradient: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
    },
    copy: {
      icon: CopyIcon,
      color: 'info',
      gradient: 'linear-gradient(135deg, #00bcd4 0%, #80deea 100%)',
    },
    delete: {
      icon: DeleteIcon,
      color: 'error',
      gradient: 'linear-gradient(135deg, #f44336 0%, #ef9a9a 100%)',
    }
  };

  useEffect(() => {
    if (open) {
      setDestination(currentPath);
      setNewName(selectedFile?.fileName || '');
      setError('');
      setLoading(false);
      setSuccess(false);
    }
  }, [open, currentPath, selectedFile]);

  const validateName = (name) => {
    if (!name.trim()) {
      return 'Name cannot be empty';
    }
    if (name.match(/[<>:"/\\|?*]/)) {
      return 'Name contains invalid characters';
    }
    return '';
  };

  const handleSubmit = async () => {
    if (action === 'rename') {
      const validationError = validateName(newName);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (action === 'delete' && !confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await onSubmit({
        action,
        file: selectedFile,
        destination,
        newName,
        onSuccess: () => {
          setSuccess(true);
          setTimeout(() => {
            fetchFiles(currentPath);
            onClose();
            setSuccess(false);
          }, 1500);
        }
      });
    } catch (err) {
      setError(err.message || 'An error occurred');
      setLoading(false);
      setConfirmDelete(false);
    }
  };

  const getActionIcon = () => {
    const config = actionConfig[action] || actionConfig.rename;
    const Icon = config.icon;
    return (
      <ActionIcon color={config.color}>
        <Icon />
      </ActionIcon>
    );
  };

  const getActionButtonText = () => {
    if (loading) return 'Processing...';
    if (success) return 'Success!';
    switch (action) {
      case 'rename': return 'Rename File';
      case 'move': return 'Move File';
      case 'copy': return 'Copy File';
      case 'delete': return confirmDelete ? 'Confirm Deletion' : 'Delete File';
      default: return 'Submit';
    }
  };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait">
        {open && (
          <Modal 
            open={open} 
            onClose={loading ? undefined : onClose}
            closeAfterTransition
            BackdropProps={{
              sx: {
                backdropFilter: 'blur(5px)',
                backgroundColor: alpha(theme.palette.common.black, 0.5),
              }
            }}
          >
            <Fade in={open} timeout={300}>
              <GlassModal>
                {/* Header */}
                <Box sx={{ 
                  p: 3, 
                  pb: 2,
                  position: 'relative',
                  background: actionConfig[action]?.gradient || actionConfig.rename.gradient,
                  backgroundSize: '200% 200%',
                  animation: `${pulseAnimation} 3s ease-in-out infinite alternate`,
                }}>
                  <IconButton
                    onClick={onClose}
                    disabled={loading}
                    sx={{
                      position: 'absolute',
                      right: 16,
                      top: 16,
                      backgroundColor: alpha(theme.palette.common.white, 0.2),
                      backdropFilter: 'blur(10px)',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.common.white, 0.3),
                        transform: 'rotate(90deg)',
                      },
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <CloseIcon sx={{ color: 'white' }} />
                  </IconButton>

                  {getActionIcon()}
                  
                  <Typography 
                    variant="h5" 
                    fontWeight="bold" 
                    align="center"
                    sx={{
                      color: 'white',
                      textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    {title}
                  </Typography>
                  
                  <Typography 
                    variant="body2" 
                    align="center" 
                    sx={{ 
                      color: alpha(theme.palette.common.white, 0.9),
                      mt: 1,
                    }}
                  >
                    {selectedFile?.fileName && (
                      <>
                        File: <strong>{selectedFile.fileName}</strong>
                      </>
                    )}
                  </Typography>
                </Box>

                {/* Content */}
                <Box sx={{ 
                  p: 3, 
                  flex: 1,
                  overflow: 'auto',
                  maxHeight: 'calc(90vh - 200px)',
                }}>
                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <Alert 
                          severity="error" 
                          sx={{ 
                            mb: 3,
                            borderRadius: 2,
                            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                            backgroundColor: alpha(theme.palette.error.main, 0.08),
                          }}
                          icon={<ErrorIcon />}
                        >
                          <Typography variant="body2" fontWeight="500">
                            {error}
                          </Typography>
                        </Alert>
                      </motion.div>
                    )}

                    {success && (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Alert 
                          severity="success" 
                          sx={{ 
                            mb: 3,
                            borderRadius: 2,
                            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                            backgroundColor: alpha(theme.palette.success.main, 0.08),
                          }}
                          icon={<SuccessIcon />}
                        >
                          <Typography variant="body2" fontWeight="500">
                            Operation completed successfully!
                          </Typography>
                        </Alert>
                      </motion.div>
                    )}

                    <motion.div
                      key={action}
                      variants={slideIn}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.3 }}
                    >
                      {action === 'rename' && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Enter a new name for the file:
                          </Typography>
                          <StyledTextField
                            fullWidth
                            label="New File Name"
                            value={newName}
                            onChange={(e) => {
                              setNewName(e.target.value);
                              setError('');
                            }}
                            disabled={loading || success}
                            autoFocus
                          />
                        </Box>
                      )}

                      {(action === 'move' || action === 'copy') && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Select destination folder:
                          </Typography>
                          <DestinationPicker
                            destination={destination}
                            setDestination={setDestination}
                            fetchFolders={fetchFiles}
                          />
                        </Box>
                      )}

                      {action === 'delete' && !confirmDelete && (
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                          <WarningIcon 
                            sx={{ 
                              fontSize: 64, 
                              color: theme.palette.warning.main,
                              mb: 2,
                              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
                            }} 
                          />
                          <Typography variant="h6" gutterBottom fontWeight="600" color="error">
                            Confirm Deletion
                          </Typography>
                          <Typography variant="body1" color="text.secondary" paragraph>
                            You are about to delete: 
                            <Box component="span" sx={{ 
                              fontWeight: 'bold', 
                              color: 'error.main',
                              display: 'block',
                              mt: 0.5,
                              wordBreak: 'break-word'
                            }}>
                              "{selectedFile?.fileName}"
                            </Box>
                          </Typography>
                          <Alert 
                            severity="warning" 
                            sx={{ 
                              mt: 2,
                              textAlign: 'left',
                              borderRadius: 2,
                            }}
                            icon={false}
                          >
                            <Typography variant="body2" fontWeight="500">
                              ⚠️ This action is permanent and cannot be undone.
                            </Typography>
                          </Alert>
                        </Box>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </Box>

                {/* Footer */}
                <Box sx={{ 
                  p: 3, 
                  pt: 2,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  backgroundColor: alpha(theme.palette.background.default, 0.5),
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 2,
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                  }}>
                    <ActionButton
                      variant="outlined"
                      onClick={onClose}
                      disabled={loading || success}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      sx={{
                        borderColor: alpha(theme.palette.divider, 0.3),
                        color: 'text.secondary',
                        '&:hover': {
                          borderColor: theme.palette.divider,
                        }
                      }}
                    >
                      Cancel
                    </ActionButton>
                    
                    <ActionButton
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={loading || success}
                      actiontype={action}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      sx={{
                        background: actionConfig[action]?.gradient || actionConfig.rename.gradient,
                        color: 'white',
                        position: 'relative',
                        overflow: 'hidden',
                        animation: success ? 'none' : 
                          (loading ? `${shimmerAnimation} 2s infinite linear` : 'none'),
                      }}
                    >
                      {loading && (
                        <Box sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: alpha(theme.palette.common.white, 0.3),
                          backdropFilter: 'blur(2px)',
                        }} />
                      )}
                      
                      {loading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircularProgress size={20} color="inherit" />
                          Processing...
                        </Box>
                      ) : success ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SuccessIcon />
                          Success!
                        </Box>
                      ) : (
                        getActionButtonText()
                      )}
                    </ActionButton>
                  </Box>
                </Box>
              </GlassModal>
            </Fade>
          </Modal>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog for Delete */}
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: `linear-gradient(135deg, 
              ${alpha(theme.palette.background.paper, 0.95)} 0%, 
              ${alpha(theme.palette.background.default, 0.9)} 100%)`,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <DialogTitle sx={{ 
            background: actionConfig.delete.gradient,
            color: 'white',
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <DeleteIcon />
              <Typography variant="h6" fontWeight="bold">
                Final Confirmation
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ py: 3 }}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <WarningIcon 
                sx={{ 
                  fontSize: 48, 
                  color: theme.palette.error.main,
                  mb: 2,
                  animation: `${pulseAnimation} 1s ease-in-out infinite`,
                }} 
              />
              <Typography variant="h6" gutterBottom fontWeight="600" color="error">
                ⚠️ Permanent Deletion
              </Typography>
              <DialogContentText sx={{ mb: 2 }}>
                You are about to permanently delete:
              </DialogContentText>
              <Paper
                sx={{
                  p: 2,
                  mb: 2,
                  backgroundColor: alpha(theme.palette.error.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                  borderRadius: 2,
                }}
              >
                <Typography variant="body1" fontWeight="600" color="error">
                  "{selectedFile?.fileName}"
                </Typography>
              </Paper>
              <Alert 
                severity="error" 
                sx={{ 
                  textAlign: 'left',
                  borderRadius: 2,
                }}
              >
                <Typography variant="body2">
                  <strong>This action cannot be undone.</strong> The file will be permanently removed from the system.
                </Typography>
              </Alert>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 1 }}>
            <Button 
              onClick={() => setConfirmDelete(false)}
              variant="outlined"
              sx={{ borderRadius: 2 }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained"
              color="error"
              sx={{ 
                borderRadius: 2,
                fontWeight: 600,
                background: actionConfig.delete.gradient,
              }}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
            >
              {loading ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogActions>
        </motion.div>
      </Dialog>
    </LazyMotion>
  );
};

export default FileActionModal;