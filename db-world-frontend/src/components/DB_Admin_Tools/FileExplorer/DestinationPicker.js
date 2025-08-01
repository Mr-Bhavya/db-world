import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Breadcrumbs,
  Link,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material';
import { Folder as FolderIcon, ChevronRight, InsertDriveFile } from '@mui/icons-material';
import { handleApiError } from '../../Utils/errorHandler';
import { getStreamMediaList } from '../../ApiServices';

const DestinationPicker = ({ destination, setDestination }) => {
  const [manualPath, setManualPath] = useState(destination);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const pathParts = useMemo(() => destination.split('/').filter(Boolean), [destination]);

  useEffect(() => {
    setManualPath(destination);
    setError('');
    loadFolders(destination);
  }, [destination]);

  const loadFolders = async (path) => {
    setLoading(true);
    try {
      const response = await getStreamMediaList(encodeURIComponent(path));
      if (response.success && response.data) {
        const folders = response.data.filter(item => item.isDirectory);
        setItems(folders);
      } else {
        setError(response.message || 'Failed to load folders');
      }
    } catch (err) {
      handleApiError(err);
      setError(err.message || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  const updatePath = useCallback(async (path) => {
    setDestination(path);
  }, [setDestination]);

  const handleBreadcrumbClick = (index) => {
    const newPath = '/' + pathParts.slice(0, index + 1).join('/');
    updatePath(newPath);
  };

  const handleRootClick = () => updatePath('/');

  const handleFolderClick = (folderName) => {
    const newPath = destination === '/' ? `/${folderName}` : `${destination}/${folderName}`;
    updatePath(newPath);
  };

  const handleParentClick = () => {
    const parts = destination.split('/').filter(Boolean);
    const parentPath = '/' + parts.slice(0, -1).join('/');
    updatePath(parentPath || '/');
  };

  const validatePath = (path) => {
    if (!path.startsWith('/')) return 'Path must start with /';
    if (path.includes('//')) return 'Path cannot contain consecutive slashes';
    return '';
  };

  const handleManualPathSubmit = () => {
    const errorMsg = validatePath(manualPath);
    if (errorMsg) {
      setError(errorMsg);
    } else {
      updatePath(manualPath);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Current Path:
      </Typography>

      <Breadcrumbs aria-label="path-breadcrumb" sx={{ mb: 2 }} separator={<ChevronRight fontSize="small" />}>
        <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={handleRootClick}>
          Root
        </Link>
        {pathParts.map((part, idx) => (
          <Link
            key={idx}
            underline="hover"
            color="inherit"
            sx={{ cursor: 'pointer' }}
            onClick={() => handleBreadcrumbClick(idx)}
          >
            {part}
          </Link>
        ))}
      </Breadcrumbs>

      <TextField
        fullWidth
        label="Destination Path"
        value={manualPath}
        onChange={(e) => {
          setManualPath(e.target.value);
          setError('');
        }}
        onBlur={handleManualPathSubmit}
        onKeyDown={(e) => e.key === 'Enter' && handleManualPathSubmit()}
        sx={{ mb: 2 }}
        error={!!error}
        helperText={error}
        inputProps={{ 'aria-label': 'Destination input path' }}
      />

      <Typography variant="body2" color="text.secondary" gutterBottom>
        {destination === '/' ? 'Root Contents' : `Contents of ${destination}`}
      </Typography>

      <Paper sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }} elevation={0}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List dense aria-label="folder list">
            {destination !== '/' && (
              <ListItem disablePadding>
                <ListItemButton onClick={handleParentClick}>
                  <ListItemIcon>
                    <FolderIcon />
                  </ListItemIcon>
                  <ListItemText primary=".. (Parent directory)" />
                </ListItemButton>
              </ListItem>
            )}

            {items.length > 0 ? (
              items.map((item, index) => (
                <React.Fragment key={item.id || `${item.fileName}-${index}`}>
                  {index > 0 && <Divider />}
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => item.isDirectory && handleFolderClick(item.fileName)}
                      disabled={!item.isDirectory}
                    >
                      <ListItemIcon>
                        {item.isDirectory ? <FolderIcon /> : <InsertDriveFile />}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.fileName}
                        secondary={
                          !item.isDirectory && item.fileSize
                            ? formatFileSize(parseInt(item.fileSize))
                            : null
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                </React.Fragment>
              ))
            ) : (
              <ListItem>
                <ListItemText
                  primary="Empty directory"
                  primaryTypographyProps={{ color: 'text.secondary', fontStyle: 'italic' }}
                />
              </ListItem>
            )}
          </List>
        )}
      </Paper>
    </Box>
  );
};

export default DestinationPicker;