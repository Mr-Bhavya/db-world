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
  Paper,
  IconButton,
  Chip,
  Tooltip,
  alpha,
  useTheme,
  Fade,
  Zoom,
  Button
} from '@mui/material';
import { 
  Folder as FolderIcon, 
  ChevronRight, 
  InsertDriveFile,
  Home as HomeIcon,
  ArrowUpward as UpIcon,
  KeyboardArrowRight,
  Refresh as RefreshIcon,
  CheckCircle,
  Error as ErrorIcon,
  Storage,
  FolderOpen,
  Search
} from '@mui/icons-material';
import { motion, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { handleApiError } from '../../Utils/errorHandler';
import { getStreamMediaList } from '../../ApiServices';
import { styled, keyframes } from '@mui/material/styles';

// Animations
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const scaleIn = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 }
};

const slideIn = {
  initial: { x: -20, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 20, opacity: 0 }
};

const shimmerAnimation = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
`;

const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
`;

// Styled Components
const GlassPaper = styled(Paper)(({ theme }) => ({
  background: `linear-gradient(135deg, 
    ${alpha(theme.palette.background.paper, 0.9)} 0%, 
    ${alpha(theme.palette.background.default, 0.7)} 100%)`,
  backdropFilter: 'blur(10px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #2196f3, #00c853, #ff9800)',
    opacity: 0.6,
  }
}));

const PathBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  backgroundColor: alpha(theme.palette.background.default, 0.5),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  backdropFilter: 'blur(5px)',
  borderRadius: theme.spacing(2, 2, 0, 0),
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(1.5),
    backgroundColor: alpha(theme.palette.background.paper, 0.8),
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
    '& fieldset': {
      borderColor: alpha(theme.palette.divider, 0.2),
    },
  },
  '& .MuiInputLabel-root': {
    color: alpha(theme.palette.text.primary, 0.7),
    '&.Mui-focused': {
      color: theme.palette.primary.main,
    },
  }
}));

const BreadcrumbLink = styled(Link)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.spacing(1),
  backgroundColor: alpha(theme.palette.background.paper, 0.6),
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  textDecoration: 'none',
  color: theme.palette.text.primary,
  fontWeight: 500,
  fontSize: '0.875rem',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    color: theme.palette.primary.main,
    transform: 'translateY(-1px)',
    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
    textDecoration: 'none',
  }
}));

