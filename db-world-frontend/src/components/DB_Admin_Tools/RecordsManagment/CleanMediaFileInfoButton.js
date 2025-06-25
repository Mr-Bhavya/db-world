import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import { cleanMediaFileInfo } from '../../ApiServices';
import Constants from '../../Constants';
import { useLocation, useNavigate } from 'react-router-dom';

export default function CleanMediaFileInfoButton() {
    const [open, setOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [resultMessage, setResultMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const handleClickOpen = () => {
        setResultMessage('');
        setOpen(true);
    };

    const handleClose = () => {
        if (!loading) {
            setOpen(false);
            setConfirming(false);
            setResultMessage('');
        }
    };

    const handleConfirm = async () => {
        setLoading(true);
        setConfirming(false);
        setResultMessage('');
        try {
            // Simulated API call
            //   await new Promise((resolve) => setTimeout(resolve, 2000)); // simulate delay

            // Replace with actual API call:
            const response = await cleanMediaFileInfo();
            if (response.httpStatusCode == 200) {
                setResultMessage(`✅ Successfully cleaned up ${response.data.deletedFilesCount} media file info from ${response.data.totalCount}.`);
            } else if (response.httpStatusCode == 401 || response.httpStatusCode == 403) {
                setResultMessage('❌ Unauthorized access. Please log in again.');
                navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
            } else {
                setResultMessage(`❌ Failed to clean media file info: ${response.message || response.errorMessage}`);
            }

        } catch (err) {
            setResultMessage('❌ Failed to clean media file info.');
        } finally {
            setLoading(false);
            setConfirming(true);
        }
    };

    return (
        <>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                    variant="contained"
                    color="error"
                    onClick={handleClickOpen}
                    sx={{ fontWeight: 'bold', px: 3 }}
                >
                    Clean Media File Info
                </Button>
            </motion.div>

            <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
                <DialogTitle>
                    {confirming ? 'Cleanup Result' : 'Are you sure?'}
                </DialogTitle>
                <DialogContent>
                    {loading ? (
                        <Typography align="center" sx={{ py: 2 }}>
                            <CircularProgress size={24} />
                            <br />
                            Cleaning media files...
                        </Typography>
                    ) : confirming ? (
                        <Typography align="center" sx={{ py: 2 }}>{resultMessage}</Typography>
                    ) : (
                        <Typography>
                            This action will delete invalid or missing media file records. Do you want to continue?
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    {!loading && !confirming && (
                        <>
                            <Button onClick={handleClose}>Cancel</Button>
                            <Button variant="contained" color="error" onClick={handleConfirm}>
                                Confirm
                            </Button>
                        </>
                    )}
                    {!loading && confirming && (
                        <Button onClick={handleClose} variant="contained" autoFocus>
                            Close
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </>
    );
}
