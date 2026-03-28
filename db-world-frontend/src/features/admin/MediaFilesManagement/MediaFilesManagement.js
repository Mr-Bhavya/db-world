import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    CircularProgress,
    Alert,
    AlertTitle,
    alpha,
    useTheme,
    useMediaQuery,
    IconButton,
    Button,
    Grid,
    TextField,
    InputAdornment,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Collapse,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Checkbox,
    Tooltip,
    Chip,
    Card,
    CardContent,
    CardActions,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Fade,
    Zoom,
    Grow,
    Slide,
} from '@mui/material';
import {
    Movie as MovieIcon,
    Refresh as RefreshIcon,
    CopyAll as CopyIcon,
    Download as DownloadIcon,
    Delete as DeleteIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    FilterAlt as FilterAltIcon,
    GridView as GridViewIcon,
    List as ListIcon,
    Sort as SortIcon,
    VideoFile as VideoIcon,
    PlayArrow as PlayIcon,
    Speed as SpeedIcon,
    AudioFile,
    ExpandMore as ExpandMoreIcon,
    Build as BuildIcon,
    Link as LinkIcon,
    Warning as WarningIcon,
    Language as LanguageIcon,
    Subtitles as SubtitlesIcon,
    SdCard as SdCardIcon,
    AccessTime as AccessTimeIcon,
    AspectRatio as AspectRatioIcon,
    Code as CodeIcon,
    Storage as StorageIcon,
    Folder as FolderIcon,
    InsertDriveFile as FileIcon,
    Info as InfoIcon,
    Close as CloseIcon,
    ExpandCircleDown as ExpandCircleDownIcon,
    PlayCircle as PlayCircleIcon,
    Visibility as VisibilityIcon,
} from '@mui/icons-material';

// Import API functions
import {
    getAllMediaFilesApi,
    repairAllSymlinksApi,
    repairSymlinkApi,
    rebuildAllSymlinksApi,
    deleteMediaFilesApi,
    cleanupMediaFilesApi
} from '../../ApiServices';
import { toast } from '../../Toast';
import { motion, AnimatePresence } from 'framer-motion';
import MediaGridView from './MediaGridView';

