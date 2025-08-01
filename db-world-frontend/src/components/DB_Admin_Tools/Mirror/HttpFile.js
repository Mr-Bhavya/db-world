import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Constants from '../../Constants';
import { adminSearchRecord, mirror } from '../../ApiServices';
import { motion } from 'framer-motion';
import {
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormLabel,
    Grid,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    TextField,
    Typography,
    CircularProgress,
    Divider,
    Chip,
    Autocomplete
} from '@mui/material';
import { toast } from '../../Toast';

function HttpFile() {
    const [links, setLinks] = useState([""]);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [linkPasswordProtect, setLinkPasswordProtect] = useState(false);
    const [title, setTitle] = useState("");
    const [extract, setExtract] = useState(false);
    const [zipPassword, setZipPassword] = useState("");
    const [zipPasswordProtect, setZipPasswordProtect] = useState(false);
    const [rename, setRename] = useState(false);
    const [submitLoader, setSubmitLoader] = useState(false);
    const [recordName, setRecordName] = useState("");
    const [recordList, setRecordList] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();

    const onSubmit = async () => {
        try {
            const invalidLinks = links.filter(link =>
                link.includes("gdtot") || link.includes("drive.google.com")
            );

            if (invalidLinks.length > 0) {
                toast.error("Some links are not supported for cloning");
                return;
            }

            setSubmitLoader(true);
            const mirrorRes = await mirror({
                urls: links.filter(link => link.trim() !== ""),
                username,
                password,
                folderName: recordName,
                fileName: title,
                isRename: rename,
                isUrlProtected: linkPasswordProtect,
                isExtract: extract,
                extractPassword: zipPassword
            });

            if (mirrorRes.httpStatusCode === 200) {
                toast.success(mirrorRes.message);
            } else if (mirrorRes.httpStatusCode === 401) {
                toast.error(mirrorRes.message + Constants.RE_LOGIN, {
                    onClose: async () => {
                        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
                    },
                    autoClose: 1000
                });
            } else {
                toast.error(mirrorRes.message);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to process request");
        } finally {
            setSubmitLoader(false);
        }
    };

    const searchDbCinemaRecord = async () => {
        const response = await adminSearchRecord(recordName);
        if (response.httpStatusCode === 200) {
            setRecordList(response.data);
        }
    };

    useEffect(() => {
        if (recordName && recordName.length > 2) {
            searchDbCinemaRecord();
        }
    }, [recordName]);

    const handleAddLink = () => {
        setLinks([...links, ""]);
    };

    const handleRemoveLink = (index) => {
        if (links.length > 1) {
            const newLinks = [...links];
            newLinks.splice(index, 1);
            setLinks(newLinks);
        }
    };

    const handleLinkChange = (index, value) => {
        const newLinks = [...links];
        newLinks[index] = value;
        setLinks(newLinks);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{ margin: '0px', padding: '0px' }}
        >
            <Card sx={{
                maxWidth: 1000,
                margin: '0px auto',
                mt: 4,
                border: '1px solid teal',
                background: 'rgba(255, 255, 255, 0.85)',
                p: 1,
            }}>
                <CardContent >
                    {/* <Typography variant="h4" component="h1" align="center" gutterBottom>
                        
                    </Typography> */}

                    <Grid container spacing={1} style={{ justifyContent: 'center' }}>
                        {/* Left Column */}
                        <Grid item xs={12} md={6}>
                            {/* Record selection */}
                            <Box sx={{ mb: 3 }}>
                                <Autocomplete
                                    fullWidth
                                    freeSolo
                                    options={recordList.map((item) => ({
                                        label: item.recordId + "-" + item.name,
                                        value: item.recordId + "-" + item.name
                                    }))}
                                    onInputChange={(_, value) => setRecordName(value)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Select or Type record"
                                            variant="outlined"
                                        />
                                    )}
                                    getOptionLabel={(option) => option.label || option}
                                />
                            </Box>

                            {/* Download links - Now scrollable when many links */}
                            <Box sx={{
                                mb: 3,
                                maxHeight: '300px',
                                overflowY: 'auto',
                                pr: 1
                            }}>
                                <FormControl fullWidth>
                                    <FormLabel>Download Links</FormLabel>
                                    {links.map((link, index) => (
                                        <Box key={index} sx={{
                                            display: 'flex',
                                            flexDirection: { xs: 'column', sm: 'row' },
                                            gap: 1,
                                            mb: 1
                                        }}>
                                            <TextField
                                                fullWidth
                                                variant="outlined"
                                                value={link}
                                                onChange={(e) => handleLinkChange(index, e.target.value)}
                                                placeholder="Enter Download Link"
                                            />
                                            {links.length > 1 && (
                                                <Button
                                                    variant="outlined"
                                                    color="error"
                                                    onClick={() => handleRemoveLink(index)}
                                                    sx={{ minWidth: '100px' }}
                                                >
                                                    Remove
                                                </Button>
                                            )}
                                        </Box>
                                    ))}
                                    <Button
                                        variant="outlined"
                                        onClick={handleAddLink}
                                        sx={{ mt: 1 }}
                                    >
                                        Add Another Link
                                    </Button>
                                </FormControl>
                            </Box>

                            {/* Link Protection - Now properly nested */}
                            <Box sx={{
                                mb: 3,
                                p: 3,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 2,
                                // backgroundColor: 'background.paper'
                            }}>
                                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                                    File Options
                                </Typography>

                                {/* Link Protection */}
                                <Box sx={{ mb: 2 }}>
                                    <FormGroup>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={linkPasswordProtect}
                                                    onChange={() => setLinkPasswordProtect(!linkPasswordProtect)}
                                                />
                                            }
                                            label="Link is password protected"
                                        />
                                    </FormGroup>

                                    {linkPasswordProtect && (
                                        <Box sx={{ ml: 4, mt: 1 }}>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} md={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Username"
                                                        variant="outlined"
                                                        size="small"
                                                        value={username}
                                                        onChange={(e) => setUsername(e.target.value)}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} md={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Password"
                                                        type="password"
                                                        variant="outlined"
                                                        size="small"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                    />
                                                </Grid>
                                            </Grid>
                                        </Box>
                                    )}
                                </Box>

                                {/* Rename */}
                                <Box>
                                    <FormGroup>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={rename}
                                                    onChange={() => setRename(!rename)}
                                                />
                                            }
                                            label="Rename File"
                                        />
                                    </FormGroup>
                                    {rename && (
                                        <Box sx={{ ml: 4, mt: 1 }}>
                                            <TextField
                                                fullWidth
                                                label="File Name"
                                                variant="outlined"
                                                size="small"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                            />
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Grid>

                        {/* Right Column */}
                        <Grid item xs={12} md={6}>
                            {/* Extraction section moved to right */}
                            <Box sx={{
                                p: 2,
                                border: '1px solid #e0e0e0',
                                borderRadius: 1,
                                mb: 3
                            }}>
                                <FormControl component="fieldset" fullWidth>
                                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                                        File Extraction Options
                                    </Typography>

                                    <RadioGroup
                                        value={extract}
                                        onChange={(e) => setExtract(e.target.value === 'true')}
                                    >
                                        <FormControlLabel
                                            value={true}
                                            control={<Radio />}
                                            label="Extract files after download"
                                        />
                                        <FormControlLabel
                                            value={false}
                                            control={<Radio />}
                                            label="Keep files as-is"
                                        />
                                    </RadioGroup>
                                </FormControl>

                                {extract && (
                                    <Box sx={{ mt: 2 }}>
                                        <FormGroup>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={zipPasswordProtect}
                                                        onChange={() => setZipPasswordProtect(!zipPasswordProtect)}
                                                    />
                                                }
                                                label="Archive is password protected"
                                            />
                                        </FormGroup>

                                        {zipPasswordProtect && (
                                            <Box sx={{ ml: 3, mt: 1 }}>
                                                <TextField
                                                    fullWidth
                                                    label="Archive Password"
                                                    type="password"
                                                    variant="outlined"
                                                    value={zipPassword}
                                                    onChange={(e) => setZipPassword(e.target.value)}
                                                />
                                            </Box>
                                        )}
                                    </Box>
                                )}
                            </Box>
                        </Grid>

                        <Grid item xs={12} style={{ alignContent: 'flex-end' }}>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'flex-end', // Aligns content to the right
                                mt: 2, // Margin top for spacing

                            }}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={onSubmit}
                                    disabled={submitLoader}
                                    size="large"
                                    sx={{
                                        width: { xs: '100%', sm: 'auto' }, // Full width on mobile, auto on desktop
                                        minWidth: '120px', // Ensures consistent width
                                        height: '48px'
                                    }}
                                >
                                    {submitLoader ? (
                                        <>
                                            <CircularProgress size={24} color="inherit" />
                                            <Box component="span" sx={{ ml: 2 }}>Processing...</Box>
                                        </>
                                    ) : (
                                        'Submit'
                                    )}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
            
        </motion.div>
    );
}

export default HttpFile;