import React from 'react';
import {
  Modal,
  Box,
  Typography,
  Button,
  Divider,
  Paper
} from '@mui/material';
import { motion } from 'framer-motion';
import CommonServices from '../../CommonServices';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  maxHeight: '80vh',
  overflowY: 'auto'
};

const FileInfoModal = ({ open, onClose, file }) => {
  if (!file) return null;

  const fileSize = CommonServices.bytesToReadbleFormat(file?.fileSize);

  return (
    <Modal open={open} onClose={onClose}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
      >
        <Paper sx={modalStyle}>
          <Typography variant="h6" gutterBottom>
            File Information
          </Typography>
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography><strong>Name:</strong> {file.fileName}</Typography>
            <Typography><strong>Path:</strong> {file.filePath}</Typography>
            <Typography><strong>Type:</strong> {file.isDirectory ? 'Folder' : 'File'}</Typography>
            {!file.isDirectory && (
              <Typography><strong>Size:</strong> {fileSize.value} {fileSize.suffix}</Typography>
            )}
            <Typography><strong>Created:</strong> {file.creationTime}</Typography>
            <Typography><strong>Modified:</strong> {file.lastModifiedTime}</Typography>
          </Box>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={onClose}>
              Close
            </Button>
          </Box>
        </Paper>
      </motion.div>
    </Modal>
  );
};

export default FileInfoModal;