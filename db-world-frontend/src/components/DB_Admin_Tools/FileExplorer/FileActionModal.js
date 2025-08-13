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
  Alert
} from '@mui/material';
import { motion } from 'framer-motion';
import DestinationPicker from './DestinationPicker';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  maxWidth: '90vw',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  outline: 'none'
};

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
  const [destination, setDestination] = useState(currentPath);
  const [newName, setNewName] = useState(selectedFile?.fileName || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setDestination(currentPath);
      setNewName(selectedFile?.fileName || '');
      setError('');
      setLoading(false);
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
    try {
      await onSubmit({
        action,
        file: selectedFile,
        destination,
        newName,
        onSuccess: () => {
          fetchFiles(currentPath);
          onClose();
        }
      });
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <Modal 
        open={open} 
        onClose={onClose}
        aria-labelledby="file-action-modal-title"
        aria-describedby="file-action-modal-description"
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <Paper sx={modalStyle}>
            <Typography id="file-action-modal-title" variant="h6" gutterBottom>
              {title}
            </Typography>
            <Divider sx={{ my: 2 }} />

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {action === 'rename' && (
              <TextField
                fullWidth
                label="New Name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError('');
                }}
                sx={{ mb: 2 }}
                error={Boolean(error)}
                helperText={error}
                disabled={loading}
              />
            )}

            {(action === 'move' || action === 'copy') && (
              <DestinationPicker
                destination={destination}
                setDestination={setDestination}
                fetchFolders={fetchFiles}
              />
            )}

            {action === 'delete' && !confirmDelete && (
              <Typography id="file-action-modal-description">
                Are you sure you want to delete <strong>{selectedFile?.fileName}</strong>?
              </Typography>
            )}

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button 
                variant="outlined" 
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color={action === 'delete' ? 'error' : 'primary'}
                onClick={handleSubmit}
                disabled={loading}
                endIcon={loading ? <CircularProgress size={20} /> : null}
              >
                {loading ? 'Processing...' : 
                 action === 'rename' ? 'Rename' :
                 action === 'move' ? 'Move' :
                 action === 'copy' ? 'Copy' : 'Delete'}
              </Button>
            </Box>
          </Paper>
        </motion.div>
      </Modal>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            This action cannot be undone. Are you absolutely sure you want to delete "{selectedFile?.fileName}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            color="error" 
            autoFocus
            disabled={loading}
            endIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FileActionModal;