import React from 'react';
import { motion } from 'framer-motion';
import {
    Box,
    Button,
    Paper,
    Typography,
    TextField,
    IconButton,
    Tooltip,
    InputAdornment,
    FormControlLabel,
    Checkbox,
    Fade
} from '@mui/material';
import {
    AddLink as AddLinkIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';

const LinksManager = ({ links, onLinksChange }) => {
    const handleAddLink = () => {
        onLinksChange([...links, { url: "", rename: false, customName: "" }]);
    };

    const handleRemoveLink = (index) => {
        if (links.length > 1) {
            const newLinks = [...links];
            newLinks.splice(index, 1);
            onLinksChange(newLinks);
        }
    };

    const handleLinkChange = (index, value) => {
        const newLinks = [...links];
        newLinks[index].url = value;
        onLinksChange(newLinks);
    };

    const handleRenameToggle = (index) => {
        const newLinks = [...links];
        newLinks[index].rename = !newLinks[index].rename;
        onLinksChange(newLinks);
    };

    const handleCustomNameChange = (index, value) => {
        const newLinks = [...links];
        newLinks[index].customName = value;
        onLinksChange(newLinks);
    };

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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddLinkIcon sx={{ color: '#007bff' }} />
                    <Typography variant="h6" fontWeight="600">
                        Download Links
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    {links.length} link{links.length !== 1 ? 's' : ''}
                </Typography>
            </Box>

            <Box sx={{ maxHeight: '400px', overflowY: 'auto', pr: 1, mb: 2 }}>
                {links.map((link, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                        <Paper
                            elevation={0}
                            sx={{
                                p: 2,
                                mb: 2,
                                background: 'rgba(248,249,250,0.8)',
                                border: '1px solid rgba(0,0,0,0.04)',
                                borderRadius: '8px'
                            }}
                        >
                            {/* URL Input */}
                            <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
                                <TextField
                                    fullWidth
                                    variant="outlined"
                                    value={link.url}
                                    onChange={(e) => handleLinkChange(index, e.target.value)}
                                    placeholder="https://example.com/file.zip"
                                    size="small"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '8px',
                                            background: 'white'
                                        }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Typography variant="body2" color="text.secondary" sx={{ minWidth: '20px' }}>
                                                    {index + 1}.
                                                </Typography>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                {links.length > 1 && (
                                    <Tooltip title="Remove link">
                                        <IconButton
                                            onClick={() => handleRemoveLink(index)}
                                            size="small"
                                            sx={{ 
                                                color: '#dc3545',
                                                background: 'rgba(220,53,69,0.1)',
                                                '&:hover': {
                                                    background: 'rgba(220,53,69,0.2)'
                                                },
                                                mt: 0.5
                                            }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>

                            {/* Individual Rename Options */}
                            <Box sx={{ pl: 1 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={link.rename}
                                            onChange={() => handleRenameToggle(index)}
                                            size="small"
                                        />
                                    }
                                    label="Use custom file name for this download"
                                />
                                <Fade in={link.rename}>
                                    <Box sx={{ ml: 4, mt: 1 }}>
                                        <TextField
                                            fullWidth
                                            label="Custom File Name"
                                            variant="outlined"
                                            size="small"
                                            value={link.customName}
                                            onChange={(e) => handleCustomNameChange(index, e.target.value)}
                                            placeholder="Enter custom filename..."
                                            helperText="Leave empty to use original filename"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '6px',
                                                    background: 'white'
                                                }
                                            }}
                                        />
                                    </Box>
                                </Fade>
                            </Box>
                        </Paper>
                    </motion.div>
                ))}
            </Box>

            <Button
                variant="outlined"
                startIcon={<AddLinkIcon />}
                onClick={handleAddLink}
                fullWidth
                sx={{
                    borderRadius: '8px',
                    borderColor: '#007bff',
                    color: '#007bff',
                    '&:hover': {
                        borderColor: '#0056b3',
                        background: 'rgba(0,123,255,0.04)'
                    }
                }}
            >
                Add Another Link
            </Button>
        </Paper>
    );
};

export default LinksManager;