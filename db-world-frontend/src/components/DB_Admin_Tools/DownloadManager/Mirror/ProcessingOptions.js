import React from 'react';
import {
    Box,
    Paper,
    Typography,
    FormControlLabel,
    Checkbox,
    Fade
} from '@mui/material';
import {
    Archive as ArchiveIcon
} from '@mui/icons-material';

const ProcessingOptions = ({ extract, onExtractChange }) => {
    return (
        <Paper
            elevation={0}
            sx={{
                p: 1.5,
                mb: 3,
                background: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '12px'
            }}
        >
            <Typography variant="h6" fontWeight="600" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArchiveIcon sx={{ color: '#007bff' }} />
                File Processing
            </Typography>

            <FormControlLabel
                control={
                    <Checkbox
                        checked={extract}
                        onChange={(e) => onExtractChange(e.target.checked)}
                    />
                }
                label="Extract files after download"
            />

            <Fade in={extract}>
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Files will be automatically extracted after download completes
                    </Typography>
                </Box>
            </Fade>
        </Paper>
    );
};

export default ProcessingOptions;