// Reusable Media Search Filters Component - FIXED onClick handler
const MediaSearchFilters = ({
    isMobile,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    viewMode,
    setViewMode,
    showAdvancedFilters,
    setShowAdvancedFilters,
    filterMinSize,
    setFilterMinSize,
    filterMaxSize,
    setFilterMaxSize,
    filterFormat,
    setFilterFormat,
    filterLanguage,
    setFilterLanguage,
    stats,
    selectedFiles,
    setDialogOpen,
    setSelectedFiles,
    formatFileSize,
    handleRepairSelectedSymlinks, // ADDED prop
}) => {
    const theme = useTheme();

    return (
        <Paper sx={{ 
            p: 2, 
            mb: 2, 
            borderRadius: 2,
            animation: 'slideDown 0.3s ease-out'
        }}>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={4}>
                    <TextField
                        fullWidth
                        placeholder="Search files..."
                        variant="outlined"
                        size="small"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                            endAdornment: searchQuery && (
                                <InputAdornment position="end">
                                    <IconButton 
                                        size="small" 
                                        onClick={() => setSearchQuery('')}
                                        sx={{ animation: 'fadeIn 0.2s' }}
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                            sx: {
                                animation: 'pulse 2s infinite',
                                '&:focus-within': {
                                    animation: 'none',
                                    boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`
                                }
                            }
                        }}
                    />
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <FormControl size="small" fullWidth>
                            <InputLabel>Sort By</InputLabel>
                            <Select
                                value={sortBy}
                                label="Sort By"
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <MenuItem value="name">Name</MenuItem>
                                <MenuItem value="size">Size</MenuItem>
                                <MenuItem value="date">Date Modified</MenuItem>
                                <MenuItem value="resolution">Resolution</MenuItem>
                                <MenuItem value="duration">Duration</MenuItem>
                            </Select>
                        </FormControl>
                        <Tooltip title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}>
                            <IconButton
                                size="small"
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                sx={{
                                    animation: sortOrder === 'asc' ? 'rotateDown 0.3s' : 'rotateUp 0.3s',
                                    '@keyframes rotateUp': {
                                        '0%': { transform: 'rotate(0deg)' },
                                        '100%': { transform: 'rotate(180deg)' }
                                    },
                                    '@keyframes rotateDown': {
                                        '0%': { transform: 'rotate(180deg)' },
                                        '100%': { transform: 'rotate(0deg)' }
                                    }
                                }}
                            >
                                <SortIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'space-between', md: 'flex-end' } }}>
                        <Button
                            size="small"
                            startIcon={<FilterAltIcon />}
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            variant={showAdvancedFilters ? "contained" : "outlined"}
                            sx={{
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                    transform: 'translateY(-1px)'
                                }
                            }}
                        >
                            Filters
                        </Button>
                        <Tooltip title={`Switch to ${viewMode === 'table' ? 'Grid' : 'Table'} view`}>
                            <Button
                                size="small"
                                startIcon={viewMode === 'table' ? <GridViewIcon /> : <ListIcon />}
                                onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
                                variant="outlined"
                                sx={{
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': {
                                        transform: 'translateY(-1px)'
                                    }
                                }}
                            >
                                {viewMode === 'table' ? 'Grid' : 'List'}
                            </Button>
                        </Tooltip>
                    </Box>
                </Grid>
            </Grid>

            {/* Advanced Filters */}
            <Collapse in={showAdvancedFilters} timeout="auto" unmountOnExit>
                <Grow in={showAdvancedFilters}>
                    <Box sx={{ 
                        mt: 2, 
                        pt: 2, 
                        borderTop: `1px solid ${theme.palette.divider}`,
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                    fullWidth
                                    label="Min Size"
                                    size="small"
                                    value={filterMinSize}
                                    onChange={(e) => setFilterMinSize(e.target.value)}
                                    placeholder="e.g., 1GB"
                                    helperText="Supports KB, MB, GB"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                    fullWidth
                                    label="Max Size"
                                    size="small"
                                    value={filterMaxSize}
                                    onChange={(e) => setFilterMaxSize(e.target.value)}
                                    placeholder="e.g., 5GB"
                                    helperText="Supports KB, MB, GB"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Format</InputLabel>
                                    <Select
                                        value={filterFormat}
                                        label="Format"
                                        onChange={(e) => setFilterFormat(e.target.value)}
                                    >
                                        <MenuItem value="">All Formats</MenuItem>
                                        {[...stats.formats].map(format => (
                                            <MenuItem key={format} value={format}>{format}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Language</InputLabel>
                                    <Select
                                        value={filterLanguage}
                                        label="Language"
                                        onChange={(e) => setFilterLanguage(e.target.value)}
                                    >
                                        <MenuItem value="">All Languages</MenuItem>
                                        <MenuItem value="hi">Hindi</MenuItem>
                                        <MenuItem value="en">English</MenuItem>
                                        <MenuItem value="ta">Tamil</MenuItem>
                                        <MenuItem value="te">Telugu</MenuItem>
                                        <MenuItem value="kn">Kannada</MenuItem>
                                        <MenuItem value="ml">Malayalam</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    </Box>
                </Grow>
            </Collapse>

            {/* Selected Files Actions - FIXED onClick handler */}
            {selectedFiles.length > 0 && (
                <Fade in={selectedFiles.length > 0}>
                    <Paper
                        elevation={3}
                        sx={{
                            mt: 2,
                            p: 1.5,
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                            borderRadius: 1,
                            animation: 'slideUp 0.3s ease-out'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                <strong>{selectedFiles.length}</strong> file(s) selected •{' '}
                                {formatFileSize(selectedFiles.reduce((total, fileId) => {
                                    const file = stats.files?.find(f => f.id === fileId);
                                    return total + (file?.fileSize || 0);
                                }, 0))}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Tooltip title="Delete selected files">
                                    <Button
                                        size="small"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => setDialogOpen('delete')}
                                        color="error"
                                        variant="outlined"
                                        sx={{
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                transform: 'scale(1.05)'
                                            }
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Repair selected symlinks">
                                    <Button
                                        size="small"
                                        startIcon={<LinkIcon />}
                                        onClick={() => handleRepairSelectedSymlinks && handleRepairSelectedSymlinks()}
                                        variant="contained"
                                        sx={{
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                transform: 'scale(1.05)'
                                            }
                                        }}
                                    >
                                        Repair Selected
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Clear selection">
                                    <Button
                                        size="small"
                                        startIcon={<ClearIcon />}
                                        onClick={() => setSelectedFiles([])}
                                        variant="text"
                                        sx={{
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                transform: 'scale(1.05)'
                                            }
                                        }}
                                    >
                                        Clear
                                    </Button>
                                </Tooltip>
                            </Box>
                        </Box>
                    </Paper>
                </Fade>
            )}
        </Paper>
    );
};

// Reusable System Actions Component
const MediaSystemActions = ({
    isMobile,
    processing,
    setDialogOpen,
    handleRebuildAllSymlinks,
    handleCleanup,
    handleRefresh,
}) => {
    const theme = useTheme();

    if (isMobile) {
        return (
            <Box sx={{ 
                mb: 2, 
                display: 'flex', 
                gap: 1, 
                flexWrap: 'wrap',
                animation: 'slideUp 0.3s ease-out'
            }}>
                <Button
                    size="small"
                    startIcon={<BuildIcon />}
                    onClick={() => setDialogOpen('repairAll')}
                    variant="contained"
                    disabled={processing}
                    fullWidth
                >
                    {processing ? <CircularProgress size={20} /> : 'Repair All'}
                </Button>
                <Button
                    size="small"
                    startIcon={<LinkIcon />}
                    onClick={handleRebuildAllSymlinks}
                    variant="outlined"
                    disabled={processing}
                    fullWidth
                >
                    {processing ? <CircularProgress size={20} /> : 'Rebuild Links'}
                </Button>
                <Button
                    size="small"
                    startIcon={<WarningIcon />}
                    onClick={() => setDialogOpen('cleanup')}
                    color="warning"
                    variant="outlined"
                    disabled={processing}
                    fullWidth
                >
                    {processing ? <CircularProgress size={20} /> : 'Cleanup'}
                </Button>
            </Box>
        );
    }

    return (
        <Paper sx={{ 
            p: 2, 
            mb: 2, 
            borderRadius: 2,
            animation: 'slideUp 0.3s ease-out'
        }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
                System Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                    size="small"
                    startIcon={<BuildIcon />}
                    onClick={() => setDialogOpen('repairAll')}
                    variant="contained"
                    disabled={processing}
                >
                    {processing ? <CircularProgress size={20} /> : 'Repair All Symlinks'}
                </Button>
                <Button
                    size="small"
                    startIcon={<LinkIcon />}
                    onClick={handleRebuildAllSymlinks}
                    variant="outlined"
                    disabled={processing}
                >
                    {processing ? <CircularProgress size={20} /> : 'Rebuild All Symlinks'}
                </Button>
                <Button
                    size="small"
                    startIcon={<WarningIcon />}
                    onClick={() => setDialogOpen('cleanup')}
                    color="warning"
                    variant="outlined"
                    disabled={processing}
                >
                    {processing ? <CircularProgress size={20} /> : 'Cleanup Media Files'}
                </Button>
            </Box>
        </Paper>
    );
};

// Reusable Table View Component
const MediaTableView = ({
    files,
    selectedFiles,
    expandedFileId,
    page,
    rowsPerPage,
    isMobile,
    theme,
    formatFileSize,
    extractVideoInfo,
    extractFileNameInfo,
    handleFileClick,
    handleFileSelect,
    handleSelectAll,
    handleCopyPath,
    handleDownloadFile,
    renderFileDetails,
    setPage,
    setRowsPerPage,
    setDialogOpen,
    setSelectedFiles,
    handleRepairSymlink,
}) => {
    const currentPageFiles = files.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleDeleteClick = (e, fileId) => {
        e.stopPropagation();
        setDialogOpen('delete');
        setSelectedFiles([fileId]);
    };

    return (
        <Box sx={{ width: '100%' }}>
            <TableContainer
                component={Box}
                sx={{
                    maxHeight: 'calc(100vh - 300px)',
                    overflow: 'auto',
                    '& .MuiTableRow-root:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.04),
                        transition: 'background-color 0.2s'
                    },
                    '&::-webkit-scrollbar': {
                        width: '8px',
                        height: '8px'
                    },
                    '&::-webkit-scrollbar-track': {
                        background: theme.palette.background.default
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: theme.palette.divider,
                        borderRadius: '4px',
                        '&:hover': {
                            background: theme.palette.text.secondary
                        }
                    }
                }}
            >
                <Table size={isMobile ? 'small' : 'medium'} stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox" sx={{ width: 48 }}>
                                <Checkbox
                                    size="small"
                                    checked={selectedFiles.length > 0 &&
                                        currentPageFiles.every(file => selectedFiles.includes(file.id))}
                                    indeterminate={selectedFiles.length > 0 &&
                                        selectedFiles.length < currentPageFiles.length}
                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                />
                            </TableCell>
                            <TableCell sx={{ minWidth: isMobile ? 150 : 200 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    Name
                                </Box>
                            </TableCell>
                            {!isMobile && (
                                <>
                                    <TableCell sx={{ minWidth: 100 }}>Size</TableCell>
                                    <TableCell sx={{ minWidth: 100 }}>Resolution</TableCell>
                                    <TableCell sx={{ minWidth: 100 }}>Duration</TableCell>
                                    <TableCell sx={{ minWidth: 100 }}>Codec</TableCell>
                                </>
                            )}
                            <TableCell sx={{ width: 150 }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {currentPageFiles.map((file, index) => {
                            const videoInfo = extractVideoInfo(file);
                            const nameInfo = extractFileNameInfo(file.fileName);
                            const isExpanded = expandedFileId === file.id;

                            return (
                                <React.Fragment key={file.id}>
                                    <TableRow
                                        hover
                                        selected={selectedFiles.includes(file.id)}
                                        sx={{ 
                                            cursor: 'pointer',
                                            animation: `fadeInUp 0.3s ease-out ${index * 0.05}s`,
                                            '@keyframes fadeInUp': {
                                                '0%': {
                                                    opacity: 0,
                                                    transform: 'translateY(10px)'
                                                },
                                                '100%': {
                                                    opacity: 1,
                                                    transform: 'translateY(0)'
                                                }
                                            }
                                        }}
                                        onClick={() => handleFileClick(file.id)}
                                    >
                                        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                size="small"
                                                checked={selectedFiles.includes(file.id)}
                                                onChange={(e) => handleFileSelect(file.id, e.target.checked)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <VideoIcon fontSize="small" color="primary" />
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography variant="body2" noWrap fontWeight={500}>
                                                        {nameInfo.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" noWrap>
                                                        {nameInfo.episode && `${nameInfo.episode} • `}
                                                        {nameInfo.quality}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        {!isMobile && (
                                            <>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={500}>
                                                        {formatFileSize(file.fileSize)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={videoInfo.resolution}
                                                        size="small"
                                                        variant="outlined"
                                                        color={videoInfo.resolution.includes('1080') ? 'primary' : 
                                                               videoInfo.resolution.includes('720') ? 'secondary' : 
                                                               videoInfo.resolution.includes('4K') ? 'success' : 'default'}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {videoInfo.duration}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={videoInfo.codec}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '0.7rem',
                                                            bgcolor: alpha(theme.palette.info.main, 0.1)
                                                        }}
                                                    />
                                                </TableCell>
                                            </>
                                        )}
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <Tooltip title="Copy Path">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyPath(file.filePath);
                                                        }}
                                                        sx={{
                                                            '&:hover': {
                                                                transform: 'scale(1.1)',
                                                                backgroundColor: alpha(theme.palette.info.main, 0.1)
                                                            }
                                                        }}
                                                    >
                                                        <CopyIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Repair Symlink">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRepairSymlink(file.id);
                                                        }}
                                                        sx={{
                                                            '&:hover': {
                                                                transform: 'scale(1.1)',
                                                                backgroundColor: alpha(theme.palette.success.main, 0.1)
                                                            }
                                                        }}
                                                    >
                                                        <LinkIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={(e) => handleDeleteClick(e, file.id)}
                                                        sx={{
                                                            '&:hover': {
                                                                transform: 'scale(1.1)',
                                                                backgroundColor: alpha(theme.palette.error.main, 0.1)
                                                            }
                                                        }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleFileClick(file.id)}
                                                        sx={{
                                                            transition: 'transform 0.3s',
                                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                            '&:hover': {
                                                                backgroundColor: alpha(theme.palette.primary.main, 0.1)
                                                            }
                                                        }}
                                                    >
                                                        <ExpandMoreIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                        <TableRow>
                                            <TableCell colSpan={isMobile ? 3 : 7} sx={{ p: 0 }}>
                                                <Slide direction="down" in={isExpanded} mountOnEnter unmountOnExit>
                                                    <Box>
                                                        {renderFileDetails(file)}
                                                    </Box>
                                                </Slide>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                rowsPerPageOptions={[5, 10, 15, 25, 50]}
                component="div"
                count={files.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                }}
                sx={{
                    borderTop: `1px solid ${theme.palette.divider}`,
                    animation: 'fadeIn 0.3s ease-out'
                }}
            />
        </Box>
    );
};

// Enhanced File Details Component
const FileDetailsView = ({ file, theme, formatFileSize, extractVideoInfo, extractPathInfo, handleCopyPath, handleDownloadFile, handleRepairSymlink }) => {
    const videoInfo = extractVideoInfo(file);
    const pathInfo = extractPathInfo(file.filePath);
    const [showAllTracks, setShowAllTracks] = useState(false);

    const isHDR = Boolean(videoInfo.hdr);
    const isDolbyVision = videoInfo.hdr?.toLowerCase().includes('dolby') || 
                         videoInfo.hdr?.toLowerCase().includes('dv');

    // Extract all track information
    const audioTracks = file.trackInfos?.filter(track => track.type === 'Audio') || [];
    const textTracks = file.trackInfos?.filter(track => track.type === 'Text') || [];
    const generalTrack = file.trackInfos?.find(track => track.type === 'General');
    const videoTrack = file.trackInfos?.find(track => track.type === 'Video');

    // Calculate video bitrate in Mbps
    const videoBitrateMbps = videoTrack?.bitRate ? (videoTrack.bitRate / 1000000).toFixed(2) : 'N/A';
    
    // Calculate overall bitrate
    const overallBitrateMbps = generalTrack?.overallBitRate ? 
        (generalTrack.overallBitRate / 1000000).toFixed(2) : 'N/A';

    return (
        <Box sx={{ 
            p: 3,
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <Grid container spacing={3}>
                {/* Left Column - File Info & Video Details */}
                <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: 1,
                        color: theme.palette.primary.main
                    }}>
                        <InfoIcon /> File Information
                    </Typography>

                    <Box sx={{ 
                        p: 2, 
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.paper, 0.7),
                        border: `1px solid ${theme.palette.divider}`,
                        mb: 3
                    }}>
                        <List dense>
                            <ListItem>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    <FileIcon color="primary" />
                                </ListItemIcon>
                                <ListItemText 
                                    primary="File Name" 
                                    secondary={
                                        <Typography variant="body2" sx={{ 
                                            fontFamily: 'monospace',
                                            wordBreak: 'break-all'
                                        }}>
                                            {pathInfo.fileName}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                            <Divider component="li" />
                            <ListItem>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    <FolderIcon color="primary" />
                                </ListItemIcon>
                                <ListItemText 
                                    primary="Directory" 
                                    secondary={
                                        <Typography variant="body2" sx={{ 
                                            fontFamily: 'monospace',
                                            wordBreak: 'break-all'
                                        }}>
                                            {pathInfo.basePath}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                            <Divider component="li" />
                            <ListItem>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    <StorageIcon color="primary" />
                                </ListItemIcon>
                                <ListItemText 
                                    primary="File Size" 
                                    secondary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body2" fontWeight={500}>
                                                {formatFileSize(file.fileSize)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                ({file.fileSize?.toLocaleString()} bytes)
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </ListItem>
                            <Divider component="li" />
                            <ListItem>
                                <ListItemIcon sx={{ minWidth: 40 }}>
                                    <SdCardIcon color="primary" />
                                </ListItemIcon>
                                <ListItemText 
                                    primary="Container Format" 
                                    secondary={
                                        <Chip 
                                            label={videoInfo.container} 
                                            size="small"
                                            sx={{ mt: 0.5 }}
                                        />
                                    }
                                />
                            </ListItem>
                        </List>
                    </Box>

                    {/* Video Technical Details */}
                    <Typography variant="h6" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: 1,
                        color: theme.palette.secondary.main
                    }}>
                        <VideoIcon /> Video Details
                    </Typography>

                    <Box sx={{ 
                        p: 2, 
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.paper, 0.7),
                        border: `1px solid ${theme.palette.divider}`
                    }}>
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <AspectRatioIcon fontSize="small" color="action" />
                                    <Typography variant="caption" color="text.secondary">
                                        Resolution
                                    </Typography>
                                </Box>
                                <Typography variant="body1" fontWeight={600}>
                                    {videoInfo.resolution}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <CodeIcon fontSize="small" color="action" />
                                    <Typography variant="caption" color="text.secondary">
                                        Codec
                                    </Typography>
                                </Box>
                                <Typography variant="body1" fontWeight={600}>
                                    {videoInfo.codec}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <AccessTimeIcon fontSize="small" color="action" />
                                    <Typography variant="caption" color="text.secondary">
                                        Duration
                                    </Typography>
                                </Box>
                                <Typography variant="body1" fontWeight={600}>
                                    {videoInfo.duration}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <PlayCircleIcon fontSize="small" color="action" />
                                    <Typography variant="caption" color="text.secondary">
                                        Frame Rate
                                    </Typography>
                                </Box>
                                <Typography variant="body1" fontWeight={600}>
                                    {videoInfo.frameRate}
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <SpeedIcon fontSize="small" color="action" />
                                    <Typography variant="caption" color="text.secondary">
                                        Video Bitrate
                                    </Typography>
                                </Box>
                                <Typography variant="body1" fontWeight={600}>
                                    {videoBitrateMbps} Mbps
                                </Typography>
                            </Grid>
                            <Grid item xs={6}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <SpeedIcon fontSize="small" color="action" />
                                    <Typography variant="caption" color="text.secondary">
                                        Overall Bitrate
                                    </Typography>
                                </Box>
                                <Typography variant="body1" fontWeight={600}>
                                    {overallBitrateMbps} Mbps
                                </Typography>
                            </Grid>
                        </Grid>

                        {/* HDR Badge */}
                        {isHDR && (
                            <Box sx={{ 
                                mt: 2, 
                                p: 1.5, 
                                borderRadius: 2,
                                background: isDolbyVision
                                    ? 'linear-gradient(135deg, #7b2ff7, #00c6ff)'
                                    : 'linear-gradient(135deg, #ff9800, #ffc107)',
                                color: '#fff',
                                textAlign: 'center',
                                animation: 'pulse 2s infinite'
                            }}>
                                <Typography variant="subtitle2" fontWeight={600}>
                                    {isDolbyVision ? '🎬 Dolby Vision HDR' : '🌟 HDR'}
                                </Typography>
                                <Typography variant="caption">
                                    {videoInfo.hdr}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Grid>

                {/* Right Column - Audio & Subtitles */}
                <Grid item xs={12} md={6}>
                    {/* Audio Tracks */}
                    <Typography variant="h6" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: 1,
                        color: theme.palette.success.main
                    }}>
                        <AudioFile /> Audio Tracks ({audioTracks.length})
                    </Typography>

                    <Box sx={{ 
                        p: 2, 
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.paper, 0.7),
                        border: `1px solid ${theme.palette.divider}`,
                        mb: 3,
                        maxHeight: showAllTracks ? 'none' : 200,
                        overflow: 'auto'
                    }}>
                        {audioTracks.map((track, index) => (
                            <Box key={index} sx={{ 
                                mb: 2, 
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.success.main, 0.05),
                                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <LanguageIcon fontSize="small" />
                                    <Typography variant="subtitle2">
                                        Track {index + 1}: {track.language || 'Unknown'}
                                    </Typography>
                                </Box>
                                <Grid container spacing={1}>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">
                                            Format
                                        </Typography>
                                        <Typography variant="body2">
                                            {track.format || 'N/A'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">
                                            Channels
                                        </Typography>
                                        <Typography variant="body2">
                                            {track.channels || 'N/A'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">
                                            Bitrate
                                        </Typography>
                                        <Typography variant="body2">
                                            {track.bitRate ? `${Math.round(track.bitRate / 1000)} kbps` : 'N/A'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">
                                            Sampling Rate
                                        </Typography>
                                        <Typography variant="body2">
                                            {track.samplingRate ? `${track.samplingRate} Hz` : 'N/A'}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Box>
                        ))}
                        
                        {audioTracks.length > 2 && (
                            <Button
                                size="small"
                                onClick={() => setShowAllTracks(!showAllTracks)}
                                sx={{ mt: 1 }}
                            >
                                {showAllTracks ? 'Show Less' : `Show All ${audioTracks.length} Tracks`}
                            </Button>
                        )}
                    </Box>

                    {/* Subtitles */}
                    <Typography variant="h6" gutterBottom sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: 1,
                        color: theme.palette.warning.main
                    }}>
                        <SubtitlesIcon /> Subtitles ({textTracks.length})
                    </Typography>

                    <Box sx={{ 
                        p: 2, 
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.paper, 0.7),
                        border: `1px solid ${theme.palette.divider}`
                    }}>
                        {textTracks.length > 0 ? (
                            <Grid container spacing={1}>
                                {textTracks.map((track, index) => (
                                    <Grid item xs={6} sm={4} key={index}>
                                        <Chip
                                            label={`${track.language || 'Unknown'}${track.forced ? ' (Forced)' : ''}`}
                                            size="small"
                                            color="warning"
                                            variant="outlined"
                                            sx={{ m: 0.5 }}
                                        />
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                No subtitles found
                            </Typography>
                        )}
                    </Box>
                </Grid>
            </Grid>

            {/* Action Buttons */}
            <Box sx={{ 
                mt: 3, 
                pt: 2, 
                borderTop: `2px dashed ${theme.palette.divider}`,
                display: 'flex',
                gap: 2,
                flexWrap: 'wrap'
            }}>
                <Button
                    variant="contained"
                    startIcon={<CopyIcon />}
                    onClick={() => handleCopyPath(file.filePath)}
                    sx={{
                        borderRadius: 2,
                        px: 3,
                        transition: 'all 0.3s',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 4
                        }
                    }}
                >
                    Copy Full Path
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleDownloadFile(file.filePath, file.fileName)}
                    sx={{
                        borderRadius: 2,
                        px: 3,
                        transition: 'all 0.3s',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 2
                        }
                    }}
                >
                    Download File
                </Button>
                <Button
                    variant="outlined"
                    color="success"
                    startIcon={<LinkIcon />}
                    onClick={() => handleRepairSymlink && handleRepairSymlink(file.id)}
                    sx={{
                        borderRadius: 2,
                        px: 3,
                        transition: 'all 0.3s',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 2
                        }
                    }}
                >
                    Repair Symlink
                </Button>
                <Button
                    variant="outlined"
                    color="error"
                    startIcon={<VisibilityIcon />}
                    onClick={() => window.open(file.filePath, '_blank')}
                    sx={{
                        borderRadius: 2,
                        px: 3,
                        transition: 'all 0.3s',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 2
                        }
                    }}
                >
                    Open Location
                </Button>
            </Box>
        </Box>
    );
};

// Main Component with all fixes
const MediaFilesManagement = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

    const [viewMode, setViewMode] = useState(isMobile ? 'grid' : 'table');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(null);
    const [dryRun, setDryRun] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(isMobile ? 8 : isTablet ? 12 : 15);
    const [expandedFileId, setExpandedFileId] = useState(null);
    const [fileDetails, setFileDetails] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [filterMinSize, setFilterMinSize] = useState('');
    const [filterMaxSize, setFilterMaxSize] = useState('');
    const [filterFormat, setFilterFormat] = useState('');
    const [filterLanguage, setFilterLanguage] = useState('');
    const [processing, setProcessing] = useState(false);
    const [stats, setStats] = useState({
        totalFiles: 0,
        totalSize: 0,
        averageSize: 0,
        videoCount: 0,
        audioCount: 0,
        textCount: 0,
        formats: new Set(),
        files: [] // ADDED to store files for size calculation
    });

    // Format file size utility
    const formatFileSize = useCallback((bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }, []);

    // Format duration utility - FIXED
    const formatDuration = useCallback((seconds) => {
        if (!seconds) return 'N/A';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    }, []);

    // Extract video info from trackInfos - ENHANCED
    const extractVideoInfo = useCallback((file) => {
        const videoTrack = file.trackInfos?.find(track => track.type === 'Video');
        const generalTrack = file.trackInfos?.find(track => track.type === 'General');
        const audioTracks = file.trackInfos?.filter(track => track.type === 'Audio') || [];
        const textTracks = file.trackInfos?.filter(track => track.type === 'Text') || [];

        // Calculate frame rate
        let frameRate = 'N/A';
        if (videoTrack?.frameRate) {
            const fps = parseFloat(videoTrack.frameRate);
            frameRate = `${fps.toFixed(2)} fps`;
        }

        return {
            resolution: videoTrack ? `${videoTrack.width || 0}x${videoTrack.height || 0}` : 'N/A',
            codec: videoTrack?.format || 'N/A',
            frameRate,
            bitrate: videoTrack?.bitRate ? `${Math.round(videoTrack.bitRate / 1000)} kbps` : 'N/A',
            duration: generalTrack?.duration ? formatDuration(generalTrack.duration) : 'N/A',
            container: generalTrack?.format || 'N/A',
            audioLanguages: [...new Set(audioTracks.map(track => track.language || 'unknown'))],
            subtitleLanguages: [...new Set(textTracks.map(track => track.language || 'unknown'))],
            audioCount: audioTracks.length,
            subtitleCount: textTracks.length,
            hdr: videoTrack?.hdrFormat || videoTrack?.hdr || null,
            bitDepth: videoTrack?.bitDepth || null,
            colorSpace: videoTrack?.colorSpace || null
        };
    }, [formatDuration]);

    // Extract filename components - IMPROVED
    const extractFileNameInfo = useCallback((fileName) => {
        if (!fileName) return { title: 'Unknown', episode: '', quality: '', extension: '' };
        
        // Multiple patterns for different file naming conventions
        const patterns = [
            // Pattern: Title.S01E01.Quality.ext
            /^(.*?)[.\s](S\d+E\d+)[.\s]*(.*?)\.([a-zA-Z0-9]+)$/i,
            // Pattern: Title.2024.Quality.ext
            /^(.*?)[.\s](\d{4})[.\s]*(.*?)\.([a-zA-Z0-9]+)$/i,
            // Pattern: Title.Quality.ext
            /^(.*?)[.\s]([0-9]+p|1080p|720p|4K|HDR|DV)[.\s]*(.*?)\.([a-zA-Z0-9]+)$/i,
            // Fallback: simple split
            /^(.*?)\.([a-zA-Z0-9]+)$/i
        ];

        for (const pattern of patterns) {
            const match = fileName.match(pattern);
            if (match) {
                return {
                    title: match[1].replace(/[.\s]+/g, ' ').trim(),
                    episode: match[2] || '',
                    quality: match[3] ? match[3].replace(/[.\s]+/g, ' ').trim() : '',
                    extension: match[4] || fileName.split('.').pop() || 'unknown'
                };
            }
        }

        return {
            title: fileName,
            episode: '',
            quality: '',
            extension: fileName.split('.').pop() || 'unknown'
        };
    }, []);

    // Extract path components
    const extractPathInfo = useCallback((filePath) => {
        if (!filePath) return { basePath: '/', fileName: 'Unknown' };
        const parts = filePath.split('/').filter(Boolean);
        return {
            basePath: parts.length > 1 ? parts.slice(0, -1).join(' / ') : '/',
            fileName: parts[parts.length - 1] || filePath
        };
    }, []);

    // Fetch all media files - FIXED
    const fetchMediaFiles = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getAllMediaFilesApi();
            if (result.success) {
                const files = result.data || [];
                setMediaFiles(files);

                // Calculate statistics
                const totalSize = files.reduce((sum, file) => sum + (file.fileSize || 0), 0);
                const formats = new Set();
                
                files.forEach(file => {
                    const generalTrack = file.trackInfos?.find(track => track.type === 'General');
                    if (generalTrack?.format) {
                        formats.add(generalTrack.format);
                    }
                });

                setStats(prev => ({
                    ...prev,
                    totalFiles: files.length,
                    totalSize,
                    averageSize: files.length > 0 ? totalSize / files.length : 0,
                    videoCount: files.length,
                    audioCount: files.reduce((sum, file) => {
                        return sum + (file.trackInfos?.filter(track => track.type === 'Audio').length || 0);
                    }, 0),
                    textCount: files.reduce((sum, file) => {
                        return sum + (file.trackInfos?.filter(track => track.type === 'Text').length || 0);
                    }, 0),
                    formats,
                    files // Store files for size calculation
                }));

                toast.success(`Loaded ${files.length} media files`);
            } else {
                throw new Error(result.message || 'Failed to fetch media files');
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`);
            console.error('Error fetching media files:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Filter and sort files - ENHANCED with size parsing
    const filteredFiles = useMemo(() => {
        let filtered = [...mediaFiles];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(file =>
                file.fileName?.toLowerCase().includes(query) ||
                file.filePath?.toLowerCase().includes(query) ||
                file.id?.toLowerCase().includes(query) ||
                file.trackInfos?.some(track => 
                    track.language?.toLowerCase().includes(query) ||
                    track.format?.toLowerCase().includes(query)
                )
            );
        }

        // Size filters with unit parsing
        if (filterMinSize) {
            const sizeStr = filterMinSize.toLowerCase();
            let minBytes = parseFloat(sizeStr);
            
            if (sizeStr.includes('tb')) minBytes *= 1024 * 1024 * 1024 * 1024;
            else if (sizeStr.includes('gb')) minBytes *= 1024 * 1024 * 1024;
            else if (sizeStr.includes('mb')) minBytes *= 1024 * 1024;
            else if (sizeStr.includes('kb')) minBytes *= 1024;
            
            filtered = filtered.filter(file => file.fileSize >= minBytes);
        }

        if (filterMaxSize) {
            const sizeStr = filterMaxSize.toLowerCase();
            let maxBytes = parseFloat(sizeStr);
            
            if (sizeStr.includes('tb')) maxBytes *= 1024 * 1024 * 1024 * 1024;
            else if (sizeStr.includes('gb')) maxBytes *= 1024 * 1024 * 1024;
            else if (sizeStr.includes('mb')) maxBytes *= 1024 * 1024;
            else if (sizeStr.includes('kb')) maxBytes *= 1024;
            
            filtered = filtered.filter(file => file.fileSize <= maxBytes);
        }

        // Format filter
        if (filterFormat) {
            filtered = filtered.filter(file => {
                const generalTrack = file.trackInfos?.find(track => track.type === 'General');
                return generalTrack?.format === filterFormat;
            });
        }

        // Language filter
        if (filterLanguage) {
            filtered = filtered.filter(file => {
                const audioTracks = file.trackInfos?.filter(track => track.type === 'Audio') || [];
                const textTracks = file.trackInfos?.filter(track => track.type === 'Text') || [];
                const languages = [...audioTracks, ...textTracks].map(track => track.language);
                return languages.includes(filterLanguage);
            });
        }

        // Sorting - ENHANCED
        filtered.sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'name':
                    aValue = a.fileName?.toLowerCase() || '';
                    bValue = b.fileName?.toLowerCase() || '';
                    break;
                case 'size':
                    aValue = a.fileSize || 0;
                    bValue = b.fileSize || 0;
                    break;
                case 'date':
                    const aGeneral = a.trackInfos?.find(track => track.type === 'General');
                    const bGeneral = b.trackInfos?.find(track => track.type === 'General');
                    aValue = new Date(aGeneral?.fileModifiedDate || 0).getTime();
                    bValue = new Date(bGeneral?.fileModifiedDate || 0).getTime();
                    break;
                case 'resolution':
                    const aVideo = a.trackInfos?.find(track => track.type === 'Video');
                    const bVideo = b.trackInfos?.find(track => track.type === 'Video');
                    aValue = (aVideo?.width || 0) * (aVideo?.height || 0);
                    bValue = (bVideo?.width || 0) * (bVideo?.height || 0);
                    break;
                case 'duration':
                    const aGen = a.trackInfos?.find(track => track.type === 'General');
                    const bGen = b.trackInfos?.find(track => track.type === 'General');
                    aValue = aGen?.duration || 0;
                    bValue = bGen?.duration || 0;
                    break;
                default:
                    aValue = a.fileName?.toLowerCase() || '';
                    bValue = b.fileName?.toLowerCase() || '';
            }

            if (sortOrder === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });

        return filtered;
    }, [mediaFiles, searchQuery, sortBy, sortOrder, filterMinSize, filterMaxSize, filterFormat, filterLanguage]);

    // Handle file click - FIXED
    const handleFileClick = useCallback((fileId) => {
        if (expandedFileId === fileId) {
            setExpandedFileId(null);
        } else {
            setExpandedFileId(fileId);
            // Use existing data
            if (!fileDetails[fileId]) {
                const file = mediaFiles.find(f => f.id === fileId);
                if (file) {
                    setFileDetails(prev => ({ ...prev, [fileId]: file }));
                }
            }
        }
    }, [expandedFileId, fileDetails, mediaFiles]);

    // Handle file selection
    const handleFileSelect = useCallback((fileId, checked) => {
        if (checked) {
            setSelectedFiles(prev => [...prev, fileId]);
        } else {
            setSelectedFiles(prev => prev.filter(id => id !== fileId));
        }
    }, []);

    // Handle select all - FIXED
    const handleSelectAll = useCallback((checked) => {
        const currentPageFiles = filteredFiles.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
        if (checked) {
            const newSelected = new Set([...selectedFiles, ...currentPageFiles.map(file => file.id)]);
            setSelectedFiles([...newSelected]);
        } else {
            const currentPageIds = new Set(currentPageFiles.map(file => file.id));
            setSelectedFiles(prev => prev.filter(id => !currentPageIds.has(id)));
        }
    }, [filteredFiles, page, rowsPerPage, selectedFiles]);

    // Handle repair all symlinks
    const handleRepairAllSymlinks = useCallback(async () => {
        setProcessing(true);
        try {
            const result = await repairAllSymlinksApi(dryRun);
            if (result.success) {
                toast.success('All symlinks repaired successfully');
                fetchMediaFiles();
            } else {
                toast.error(result.message || 'Failed to repair symlinks');
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setProcessing(false);
            setDialogOpen(null);
        }
    }, [dryRun, fetchMediaFiles]);

    // Handle rebuild all symlinks
    const handleRebuildAllSymlinks = useCallback(async () => {
        setProcessing(true);
        try {
            const result = await rebuildAllSymlinksApi();
            if (result.success) {
                toast.success('All symlinks rebuilt successfully');
                fetchMediaFiles();
            } else {
                toast.error(result.message || 'Failed to rebuild symlinks');
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    }, [fetchMediaFiles]);

    // Handle repair single symlink - FIXED
    const handleRepairSymlink = useCallback(async (fileId) => {
        setProcessing(true);
        try {
            const result = await repairSymlinkApi(fileId, true);
            if (result.success) {
                toast.success(result.message || `Symlink repaired successfully`);
                fetchMediaFiles();
            } else {
                toast.error(result.message || 'Failed to repair symlink');
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    }, [fetchMediaFiles]);

    // Handle repair selected symlinks - NEW
    const handleRepairSelectedSymlinks = useCallback(async () => {
        if (selectedFiles.length === 0) {
            toast.warning('No files selected');
            return;
        }

        setProcessing(true);
        try {
            const promises = selectedFiles.map(fileId => repairSymlinkApi(fileId, true));
            const results = await Promise.allSettled(promises);
            
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.length - successful;
            
            if (failed === 0) {
                toast.success(`Successfully repaired ${successful} symlinks`);
            } else {
                toast.warning(`Repaired ${successful} symlinks, ${failed} failed`);
            }
            
            fetchMediaFiles();
        } catch (err) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    }, [selectedFiles, fetchMediaFiles]);

    // Handle delete files - FIXED
    const handleDeleteFiles = useCallback(async () => {
        if (selectedFiles.length === 0) {
            toast.warning('No files selected');
            return;
        }

        setProcessing(true);
        try {
            const result = await deleteMediaFilesApi(selectedFiles);
            if (result.success) {
                toast.success(`${selectedFiles.length} files deleted successfully`);
                fetchMediaFiles();
                setSelectedFiles([]);
                setDialogOpen(null);
            } else {
                toast.error(result.message || 'Failed to delete files');
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    }, [selectedFiles, fetchMediaFiles]);

    // Handle cleanup
    const handleCleanup = useCallback(async () => {
        setProcessing(true);
        try {
            const result = await cleanupMediaFilesApi();
            if (result.success) {
                toast.success('Cleanup completed successfully');
                fetchMediaFiles();
                setDialogOpen(null);
            } else {
                toast.error(result.message || 'Failed to cleanup');
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    }, [fetchMediaFiles]);

    // Copy file path to clipboard
    const handleCopyPath = useCallback((filePath) => {
        navigator.clipboard.writeText(filePath)
            .then(() => toast.success('Path copied to clipboard'))
            .catch(() => toast.error('Failed to copy path'));
    }, []);

    // Download file - ENHANCED
    const handleDownloadFile = useCallback((filePath, fileName) => {
        // Create a temporary link element
        const link = document.createElement('a');
        link.href = filePath;
        link.download = fileName || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Downloading ${fileName}`);
    }, []);

    // Handle refresh
    const handleRefresh = useCallback(() => {
        fetchMediaFiles();
        toast.info('Refreshing file list...');
    }, [fetchMediaFiles]);

    // Render file details - USING NEW COMPONENT
    const renderFileDetails = useCallback((file) => {
        return (
            <FileDetailsView
                file={file}
                theme={theme}
                formatFileSize={formatFileSize}
                extractVideoInfo={extractVideoInfo}
                extractPathInfo={extractPathInfo}
                handleCopyPath={handleCopyPath}
                handleDownloadFile={handleDownloadFile}
                handleRepairSymlink={handleRepairSymlink}
            />
        );
    }, [theme, formatFileSize, extractVideoInfo, extractPathInfo, handleCopyPath, handleDownloadFile, handleRepairSymlink]);

    // Initialize
    useEffect(() => {
        fetchMediaFiles();
    }, [fetchMediaFiles]);

    // Add global CSS animations
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }
            @keyframes shimmer {
                0% { background-position: -1000px 0; }
                100% { background-position: 1000px 0; }
            }
        `;
        document.head.appendChild(style);
        
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    return (
        <Box sx={{
            p: { xs: 1, sm: 2, md: 3 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
            animation: 'fadeIn 0.5s ease-out'
        }}>
            {/* Header */}
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 1, sm: 2 },
                    mb: 2,
                    borderRadius: 3,
                    background: `linear-gradient(
                        135deg,
                        ${alpha(theme.palette.primary.main, 0.08)} 0%,
                        ${alpha(theme.palette.secondary.main, 0.08)} 50%,
                        ${alpha(theme.palette.success.main, 0.05)} 100%
                    )`,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                    animation: 'slideDown 0.5s ease-out'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <MovieIcon sx={{ 
                            fontSize: 32, 
                            color: theme.palette.primary.main,
                            animation: 'pulse 2s infinite'
                        }} />
                        <Box>
                            <Typography variant="h5" fontWeight={700} gutterBottom>
                                Media Files Management
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Manage and organize your media library
                            </Typography>
                        </Box>
                    </Box>
                    <Tooltip title="Refresh">
                        <IconButton 
                            onClick={handleRefresh} 
                            disabled={loading}
                            sx={{
                                animation: loading ? 'shimmer 2s infinite linear' : 'none',
                                background: loading ? 
                                    `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.1)} 25%, ${alpha(theme.palette.primary.main, 0.2)} 50%, ${alpha(theme.palette.primary.main, 0.1)} 75%)` : 
                                    'transparent',
                                backgroundSize: '1000px 100%'
                            }}
                        >
                            <RefreshIcon sx={{ 
                                animation: loading ? 'rotate 1s linear infinite' : 'none',
                                '@keyframes rotate': {
                                    '0%': { transform: 'rotate(0deg)' },
                                    '100%': { transform: 'rotate(360deg)' }
                                }
                            }} />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Stats */}
                <Grid container spacing={1} sx={{ mt: 2 }}>
                    {[
                        { label: 'Files', value: stats.totalFiles, color: theme.palette.primary.main, icon: <FileIcon /> },
                        { label: 'Size', value: formatFileSize(stats.totalSize), color: theme.palette.secondary.main, icon: <StorageIcon /> },
                        { label: 'Audio', value: stats.audioCount, color: theme.palette.success.main, icon: <AudioFile /> },
                        { label: 'Subs', value: stats.textCount, color: theme.palette.warning.main, icon: <SubtitlesIcon /> }
                    ].map(({ label, value, color, icon }, index) => (
                        <Grid item xs={3} key={label}>
                            <Box
                                sx={{
                                    textAlign: 'center',
                                    py: 1.2,
                                    px: 0.75,
                                    borderRadius: 2,
                                    border: `1px solid ${alpha(color, 0.3)}`,
                                    background: `linear-gradient(135deg, ${alpha(color, 0.1)}, ${alpha(color, 0.05)})`,
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'default',
                                    animation: `fadeInUp 0.5s ease-out ${index * 0.1}s`,
                                    '&:hover': {
                                        borderColor: color,
                                        backgroundColor: alpha(color, 0.15),
                                        transform: 'translateY(-4px) scale(1.02)',
                                        boxShadow: `0 8px 24px ${alpha(color, 0.2)}`
                                    }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5 }}>
                                    {React.cloneElement(icon, { 
                                        sx: { 
                                            fontSize: 16,
                                            color 
                                        } 
                                    })}
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            color,
                                            fontSize: { xs: '0.9rem', sm: '1.1rem' },
                                            fontWeight: 700,
                                            lineHeight: 1.2
                                        }}
                                    >
                                        {value}
                                    </Typography>
                                </Box>

                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        fontSize: '0.7rem',
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                        fontWeight: 600
                                    }}
                                >
                                    {label}
                                </Typography>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Paper>

            {/* Search and Filters - ADDED handleRepairSelectedSymlinks prop */}
            <MediaSearchFilters
                isMobile={isMobile}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                viewMode={viewMode}
                setViewMode={setViewMode}
                showAdvancedFilters={showAdvancedFilters}
                setShowAdvancedFilters={setShowAdvancedFilters}
                filterMinSize={filterMinSize}
                setFilterMinSize={setFilterMinSize}
                filterMaxSize={filterMaxSize}
                setFilterMaxSize={setFilterMaxSize}
                filterFormat={filterFormat}
                setFilterFormat={setFilterFormat}
                filterLanguage={filterLanguage}
                setFilterLanguage={setFilterLanguage}
                stats={stats}
                selectedFiles={selectedFiles}
                setDialogOpen={setDialogOpen}
                setSelectedFiles={setSelectedFiles}
                formatFileSize={formatFileSize}
                handleRepairSelectedSymlinks={handleRepairSelectedSymlinks} // ADDED
            />

            {/* System Actions - ADDED handleRefresh prop */}
            <MediaSystemActions
                isMobile={isMobile}
                processing={processing}
                setDialogOpen={setDialogOpen}
                handleRebuildAllSymlinks={handleRebuildAllSymlinks}
                handleCleanup={handleCleanup}
                handleRefresh={handleRefresh} // ADDED
            />

            {/* Render table or grid view */}
            <Paper
                elevation={0}
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: 'background.paper',
                    animation: 'fadeIn 0.5s ease-out'
                }}
            >
                {loading ? (
                    <Box sx={{ 
                        p: 3, 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: 2 
                    }}>
                        <CircularProgress size={60} thickness={4} />
                        <Typography variant="body1" color="text.secondary">
                            Loading media files...
                        </Typography>
                    </Box>
                ) : filteredFiles.length === 0 ? (
                    <Box sx={{ 
                        p: 4, 
                        textAlign: 'center', 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: 2 
                    }}>
                        <MovieIcon sx={{ fontSize: 64, color: 'text.disabled', opacity: 0.5 }} />
                        <Alert severity="info" sx={{ maxWidth: 400 }}>
                            <AlertTitle>No media files found</AlertTitle>
                            {searchQuery || filterMinSize || filterMaxSize || filterFormat || filterLanguage 
                                ? 'Try a different search term or clear filters.' 
                                : 'No media files available in the system.'}
                        </Alert>
                    </Box>
                ) : viewMode === 'table' ? (
                    <MediaTableView
                        files={filteredFiles}
                        selectedFiles={selectedFiles}
                        expandedFileId={expandedFileId}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        isMobile={isMobile}
                        theme={theme}
                        formatFileSize={formatFileSize}
                        extractVideoInfo={extractVideoInfo}
                        extractFileNameInfo={extractFileNameInfo}
                        handleFileClick={handleFileClick}
                        handleFileSelect={handleFileSelect}
                        handleSelectAll={handleSelectAll}
                        handleCopyPath={handleCopyPath}
                        handleDownloadFile={handleDownloadFile}
                        renderFileDetails={renderFileDetails}
                        setPage={setPage}
                        setRowsPerPage={setRowsPerPage}
                        setDialogOpen={setDialogOpen}
                        setSelectedFiles={setSelectedFiles}
                        handleRepairSymlink={handleRepairSymlink} // ADDED
                    />
                ) : (
                    <MediaGridView
                        files={filteredFiles}
                        selectedFiles={selectedFiles}
                        expandedFileId={expandedFileId}
                        page={page}
                        rowsPerPage={rowsPerPage}
                        isMobile={isMobile}
                        theme={theme}
                        formatFileSize={formatFileSize}
                        extractVideoInfo={extractVideoInfo}
                        extractFileNameInfo={extractFileNameInfo}
                        handleFileClick={handleFileClick}
                        handleFileSelect={handleFileSelect}
                        handleCopyPath={handleCopyPath}
                        handleDownloadFile={handleDownloadFile}
                        renderFileDetails={renderFileDetails}
                        setPage={setPage}
                        setRowsPerPage={setRowsPerPage}
                        setDialogOpen={setDialogOpen}
                        setSelectedFiles={setSelectedFiles}
                        loading={loading}
                        handleRepairSymlink={handleRepairSymlink} // ADDED
                    />
                )}
            </Paper>

            {/* Dialogs */}
            <DeleteDialog
                open={dialogOpen === 'delete'}
                onClose={() => setDialogOpen(null)}
                onConfirm={handleDeleteFiles}
                processing={processing}
                selectedCount={selectedFiles.length}
            />

            <RepairAllDialog
                open={dialogOpen === 'repairAll'}
                onClose={() => setDialogOpen(null)}
                onConfirm={handleRepairAllSymlinks}
                processing={processing}
                dryRun={dryRun}
                setDryRun={setDryRun}
            />

            <CleanupDialog
                open={dialogOpen === 'cleanup'}
                onClose={() => setDialogOpen(null)}
                onConfirm={handleCleanup}
                processing={processing}
            />
        </Box>
    );
};

// Dialog Components (keep as before but with animations)
const DeleteDialog = ({ open, onClose, onConfirm, processing, selectedCount }) => {
    const theme = useTheme();
    
    if (!open) return null;

    return (
        <Fade in={open}>
            <Box sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1300,
                p: 2,
                backdropFilter: 'blur(4px)'
            }}>
                <Slide direction="up" in={open}>
                    <Paper sx={{ 
                        p: 3, 
                        maxWidth: 400, 
                        width: '100%',
                        borderRadius: 3,
                        animation: 'slideUp 0.3s ease-out'
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <WarningIcon sx={{ fontSize: 40, color: 'error.main' }} />
                            <Typography variant="h6">
                                Confirm Deletion
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            Are you sure you want to delete <strong>{selectedCount}</strong> file(s)? 
                            This action cannot be undone.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
                            <Button onClick={onClose} disabled={processing}>
                                Cancel
                            </Button>
                            <Button
                                onClick={onConfirm}
                                color="error"
                                variant="contained"
                                disabled={processing}
                                sx={{
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        transform: 'scale(1.05)'
                                    }
                                }}
                            >
                                {processing ? <CircularProgress size={24} /> : 'Delete'}
                            </Button>
                        </Box>
                    </Paper>
                </Slide>
            </Box>
        </Fade>
    );
};

const RepairAllDialog = ({ open, onClose, onConfirm, processing, dryRun, setDryRun }) => {
    if (!open) return null;

    return (
        <Fade in={open}>
            <Box sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1300,
                p: 2,
                backdropFilter: 'blur(4px)'
            }}>
                <Slide direction="up" in={open}>
                    <Paper sx={{ 
                        p: 3, 
                        maxWidth: 400, 
                        width: '100%',
                        borderRadius: 3
                    }}>
                        <Typography variant="h6" gutterBottom>
                            Repair All Symlinks
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            This will attempt to repair all broken symlinks in the system.
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Checkbox
                                checked={dryRun}
                                onChange={(e) => setDryRun(e.target.checked)}
                                size="small"
                            />
                            <Typography variant="body2">
                                Dry run (simulate without making changes)
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
                            <Button onClick={onClose} disabled={processing}>
                                Cancel
                            </Button>
                            <Button
                                onClick={onConfirm}
                                variant="contained"
                                disabled={processing}
                            >
                                {processing ? <CircularProgress size={24} /> : 'Repair All'}
                            </Button>
                        </Box>
                    </Paper>
                </Slide>
            </Box>
        </Fade>
    );
};

const CleanupDialog = ({ open, onClose, onConfirm, processing }) => {
    if (!open) return null;

    return (
        <Fade in={open}>
            <Box sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1300,
                p: 2,
                backdropFilter: 'blur(4px)'
            }}>
                <Slide direction="up" in={open}>
                    <Paper sx={{ 
                        p: 3, 
                        maxWidth: 400, 
                        width: '100%',
                        borderRadius: 3
                    }}>
                        <Typography variant="h6" gutterBottom>
                            Cleanup Media Files
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            This will remove orphaned files and clean up temporary files. Make sure to backup important data first.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
                            <Button onClick={onClose} disabled={processing}>
                                Cancel
                            </Button>
                            <Button
                                onClick={onConfirm}
                                color="warning"
                                variant="contained"
                                disabled={processing}
                            >
                                {processing ? <CircularProgress size={24} /> : 'Cleanup'}
                            </Button>
                        </Box>
                    </Paper>
                </Slide>
            </Box>
        </Fade>
    );
};

// Keep the existing MediaGridView component but add handleRepairSymlink prop

export default MediaFilesManagement;