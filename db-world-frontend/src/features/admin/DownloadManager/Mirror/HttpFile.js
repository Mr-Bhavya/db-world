import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Constants from '@shared/constants';
import { adminSearchRecord, mirror } from '@shared/services/ApiServices';
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
    Alert,
    Stack,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    Folder as FolderIcon,
    Download as DownloadIcon,
    Refresh,
    ClearAll,
    AddLink,
    CheckCircle,
    Error
} from '@mui/icons-material';
import { toast } from '@shared/components/ui/Toast';
import LinksManager from './LinksManager';
import SecurityOptions from './SecurityOptions';
import ProcessingOptions from './ProcessingOptions';

// Animation variants
const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
};

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
    const [searchTimeout, setSearchTimeout] = useState(null);

    const navigate = useNavigate();
    const location = useLocation();

    // Calculate active options count
    const activeOptionsCount = useMemo(() => {
        let count = 0;
        if (linkPasswordProtect) count++;
        if (extract) count++;
        if (zipPasswordProtect) count++;

        const renameCount = links.filter(link => link.rename && link.customName.trim()).length;
        count += renameCount;

        return count;
    }, [linkPasswordProtect, extract, zipPasswordProtect, links]);

    // Count valid links
    const validLinksCount = useMemo(() => {
        return links.filter(link => link.url.trim() !== "").length;
    }, [links]);

    // Validate links
    const hasInvalidLinks = useMemo(() => {
        return links.some(link => 
            link.url.includes("gdtot") || 
            link.url.includes("drive.google.com")
        );
    }, [links]);

    // Search records with debounce
    const searchDbCinemaRecord = useCallback((searchTerm) => {
        if (searchTerm && searchTerm.length > 2) {
            clearTimeout(searchTimeout);
            const timeout = setTimeout(async () => {
                try {
                    const response = await adminSearchRecord(searchTerm);
                    if (response.httpStatusCode === 200) {
                        setRecordList(response.data);
                    }
                } catch (error) {
                    console.error('Search error:', error);
                }
            }, 300);
            setSearchTimeout(timeout);
        }
    }, [searchTimeout]);

    // Handle record name change
    const handleRecordNameChange = useCallback((e) => {
        console.log("Record Name Changed:", e);
        setRecordName(e?.value || "");
        searchDbCinemaRecord(e);
    }, [searchDbCinemaRecord]);

    // Handle form submission
    const onSubmit = useCallback(async () => {
        try {
            if (hasInvalidLinks) {
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
                // uris: [link.url],
                uri: link.url,
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
                toast.success(`Added ${successCount} download${successCount !== 1 ? 's' : ''} to queue`);
                onDownloadAdded?.();

                // Reset form
                setLinks([{ url: "", rename: false, customName: "" }]);
                setUsername("");
                setPassword("");
                setLinkPasswordProtect(false);
                setExtract(false);
                setZipPassword("");
                setZipPasswordProtect(false);
                setRecordName("");
            }

            // Handle errors
            results.forEach((res, index) => {
                if (res.httpStatusCode === 401 || res.httpStatusCode === 403) {
                    navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
                } else if (res.httpStatusCode !== 200) {
                    toast.error(`Download ${index + 1}: ${res.message}`);
                }
            });

        } catch (err) {
            console.error(err);
            toast.error("Failed to process request");
        } finally {
            setSubmitLoader(false);
        }
    }, [
        links, username, password, recordName, linkPasswordProtect, extract, zipPassword,
        hasInvalidLinks, navigate, location, onDownloadAdded
    ]);

    // Clear form
    const clearForm = useCallback(() => {
        setLinks([{ url: "", rename: false, customName: "" }]);
        setUsername("");
        setPassword("");
        setLinkPasswordProtect(false);
        setExtract(false);
        setZipPassword("");
        setZipPasswordProtect(false);
        setRecordName("");
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
        };
    }, [searchTimeout]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ margin: 0, padding: 0 }}
        >
            {/* Header Section */}
            <Stack spacing={1.5} sx={{ mb: 3 }}>
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.5,
                    flexWrap: 'wrap' 
                }}>
                    <DownloadIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight="600">
                        HTTP File Download
                    </Typography>
                    <Chip
                        size="small"
                        label={`${validLinksCount} link${validLinksCount !== 1 ? 's' : ''}`}
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 500 }}
                    />
                </Box>
                
                {hasInvalidLinks && (
                    <Alert severity="warning" sx={{ py: 0.5 }}>
                        Some links are not supported for cloning
                    </Alert>
                )}

                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    flexWrap: 'wrap' 
                }}>
                    <Chip
                        size="small"
                        icon={<CheckCircle fontSize="small" />}
                        label={`${activeOptionsCount} active option${activeOptionsCount !== 1 ? 's' : ''}`}
                        color={activeOptionsCount > 0 ? "primary" : "default"}
                        variant="filled"
                        sx={{ fontWeight: 500, fontSize: '0.75rem' }}
                    />
                </Box>
            </Stack>

            {/* Main Form Grid */}
            <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                gap: 2.5 
            }}>
                {/* Left Column */}
                <Stack spacing={2.5}>
                    {/* Record Selection */}
                    <Paper
                        variant="outlined"
                        sx={{ p: 2, borderRadius: 2 }}
                    >
                        <Stack spacing={1.5}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FolderIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                <Typography variant="subtitle1" fontWeight="600">
                                    Destination Folder
                                </Typography>
                            </Box>
                            
                            <Autocomplete
                                freeSolo
                                size="small"
                                options={recordList.map((item) => ({
                                    label: `${item.recordId}-${item.name}`,
                                    value: `${item.recordId}-${item.name}`,
                                    type: item.type
                                }))}
                                value={recordName}
                                onChange={(_, value) => handleRecordNameChange(value || '')}
                                onInputChange={(_, value) => handleRecordNameChange(value)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Select or type folder name..."
                                        variant="outlined"
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: 1.5
                                            }
                                        }}
                                    />
                                )}
                                renderOption={(props, option) => (
                                    <Box component="li" {...props}>
                                        <Stack direction="row" justifyContent="space-between" width="100%">
                                            <Typography variant="body2">
                                                {option.label}
                                            </Typography>
                                            <Chip
                                                label={option.type}
                                                size="small"
                                                variant="outlined"
                                                sx={{ ml: 1, fontSize: '0.625rem' }}
                                            />
                                        </Stack>
                                    </Box>
                                )}
                            />
                        </Stack>
                    </Paper>

                    {/* Links Manager */}
                    <LinksManager
                        links={links}
                        onLinksChange={setLinks}
                    />
                </Stack>

                {/* Right Column */}
                <Stack spacing={2.5}>
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

                    {/* Action Buttons */}
                    <Paper
                        variant="outlined"
                        sx={{ p: 2, borderRadius: 2 }}
                    >
                        <Stack spacing={1.5}>
                            <Typography variant="subtitle2" fontWeight="600" color="text.secondary">
                                Submit Download
                            </Typography>
                            
                            <Stack direction="row" spacing={1.5}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={onSubmit}
                                    disabled={submitLoader || validLinksCount === 0}
                                    startIcon={
                                        submitLoader ? 
                                        <CircularProgress size={16} color="inherit" /> : 
                                        <AddLink />
                                    }
                                    sx={{
                                        borderRadius: 1.5,
                                        py: 1.25,
                                        fontWeight: 600
                                    }}
                                >
                                    {submitLoader ? 'Adding...' : `Add ${validLinksCount} Download${validLinksCount !== 1 ? 's' : ''}`}
                                </Button>

                                <Tooltip title="Clear Form">
                                    <IconButton
                                        onClick={clearForm}
                                        disabled={submitLoader}
                                        sx={{
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1.5,
                                            width: 48,
                                            height: 48
                                        }}
                                    >
                                        <ClearAll />
                                    </IconButton>
                                </Tooltip>
                            </Stack>

                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 1,
                                pt: 1
                            }}>
                                <Typography variant="caption" color="text.secondary">
                                    {validLinksCount === 0 ? 'Add links to enable submit' : 'Ready to submit'}
                                </Typography>
                                
                                {validLinksCount > 0 && (
                                    <Chip
                                        size="small"
                                        label={`${validLinksCount} valid link${validLinksCount !== 1 ? 's' : ''}`}
                                        color="success"
                                        variant="outlined"
                                        sx={{ fontSize: '0.625rem' }}
                                    />
                                )}
                            </Box>
                        </Stack>
                    </Paper>
                </Stack>
            </Box>

            {/* Quick Stats Footer */}
            <Box sx={{ 
                mt: 3, 
                pt: 2, 
                borderTop: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1
            }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Chip
                        size="small"
                        label={`Links: ${validLinksCount}`}
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                    />
                    <Chip
                        size="small"
                        label={`Options: ${activeOptionsCount}`}
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                    />
                </Stack>

                <Typography variant="caption" color="text.secondary">
                    HTTP File Download Manager
                </Typography>
            </Box>
        </motion.div>
    );
}

export default React.memo(HttpFile);