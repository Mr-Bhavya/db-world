import React from 'react';
import { motion } from 'framer-motion';
import {
    Box,
    Button,
    Paper,
    Typography,
    CircularProgress
} from '@mui/material';
import {
    Download as DownloadIcon,
    Clear as ClearIcon
} from '@mui/icons-material';

const QuickActions = ({ onSubmit, onClear, submitLoader, hasValidLinks }) => {
    return (
        <Paper
            elevation={0}
            sx={{
                p: 1.5,
                background: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '12px'
            }}
        >
            <Typography variant="h6" fontWeight="600" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DownloadIcon sx={{ color: '#007bff' }} />
                Quick Actions
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                <Button
                    variant="outlined"
                    onClick={onClear}
                    fullWidth
                    startIcon={<ClearIcon />}
                    sx={{
                        borderRadius: '8px',
                        borderColor: '#6c757d',
                        color: '#6c757d',
                        '&:hover': {
                            borderColor: '#5a6268',
                            background: 'rgba(108,117,125,0.04)'
                        }
                    }}
                >
                    Clear Form
                </Button>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ width: '100%' }}>
                    <Button
                        variant="contained"
                        onClick={onSubmit}
                        disabled={submitLoader || !hasValidLinks}
                        fullWidth
                        sx={{
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #0056b3 0%, #004085 100%)'
                            },
                            '&:disabled': {
                                background: '#6c757d'
                            }
                        }}
                        startIcon={submitLoader ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        {submitLoader ? 'Processing...' : 'Start Download'}
                    </Button>
                </motion.div>
            </Box>
        </Paper>
    );
};

export default QuickActions;