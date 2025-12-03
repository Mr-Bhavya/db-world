import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Constants from '../../../Constants';
import { adminSearchRecord, mirror } from '../../../ApiServices';
import { motion } from 'framer-motion';
import {
    Box,
    Button,
    Paper,
    Typography,
    CircularProgress,
    Chip,
    Autocomplete,
    TextField,
    Fade
} from '@mui/material';
import {
    Folder as FolderIcon,
    Download as DownloadIcon
} from '@mui/icons-material';
import { toast } from '../../../Toast';
import LinksManager from './LinksManager';
import SecurityOptions from './SecurityOptions';
import ProcessingOptions from './ProcessingOptions';
import QuickActions from './QuickActions';

function HttpFile({ onDownloadAdded }) {
    const [links, setLinks] = useState([{ url: "", rename: false, customName: "" }]);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [linkPasswordProtect, setLinkPasswordProtect] = useState(false);
    const [extract, setExtract] = useState(false);
    const [zipPassword, setZipPassword] = useState("");
    const [zipPasswordProtect, setZipPasswordProtect] = useState(false);
    const [submitLoader, setSubmitLoader] = useState(false);
    const [recordName, setRecordName] = useState("");
    const [recordList, setRecordList] = useState([]);

    const navigate = useNavigate();
    const location = useLocation();

    const onSubmit = async () => {
        try {
            const invalidLinks = links.filter(link =>
                link.url.includes("gdtot") || link.url.includes("drive.google.com")
            );

            if (invalidLinks.length > 0) {
                toast.error("Some links are not supported for cloning");
                return;
            }

            const validLinks = links.filter(link => link.url.trim() !== "");

            if (validLinks.length === 0) {
                toast.error("Please add at least one valid download link");
                return;
            }

            setSubmitLoader(true);

            // Prepare data for each link
            const downloadRequests = validLinks.map(link => ({
                urls: [link.url],
                username,
                password,
                folderName: recordName,
                fileName: link.rename ? link.customName : "",
                isRename: link.rename,
                isUrlProtected: linkPasswordProtect,
                isExtract: extract,
                extractPassword: zipPassword
            }));

            // Send requests in parallel
            const results = await Promise.all(downloadRequests.map(mirror));

            const successCount = results.filter(res => res.httpStatusCode === 200).length;

            if (successCount > 0) {
                toast.success(`Successfully added ${successCount} download${successCount !== 1 ? 's' : ''} to queue`);
                onDownloadAdded?.();

                // Reset form but keep one empty link
                setLinks([{ url: "", rename: false, customName: "" }]);
                setUsername("");
                setPassword("");
                setLinkPasswordProtect(false);
                setExtract(false);
                setZipPassword("");
                setZipPasswordProtect(false);
                setRecordName("");
            }

            // Handle individual errors
            results.forEach((res, index) => {
                if (res.httpStatusCode === 401) {
                    toast.error(res.message + Constants.RE_LOGIN, {
                        onClose: async () => {
                            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
                        },
                        autoClose: 1000
                    });
                } else if (res.httpStatusCode !== 200) {
                    toast.error(`Failed to add download ${index + 1}: ${res.message}`);
                }
            });

        } catch (err) {
            console.error(err);
            toast.error("Failed to process request");
        } finally {
            setSubmitLoader(false);
        }
    };

    const searchDbCinemaRecord = async () => {
        if (recordName && recordName.length > 2) {
            const response = await adminSearchRecord(recordName);
            if (response.httpStatusCode === 200) {
                setRecordList(response.data);
            }
        }
    };

    useEffect(() => {
        searchDbCinemaRecord();
    }, [recordName]);

    const getActiveOptionsCount = () => {
        let count = 0;
        if (linkPasswordProtect) count++;
        if (extract) count++;
        if (zipPasswordProtect) count++;

        // Count individual renames
        const renameCount = links.filter(link => link.rename && link.customName.trim()).length;
        count += renameCount;

        return count;
    };

    const clearForm = () => {
        setLinks([{ url: "", rename: false, customName: "" }]);
        setUsername("");
        setPassword("");
        setLinkPasswordProtect(false);
        setExtract(false);
        setZipPassword("");
        setZipPasswordProtect(false);
        setRecordName("");
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ margin: 0, padding: 0 }}
        >
            <Paper
                elevation={0}
                sx={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }}
            >
                <Box sx={{ p: 1 }}>
                    {/* Header Section */}
                    <Box sx={{ mb: 3, textAlign: 'center' }}>
                        <Typography
                            variant="h5"
                            fontWeight="700"
                            color="#2c3e50"
                            gutterBottom
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1
                            }}
                        >
                            <DownloadIcon sx={{ fontSize: 28, color: '#007bff' }} />
                            HTTP File Download
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Add HTTP file links to download queue
                        </Typography>
                    </Box>

                    {/* Active Options Counter */}
                    <Box sx={{ mb: 3, textAlign: 'center' }}>
                        <Chip
                            label={`${getActiveOptionsCount()} active option${getActiveOptionsCount() !== 1 ? 's' : ''}`}
                            color="primary"
                            variant="filled"
                            sx={{
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                py: 1
                            }}
                        />
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                        {/* Left Column */}
                        <Box>
                            {/* Record Selection */}
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
                                    <FolderIcon sx={{ color: '#007bff' }} />
                                    Destination Folder
                                </Typography>
                                <Autocomplete
                                    fullWidth
                                    freeSolo
                                    options={recordList.map((item) => ({
                                        label: `${item.recordId}-${item.name} (${item.type})`,
                                        value: `${item.recordId}-${item.name}`
                                    }))}

                                    // Clean on input
                                    onInputChange={(_, value) => {
                                        if (!value) return setRecordName('');
                                        const cleaned = value.replace(/\s*\(.*?\)\s*$/, '').trim();
                                        setRecordName(cleaned);
                                    }}

                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder="Select or type record name..."
                                            variant="outlined"
                                            size="small"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '8px',
                                                    background: 'white'
                                                }
                                            }}
                                        />
                                    )}

                                    getOptionLabel={(option) => option.label || option}
                                />
                            </Paper>

                            {/* Links Manager */}
                            <LinksManager
                                links={links}
                                onLinksChange={setLinks}
                            />
                        </Box>

                        {/* Right Column */}
                        <Box>
                            {/* Security Options */}
                            <SecurityOptions
                                linkPasswordProtect={linkPasswordProtect}
                                onLinkPasswordProtectChange={setLinkPasswordProtect}
                                username={username}
                                onUsernameChange={setUsername}
                                password={password}
                                onPasswordChange={setPassword}
                                zipPasswordProtect={zipPasswordProtect}
                                onZipPasswordProtectChange={setZipPasswordProtect}
                                zipPassword={zipPassword}
                                onZipPasswordChange={setZipPassword}
                            />

                            {/* Processing Options */}
                            <ProcessingOptions
                                extract={extract}
                                onExtractChange={setExtract}
                            />

                            {/* Quick Actions */}
                            <QuickActions
                                onSubmit={onSubmit}
                                onClear={clearForm}
                                submitLoader={submitLoader}
                                hasValidLinks={links.some(link => link.url.trim() !== "")}
                            />
                        </Box>
                    </Box>
                </Box>
            </Paper>
        </motion.div>
    );
}

export default HttpFile;