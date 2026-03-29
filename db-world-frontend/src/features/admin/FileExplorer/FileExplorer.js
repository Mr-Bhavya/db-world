import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  Paper,
  CircularProgress,
  Tooltip,
  Breadcrumbs,
  Link,
  Chip,
  alpha,
  useTheme,
  useMediaQuery,
  Fade,
  Skeleton,
  Badge
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  MoreVert as MoreVertIcon,
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  ChevronRight,
  Sort as SortIcon,
  GridView,
  ViewList,
  SelectAll,
  Deselect,
  Download,
  Upload,
  CreateNewFolder,
  Refresh,
  SortByAlpha,
  DateRange,
  FolderOpen,
  DriveFileMove,
  ContentCopy,
  Delete,
  Info
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { getStreamMediaList } from '@shared/services/ApiServices';
import FileInfoModal from './FileInfoModal';
import FileActionModal from './FileActionModal';
import useFileOperations from './useFileOperations';
import { FileContextMenu, FileActionMenu, FileSelectMenu, FileSortMenu } from './FileMenus';
// import FileUploadModal from './FileUploadModal';
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
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

// Styled Components
const GlassContainer = styled(Container)(({ theme }) => ({
  background: `linear-gradient(135deg, 
    ${alpha(theme.palette.background.default, 0.9)} 0%, 
    ${alpha(theme.palette.background.default, 0.7)} 100%)`,
  backdropFilter: 'blur(20px)',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `radial-gradient(circle at 20% 80%, 
      ${alpha(theme.palette.primary.light, 0.1)} 0%, 
      transparent 40%),
      radial-gradient(circle at 80% 20%, 
      ${alpha(theme.palette.secondary.light, 0.1)} 0%, 
      transparent 40%)`,
    pointerEvents: 'none',
    zIndex: 0,
  }
}));

const HeaderCard = styled(Paper)(({ theme }) => ({
  background: `linear-gradient(135deg, 
    ${alpha(theme.palette.background.paper, 0.95)} 0%, 
    ${alpha(theme.palette.background.default, 0.85)} 100%)`,
  backdropFilter: 'blur(20px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  boxShadow: `0 16px 40px ${alpha(theme.palette.common.black, 0.08)}`,
  borderRadius: theme.spacing(3),
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #2196f3, #00c853, #ff9800)',
    opacity: 0.7,
  }
}));

const FileCard = styled(Card)(({ theme, selected, isdirectory }) => ({
  background: `linear-gradient(135deg, 
    ${selected 
      ? alpha(theme.palette.primary.main, 0.1) 
      : alpha(theme.palette.background.paper, 0.9)} 0%, 
    ${selected 
      ? alpha(theme.palette.primary.light, 0.05) 
      : alpha(theme.palette.background.default, 0.7)} 100%)`,
  backdropFilter: 'blur(10px)',
  border: `2px solid ${selected 
    ? theme.palette.primary.main 
    : alpha(theme.palette.divider, 0.2)}`,
  borderRadius: theme.spacing(2),
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-6px)',
    boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
    '&::after': {
      opacity: 0.1,
    }
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: isdirectory === 'true' 
      ? `linear-gradient(135deg, 
          ${alpha(theme.palette.primary.main, 0.1)} 0%, 
          transparent 100%)`
      : `linear-gradient(135deg, 
          ${alpha(theme.palette.secondary.main, 0.1)} 0%, 
          transparent 100%)`,
    opacity: 0,
    transition: 'opacity 0.3s ease',
    pointerEvents: 'none',
  }
}));

