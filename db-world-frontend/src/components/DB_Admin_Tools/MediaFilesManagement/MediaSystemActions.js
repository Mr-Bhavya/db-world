import React from 'react';
import {
    Box,
    Paper,
    Button,
    Typography,
    CircularProgress,
} from '@mui/material';
import {
    Build as BuildIcon,
    Link as LinkIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';

const MediaSystemActions = ({
    isMobile,
    processing,
    setDialogOpen,
    handleRebuildAllSymlinks,
    handleCleanup,
}) => {

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

export default MediaSystemActions;