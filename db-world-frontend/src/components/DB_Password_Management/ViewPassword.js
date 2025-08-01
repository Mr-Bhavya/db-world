import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    Collapse,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    ListItemText,
    Paper,
    TextField,
    Typography,
    Tooltip,
    useTheme
} from '@mui/material';
import {
    Search as SearchIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ContentCopy as CopyIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import Constants from '../Constants';
import { deleteCredentialByCredentialId, deleteHostById, getCredential, updateCredential } from '../ApiServices';
import { teal } from '@mui/material/colors';
import { max } from 'rxjs';
import CommonServices from '../CommonServices';
import { toast } from '../Toast';

const ViewPassword = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [credentialsCache, setCredentialsCache] = useState([]);
    const [credentials, setCredentials] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeletingHost, setIsDeletingHost] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openDeleteHostDialog, setOpenDeleteHostDialog] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formCredential, setFormCredential] = useState({
        pmId: null,
        host: null,
        credentialId: null,
        username: null,
        password: null,
        pin: null,
        notes: null
    });

    // Style for dark background
    const darkBackgroundStyle = {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        color: '#ffffff',
        minHeight: '100vh',
        padding: theme.spacing(4)
    };

    const cardStyle = {
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        color: '#000000',
        transition: 'all 0.3s ease',
        '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[6]
        }
    };

    const handleInputChange = (e) => {
        setFormCredential({
            ...formCredential,
            [e.target.name]: e.target.value
        });
    };

    const resetFormCredential = () => {
        setFormCredential({
            pmId: null,
            host: null,
            credentialId: null,
            username: null,
            password: null,
            pin: null,
            notes: null
        });
        setShowPassword(false);
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const handleUpdateCredential = async (e) => {
        e.preventDefault();
        setIsUpdating(true);
        const { credentialId, pmId, host, username, password, pin, notes } = formCredential;
        const processedPin = pin === "" ? null : pin;

        try {
            const updateCredentialRes = await updateCredential(pmId, {
                id: credentialId,
                url: `https://${host}`,
                username,
                password,
                pin: processedPin,
                notes
            });

            if (updateCredentialRes.httpStatusCode === 200) {
                toast.success(updateCredentialRes.message);
                await getUserCredentials();
                setOpenEditDialog(false);
            } else if (updateCredentialRes.httpStatusCode === 401) {
                toast.error(updateCredentialRes.message, {
                    autoClose: 1000,
                    onClose: () => navigate(Constants.LOGIN_ROUTE, { state: { from: location } })
                });
            } else {
                toast.error(updateCredentialRes.message);
            }
        } catch (error) {
            toast.error("An error occurred while updating credential");
        } finally {
            setIsUpdating(false);
        }
    };

    const getUserCredentials = async () => {
        setIsFetching(true);
        try {
            const getCredentialRes = await getCredential();
            if (getCredentialRes.httpStatusCode === 200) {
                setCredentialsCache(getCredentialRes.data);
                setCredentials(getCredentialRes.data);
            } else if (getCredentialRes.httpStatusCode === 401) {
                navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
            } else {
                toast.error(getCredentialRes.message);
            }
        } catch (error) {
            toast.error("Failed to fetch credentials");
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (!query) {
            setCredentials(credentialsCache);
            return;
        }

        const filtered = credentialsCache.filter(({ host, credentials }) =>
            host.toLowerCase().includes(query.toLowerCase()) ||
            credentials.some(({ username }) => username.toLowerCase().includes(query.toLowerCase()))
        );
        setCredentials(filtered);
    };

    const handleDeleteCredential = async () => {
        setIsDeleting(true);
        try {
            const deleteCredentialRes = await deleteCredentialByCredentialId(formCredential?.credentialId);
            if (deleteCredentialRes.httpStatusCode === 200) {
                toast.success(deleteCredentialRes.message);
                await getUserCredentials();
                setOpenDeleteDialog(false);
            } else if (deleteCredentialRes.httpStatusCode === 401) {
                navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
            } else {
                toast.error(deleteCredentialRes.message);
            }
        } catch (error) {
            toast.error("An error occurred while deleting credential");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteHost = async () => {
        setIsDeletingHost(true);
        try {
            const deleteHostRes = await deleteHostById(formCredential.pmId);
            if (deleteHostRes.httpStatusCode === 200) {
                toast.success(deleteHostRes.message);
                await getUserCredentials();
                setOpenDeleteHostDialog(false);
            } else if (deleteHostRes.status === 401) {
                navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
            } else {
                toast.error(deleteHostRes.message);
            }
        } catch (error) {
            toast.error("An error occurred while deleting host");
        } finally {
            setIsDeletingHost(false);
        }
    };

    const copyToClipboard = (text) => {
        const result = CommonServices.handleCopy(text);
        if (result.success) {
            toast.success(result.message);
        } else {
            toast.error(result.message);
        }
    };

    useEffect(() => {
        getUserCredentials();
    }, []);

    const CredentialItem = ({ credential, host, pmId }) => {
        const [expanded, setExpanded] = useState(false);
        const { id, username, password, pin, notes } = credential;

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                <Paper elevation={2} sx={{ ...cardStyle, mb: 1 }}>
                    <ListItem
                        alignItems="flex-start"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => setExpanded(!expanded)}
                    >
                        <ListItemText
                            sx={{ maxWidth: '100%' }}
                            primary={
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Typography variant="subtitle1" sx={{ flex: 1 }} noWrap>
                                        {username}
                                    </Typography>
                                    <IconButton edge="end" size="small" sx={{ ml: 1, color: 'teal' }}>
                                        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                    </IconButton>
                                </Box>
                            }
                        />
                    </ListItem>

                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Divider />
                        <Box sx={{ p: 2 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="body2">
                                        <strong>Username:</strong> {username}
                                        <Tooltip title="Copy username">
                                            <IconButton size="small" onClick={() => copyToClipboard(username)} style={{ color: 'teal' }}>
                                                <CopyIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Typography>
                                    <Typography variant="body2">
                                        <strong>Password:</strong> {password}
                                        <Tooltip title="Copy password">
                                            <IconButton size="small" onClick={() => copyToClipboard(password)} style={{ color: 'teal' }}>
                                                <CopyIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    {pin && (
                                        <Typography variant="body2">
                                            <strong>Pin:</strong> {pin}
                                            <Tooltip title="Copy pin">
                                                <IconButton size="small" onClick={() => copyToClipboard(pin)} style={{ color: 'teal' }}>
                                                    <CopyIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Typography>
                                    )}
                                    {notes && (
                                        <Typography variant="body2">
                                            <strong>Notes:</strong> {notes}
                                        </Typography>
                                    )}
                                </Grid>
                            </Grid>

                            {/* Action buttons (Edit/Delete) inside collapse */}
                            <Box mt={2} display="flex" justifyContent="flex-end" gap={1}>
                                <Tooltip title="Edit">
                                    <IconButton
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFormCredential({ host, username, password, pin, notes, credentialId: id, pmId });
                                            setOpenEditDialog(true);
                                        }}
                                    >
                                        <EditIcon color="primary" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                    <IconButton
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFormCredential({ host, username, password, pin, notes, credentialId: id, pmId });
                                            setOpenDeleteDialog(true);
                                        }}
                                    >
                                        <DeleteIcon color="error" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    </Collapse>
                </Paper>
            </motion.div>
        );
    };


    const HostCard = ({ hostData, index, sx }) => {
        const { id: pmId, host, credentials } = hostData;

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                style={{ width: '100%', height: '100%' }}
            >
                <Card sx={{
                    ...cardStyle,
                    mb: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    ...sx
                }}>
                    <CardHeader
                        avatar={
                            <img
                                src={`https://t1.gstatic.com/faviconV2?client=PASSWORD_MANAGER&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=32&url=https%3A%2F%2F${host}`}
                                alt={host}
                                style={{ width: 32, height: 32 }}
                            />
                        }
                        action={
                            <Tooltip title="Delete host and all credentials">
                                <IconButton
                                    color="error"
                                    onClick={() => {
                                        setFormCredential({ host, pmId });
                                        setOpenDeleteHostDialog(true);
                                    }}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </Tooltip>
                        }
                        title={
                            <Typography variant="h6" component="div">
                                {host}
                            </Typography>
                        }
                    />
                    <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
                        <List sx={{ maxHeight: '300px', overflow: 'auto' }}>
                            {credentials.map((credential, idx) => (
                                <CredentialItem
                                    key={idx}
                                    credential={credential}
                                    host={host}
                                    pmId={pmId}
                                />
                            ))}
                        </List>
                    </CardContent>
                </Card>
            </motion.div>
        );
    };

    return (
        <Box sx={darkBackgroundStyle} style={{
            padding: '10px', margin: '10px auto',
            maxWidth: 1500
        }} >
            <Container style={{ padding: '0px', margin: '0px', maxWidth: '100%' }}>
                <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
                    <Button
                        variant="contained"
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate(Constants.DB_PASSWORD_MANAGER_ROUTE)}
                        sx={{ mr: 2 }}
                    >
                        Back
                    </Button>
                    <Typography variant="h4" component="h1" sx={{ flexGrow: 1, color: 'black' }}>
                        View Credentials
                    </Typography>
                </Box>

                <Divider sx={{ mb: 4, backgroundColor: 'rgba(0, 0, 0, 0.9)' }} />

                {/* <Grid item xs={12} md={6} lg={6}> */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        mb: 4,
                        mx: 'auto',
                    }}
                >

                    <TextField

                        // fullWidth
                        variant="outlined"
                        placeholder="Search by host or username..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                            sx: {
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                color: 'white',
                                minWidth: '300px',
                                maxWidth: '400px',
                            },
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                    borderColor: 'rgba(0, 0, 0, 0.23)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(0, 0, 0, 0.5)',
                                },
                            },
                        }}
                    />
                </Box>
                {/* </Grid> */}


                {isFetching ? (
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                        <CircularProgress color="primary" />
                        <Typography variant="body1" sx={{ ml: 2, color: 'black' }}>
                            Loading credentials...
                        </Typography>
                    </Box>
                ) : loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                        <CircularProgress color="primary" />
                    </Box>
                ) : (
                    <Grid container spacing={2} sx={{ justifyContent: 'center' }}>
                        {credentials.length > 0 ? (
                            credentials.map((hostData, index) => (
                                <Grid
                                    item
                                    key={hostData.id}
                                    sx={{
                                        width: { xs: '100%', sm: '45%', md: '30%' },
                                        minWidth: '300px',
                                        maxWidth: '400px',
                                        height: '100%',
                                        display: 'flex'
                                    }}
                                >
                                    <HostCard
                                        hostData={hostData}
                                        index={index}
                                        sx={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    />
                                </Grid>
                            ))
                        ) : (
                            <Grid item xs={12}>
                                <Paper elevation={3} sx={{ ...cardStyle, p: 4, textAlign: 'center' }}>
                                    <Typography variant="h6">No credentials found</Typography>
                                </Paper>
                            </Grid>
                        )}
                    </Grid>
                )}

                {/* Edit Credential Dialog */}

                <Dialog
                    open={openEditDialog}
                    onClose={() => !isUpdating && setOpenEditDialog(false)}
                    maxWidth="sm"
                    fullWidth
                    PaperProps={{
                        sx: {
                            backgroundColor: 'white',
                            color: 'black',
                            borderRadius: 3,
                            boxShadow: 6,
                            border: `2px solid ${teal[500]}`,
                        }
                    }}
                >
                    <DialogTitle sx={{
                        color: 'black',
                        fontWeight: 'bold',
                        backgroundColor: teal[100],
                        borderBottom: `1px solid ${teal[300]}`,
                        padding: '16px 24px'
                    }}>
                        Update Credential
                    </DialogTitle>

                    <DialogContent dividers sx={{ backgroundColor: 'white' }}>
                        <Grid container spacing={2}>
                            {/* Host (disabled) */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Host"
                                    name="host"
                                    value={formCredential.host || ''}
                                    disabled
                                    sx={{
                                        '& .MuiInputLabel-root': {
                                            color: teal[800],
                                            fontWeight: '500',
                                            '&.Mui-disabled': {
                                                color: teal[600] // Slightly lighter when disabled
                                            }
                                        },
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: teal[300],
                                            },
                                            '&:hover fieldset': {
                                                borderColor: teal[500],
                                            },
                                            '&.Mui-disabled': {
                                                '& fieldset': {
                                                    borderColor: teal[200],
                                                },
                                                '& input': {
                                                    color: 'black !important',
                                                    WebkitTextFillColor: 'black !important',
                                                },
                                                backgroundColor: teal[50],
                                            }
                                        },
                                    }}
                                />
                            </Grid>

                            {/* Username (disabled) */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Username"
                                    name="username"
                                    value={formCredential.username || ''}
                                    disabled
                                    sx={{
                                        '& .MuiInputLabel-root': {
                                            color: teal[800],
                                            fontWeight: '500',
                                            '&.Mui-disabled': {
                                                color: teal[600]
                                            }
                                        },
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: teal[300],
                                            },
                                            '&:hover fieldset': {
                                                borderColor: teal[500],
                                            },
                                            '&.Mui-disabled': {
                                                '& fieldset': {
                                                    borderColor: teal[200],
                                                },
                                                '& input': {
                                                    color: 'black !important',
                                                    WebkitTextFillColor: 'black !important',
                                                },
                                                backgroundColor: teal[50],
                                            }
                                        },
                                    }}
                                />
                            </Grid>

                            {/* Password with toggle */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    value={formCredential.password || ''}
                                    onChange={handleInputChange}
                                    sx={{
                                        '& .MuiInputLabel-root': {
                                            color: teal[800],
                                            fontWeight: '500'
                                        },
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: teal[300],
                                            },
                                            '&:hover fieldset': {
                                                borderColor: teal[500],
                                            },
                                            '& input': {
                                                color: 'black'
                                            }
                                        },
                                    }}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={togglePasswordVisibility}
                                                    sx={{ color: teal[700] }}
                                                >
                                                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>

                            {/* Optional PIN */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Pin (optional)"
                                    name="pin"
                                    value={formCredential.pin || ''}
                                    onChange={handleInputChange}
                                    sx={{
                                        '& .MuiInputLabel-root': {
                                            color: teal[800],
                                            fontWeight: '500'
                                        },
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: teal[300],
                                            },
                                            '&:hover fieldset': {
                                                borderColor: teal[500],
                                            },
                                            '& input': {
                                                color: 'black'
                                            }
                                        },
                                    }}
                                />
                            </Grid>

                            {/* Optional Notes */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Notes (optional)"
                                    name="notes"
                                    multiline
                                    rows={3}
                                    value={formCredential.notes || ''}
                                    onChange={handleInputChange}
                                    sx={{
                                        '& .MuiInputLabel-root': {
                                            color: teal[800],
                                            fontWeight: '500'
                                        },
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': {
                                                borderColor: teal[300],
                                            },
                                            '&:hover fieldset': {
                                                borderColor: teal[500],
                                            },
                                            '& textarea': {
                                                color: 'black'
                                            }
                                        },
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>

                    <DialogActions sx={{
                        backgroundColor: teal[50],
                        borderTop: `1px solid ${teal[300]}`,
                        padding: '16px 24px'
                    }}>
                        <Button
                            onClick={() => setOpenEditDialog(false)}
                            disabled={isUpdating}
                            sx={{
                                color: teal[800],
                                border: `1px solid ${teal[800]}`,
                                fontWeight: 'bold',
                                '&:hover': {
                                    backgroundColor: teal[100],
                                },
                                '&:disabled': {
                                    color: teal[300],
                                    borderColor: teal[300]
                                }
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleUpdateCredential}
                            disabled={isUpdating}
                            startIcon={isUpdating ? <CircularProgress size={20} color="inherit" /> : null}
                            sx={{
                                backgroundColor: teal[700],
                                color: 'white',
                                fontWeight: 'bold',
                                '&:hover': {
                                    backgroundColor: teal[900]
                                },
                                '&:disabled': {
                                    backgroundColor: teal[300]
                                }
                            }}
                        >
                            {isUpdating ? 'Updating...' : 'Save Changes'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete Credential Dialog */}
                <Dialog
                    open={openDeleteDialog}
                    onClose={() => !isDeleting && setOpenDeleteDialog(false)}
                    PaperProps={{
                        sx: { ...cardStyle, backgroundColor: 'white' }
                    }}
                >
                    <DialogTitle>Delete Credential</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to delete this credential?
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 2 }}>
                            <strong>Host:</strong> {formCredential.host}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Username:</strong> {formCredential.username}
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => setOpenDeleteDialog(false)}
                            disabled={isDeleting}
                            color="inherit"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleDeleteCredential}
                            disabled={isDeleting}
                            startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : null}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete Host Dialog */}
                <Dialog
                    open={openDeleteHostDialog}
                    onClose={() => !isDeletingHost && setOpenDeleteHostDialog(false)}
                    PaperProps={{
                        sx: cardStyle
                    }}
                >
                    <DialogTitle>Delete Host</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to delete this host and all its credentials?
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 2 }}>
                            <strong>Host:</strong> {formCredential.host}
                        </Typography>
                        <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                            Warning: This will permanently delete all credentials under this host.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => setOpenDeleteHostDialog(false)}
                            disabled={isDeletingHost}
                            color="inherit"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleDeleteHost}
                            disabled={isDeletingHost}
                            startIcon={isDeletingHost ? <CircularProgress size={20} color="inherit" /> : null}
                        >
                            {isDeletingHost ? 'Deleting...' : 'Delete Host'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
            
        </Box>
    );
};

export default ViewPassword;