const ActionButton = styled(motion(Button))(({ theme }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(1.5, 3),
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.875rem',
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
    boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.3)}`,
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
  borderRadius: theme.spacing(1),
}));

const FileExplorer = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState(null);
  const [fileMenuAnchor, setFileMenuAnchor] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const {
    showRenameModal,
    showDeleteModal,
    showInfoModal,
    showMoveModal,
    showCopyModal,
    selectedFile,
    setSelectedFile,
    handleOpenModal,
    handleCloseModal,
    handleFileAction
  } = useFileOperations();

  const fetchFiles = useCallback(async (path, showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    
    try {
      const response = await getStreamMediaList(encodeURIComponent(path));
      if (response.httpStatusCode === 200) {
        setFiles(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentPath);
    setSelectedFiles([]);
    setSearchTerm('');
  }, [currentPath, fetchFiles]);

  const handleDoubleClick = useCallback((file) => {
    if (file.isDirectory) {
      setCurrentPath(file.filePath);
    }
  }, []);

  const handleToggleSelect = useCallback((file, e) => {
    e.stopPropagation();
    setSelectedFiles((prev) => (
      prev.find((f) => f.filePath === file.filePath)
        ? prev.filter((f) => f.filePath !== file.filePath)
        : [...prev, file]
    ));
  }, []);

  const getFilteredAndSortedFiles = useMemo(() => {
    const filtered = files.filter((file) =>
      file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortFunctions = {
      name: (a, b) => a.fileName.localeCompare(b.fileName),
      date: (a, b) => new Date(b.lastModifiedTime) - new Date(a.lastModifiedTime),
      size: (a, b) => (b.fileSize || 0) - (a.fileSize || 0),
      'folders-first': (a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.fileName.localeCompare(b.fileName);
      },
      'files-first': (a, b) => {
        if (!a.isDirectory && b.isDirectory) return -1;
        if (a.isDirectory && !b.isDirectory) return 1;
        return a.fileName.localeCompare(b.fileName);
      }
    };

    return filtered.sort(sortFunctions[sortBy]);
  }, [files, searchTerm, sortBy]);

  const filteredFiles = getFilteredAndSortedFiles;

  const handleSelectAll = useCallback(() => {
    if (selectedFiles.length === filteredFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles([...filteredFiles]);
    }
  }, [filteredFiles, selectedFiles.length]);

  const handleContextMenu = useCallback((event, file) => {
    event.preventDefault();
    setSelectedFile(file);
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4
    });
  }, [setSelectedFile]);

  const handleFileMenuClick = useCallback((event, file) => {
    event.stopPropagation();
    setSelectedFile(file);
    setFileMenuAnchor(event.currentTarget);
  }, [setSelectedFile]);

  const handleSortMenuClick = useCallback((event) => {
    event.stopPropagation();
    setSortMenuAnchor(event.currentTarget);
  }, []);

  const handleBack = useCallback(() => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length ? `/${parts.join('/')}` : '/');
  }, [currentPath]);

  const fileStats = useMemo(() => {
    const total = filteredFiles.length;
    const folders = filteredFiles.filter(f => f.isDirectory).length;
    const files = total - folders;
    const selectedCount = selectedFiles.length;
    
    return { total, folders, files, selectedCount };
  }, [filteredFiles, selectedFiles.length]);

  const handleCreateFolder = useCallback(() => {
    handleOpenModal('create');
  }, [handleOpenModal]);

  const handleUpload = useCallback(() => {
    setShowUploadModal(true);
  }, []);

  const handleDownloadSelected = useCallback(() => {
    // Implement download logic
    //console.log('Downloading selected files:', selectedFiles);
  }, [selectedFiles]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  const gridLayout = useMemo(() => {
    if (viewMode === 'list') return '1fr';
    if (isMobile) return 'repeat(auto-fill, minmax(140px, 1fr))';
    if (isTablet) return 'repeat(auto-fill, minmax(160px, 1fr))';
    return 'repeat(auto-fill, minmax(180px, 1fr))';
  }, [viewMode, isMobile, isTablet]);

  const formatFileSize = useCallback((bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  return (
    <GlassContainer 
      maxWidth="xl" 
      sx={{ 
        py: isMobile ? 1 : 3,
        px: isMobile ? 1 : 2,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* Header Section */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        style={{ flexShrink: 0, position: 'relative', zIndex: 2 }}
      >
        <HeaderCard
          sx={{
            p: isMobile ? 1.5 : 3,
            mb: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {/* Top Controls */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 2,
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                width: isMobile ? '100%' : 'auto'
              }}
            >
              <Tooltip title="Go back">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <IconButton
                    onClick={handleBack}
                    disabled={currentPath === '/'}
                    sx={{
                      bgcolor: alpha(theme.palette.background.default, 0.8),
                      backdropFilter: 'blur(5px)',
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                </motion.div>
              </Tooltip>

              <TextField
                fullWidth={isMobile}
                placeholder="Search files and folders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.default, 0.8),
                    backdropFilter: 'blur(5px)',
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.background.default, 0.9),
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    },
                    '&.Mui-focused': {
                      borderColor: theme.palette.primary.main,
                      boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.1)}`,
                    }
                  }
                }}
                sx={{ 
                  maxWidth: isMobile ? '100%' : 400,
                  flexGrow: 1
                }}
              />
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                width: isMobile ? '100%' : 'auto',
                justifyContent: isMobile ? 'space-between' : 'flex-start'
              }}
            >
              {/* View Mode Toggle */}
              <Tooltip title={viewMode === 'grid' ? 'List view' : 'Grid view'}>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <IconButton
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    sx={{
                      bgcolor: viewMode === 'grid' 
                        ? alpha(theme.palette.primary.main, 0.1)
                        : alpha(theme.palette.background.default, 0.8),
                      backdropFilter: 'blur(5px)',
                      borderRadius: 2,
                      border: `1px solid ${viewMode === 'grid' 
                        ? alpha(theme.palette.primary.main, 0.3)
                        : alpha(theme.palette.divider, 0.2)}`,
                      color: viewMode === 'grid' 
                        ? theme.palette.primary.main 
                        : 'inherit',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {viewMode === 'grid' ? <ViewList /> : <GridView />}
                  </IconButton>
                </motion.div>
              </Tooltip>

              {/* Sort Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="outlined"
                  onClick={handleSortMenuClick}
                  startIcon={<SortIcon />}
                  size={isMobile ? "small" : "medium"}
                  sx={{
                    borderRadius: 2,
                    borderColor: alpha(theme.palette.divider, 0.3),
                    textTransform: 'none',
                    minWidth: isMobile ? 'auto' : 120,
                    fontWeight: 500,
                    bgcolor: alpha(theme.palette.background.paper, 0.8),
                    backdropFilter: 'blur(5px)',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                    }
                  }}
                >
                  {isMobile ? 'Sort' : `Sort: ${sortBy}`}
                </Button>
              </motion.div>

              {/* Refresh Button */}
              <Tooltip title="Refresh">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <IconButton
                    onClick={() => fetchFiles(currentPath, false)}
                    disabled={refreshing}
                    sx={{
                      bgcolor: alpha(theme.palette.background.default, 0.8),
                      backdropFilter: 'blur(5px)',
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                      color: refreshing ? theme.palette.primary.main : 'inherit',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <Refresh
                      sx={{
                        animation: refreshing ? 'spin 1s linear infinite' : 'none',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' }
                        }
                      }}
                    />
                  </IconButton>
                </motion.div>
              </Tooltip>
            </Box>
          </Box>

          {/* Path Navigation */}
          <Paper
            variant="outlined"
            sx={{
              p: isMobile ? 1 : 1.5,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.default, 0.6),
              backdropFilter: 'blur(5px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              overflow: 'hidden',
            }}
          >
            <Breadcrumbs
              separator={
                <motion.div
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <ChevronRight fontSize="small" sx={{ color: alpha(theme.palette.text.secondary, 0.5) }} />
                </motion.div>
              }
              maxItems={isMobile ? 2 : 4}
              itemsAfterCollapse={1}
              itemsBeforeCollapse={0}
              sx={{
                '& .MuiBreadcrumbs-li': {
                  display: 'flex',
                  alignItems: 'center'
                }
              }}
            >
              <Tooltip title="Root directory">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link
                    underline="none"
                    onClick={() => setCurrentPath('/')}
                    sx={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      color: theme.palette.primary.main,
                      fontWeight: 500,
                      fontSize: '0.875rem',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        transform: 'translateY(-1px)',
                        boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
                      }
                    }}
                  >
                    <FolderOpen fontSize="small" />
                    <Typography variant="body2" noWrap>
                      Root
                    </Typography>
                  </Link>
                </motion.div>
              </Tooltip>
              {currentPath.split('/').filter(Boolean).map((part, index) => {
                const pathUpToHere = `/${currentPath.split('/').filter(Boolean).slice(0, index + 1).join('/')}`;
                return (
                  <Tooltip key={index} title={pathUpToHere}>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Link
                        underline="none"
                        onClick={() => setCurrentPath(pathUpToHere)}
                        sx={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1.5,
                          py: 0.75,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.background.paper, 0.6),
                          color: theme.palette.text.primary,
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            transform: 'translateY(-1px)',
                            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.1)}`,
                          }
                        }}
                      >
                        <FolderIcon fontSize="small" />
                        <Typography variant="body2" noWrap>
                          {part}
                        </Typography>
                      </Link>
                    </motion.div>
                  </Tooltip>
                );
              })}
            </Breadcrumbs>
          </Paper>

          {/* Stats and Actions */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 2,
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Chip
                  icon={<FolderIcon />}
                  label={`${fileStats.folders} folder${fileStats.folders !== 1 ? 's' : ''}`}
                  size="small"
                  variant="outlined"
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    fontWeight: 500,
                  }}
                />
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Chip
                  icon={<FileIcon />}
                  label={`${fileStats.files} file${fileStats.files !== 1 ? 's' : ''}`}
                  size="small"
                  variant="outlined"
                  sx={{
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    color: theme.palette.secondary.main,
                    borderColor: alpha(theme.palette.secondary.main, 0.3),
                    fontWeight: 500,
                  }}
                />
              </motion.div>
              {fileStats.selectedCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring' }}
                >
                  <Chip
                    label={`${fileStats.selectedCount} selected`}
                    size="small"
                    color="primary"
                    onDelete={handleSelectAll}
                    deleteIcon={fileStats.selectedCount === filteredFiles.length ? 
                      <Deselect fontSize="small" /> : 
                      <SelectAll fontSize="small" />}
                    sx={{
                      bgcolor: theme.palette.primary.main,
                      color: 'white',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: theme.palette.primary.dark,
                      }
                    }}
                  />
                </motion.div>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <ActionButton
                variant="contained"
                startIcon={<CreateNewFolder />}
                onClick={handleCreateFolder}
                size={isMobile ? "small" : "medium"}
                sx={{
                  bgcolor: theme.palette.primary.main,
                  '&:hover': {
                    bgcolor: theme.palette.primary.dark,
                  }
                }}
              >
                {isMobile ? 'New' : 'New Folder'}
              </ActionButton>
              <ActionButton
                variant="outlined"
                startIcon={<Upload />}
                onClick={handleUpload}
                size={isMobile ? "small" : "medium"}
                sx={{
                  borderColor: alpha(theme.palette.divider, 0.3),
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    color: theme.palette.primary.main,
                  }
                }}
              >
                {isMobile ? 'Upload' : 'Upload'}
              </ActionButton>
              {fileStats.selectedCount > 0 && (
                <ActionButton
                  variant="contained"
                  startIcon={<Download />}
                  onClick={handleDownloadSelected}
                  size={isMobile ? "small" : "medium"}
                  sx={{
                    bgcolor: 'success.main',
                    '&:hover': { bgcolor: 'success.dark' }
                  }}
                >
                  {isMobile ? 'Download' : 'Download'}
                </ActionButton>
              )}
            </Box>
          </Box>
        </HeaderCard>
      </motion.div>

      {/* Menu Components */}
      <FileSelectMenu
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        handleOpenModal={handleOpenModal}
      />

      <FileContextMenu
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        handleOpenModal={handleOpenModal}
      />

      <FileActionMenu
        fileMenuAnchor={fileMenuAnchor}
        setFileMenuAnchor={setFileMenuAnchor}
        handleOpenModal={handleOpenModal}
      />

      <FileSortMenu
        setSortBy={setSortBy}
        setSortMenuAnchor={setSortMenuAnchor}
        sortMenuAnchor={sortMenuAnchor}
      />

      {/* Files Grid/List */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          bgcolor: alpha(theme.palette.background.paper, 0.9),
          backdropFilter: 'blur(20px)',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow: `0 16px 40px ${alpha(theme.palette.common.black, 0.05)}`,
          p: isMobile ? 1 : 2,
          position: 'relative',
          zIndex: 2,
        }}
      >
        {loading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            flex: 1
          }}>
            <CircularProgress />
          </Box>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${viewMode}-${sortBy}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ 
                flex: 1,
                overflow: 'auto',
                padding: '8px',
              }}
            >
              {filteredFiles.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      textAlign: 'center',
                      p: 4
                    }}
                  >
                    <FolderIcon sx={{ 
                      fontSize: 80, 
                      color: alpha(theme.palette.text.secondary, 0.3), 
                      mb: 2,
                      animation: `${pulseAnimation} 2s ease-in-out infinite`,
                    }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom fontWeight="500">
                      {searchTerm ? 'No files found' : 'Folder is empty'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
                      {searchTerm ? 'Try a different search term' : 'Upload files or create a folder to get started'}
                    </Typography>
                  </Box>
                </motion.div>
              ) : (
                <Box
                  sx={{
                    display: viewMode === 'list' ? 'flex' : 'grid',
                    flexDirection: viewMode === 'list' ? 'column' : 'unset',
                    gridTemplateColumns: gridLayout,
                    gap: 2
                  }}
                >
                  {filteredFiles.map((file, index) => {
                    const isSelected = selectedFiles.some(f => f?.filePath === file?.filePath);
                    return (
                      <motion.div
                        key={file.filePath}
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        custom={index * 0.05}
                        layout
                        style={{ width: '100%' }}
                      >
                        <FileCard
                          selected={isSelected}
                          isdirectory={file.isDirectory.toString()}
                          onDoubleClick={() => handleDoubleClick(file)}
                          onContextMenu={(e) => handleContextMenu(e, file)}
                          onClick={(e) => handleToggleSelect(file, e)}
                        >
                          {/* Selection indicator */}
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring' }}
                              style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                backgroundColor: theme.palette.primary.main,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1,
                                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
                              }}
                            >
                              <Typography variant="caption" sx={{ 
                                color: 'white', 
                                fontSize: '0.7rem',
                                fontWeight: 'bold'
                              }}>
                                ✓
                              </Typography>
                            </motion.div>
                          )}

                          <Box sx={{
                            display: 'flex',
                            flexDirection: viewMode === 'list' ? 'row' : 'column',
                            alignItems: viewMode === 'list' ? 'center' : 'flex-start',
                            p: viewMode === 'list' ? 1.5 : 2,
                            width: '100%',
                            height: '100%',
                          }}>
                            {/* File/Folder Icon */}
                            <motion.div
                              whileHover={{ scale: 1.1 }}
                              transition={{ type: 'spring', stiffness: 400 }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: viewMode === 'list' ? 48 : 64,
                                  height: viewMode === 'list' ? 48 : 64,
                                  borderRadius: 2,
                                  bgcolor: file.isDirectory 
                                    ? alpha(theme.palette.primary.main, 0.15)
                                    : alpha(theme.palette.secondary.main, 0.15),
                                  mb: viewMode === 'list' ? 0 : 1.5,
                                  mr: viewMode === 'list' ? 2 : 0,
                                  position: 'relative',
                                  overflow: 'hidden',
                                }}
                              >
                                {file.isDirectory ? (
                                  <FolderIcon sx={{ 
                                    fontSize: viewMode === 'list' ? 28 : 32,
                                    color: theme.palette.primary.main 
                                  }} />
                                ) : (
                                  <FileIcon sx={{ 
                                    fontSize: viewMode === 'list' ? 28 : 32,
                                    color: theme.palette.secondary.main 
                                  }} />
                                )}
                              </Box>
                            </motion.div>

                            {/* File Info */}
                            <Box sx={{ 
                              flex: 1,
                              minWidth: 0,
                              width: viewMode === 'list' ? 'auto' : '100%'
                            }}>
                              <Tooltip title={file.fileName} placement="top">
                                <Typography
                                  variant={viewMode === 'list' ? "body1" : "body2"}
                                  noWrap
                                  sx={{
                                    fontWeight: 600,
                                    mb: 0.5,
                                    color: 'text.primary',
                                    fontSize: viewMode === 'list' ? '0.875rem' : '0.8rem',
                                  }}
                                >
                                  {file.fileName}
                                </Typography>
                              </Tooltip>
                              
                              {!file.isDirectory && (
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                  Size: {formatFileSize(file.fileSize)}
                                </Typography>
                              )}
                              
                              <Typography variant="caption" color="text.secondary" display="block">
                                Modified: {new Date(file.lastModifiedTime).toLocaleDateString()}
                              </Typography>
                            </Box>

                            {/* Action Menu Button */}
                            {viewMode === 'list' && (
                              <motion.div
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleFileMenuClick(e, file)}
                                  sx={{
                                    ml: 1,
                                    bgcolor: alpha(theme.palette.background.paper, 0.8),
                                    backdropFilter: 'blur(5px)',
                                    border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                                    '&:hover': {
                                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                                      borderColor: alpha(theme.palette.primary.main, 0.3),
                                    },
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  <MoreVertIcon fontSize="small" />
                                </IconButton>
                              </motion.div>
                            )}
                          </Box>
                        </FileCard>
                      </motion.div>
                    );
                  })}
                </Box>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </Box>

      {/* Modals */}
      <FileActionModal
        open={showRenameModal}
        onClose={() => handleCloseModal('rename')}
        title="Rename File"
        action="rename"
        onSubmit={handleFileAction}
        selectedFile={selectedFile}
        currentPath={currentPath}
        fetchFiles={fetchFiles}
      />

      <FileActionModal
        open={showMoveModal}
        onClose={() => handleCloseModal('move')}
        title="Move File"
        action="move"
        onSubmit={handleFileAction}
        selectedFile={selectedFile}
        currentPath={currentPath}
        fetchFiles={fetchFiles}
      />

      <FileActionModal
        open={showCopyModal}
        onClose={() => handleCloseModal('copy')}
        title="Copy File"
        action="copy"
        onSubmit={handleFileAction}
        selectedFile={selectedFile}
        currentPath={currentPath}
        fetchFiles={fetchFiles}
      />

      <FileActionModal
        open={showDeleteModal}
        onClose={() => handleCloseModal('delete')}
        title="Delete File"
        action="delete"
        onSubmit={handleFileAction}
        selectedFile={selectedFile}
        currentPath={currentPath}
        fetchFiles={fetchFiles}
      />

      <FileActionModal
        open={showRenameModal}
        onClose={() => handleCloseModal('create')}
        title="Create New Folder"
        action="create"
        onSubmit={handleFileAction}
        selectedFile={null}
        currentPath={currentPath}
        fetchFiles={fetchFiles}
      />

      <FileInfoModal
        open={showInfoModal}
        onClose={() => handleCloseModal('info')}
        file={selectedFile}
      />

      {/* <FileUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        currentPath={currentPath}
        onUploadSuccess={() => fetchFiles(currentPath, false)}
      /> */}
    </GlassContainer>
  );
};

export default React.memo(FileExplorer);