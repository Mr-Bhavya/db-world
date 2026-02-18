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

// Reusable Media Search Filters Component
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
}) => {
    const theme = useTheme();

    return (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
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
                                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            )
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
                            </Select>
                        </FormControl>
                        <IconButton
                            size="small"
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        >
                            <SortIcon />
                        </IconButton>
                    </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'space-between', md: 'flex-end' } }}>
                        <Button
                            size="small"
                            startIcon={<FilterAltIcon />}
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            variant={showAdvancedFilters ? "contained" : "outlined"}
                        >
                            Filters
                        </Button>
                        <Button
                            size="small"
                            startIcon={viewMode === 'table' ? <GridViewIcon /> : <ListIcon />}
                            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
                            variant="outlined"
                        >
                            {viewMode === 'table' ? 'Grid' : 'List'}
                        </Button>
                    </Box>
                </Grid>
            </Grid>

            {/* Advanced Filters */}
            <Collapse in={showAdvancedFilters}>
                <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                fullWidth
                                label="Min Size"
                                size="small"
                                value={filterMinSize}
                                onChange={(e) => setFilterMinSize(e.target.value)}
                                placeholder="e.g., 1GB"
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
            </Collapse>

            {/* Selected Files Actions */}
            {selectedFiles.length > 0 && (
                <Paper
                    elevation={0}
                    sx={{
                        mt: 2,
                        p: 1.5,
                        bgcolor: theme.palette.action.selected,
                        borderRadius: 1
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Typography variant="body2">
                            <strong>{selectedFiles.length}</strong> file(s) selected
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                                size="small"
                                startIcon={<DeleteIcon />}
                                onClick={() => setDialogOpen('delete')}
                                color="error"
                                variant="outlined"
                            >
                                Delete Selected
                            </Button>
                            <Button
                                size="small"
                                startIcon={<LinkIcon />}
                                onClick={() => selectedFiles?.forEach(()=>handleRepairSymlinkApi(selectedFiles[0]?.id))}
                                variant="text"
                            >
                                Repair selected
                            </Button>
                            <Button
                                size="small"
                                startIcon={<ClearIcon />}
                                onClick={() => setSelectedFiles([])}
                                variant="text"
                            >
                                Clear Selection
                            </Button>
                        </Box>
                    </Box>
                </Paper>
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
}) => {
    if (isMobile) {
        return (
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
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
                        backgroundColor: theme.palette.action.hover
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
                                    <IconButton size="small">
                                        <SortIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </TableCell>
                            {!isMobile && (
                                <>
                                    <TableCell sx={{ minWidth: 100 }}>Size</TableCell>
                                    <TableCell sx={{ minWidth: 100 }}>Resolution</TableCell>
                                    <TableCell sx={{ minWidth: 100 }}>Duration</TableCell>
                                </>
                            )}
                            <TableCell sx={{ width: 100 }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {currentPageFiles.map((file) => {
                            const videoInfo = extractVideoInfo(file);
                            const nameInfo = extractFileNameInfo(file.fileName);

                            return (
                                <React.Fragment key={file.id}>
                                    <TableRow
                                        hover
                                        selected={selectedFiles.includes(file.id)}
                                        sx={{ cursor: 'pointer' }}
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
                                                    <Typography variant="body2" noWrap>
                                                        {nameInfo.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" noWrap>
                                                        {nameInfo.episode && `${nameInfo.episode} • `}
                                                        {videoInfo.codec}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        {!isMobile && (
                                            <>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {formatFileSize(file.fileSize)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={videoInfo.resolution}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {videoInfo.duration}
                                                    </Typography>
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
                                                    >
                                                        <CopyIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Download">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownloadFile(file.filePath, file.fileName);
                                                        }}
                                                    >
                                                        <DownloadIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={(e) => handleDeleteClick(e, file.id)}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                    {expandedFileId === file.id && (
                                        <TableRow>
                                            <TableCell colSpan={isMobile ? 3 : 6} sx={{ p: 0 }}>
                                                {renderFileDetails(file)}
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
                rowsPerPageOptions={[5, 10, 15, 25]}
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
                }}
            />
        </Box>
    );
};

// Reusable Grid View Component
const MediaGridView = ({
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
    handleCopyPath,
    handleDownloadFile,
    renderFileDetails,
    setPage,
    setRowsPerPage,
    setDialogOpen,
    setSelectedFiles,
}) => {
    const currentPageFiles = files.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleDeleteClick = (fileId) => {
        setDialogOpen('delete');
        setSelectedFiles([fileId]);
    };

    return (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
            <Grid container spacing={isMobile ? 1 : 2} sx={{ p: isMobile ? 1 : 2 }}>
                {currentPageFiles.map((file) => {
                    const videoInfo = extractVideoInfo(file);
                    const nameInfo = extractFileNameInfo(file.fileName);

                    const isSelected = selectedFiles.includes(file.id);
                    const isExpanded = expandedFileId === file.id;

                    const isHDR = Boolean(videoInfo.hdr);
                    const isDolbyVision =
                        videoInfo.hdr?.toLowerCase().includes('dolby') ||
                        videoInfo.hdr?.toLowerCase().includes('dv');

                    return (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={file.id}>
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                                whileHover={{ y: -4 }}
                            >
                                <Card
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderRadius: 2.5,
                                        border: isSelected
                                            ? `2px solid ${theme.palette.primary.main}`
                                            : `1px solid ${theme.palette.divider}`,
                                        background:
                                            'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
                                        transition: 'all 0.25s ease',
                                        boxShadow: isSelected ? 4 : 1,
                                        '&:hover': {
                                            boxShadow: 6
                                        }
                                    }}
                                >
                                    {/* ================= HEADER ================= */}
                                    <CardContent sx={{ p: isMobile ? 1.5 : 2, pb: 1 }}>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <VideoIcon color="primary" fontSize="small" />

                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography
                                                    variant="subtitle2"
                                                    noWrap
                                                    fontWeight={600}
                                                >
                                                    {nameInfo.title}
                                                </Typography>

                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    noWrap
                                                >
                                                    {nameInfo.episode && `${nameInfo.episode} • `}
                                                    {nameInfo.quality}
                                                </Typography>
                                            </Box>

                                            <Checkbox
                                                size="small"
                                                checked={isSelected}
                                                onChange={(e) =>
                                                    handleFileSelect(file.id, e.target.checked)
                                                }
                                                onClick={(e) => e.stopPropagation()}
                                                sx={{ p: 0.5 }}
                                            />
                                        </Box>

                                        {/* ================= BADGES ================= */}
                                        <Box
                                            sx={{
                                                mt: 1,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <Chip
                                                label={videoInfo.resolution}
                                                size="small"
                                                sx={{
                                                    fontSize: '0.7rem',
                                                    height: 20
                                                }}
                                            />

                                            {isHDR && (
                                                <Box
                                                    sx={{
                                                        px: 1,
                                                        py: 0.25,
                                                        borderRadius: 1,
                                                        fontSize: '0.6rem',
                                                        fontWeight: 600,
                                                        letterSpacing: 0.6,
                                                        textTransform: 'uppercase',
                                                        color: '#fff',
                                                        background: isDolbyVision
                                                            ? 'linear-gradient(135deg, #7b2ff7, #00c6ff)'
                                                            : 'linear-gradient(135deg, #ff9800, #ffc107)',
                                                        boxShadow: 2
                                                    }}
                                                >
                                                    {isDolbyVision ? 'Dolby Vision' : 'HDR'}
                                                </Box>
                                            )}
                                        </Box>

                                        {/* ================= META ================= */}
                                        <Box
                                            sx={{
                                                mt: 1,
                                                display: 'grid',
                                                gap: 0.6
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <PlayIcon fontSize="small" color="action" />
                                                <Typography variant="caption">
                                                    {videoInfo.duration}
                                                </Typography>
                                            </Box>

                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <SpeedIcon fontSize="small" color="action" />
                                                <Typography variant="caption">
                                                    {videoInfo.codec}
                                                </Typography>
                                            </Box>

                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <AudioFile fontSize="small" color="action" />
                                                <Typography variant="caption">
                                                    {videoInfo.audioCount} audio tracks
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>

                                    {/* ================= ACTIONS ================= */}
                                    <CardActions
                                        sx={{
                                            px: 1,
                                            py: 0.75,
                                            borderTop: `1px dashed ${theme.palette.divider}`
                                        }}
                                    >
                                        <Tooltip title="Copy Path">
                                            <IconButton size="small" onClick={() => handleCopyPath(file.filePath)}>
                                                <CopyIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip title="Download">
                                            <IconButton
                                                size="small"
                                                onClick={() =>
                                                    handleDownloadFile(file.filePath, file.fileName)
                                                }
                                            >
                                                <DownloadIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip title="Delete">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDeleteClick(file.id)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>

                                        <Box sx={{ flexGrow: 1 }} />

                                        <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleFileClick(file.id)}
                                            >
                                                <ExpandMoreIcon
                                                    fontSize="small"
                                                    sx={{
                                                        transition: 'transform 0.25s',
                                                        transform: isExpanded
                                                            ? 'rotate(180deg)'
                                                            : 'rotate(0deg)'
                                                    }}
                                                />
                                            </IconButton>
                                        </Tooltip>
                                    </CardActions>

                                    {/* ================= EXPAND ================= */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.25 }}
                                            >
                                                {renderFileDetails(file)}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Card>
                            </motion.div>
                        </Grid>
                    );
                })}
            </Grid>

            {/* ================= PAGINATION ================= */}
            {files.length > rowsPerPage && (
                <Box sx={{ px: isMobile ? 1 : 2, pb: 2 }}>
                    <TablePagination
                        component="div"
                        count={files.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(e, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[8, 12, 16, 24]}
                        sx={{
                            '& .MuiTablePagination-toolbar': { minHeight: 48, px: 0 },
                            '& .MuiTablePagination-displayedRows': { fontSize: '0.75rem' }
                        }}
                    />
                </Box>
            )}
        </Box>
    );
};

// Dialog Components
const DeleteDialog = ({
    open,
    onClose,
    onConfirm,
    processing,
    selectedCount
}) => {
    if (!open) return null;

    return (
        <Box sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            p: 2
        }}>
            <Paper sx={{ p: 3, maxWidth: 400, width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                    Confirm Deletion
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                    Are you sure you want to delete {selectedCount} file(s)? This action cannot be undone.
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
                    >
                        {processing ? <CircularProgress size={24} /> : 'Delete'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

const RepairAllDialog = ({
    open,
    onClose,
    onConfirm,
    processing,
    dryRun,
    setDryRun
}) => {
    if (!open) return null;

    return (
        <Box sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            p: 2
        }}>
            <Paper sx={{ p: 3, maxWidth: 400, width: '100%' }}>
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
        </Box>
    );
};

const CleanupDialog = ({
    open,
    onClose,
    onConfirm,
    processing
}) => {
    if (!open) return null;

    return (
        <Box sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            p: 2
        }}>
            <Paper sx={{ p: 3, maxWidth: 400, width: '100%' }}>
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
        </Box>
    );
};

// Main Component
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
        formats: new Set()
    });

    // Format file size utility
    const formatFileSize = useCallback((bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }, []);

    // Format duration utility
    const formatDuration = useCallback((seconds) => {
        if (!seconds) return 'N/A';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }, []);

    // Extract video info from trackInfos
    const extractVideoInfo = useCallback((file) => {
        const videoTrack = file.trackInfos?.find(track => track.type === 'Video');
        const generalTrack = file.trackInfos?.find(track => track.type === 'General');
        const audioTracks = file.trackInfos?.filter(track => track.type === 'Audio') || [];
        const textTracks = file.trackInfos?.filter(track => track.type === 'Text') || [];

        return {
            resolution: videoTrack ? `${videoTrack.width || 0}x${videoTrack.height || 0}` : 'N/A',
            codec: videoTrack?.format || 'N/A',
            frameRate: videoTrack?.frameRate ? `${videoTrack.frameRate} fps` : 'N/A',
            bitrate: videoTrack?.bitRate ? `${Math.round(videoTrack.bitRate / 1000)} kbps` : 'N/A',
            duration: generalTrack?.duration ? formatDuration(generalTrack.duration) : 'N/A',
            container: generalTrack?.format || 'N/A',
            audioLanguages: [...new Set(audioTracks.map(track => track.language || 'unknown'))],
            subtitleLanguages: [...new Set(textTracks.map(track => track.language || 'unknown'))],
            audioCount: audioTracks.length,
            subtitleCount: textTracks.length,
            hdr: videoTrack?.hdrFormat || null
        };
    }, [formatDuration]);

    // Extract filename components
    const extractFileNameInfo = useCallback((fileName) => {
        const match = fileName.match(/(.+?)[.](S\d+E\d+|Season\s*\d+\s*Episode\s*\d+)[.]?(.+)?\.(\w+)$/i) ||
            fileName.match(/(.+?)[.](\d{4})[.](.+)?\.(\w+)$/i) ||
            fileName.match(/(.+?)\.(\w+)$/i);

        if (match) {
            return {
                title: match[1].replace(/\./g, ' ').trim(),
                episode: match[2] || '',
                quality: match[3] ? match[3].replace(/\./g, ' ').trim() : '',
                extension: match[4] || 'unknown'
            };
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
        const parts = filePath.split('/').filter(Boolean);
        return {
            basePath: parts.length > 1 ? parts.slice(0, -1).join(' / ') : '/',
            fileName: parts[parts.length - 1] || filePath
        };
    }, []);

    // Fetch all media files
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

                setStats({
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
                    formats
                });

                // toast.success(`Loaded ${files.length} media files`);
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

    // Filter and sort files
    const filteredFiles = useMemo(() => {
        let filtered = [...mediaFiles];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(file =>
                file.fileName?.toLowerCase().includes(query) ||
                file.filePath?.toLowerCase().includes(query) ||
                file.id?.toLowerCase().includes(query)
            );
        }

        // Size filters
        if (filterMinSize) {
            const minBytes = parseFloat(filterMinSize) * (filterMinSize.includes('GB') ? 1024 * 1024 * 1024 :
                filterMinSize.includes('MB') ? 1024 * 1024 : 1024);
            filtered = filtered.filter(file => file.fileSize >= minBytes);
        }

        if (filterMaxSize) {
            const maxBytes = parseFloat(filterMaxSize) * (filterMaxSize.includes('GB') ? 1024 * 1024 * 1024 :
                filterMaxSize.includes('MB') ? 1024 * 1024 : 1024);
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

        // Sorting
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
                    aValue = aGeneral?.fileModifiedDate || '';
                    bValue = bGeneral?.fileModifiedDate || '';
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

    // Handle file click - use existing data instead of calling API
    const handleFileClick = useCallback((fileId) => {
        if (expandedFileId === fileId) {
            setExpandedFileId(null);
        } else {
            setExpandedFileId(fileId);
            // Use existing data instead of calling API
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

    // Handle select all
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
                toast.success(result.message || 'All symlinks repaired successfully');
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

    const handleRepairSymlinkApi = useCallback(async (fileId) => {
        setProcessing(true);
        try {
            const result = await repairSymlinkApi(fileId, true);
            if (result.success) {
                toast.success(result.message || 'Symlink repaired successfully for fileId: ' + fileId);
                fetchMediaFiles();
            } else {
                toast.error(result.message || 'Failed to repair symlink for fileId: ' + fileId);
            }
        } catch (err) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    }, [fetchMediaFiles]);

    // Handle delete files - FIXED
    const handleDeleteFiles = useCallback(async () => {
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

    // Download file
    const handleDownloadFile = useCallback((filePath, fileName) => {
        toast.info('Download functionality to be implemented');
    }, []);



    // Initialize
    useEffect(() => {
        fetchMediaFiles();
    }, [fetchMediaFiles]);

    // Render file details
    const renderFileDetails = useCallback((file) => {
        const details = fileDetails[file.id] || file;
        const videoInfo = extractVideoInfo(details);
        const pathInfo = extractPathInfo(file.filePath);

        const isHDR = Boolean(videoInfo.hdr);
        const isDolbyVision =
            videoInfo.hdr?.toLowerCase().includes('dolby') ||
            videoInfo.hdr?.toLowerCase().includes('dv');

        return (
            <motion.div
                key={file.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
            >
                <Box
                    sx={{
                        mt: 1,
                        p: 2,
                        borderTop: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                        background: alpha(theme.palette.background.paper, 0.65),
                        boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.08)}`
                    }}
                >
                    <Grid container spacing={3}>
                        {/* ================= FILE INFO ================= */}
                        <Grid item xs={12} md={6}>
                            <Typography
                                variant="subtitle2"
                                color="text.secondary"
                                sx={{ mb: 1, letterSpacing: 0.6 }}
                            >
                                FILE INFORMATION
                            </Typography>

                            <Box sx={{ display: 'grid', gap: 1 }}>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Typography variant="caption" sx={{ minWidth: 90, color: 'text.secondary' }}>
                                        Path:
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.75rem',
                                            wordBreak: 'break-all'
                                        }}
                                    >
                                        {pathInfo.basePath}
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Typography variant="caption" sx={{ minWidth: 90, color: 'text.secondary' }}>
                                        ID:
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontFamily: 'monospace',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        {file.id}
                                    </Typography>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <Typography variant="caption" sx={{ minWidth: 90, color: 'text.secondary' }}>
                                        Format:
                                    </Typography>
                                    <Typography variant="body2" fontWeight={500}>
                                        {videoInfo.container}
                                    </Typography>

                                    {/* ===== HDR / DOLBY BADGES ===== */}
                                    {isHDR && (
                                        <Box
                                            sx={{
                                                ml: 1,
                                                px: 1,
                                                py: 0.25,
                                                borderRadius: 1,
                                                fontSize: '0.65rem',
                                                fontWeight: 600,
                                                letterSpacing: 0.6,
                                                background: isDolbyVision
                                                    ? 'linear-gradient(135deg, #7b2ff7, #00c6ff)'
                                                    : 'linear-gradient(135deg, #ff9800, #ffc107)',
                                                color: '#fff',
                                                boxShadow: 2,
                                                textTransform: 'uppercase'
                                            }}
                                        >
                                            {isDolbyVision ? 'Dolby Vision' : 'HDR'}
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Grid>

                        {/* ================= VIDEO INFO ================= */}
                        <Grid item xs={12} md={6}>
                            <Typography
                                variant="subtitle2"
                                color="text.secondary"
                                sx={{ mb: 1, letterSpacing: 0.6 }}
                            >
                                VIDEO DETAILS
                            </Typography>

                            <Grid container spacing={1.5}>
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">
                                        Resolution
                                    </Typography>
                                    <Typography variant="body2" fontWeight={500}>
                                        {videoInfo.resolution}
                                    </Typography>
                                </Grid>

                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">
                                        Duration
                                    </Typography>
                                    <Typography variant="body2" fontWeight={500}>
                                        {videoInfo.duration}
                                    </Typography>
                                </Grid>

                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">
                                        Codec
                                    </Typography>
                                    <Typography variant="body2" fontWeight={500}>
                                        {videoInfo.codec}
                                    </Typography>
                                </Grid>

                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">
                                        Audio
                                    </Typography>
                                    <Typography variant="body2" fontWeight={500}>
                                        {videoInfo.audioLanguages.join(', ') || 'N/A'}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* ================= ACTIONS ================= */}
                    <Box
                        sx={{
                            mt: 2,
                            pt: 1.5,
                            display: 'flex',
                            gap: 1,
                            flexWrap: 'wrap',
                            borderTop: `1px dashed ${theme.palette.divider}`
                        }}
                    >
                        <Button
                            size="small"
                            startIcon={<CopyIcon />}
                            onClick={() => handleCopyPath(file.filePath)}
                            variant="outlined"
                            sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    transform: 'translateY(-1px)',
                                    boxShadow: 2
                                }
                            }}
                        >
                            Copy Path
                        </Button>

                        <Button
                            size="small"
                            startIcon={<DownloadIcon />}
                            onClick={() => handleDownloadFile(file.filePath, file.fileName)}
                            variant="outlined"
                            sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    transform: 'translateY(-1px)',
                                    boxShadow: 2
                                }
                            }}
                        >
                            Download
                        </Button>
                    </Box>
                </Box>
            </motion.div>
        );
    }, [
        fileDetails,
        extractVideoInfo,
        extractPathInfo,
        handleCopyPath,
        handleDownloadFile,
        theme
    ]);

    return (
        <Box sx={{
            p: { xs: 1, sm: 2, md: 3 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default'
        }}>
            {/* Header */}
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 1, sm: 2 },
                    mb: 2,
                    borderRadius: 2,
                    background: `linear-gradient(
            135deg,
            ${alpha(theme.palette.primary.main, 0.05)} 0%,
            ${alpha(theme.palette.secondary.main, 0.05)} 100%
        )`,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
                }}
            >

                {/* Stats */}
                <Grid container spacing={1} sx={{ mt: 2 }}>
                    {[
                        { label: 'Files', value: stats.totalFiles, color: 'primary' },
                        { label: 'Size', value: formatFileSize(stats.totalSize), color: 'secondary' },
                        { label: 'Audio', value: stats.audioCount, color: 'success.main' },
                        { label: 'Subs', value: stats.textCount, color: 'warning.main' }
                    ].map(({ label, value, color }) => (
                        <Grid item xs={3} key={label}>
                            <Box
                                sx={{
                                    textAlign: 'center',
                                    py: 1.2,
                                    px: 0.75,
                                    borderRadius: 1.5,
                                    border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                                    // backgroundColor: 'background.paper',
                                    transition: 'all 0.25s ease',
                                    cursor: 'default',

                                    '&:hover': {
                                        borderColor: color,
                                        backgroundColor: alpha(theme.palette.action.hover, 0.3),
                                        // boxShadow: `0 4px 12px ${alpha(color, 0.25)}`,
                                        transform: 'translateY(-2px) scale(1.02)'
                                    }
                                }}
                            >
                                <Typography
                                    variant="h6"
                                    sx={{
                                        color,
                                        fontSize: { xs: '0.9rem', sm: '1.1rem' },
                                        fontWeight: 600,
                                        lineHeight: 1.2
                                    }}
                                >
                                    {value}
                                </Typography>

                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        fontSize: '0.7rem',
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase'
                                    }}
                                >
                                    {label}
                                </Typography>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Paper>

            {/* Search and Filters */}
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
            />

            {/* System Actions - Now works on mobile too */}
            <MediaSystemActions
                isMobile={isMobile}
                processing={processing}
                setDialogOpen={setDialogOpen}
                handleRebuildAllSymlinks={handleRebuildAllSymlinks}
                handleCleanup={handleCleanup}
            />

            {/* Render table or grid view */}
            <Paper
                elevation={0}
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: 'background.paper'
                }}
            >
                {loading ? (
                    <Box sx={{ p: 3, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CircularProgress />
                    </Box>
                ) : filteredFiles.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Alert severity="info" sx={{ maxWidth: 400 }}>
                            <AlertTitle>No media files found</AlertTitle>
                            {searchQuery ? 'Try a different search term or clear filters.' : 'No media files available in the system.'}
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

export default MediaFilesManagement;