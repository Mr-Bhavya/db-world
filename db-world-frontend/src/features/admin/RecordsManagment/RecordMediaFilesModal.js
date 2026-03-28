import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Menu,
    MenuItem,
    Tab,
    Tabs,
    Tooltip,
    Chip,
    Avatar,
    Typography,
    Card,
    CardContent,
    LinearProgress,
    Divider,
    useTheme,
    useMediaQuery,
    Grid,
    Badge,
    Fade,
    Alert,
    CircularProgress
} from '@mui/material';
import { 
    Close, 
    Delete, 
    MoreVert, 
    VideoFile,
    Folder,
    Storage,
    Code,
    Audiotrack,
    Subtitles,
    CheckCircle,
    Cancel,
    PlayArrow,
    Info,
    SelectAll,
    Deselect
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteMediaFileInfoById } from '../../ApiServices';
import Constants from '../../Constants';
import CommonServices from '../../CommonServices';
import { toast } from '../../Toast';

const MotionDialog = motion(Dialog);
const MotionCard = motion(Card);
const MotionListItem = motion(ListItem);

const FileTypeChip = ({ trackInfos }) => {
    const theme = useTheme();
    
    const trackCounts = trackInfos?.reduce((acc, track) => {
        acc[track.type] = (acc[track.type] || 0) + 1;
        return acc;
    }, {});

    const getTrackIcon = (type) => {
        switch(type) {
            case 'Video': return <VideoFile sx={{ fontSize: 14 }} />;
            case 'Audio': return <Audiotrack sx={{ fontSize: 14 }} />;
            case 'Text': return <Subtitles sx={{ fontSize: 14 }} />;
            default: return <Code sx={{ fontSize: 14 }} />;
        }
    };

    return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {Object.entries(trackCounts || {}).map(([type, count]) => (
                <Chip
                    key={type}
                    icon={getTrackIcon(type)}
                    label={`${count} ${type}`}
                    size="small"
                    variant="outlined"
                    sx={{ 
                        height: 24,
                        fontSize: '0.7rem',
                        '& .MuiChip-icon': { fontSize: 14 }
                    }}
                />
            ))}
        </Box>
    );
};