const FolderItemButton = styled(motion(ListItemButton))(({ theme, isdirectory }) => ({
  borderRadius: theme.spacing(1),
  margin: theme.spacing(0.5),
  padding: theme.spacing(1.5),
  backgroundColor: 'transparent',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor: isdirectory === 'true' 
      ? alpha(theme.palette.primary.main, 0.08)
      : alpha(theme.palette.action.hover, 0.4),
    transform: 'translateX(8px) scale(1.02)',
    boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.1)}`,
  },
  '& .MuiListItemIcon-root': {
    minWidth: 40,
  },
  '& .MuiListItemText-primary': {
    fontWeight: isdirectory === 'true' ? 600 : 400,
    color: isdirectory === 'true' ? theme.palette.primary.main : theme.palette.text.primary,
  }
}));

const FileSizeChip = styled(Chip)(({ theme }) => ({
  height: 20,
  fontSize: '0.65rem',
  fontWeight: 500,
  backgroundColor: alpha(theme.palette.info.main, 0.1),
  color: theme.palette.info.main,
  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
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
  borderRadius: theme.spacing(1),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(8, 3),
  gap: theme.spacing(2),
  color: theme.palette.text.secondary,
  textAlign: 'center',
}));

const DestinationPicker = ({ destination, setDestination }) => {
  const theme = useTheme();
  const [manualPath, setManualPath] = useState(destination);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [validatingPath, setValidatingPath] = useState(false);
  const [lastValidatedPath, setLastValidatedPath] = useState('');

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
        setLastValidatedPath(path);
      } else {
        setError(response.message || 'Failed to load folders');
        setItems([]);
      }
    } catch (err) {
      handleApiError(err);
      setError(err.message || 'Server error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const updatePath = useCallback(async (path) => {
    setDestination(path);
    setValidatingPath(true);
    await loadFolders(path);
    setValidatingPath(false);
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
    if (path.length > 500) return 'Path is too long';
    if (!/^[a-zA-Z0-9_\-./ ]+$/.test(path)) return 'Path contains invalid characters';
    return '';
  };

  const handleManualPathSubmit = async () => {
    const errorMsg = validatePath(manualPath);
    if (errorMsg) {
      setError(errorMsg);
    } else {
      await updatePath(manualPath);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === '0') return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFolderStats = () => {
    const folderCount = items.filter(item => item.isDirectory).length;
    const totalItems = items.length;
    return { folderCount, totalItems };
  };

  const stats = getFolderStats();

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait">
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3 }}
          style={{ width: '100%' }}
        >
          <GlassPaper elevation={0}>
            {/* Header */}
            <PathBar>
              <Tooltip title="Root Directory">
                <IconButton
                  size="small"
                  onClick={handleRootClick}
                  sx={{
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.2),
                      transform: 'rotate(180deg)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  <HomeIcon />
                </IconButton>
              </Tooltip>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, overflow: 'auto' }}>
                <Breadcrumbs 
                  separator={
                    <KeyboardArrowRight 
                      sx={{ 
                        fontSize: 16, 
                        color: alpha(theme.palette.text.primary, 0.5) 
                      }} 
                    />
                  }
                  sx={{ flex: 1 }}
                >
                  <BreadcrumbLink 
                    onClick={handleRootClick}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.5 
                    }}
                  >
                    <HomeIcon fontSize="small" />
                    Root
                  </BreadcrumbLink>
                  {pathParts.map((part, idx) => (
                    <BreadcrumbLink 
                      key={idx}
                      onClick={() => handleBreadcrumbClick(idx)}
                    >
                      {part}
                    </BreadcrumbLink>
                  ))}
                </Breadcrumbs>
              </Box>

              <Tooltip title="Refresh">
                <IconButton
                  size="small"
                  onClick={() => loadFolders(destination)}
                  disabled={loading}
                  sx={{
                    backgroundColor: alpha(theme.palette.info.main, 0.1),
                    color: theme.palette.info.main,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.info.main, 0.2),
                      transform: 'rotate(180deg)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </PathBar>

            {/* Main Content */}
            <Box sx={{ p: 2.5 }}>
              {/* Path Input */}
              <Box sx={{ mb: 3, position: 'relative' }}>
                <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Storage fontSize="small" />
                  Destination Path
                </Typography>
                <StyledTextField
                  fullWidth
                  placeholder="/path/to/destination"
                  value={manualPath}
                  onChange={(e) => {
                    setManualPath(e.target.value);
                    setError('');
                  }}
                  onBlur={handleManualPathSubmit}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualPathSubmit()}
                  error={!!error}
                  helperText={error}
                  InputProps={{
                    endAdornment: (
                      <AnimatePresence>
                        {validatingPath ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                          >
                            <CircularProgress size={20} />
                          </motion.div>
                        ) : lastValidatedPath === destination && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring' }}
                          >
                            <CheckCircle sx={{ color: theme.palette.success.main }} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ),
                  }}
                  disabled={loading}
                  size="small"
                />
              </Box>

              {/* Stats Bar */}
              <AnimatePresence>
                {!error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Box sx={{ 
                      display: 'flex', 
                      gap: 2, 
                      mb: 2,
                      flexWrap: 'wrap' 
                    }}>
                      <Chip
                        icon={<FolderOpen fontSize="small" />}
                        label={`${stats.folderCount} Folders`}
                        size="small"
                        sx={{
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          color: theme.palette.primary.main,
                          fontWeight: 500,
                        }}
                      />
                      <Chip
                        icon={<InsertDriveFile fontSize="small" />}
                        label={`${stats.totalItems} Items`}
                        size="small"
                        sx={{
                          backgroundColor: alpha(theme.palette.info.main, 0.1),
                          color: theme.palette.info.main,
                          fontWeight: 500,
                        }}
                      />
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Folder List */}
              <Box sx={{ position: 'relative' }}>
                <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderOpen fontSize="small" />
                  {destination === '/' ? 'Root Directory' : `Contents of ${destination}`}
                </Typography>

                {loading ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <CircularProgress 
                        size={40} 
                        thickness={4}
                        sx={{ 
                          color: theme.palette.primary.main,
                          '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round'
                          }
                        }} 
                      />
                    </motion.div>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Loading directory contents...
                    </Typography>
                  </Box>
                ) : error ? (
                  <Alert 
                    severity="error" 
                    icon={<ErrorIcon />}
                    sx={{ 
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.error.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                    }}
                    action={
                      <Button 
                        size="small" 
                        color="inherit"
                        onClick={() => loadFolders(destination)}
                      >
                        Retry
                      </Button>
                    }
                  >
                    <Typography variant="body2" fontWeight="500">
                      {error}
                    </Typography>
                  </Alert>
                ) : (
                  <Paper 
                    sx={{ 
                      maxHeight: 320, 
                      overflow: 'auto',
                      backgroundColor: alpha(theme.palette.background.default, 0.5),
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      borderRadius: 2,
                    }}
                  >
                    <List dense disablePadding>
                      {/* Parent Directory */}
                      {destination !== '/' && (
                        <motion.div
                          variants={slideIn}
                          initial="initial"
                          animate="animate"
                          transition={{ delay: 0.1 }}
                        >
                          <ListItem disablePadding>
                            <FolderItemButton
                              onClick={handleParentClick}
                              isdirectory="true"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onMouseEnter={() => setHoveredItem('..')}
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              <ListItemIcon>
                                <UpIcon sx={{ color: theme.palette.primary.main }} />
                              </ListItemIcon>
                              <ListItemText 
                                primary=".. (Go Up)"
                                primaryTypographyProps={{ fontWeight: 600 }}
                              />
                              {hoveredItem === '..' && (
                                <Chip 
                                  label="Parent" 
                                  size="small" 
                                  sx={{ 
                                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                    color: theme.palette.primary.main,
                                  }}
                                />
                              )}
                            </FolderItemButton>
                          </ListItem>
                          <Divider sx={{ my: 0.5 }} />
                        </motion.div>
                      )}

                      {/* Folder Items */}
                      <AnimatePresence>
                        {items.length > 0 ? (
                          items.map((item, index) => (
                            <motion.div
                              key={item.id || `${item.fileName}-${index}`}
                              variants={slideIn}
                              initial="initial"
                              animate="animate"
                              exit="exit"
                              transition={{ delay: index * 0.05 }}
                              layout
                            >
                              <ListItem disablePadding>
                                <FolderItemButton
                                  onClick={() => item.isDirectory && handleFolderClick(item.fileName)}
                                  disabled={!item.isDirectory}
                                  isdirectory={item.isDirectory.toString()}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onMouseEnter={() => setHoveredItem(item.fileName)}
                                  onMouseLeave={() => setHoveredItem(null)}
                                >
                                  <ListItemIcon>
                                    <FolderIcon sx={{ 
                                      color: item.isDirectory 
                                        ? theme.palette.primary.main 
                                        : alpha(theme.palette.text.primary, 0.6)
                                    }} />
                                  </ListItemIcon>
                                  <ListItemText 
                                    primary={item.fileName}
                                    secondary={
                                      !item.isDirectory && item.fileSize
                                        ? formatFileSize(parseInt(item.fileSize))
                                        : null
                                    }
                                    primaryTypographyProps={{ 
                                      noWrap: true,
                                      sx: {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }
                                    }}
                                  />
                                  {hoveredItem === item.fileName && item.isDirectory && (
                                    <motion.div
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                    >
                                      <ChevronRight sx={{ color: theme.palette.primary.main }} />
                                    </motion.div>
                                  )}
                                </FolderItemButton>
                              </ListItem>
                              {index < items.length - 1 && (
                                <Divider sx={{ my: 0.5, mx: 2 }} />
                              )}
                            </motion.div>
                          ))
                        ) : (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                          >
                            <EmptyState>
                              <FolderOpen 
                                sx={{ 
                                  fontSize: 48, 
                                  color: alpha(theme.palette.text.secondary, 0.3),
                                  mb: 1
                                }} 
                              />
                              <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                                Empty Directory
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                This folder contains no items
                              </Typography>
                            </EmptyState>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </List>
                  </Paper>
                )}
              </Box>

              {/* Help Text */}
              <AnimatePresence>
                {!loading && !error && items.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      sx={{ 
                        display: 'block', 
                        mt: 1.5,
                        fontStyle: 'italic',
                        textAlign: 'center'
                      }}
                    >
                      Click on a folder to navigate, or type a path above
                    </Typography>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
          </GlassPaper>
        </motion.div>
      </AnimatePresence>
    </LazyMotion>
  );
};

export default React.memo(DestinationPicker);