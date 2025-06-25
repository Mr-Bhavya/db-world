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
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { Close, Delete, MoreVert } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteMediaFileInfoById } from '../../ApiServices';
import Constants from '../../Constants';
import CommonServices from '../../CommonServices';

function RecordMediaFilesModal({ fileDialog, setFileDialogData }) {
    const { open, record, files, type } = fileDialog;
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [filesToDelete, setFilesToDelete] = useState([]);
    const [deleteMode, setDeleteMode] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
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
        setFileDialogData({ open: false, record: null, files: [], type: null });
        setSelectedSeason(null);
        setFilesToDelete([]);
        setDeleteMode(false);
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

            const response = await deleteMediaFileInfoById(filesToDelete.join(','));
            if (response.httpStatusCode === 200) {
                Constants.showToast.success(`${filesToDelete.length} file(s) deleted`);
            } else if ([401, 403].includes(response.httpStatusCode)) {
                Constants.showToast.error(response.message + Constants.RE_LOGIN);
                navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
            } else {
                Constants.showToast.error(response.message || 'Failed to delete files');
            }

            handleClose();
        } catch (error) {
            Constants.showToast.error('Failed to delete files');
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

    // -- Menu Actions --
    const handleToggleSelection = () => {
        const visibleIds = visibleFiles.map(f => f.id);
        const allSelected = visibleIds.every(id => filesToDelete.includes(id));

        if (allSelected) {
            setFilesToDelete(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setFilesToDelete(prev => [...new Set([...prev, ...visibleIds])]);
        }

        handleMenuClose();
    };

    const handleSelectAll = () => {
        const visibleIds = visibleFiles.map(f => f.id);
        setFilesToDelete(prev => [...new Set([...prev, ...visibleIds])]);
        handleMenuClose();
    };

    const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth scroll="paper">
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box component="span" fontWeight={500}>
                        Files for {record?.name}
                    </Box>
                    <Box>
                        {deleteMode && (
                            <>
                                <Tooltip title="Options">
                                    <IconButton onClick={handleMenuClick}>
                                        <MoreVert />
                                    </IconButton>
                                </Tooltip>
                                <Menu anchorEl={anchorEl} open={openMenu} onClose={handleMenuClose}>
                                    <MenuItem onClick={handleToggleSelection}>Toggle Selection</MenuItem>
                                    <MenuItem onClick={handleSelectAll}>Select All</MenuItem>
                                </Menu>
                            </>
                        )}
                        <IconButton onClick={handleClose}>
                            <Close />
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent dividers>
                {type === 'series' && (
                    <Box sx={{ mb: 2 }}>
                        <Tabs
                            value={selectedSeason}
                            onChange={(e, newValue) => setSelectedSeason(newValue)}
                            variant="scrollable"
                            scrollButtons="auto"
                        >
                            {sortedSeasonKeys.map((seasonKey) => (
                                <Tab key={seasonKey} label={seasonKey} value={seasonKey} />
                            ))}
                        </Tabs>
                    </Box>
                )}

                <List dense>
                    {visibleFiles.map((file) => (
                        <ListItem
                            key={file.id}
                            secondaryAction={
                                deleteMode && (
                                    <Checkbox
                                        edge="end"
                                        checked={filesToDelete.includes(file.id)}
                                        onChange={() => toggleFileSelection(file.id)}
                                    />
                                )
                            }
                        >
                            <ListItemText
                                primary={file.fileName}
                                secondary={`${CommonServices.bytesToReadbleFormat(file.fileSize).value} ${CommonServices.bytesToReadbleFormat(file.fileSize).suffix
                                    } • ${file.filePath}`}
                                primaryTypographyProps={{ noWrap: true }}
                                secondaryTypographyProps={{ noWrap: true }}
                            />
                        </ListItem>
                    ))}
                </List>
            </DialogContent>

            <DialogActions>
                {deleteMode ? (
                    <Button
                        color="error"
                        onClick={handleDeleteSelected}
                        disabled={filesToDelete.length === 0}
                        startIcon={<Delete />}
                        size="small"
                    >
                        Delete Selected ({filesToDelete.length})
                    </Button>
                ) : (
                    <Button
                        color="error"
                        onClick={() => setDeleteMode(true)}
                        startIcon={<Delete />}
                        size="small"
                    >
                        Delete Files
                    </Button>
                )}
                <Button onClick={handleClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

export default RecordMediaFilesModal;