const FileCard = ({ file, isSelected, onSelect, deleteMode, onPlay }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const fileSize = CommonServices.bytesToReadbleFormat(file.fileSize);

    return (
        <MotionCard
            sx={{
                border: isSelected 
                    ? `2px solid ${theme.palette.error.main}`
                    : `1px solid ${theme.palette.divider}`,
                borderRadius: '12px',
                background: isSelected 
                    ? `${theme.palette.error.light}15`
                    : theme.palette.background.paper,
                transition: 'all 0.2s ease',
                cursor: deleteMode ? 'pointer' : 'default',
                '&:hover': {
                    transform: deleteMode ? 'translateY(-2px)' : 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                }
            }}
            whileHover={{ scale: deleteMode ? 1.02 : 1 }}
            whileTap={{ scale: 0.98 }}
            onClick={deleteMode ? () => onSelect(file.id) : undefined}
        >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                    <Avatar
                        variant="rounded"
                        sx={{
                            bgcolor: theme.palette.primary.main,
                            width: 40,
                            height: 40
                        }}
                    >
                        <VideoFile />
                    </Avatar>
                    
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                            variant="h6" 
                            sx={{
                                fontWeight: 600,
                                fontSize: '1rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                lineHeight: 1.3
                            }}
                        >
                            {file.fileName}
                        </Typography>
                        
                        {/* File Size and Selection Status */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Chip
                                icon={<Storage sx={{ fontSize: 14 }} />}
                                label={`${fileSize.value} ${fileSize.suffix}`}
                                size="small"
                                variant="filled"
                                color="primary"
                                sx={{ height: 24, fontSize: '0.7rem' }}
                            />
                            
                            {deleteMode && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {isSelected ? (
                                        <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                                    ) : (
                                        <Cancel sx={{ fontSize: 16, color: 'text.disabled' }} />
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                        {isSelected ? 'Selected' : 'Not selected'}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>

                    {/* Action Buttons */}
                    {!deleteMode && (
                        <Tooltip title="Play File">
                            <IconButton 
                                size="small" 
                                onClick={onPlay}
                                sx={{
                                    backgroundColor: theme.palette.primary.main,
                                    color: 'white',
                                    '&:hover': {
                                        backgroundColor: theme.palette.primary.dark,
                                    }
                                }}
                            >
                                <PlayArrow />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>

                {/* File Path */}
                <Tooltip title={file.filePath} arrow>
                    <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mb: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <Folder sx={{ fontSize: 16 }} />
                        {file.filePath}
                    </Typography>
                </Tooltip>

                {/* Track Information */}
                <FileTypeChip trackInfos={file.trackInfos} />
            </CardContent>
        </MotionCard>
    );
};

function RecordMediaFilesModal({ fileDialog, setFileDialog }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));

    const { open, record, files, type } = fileDialog;
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [filesToDelete, setFilesToDelete] = useState([]);
    const [deleteMode, setDeleteMode] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [deleting, setDeleting] = useState(false);
    
    const navigate = useNavigate();
    const location = useLocation();

    const openMenu = Boolean(anchorEl);

    const groupedFiles = useMemo(() => {
        if (type !== 'series') return { 'All Files': files };

        const seasons = {};
        const extractSeasonNumber = (text) => {
            if (!text) return null;
            const match = text.match(/(?:S|Season)?\s?0?(\d{1,2})/i);
            return match ? parseInt(match[1], 10) : null;
        };

        files.forEach((file) => {
            let seasonNumber = file.seasonNumber;

            if (!seasonNumber || seasonNumber <= 0) {
                seasonNumber = extractSeasonNumber(file.fileName) || extractSeasonNumber(file.filePath);
            }

            const seasonKey = seasonNumber ? `Season ${seasonNumber}` : 'Unsorted Files';

            if (!seasons[seasonKey]) seasons[seasonKey] = [];
            seasons[seasonKey].push(file);
        });

        return seasons;
    }, [files, type]);

    useEffect(() => {
        if (type === 'series') {
            const firstSeason = Object.keys(groupedFiles)[0];
            setSelectedSeason(firstSeason);
        }
    }, [type, groupedFiles]);

    const handleClose = () => {
        setFileDialog({ open: false, record: null, files: [], type: null });
        setSelectedSeason(null);
        setFilesToDelete([]);
        setDeleteMode(false);
        setDeleting(false);
    };

    const toggleFileSelection = (fileId) => {
        setFilesToDelete((prev) =>
            prev.includes(fileId)
                ? prev.filter((id) => id !== fileId)
                : [...prev, fileId]
        );
    };

    const handleDeleteSelected = async () => {
        try {
            if (filesToDelete.length === 0) return;

            setDeleting(true);
            const response = await deleteMediaFileInfoById(filesToDelete.join(','));
            
            if (response.httpStatusCode === 200) {
                toast.success(`${filesToDelete.length} file(s) deleted successfully`);
                handleClose();
            } else if ([401, 403].includes(response.httpStatusCode)) {
                toast.error(response.message + Constants.RE_LOGIN);
                navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
            } else {
                toast.error(response.message || 'Failed to delete files');
            }
        } catch (error) {
            toast.error('Failed to delete files');
        } finally {
            setDeleting(false);
        }
    };

    const visibleFiles =
        type === 'series' && selectedSeason
            ? groupedFiles[selectedSeason] || []
            : files;

    const sortedSeasonKeys = useMemo(() => {
        return Object.keys(groupedFiles).sort((a, b) => {
            const aNum = parseInt(a.replace('Season ', '')) || 0;
            const bNum = parseInt(b.replace('Season ', '')) || 0;
            return aNum - bNum;
        });
    }, [groupedFiles]);

    // Menu Actions
const handleToggleSelection = () => {
    const visibleIds = visibleFiles.map(f => f.id);

    setFilesToDelete(prev => {
        const newSelection = new Set(prev);

        visibleIds.forEach(id => {
            if (newSelection.has(id)) {
                newSelection.delete(id);  // unselect if selected
            } else {
                newSelection.add(id);     // select if not selected
            }
        });

        return Array.from(newSelection);
    });

    handleMenuClose();
};


    const handleSelectAll = () => {
        const visibleIds = visibleFiles.map(f => f.id);
        setFilesToDelete(prev => [...new Set([...prev, ...visibleIds])]);
        handleMenuClose();
    };

    const handleDeselectAll = () => {
        const visibleIds = visibleFiles.map(f => f.id);
        setFilesToDelete(prev => prev.filter(id => !visibleIds.includes(id)));
        handleMenuClose();
    };

    const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handlePlayFile = (file) => {
        // Implement play file functionality
        toast.info(`Playing: ${file.fileName}`);
    };

    const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);
    const totalSizeFormatted = CommonServices.bytesToReadbleFormat(totalSize);

    return (
        <MotionDialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            fullScreen={isMobile}
            TransitionComponent={Fade}
            transitionDuration={400}
        >
            <DialogTitle sx={{ 
                background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}15 100%)`,
                borderBottom: `1px solid ${theme.palette.divider}`,
                py: 2
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <VideoFile color="primary" />
                            Media Files
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            {record?.name} • {files.length} files • {totalSizeFormatted.value} {totalSizeFormatted.suffix}
                        </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {deleteMode && (
                            <>
                                <Tooltip title="Selection Options">
                                    <IconButton 
                                        onClick={handleMenuClick}
                                        sx={{
                                            backgroundColor: theme.palette.action.hover,
                                            '&:hover': {
                                                backgroundColor: theme.palette.action.selected,
                                            }
                                        }}
                                    >
                                        <MoreVert />
                                    </IconButton>
                                </Tooltip>
                                <Menu 
                                    anchorEl={anchorEl} 
                                    open={openMenu} 
                                    onClose={handleMenuClose}
                                    TransitionComponent={Fade}
                                >
                                    <MenuItem onClick={handleToggleSelection}>
                                        <Deselect sx={{ mr: 1, fontSize: 20 }} />
                                        Toggle Selection
                                    </MenuItem>
                                    <MenuItem onClick={handleSelectAll}>
                                        <SelectAll sx={{ mr: 1, fontSize: 20 }} />
                                        Select All
                                    </MenuItem>
                                    <MenuItem onClick={handleDeselectAll}>
                                        <Deselect sx={{ mr: 1, fontSize: 20 }} />
                                        Deselect All
                                    </MenuItem>
                                </Menu>
                            </>
                        )}
                        
                        <Tooltip title="Close">
                            <IconButton 
                                onClick={handleClose}
                                sx={{
                                    backgroundColor: theme.palette.action.hover,
                                    '&:hover': {
                                        backgroundColor: theme.palette.action.selected,
                                    }
                                }}
                            >
                                <Close />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 0 }}>
                {/* Season Tabs for Series */}
                {type === 'series' && (
                    <Box sx={{ 
                        borderBottom: 1, 
                        borderColor: 'divider',
                        px: 3,
                        pt: 2
                    }}>
                        <Tabs
                            value={selectedSeason}
                            onChange={(e, newValue) => setSelectedSeason(newValue)}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{
                                '& .MuiTab-root': {
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    fontSize: '0.9rem',
                                    minHeight: 48
                                }
                            }}
                        >
                            {sortedSeasonKeys.map((seasonKey) => (
                                <Tab 
                                    key={seasonKey} 
                                    label={
                                        <Badge 
                                            badgeContent={groupedFiles[seasonKey]?.length} 
                                            color="primary"
                                            sx={{ 
                                                '& .MuiBadge-badge': {
                                                    fontSize: '0.7rem',
                                                    height: 16,
                                                    minWidth: 16
                                                }
                                            }}
                                        >
                                            {seasonKey}
                                        </Badge>
                                    } 
                                    value={seasonKey} 
                                />
                            ))}
                        </Tabs>
                    </Box>
                )}

                {/* Delete Mode Alert */}
                {deleteMode && (
                    <Alert 
                        severity="warning" 
                        sx={{ 
                            mx: 3, 
                            mt: 2,
                            borderRadius: 2
                        }}
                        action={
                            <Button 
                                color="inherit" 
                                size="small" 
                                onClick={() => setDeleteMode(false)}
                            >
                                Cancel
                            </Button>
                        }
                    >
                        <Typography variant="body2" fontWeight="600">
                            Delete Mode Active
                        </Typography>
                        <Typography variant="caption">
                            Select files to delete. {filesToDelete.length} file(s) selected.
                        </Typography>
                    </Alert>
                )}

                {/* Files Grid */}
                <Box sx={{ p: 3 }}>
                    <AnimatePresence mode="wait">
                        <Grid container spacing={2}>
                            {visibleFiles.map((file) => (
                                <Grid item xs={12} md={6} lg={4} key={file.id}>
                                    <FileCard
                                        file={file}
                                        isSelected={filesToDelete.includes(file.id)}
                                        onSelect={toggleFileSelection}
                                        deleteMode={deleteMode}
                                        onPlay={() => handlePlayFile(file)}
                                    />
                                </Grid>
                            ))}
                        </Grid>
                    </AnimatePresence>

                    {visibleFiles.length === 0 && (
                        <Box sx={{ 
                            textAlign: 'center', 
                            py: 8,
                            color: 'text.secondary'
                        }}>
                            <VideoFile sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                            <Typography variant="h6" gutterBottom>
                                No files found
                            </Typography>
                            <Typography variant="body2">
                                {type === 'series' && selectedSeason 
                                    ? `No files in ${selectedSeason}`
                                    : 'No media files available for this record'
                                }
                            </Typography>
                        </Box>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ 
                p: 3, 
                gap: 2,
                borderTop: `1px solid ${theme.palette.divider}`,
                flexWrap: { xs: 'wrap', sm: 'nowrap' }
            }}>
                <Box sx={{ 
                    display: 'flex', 
                    gap: 1, 
                    flexWrap: 'wrap',
                    flex: 1
                }}>
                    {deleteMode ? (
                        <>
                            <Button
                                color="error"
                                variant="contained"
                                onClick={handleDeleteSelected}
                                disabled={filesToDelete.length === 0 || deleting}
                                startIcon={deleting ? <CircularProgress size={16} /> : <Delete />}
                                sx={{
                                    background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
                                    minWidth: 180
                                }}
                            >
                                {deleting ? 'Deleting...' : `Delete (${filesToDelete.length})`}
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={() => setDeleteMode(false)}
                                disabled={deleting}
                            >
                                Cancel Delete
                            </Button>
                        </>
                    ) : (
                        <Button
                            color="error"
                            variant="outlined"
                            onClick={() => setDeleteMode(true)}
                            startIcon={<Delete />}
                            sx={{ minWidth: 140 }}
                        >
                            Delete Files
                        </Button>
                    )}
                </Box>

                <Button 
                    onClick={handleClose}
                    variant="contained"
                    sx={{
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                        minWidth: 100
                    }}
                >
                    Close
                </Button>
            </DialogActions>
        </MotionDialog>
    );
}

export default RecordMediaFilesModal;