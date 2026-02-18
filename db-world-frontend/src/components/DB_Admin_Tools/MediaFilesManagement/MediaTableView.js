import React from 'react';
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Checkbox,
    IconButton,
    Tooltip,
    Typography,
    Chip,
} from '@mui/material';
import {
    VideoFile as VideoIcon,
    CopyAll as CopyIcon,
    Download as DownloadIcon,
    Sort as SortIcon,
    Download,
    Delete,
} from '@mui/icons-material';

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
                                                        <Download fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDialogOpen('delete');
                                                            setSelectedFiles([file.id]);
                                                        }}
                                                    >
                                                        <Delete fontSize="small" />
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

export default MediaTableView;