import React from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    FormControlLabel,
    Checkbox,
    Fade,
    Grid
} from '@mui/material';
import {
    Security as SecurityIcon,
    Lock as LockIcon
} from '@mui/icons-material';

const SecurityOptions = ({
    linkPasswordProtect,
    onLinkPasswordProtectChange,
    username,
    onUsernameChange,
    password,
    onPasswordChange,
    zipPasswordProtect,
    onZipPasswordProtectChange,
    zipPassword,
    onZipPasswordChange
}) => {
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
                <SecurityIcon sx={{ color: '#007bff' }} />
                Security & Access
            </Typography>

            {/* Link Protection */}
            <Box sx={{ mb: 3 }}>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={linkPasswordProtect}
                            onChange={(e) => onLinkPasswordProtectChange(e.target.checked)}
                        />
                    }
                    label="Link requires authentication"
                />
                <Fade in={linkPasswordProtect}>
                    <Box sx={{ ml: 4, mt: 2 }}>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Username"
                                    variant="outlined"
                                    size="small"
                                    value={username}
                                    onChange={(e) => onUsernameChange(e.target.value)}
                                    placeholder="Enter username..."
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '8px',
                                            background: 'white'
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Password"
                                    type="password"
                                    variant="outlined"
                                    size="small"
                                    value={password}
                                    onChange={(e) => onPasswordChange(e.target.value)}
                                    placeholder="Enter password..."
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '8px',
                                            background: 'white'
                                        }
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </Box>
                </Fade>
            </Box>

            {/* Archive Protection */}
            <Box>
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={zipPasswordProtect}
                            onChange={(e) => onZipPasswordProtectChange(e.target.checked)}
                            icon={<LockIcon />}
                            checkedIcon={<LockIcon />}
                        />
                    }
                    label="Archive is password protected"
                />
                <Fade in={zipPasswordProtect}>
                    <Box sx={{ ml: 4, mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Archive Password"
                            type="password"
                            variant="outlined"
                            size="small"
                            value={zipPassword}
                            onChange={(e) => onZipPasswordChange(e.target.value)}
                            placeholder="Enter archive password..."
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                    background: 'white'
                                }
                            }}
                        />
                    </Box>
                </Fade>
            </Box>
        </Paper>
    );
};

export default SecurityOptions;