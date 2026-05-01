import React, { useState, useEffect, useMemo, useCallback } from 'react';

function formatFileSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

import {
  Box,
  Typography,
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
  Button
} from '@mui/material';
import {
  Folder as FolderIcon,
  ChevronRight,
  Home as HomeIcon,
  ArrowUpward as UpIcon,
  KeyboardArrowRight,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  FolderOpen,
} from '@mui/icons-material';
import { motion, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { getStreamMediaList } from '@shared/services/ApiServices';
import { styled } from '@mui/material/styles';

// Animations
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const slideIn = {
  initial: { x: -20, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 20, opacity: 0 }
};


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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [hoveredItem, setHoveredItem] = useState(null);

  const pathParts = useMemo(() => destination.split('/').filter(Boolean), [destination]);

  useEffect(() => {
    setError('');
    loadFolders(destination);
  }, [destination]);

  const loadFolders = async (path) => {
    setLoading(true);
    try {
      const response = await getStreamMediaList(encodeURIComponent(path));
      if (response.success && response.data) {
        setItems(response.data.filter(item => item.isDirectory));
      } else {
        setError(response.message || 'Failed to load folders');
        setItems([]);
      }
    } catch (err) {
      setError(err.message || 'Server error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const updatePath = useCallback((path) => {
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

  const folderCount = items.length;

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
            <Box sx={{ p: 2 }}>
              {/* Folder Browser — primary element */}
              <Box sx={{ position: 'relative', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FolderOpen fontSize="small" />
                    {destination === '/' ? 'Root Directory' : destination}
                  </Typography>
                  {folderCount > 0 && (
                    <Chip
                      icon={<FolderOpen fontSize="small" />}
                      label={`${folderCount} folder${folderCount !== 1 ? 's' : ''}`}
                      size="small"
                      sx={{
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                        fontWeight: 500,
                        height: 22,
                      }}
                    />
                  )}
                </Box>

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

              {/* Selected folder indicator */}
              <Box
                sx={{
                  mt: 1.5,
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  Destination:
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="primary.main"
                  sx={{ wordBreak: 'break-all' }}
                >
                  {destination}
                </Typography>
              </Box>
            </Box>
          </GlassPaper>
        </motion.div>
      </AnimatePresence>
    </LazyMotion>
  );
};

export default React.memo(DestinationPicker);