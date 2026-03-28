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
    useTheme,
    alpha,
    Chip,
    Fade,
    Zoom
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
    ArrowBack as ArrowBackIcon,
    Security as SecurityIcon,
    VpnKey as KeyIcon,
    Lock as LockIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import Constants from '../Constants';
import { deleteCredentialByCredentialId, deleteHostById, getCredential, updateCredential } from '../ApiServices';
import { teal, red, blue, orange } from '@mui/material/colors';
import CommonServices from '../CommonServices';
import { toast } from '../Toast';

// Advanced Background Component
const AdvancedBackground = () => {
    const theme = useTheme();

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                overflow: 'hidden',
                background: `linear-gradient(135deg, 
                    ${alpha('#000428', 0.95)} 0%, 
                    ${alpha('#004e92', 0.9)} 50%, 
                    ${alpha('#000428', 0.95)} 100%)`,
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `
                        radial-gradient(circle at 15% 20%, ${alpha(teal[500], 0.15)} 0%, transparent 25%),
                        radial-gradient(circle at 85% 30%, ${alpha(blue[500], 0.15)} 0%, transparent 25%),
                        radial-gradient(circle at 25% 80%, ${alpha(red[500], 0.1)} 0%, transparent 20%),
                        radial-gradient(circle at 75% 75%, ${alpha(orange[500], 0.1)} 0%, transparent 20%)
                    `,
                    animation: 'pulse 8s ease-in-out infinite alternate'
                }
            }}
        >
            {/* Animated Particles */}
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    style={{
                        position: 'absolute',
                        width: Math.random() * 3 + 1,
                        height: Math.random() * 3 + 1,
                        background: [
                            alpha(teal[500], 0.6),
                            alpha(blue[500], 0.6),
                            alpha(red[500], 0.6),
                            alpha(orange[500], 0.6)
                        ][i % 4],
                        borderRadius: '50%',
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                    }}
                    animate={{
                        y: [0, -20, 0],
                        x: [0, Math.random() * 10 - 5, 0],
                        opacity: [0, 1, 0],
                    }}
                    transition={{
                        duration: Math.random() * 4 + 3,
                        repeat: Infinity,
                        delay: Math.random() * 5,
                    }}
                />
            ))}
        </Box>
    );
};

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

    const cardStyle = {
        background: alpha('#ffffff', 0.95),
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(teal[500], 0.2)}`,
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
            borderColor: alpha(teal[500], 0.4)
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

    const copyToClipboard = async (text) => {
        const result = await CommonServices.handleCopy(text);
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
                <Paper elevation={0} sx={{ ...cardStyle, mb: 1, border: `1px solid ${alpha(teal[200], 0.5)}` }}>
                    <ListItem
                        alignItems="flex-start"
                        sx={{
                            cursor: 'pointer',
                            '&:hover': {
                                backgroundColor: alpha(teal[50], 0.5)
                            }
                        }}
                        onClick={() => setExpanded(!expanded)}
                    >
                        <ListItemText
                            sx={{ maxWidth: '100%' }}
                            primary={
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <KeyIcon sx={{ color: teal[500], fontSize: 20 }} />
                                        <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600, color: 'black' }} noWrap>
                                            {username}
                                        </Typography>
                                    </Box>
                                    <motion.div
                                        animate={{ rotate: expanded ? 180 : 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <IconButton edge="end" size="small" sx={{ color: teal[500] }}>
                                            <ExpandMoreIcon />
                                        </IconButton>
                                    </motion.div>
                                </Box>
                            }
                        />
                    </ListItem>

                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Divider />
                        <Box sx={{ p: 2, color: 'black' }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80 }}>
                                            Username:
                                        </Typography>
                                        <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                                            {username}
                                        </Typography>
                                        <Tooltip title="Copy username">
                                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => copyToClipboard(username)}
                                                    sx={{ color: teal[500] }}
                                                >
                                                    <CopyIcon fontSize="small" />
                                                </IconButton>
                                            </motion.div>
                                        </Tooltip>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80 }}>
                                            Password:
                                        </Typography>
                                        <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                                            ••••••••
                                        </Typography>
                                        <Tooltip title="Copy password">
                                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => copyToClipboard(password)}
                                                    sx={{ color: teal[500] }}
                                                >
                                                    <CopyIcon fontSize="small" />
                                                </IconButton>
                                            </motion.div>
                                        </Tooltip>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    {pin && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 40 }}>
                                                PIN:
                                            </Typography>
                                            <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                                                {pin}
                                            </Typography>
                                            <Tooltip title="Copy pin">
                                                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => copyToClipboard(pin)}
                                                        sx={{ color: teal[500] }}
                                                    >
                                                        <CopyIcon fontSize="small" />
                                                    </IconButton>
                                                </motion.div>
                                            </Tooltip>
                                        </Box>
                                    )}
                                    {notes && (
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                Notes:
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                                                {notes}
                                            </Typography>
                                        </Box>
                                    )}
                                </Grid>
                            </Grid>

                            {/* Action buttons */}
                            <Box mt={2} display="flex" justifyContent="flex-end" gap={1}>
                                <Tooltip title="Edit credential">
                                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                        <IconButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFormCredential({ host, username, password, pin, notes, credentialId: id, pmId });
                                                setOpenEditDialog(true);
                                            }}
                                            sx={{
                                                color: blue[500],
                                                background: alpha(blue[50], 0.8),
                                                '&:hover': { background: alpha(blue[100], 0.8) }
                                            }}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                    </motion.div>
                                </Tooltip>
                                <Tooltip title="Delete credential">
                                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                        <IconButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFormCredential({ host, username, password, pin, notes, credentialId: id, pmId });
                                                setOpenDeleteDialog(true);
                                            }}
                                            sx={{
                                                color: red[500],
                                                background: alpha(red[50], 0.8),
                                                '&:hover': { background: alpha(red[100], 0.8) }
                                            }}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </motion.div>
                                </Tooltip>
                            </Box>
                        </Box>
                    </Collapse>
                </Paper>
            </motion.div>
        );
    };

    const HostCard = ({ hostData, index }) => {
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
                }}>
                    <CardHeader
                        avatar={
                            <motion.div whileHover={{ scale: 1.1 }}>
                                <img
                                    src={`https://t1.gstatic.com/faviconV2?client=PASSWORD_MANAGER&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=32&url=https%3A%2F%2F${host}`}
                                    alt={host}
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        border: `2px solid ${alpha(teal[500], 0.3)}`
                                    }}
                                    onError={(e) => {
                                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0iIzAwQkZBNSIvPgo8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiI+CiAgICBLZXkKPC90ZXh0Pgo8L3N2Zz4K';
                                    }}
                                />
                            </motion.div>
                        }
                        action={
                            <Tooltip title="Delete host and all credentials">
                                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                    <IconButton
                                        sx={{
                                            color: red[500],
                                            background: alpha(red[50], 0.8),
                                            '&:hover': { background: alpha(red[100], 0.8) }
                                        }}
                                        onClick={() => {
                                            setFormCredential({ host, pmId });
                                            setOpenDeleteHostDialog(true);
                                        }}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </motion.div>
                            </Tooltip>
                        }
                        title={
                            <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: teal[800] }}>
                                {host}
                            </Typography>
                        }
                        subheader={
                            <Chip
                                label={`${credentials.length} credential${credentials.length !== 1 ? 's' : ''}`}
                                size="small"
                                sx={{
                                    background: alpha(teal[500], 0.1),
                                    color: teal[700],
                                    fontWeight: 600
                                }}
                            />
                        }
                    />
                    <CardContent sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                        <List sx={{ maxHeight: 300, overflow: 'auto' }}>
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
        <Box sx={{
            minHeight: '100vh',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Advanced Background */}
            <AdvancedBackground />

            {/* Main Content */}
            <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Container maxWidth="xl" sx={{ py: 4, px: { xs: 2, sm: 3 } }}>
                    {/* Header Section */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Box sx={{
                            mb: 4,
                            display: 'flex',
                            alignItems: 'center',
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: 2
                        }}>
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                    variant="contained"
                                    startIcon={<ArrowBackIcon />}
                                    onClick={() => navigate(Constants.DB_PASSWORD_MANAGER_ROUTE)}
                                    sx={{
                                        mr: 2,
                                        background: `linear-gradient(135deg, ${teal[500]} 0%, ${teal[700]} 100%)`,
                                        borderRadius: 2,
                                        fontWeight: 600
                                    }}
                                >
                                    Back
                                </Button>
                            </motion.div>

                            <Box sx={{
                                flexGrow: 1,
                                textAlign: { xs: 'center', sm: 'left' },
                                background: alpha('#ffffff', 0.9),
                                backdropFilter: 'blur(10px)',
                                borderRadius: 3,
                                p: 3,
                                border: `1px solid ${alpha(teal[500], 0.2)}`
                            }}>
                                <Typography
                                    variant="h3"
                                    component="h1"
                                    sx={{
                                        fontWeight: 800,
                                        background: `linear-gradient(135deg, ${teal[500]} 0%, ${blue[500]} 100%)`,
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        fontSize: { xs: '2rem', sm: '2.5rem' }
                                    }}
                                >
                                    Password Vault
                                </Typography>
                                <Typography
                                    variant="h6"
                                    color="text.secondary"
                                    sx={{ mt: 1 }}
                                >
                                    Manage your stored credentials securely
                                </Typography>
                            </Box>
                        </Box>
                    </motion.div>

                    {/* Search Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            mb: 4
                        }}>
                            <TextField
                                variant="outlined"
                                placeholder="Search by host or username..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon color="primary" />
                                        </InputAdornment>
                                    ),
                                    sx: {
                                        color: 'black',
                                        background: alpha('#ffffff', 0.95),
                                        borderRadius: 3,
                                        minWidth: { xs: '100%', sm: 400 },
                                        maxWidth: 500,
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: alpha(teal[500], 0.3),
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: teal[500],
                                        },
                                    },
                                }}
                            />
                        </Box>
                    </motion.div>

                    {/* Credentials Grid */}
                    {isFetching ? (
                        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                                <CircularProgress
                                    size={60}
                                    thickness={4}
                                    sx={{ color: teal[500] }}
                                />
                            </motion.div>
                            <Typography variant="body1" sx={{ ml: 2, color: 'white', fontWeight: 600 }}>
                                Loading credentials...
                            </Typography>
                        </Box>
                    ) : loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                            <CircularProgress color="primary" />
                        </Box>
                    ) : (
                        <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
                            {credentials.length > 0 ? (
                                credentials.map((hostData, index) => (
                                    <Grid
                                        item
                                        key={hostData.id}
                                        sx={{
                                            width: { xs: '100%', sm: '45%', md: '30%' },
                                            minWidth: 300,
                                            maxWidth: 400,
                                            height: '100%',
                                            display: 'flex'
                                        }}
                                    >
                                        <HostCard
                                            hostData={hostData}
                                            index={index}
                                        />
                                    </Grid>
                                ))
                            ) : (
                                <Grid item xs={12}>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.5 }}
                                    >
                                        <Paper elevation={0} sx={{
                                            ...cardStyle,
                                            p: 6,
                                            textAlign: 'center',
                                            border: `2px dashed ${alpha(teal[300], 0.5)}`
                                        }}>
                                            <LockIcon sx={{ fontSize: 64, color: teal[300], mb: 2 }} />
                                            <Typography variant="h5" gutterBottom sx={{ color: teal[800], fontWeight: 600 }}>
                                                No Credentials Found
                                            </Typography>
                                            <Typography variant="body1" color="text.secondary">
                                                {searchQuery ? 'Try adjusting your search terms' : 'Start by adding some credentials to your vault'}
                                            </Typography>
                                        </Paper>
                                    </motion.div>
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
                                background: `linear-gradient(135deg, ${alpha('#ffffff', 0.95)} 0%, ${alpha(teal[50], 0.8)} 100%)`,
                                backdropFilter: 'blur(20px)',
                                borderRadius: 3,
                                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                                border: `1px solid ${alpha(teal[500], 0.2)}`,
                            }
                        }}
                    >
                        <DialogTitle sx={{
                            background: `linear-gradient(135deg, ${teal[500]} 0%, ${teal[700]} 100%)`,
                            color: 'white',
                            fontWeight: 'bold',
                            borderBottom: `1px solid ${teal[300]}`,
                            padding: '20px 24px'
                        }}>
                            <Box display="flex" alignItems="center" gap={1}>
                                <EditIcon />
                                Update Credential
                            </Box>
                        </DialogTitle>

                        <DialogContent dividers sx={{ p: 3 }}>
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
                                            '& .MuiInputBase-input': {
                                                color: 'black', // ✅ main text
                                            },
                                            '& .MuiInputBase-input.Mui-disabled': {
                                                WebkitTextFillColor: 'black', // ✅ ensures disabled text is black too
                                                opacity: 1,
                                            },
                                            '& .MuiInputLabel-root': {
                                                color: teal[800],
                                                fontWeight: '600'
                                            },
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: teal[300],
                                                },
                                                '&.Mui-disabled': {
                                                    '& fieldset': {
                                                        borderColor: teal[200],
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
                                            '& .MuiInputBase-input': {
                                                color: 'black', // ✅ main text
                                            },
                                            '& .MuiInputBase-input.Mui-disabled': {
                                                WebkitTextFillColor: 'black', // ✅ ensures disabled text is black too
                                                opacity: 1,
                                            },
                                            '& .MuiInputLabel-root': {
                                                color: teal[800],
                                                fontWeight: '600'
                                            },
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: teal[300],
                                                },
                                                '&.Mui-disabled': {
                                                    '& fieldset': {
                                                        borderColor: teal[200],
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
                                            '& .MuiInputBase-input': {
                                                color: 'black', // ✅ main text
                                            },
                                            '& .MuiInputBase-input.Mui-disabled': {
                                                WebkitTextFillColor: 'black', // ✅ ensures disabled text is black too
                                                opacity: 1,
                                            },
                                            '& .MuiInputLabel-root': {
                                                color: teal[800],
                                                fontWeight: '600'
                                            },
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: teal[300],
                                                },
                                                '&:hover fieldset': {
                                                    borderColor: teal[500],
                                                },
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
                                            '& .MuiInputBase-input': {
                                                color: 'black', // ✅ main text
                                            },
                                            '& .MuiInputBase-input.Mui-disabled': {
                                                WebkitTextFillColor: 'black', // ✅ ensures disabled text is black too
                                                opacity: 1,
                                            },
                                            '& .MuiInputLabel-root': {
                                                color: teal[800],
                                                fontWeight: '600'
                                            },
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: teal[300],
                                                },
                                                '&:hover fieldset': {
                                                    borderColor: teal[500],
                                                },
                                            },
                                        }}
                                    />
                                </Grid>

                                {/* Optional Notes */}
                                <Grid item xs={12}>
                                    <Box sx={{ mb: 1 }}>
                                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                            Additional Credentials & Notes
                                        </Typography>
                                    </Box>
                                    <TextField
                                        fullWidth
                                        name="notes"
                                        multiline
                                        minRows={3}
                                        maxRows={8}
                                        value={formCredential.notes || ''}
                                        onChange={handleInputChange}
                                        placeholder={
                                            `You can add:
• Security questions (Q: What's your pet's name? A: Fluffy)
• Backup codes (Code1: XXXX-XXXX, Code2: YYYY-YYYY)
• Additional credentials (API Key: sk-...)
• Recovery email: backup@example.com
• Any other relevant information`
                                        }
                                        sx={{
                                            '& .MuiInputBase-input': {
                                                color: 'black', // ✅ main text
                                            },
                                            '& .MuiInputBase-input.Mui-disabled': {
                                                WebkitTextFillColor: 'black', // ✅ ensures disabled text is black too
                                                opacity: 1,
                                            },
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: teal[300],
                                                    borderWidth: 2,
                                                },
                                                '&:hover fieldset': {
                                                    borderColor: teal[500],
                                                },
                                                '&.Mui-focused fieldset': {
                                                    borderColor: teal[700],
                                                },
                                                '& textarea': {
                                                    fontFamily: 'Monaco, Consolas, monospace',
                                                    fontSize: '0.9rem',
                                                    lineHeight: 1.6,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }
                                            },
                                        }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                                                    <LockIcon fontSize="small" color="action" />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Supports multiple lines and formatted text
                                        </Typography>
                                        {formCredential.notes && (
                                            <Chip
                                                label={`${formCredential.notes.split('\n').length} lines`}
                                                size="small"
                                                variant="outlined"
                                                color="primary"
                                            />
                                        )}
                                    </Box>
                                </Grid>
                            </Grid>
                        </DialogContent>

                        <DialogActions sx={{
                            backgroundColor: alpha(teal[50], 0.8),
                            borderTop: `1px solid ${teal[200]}`,
                            padding: '16px 24px'
                        }}>
                            <Button
                                onClick={() => setOpenEditDialog(false)}
                                disabled={isUpdating}
                                sx={{
                                    color: teal[800],
                                    border: `1px solid ${teal[800]}`,
                                    fontWeight: '600',
                                    borderRadius: 2,
                                    '&:hover': {
                                        backgroundColor: teal[100],
                                    },
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
                                    background: `linear-gradient(135deg, ${teal[500]} 0%, ${teal[700]} 100%)`,
                                    color: 'white',
                                    fontWeight: '600',
                                    borderRadius: 2,
                                    '&:hover': {
                                        background: `linear-gradient(135deg, ${teal[600]} 0%, ${teal[800]} 100%)`,
                                    },
                                }}
                            >
                                {isUpdating ? 'Updating...' : 'Save Changes'}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Delete Credential Dialog */}
                    {/* Delete Credential Dialog */}
                    <Dialog
                        open={openDeleteDialog}
                        onClose={() => !isDeleting && setOpenDeleteDialog(false)}
                        PaperProps={{
                            sx: {
                                ...cardStyle,
                                background: `linear-gradient(135deg, ${alpha('#ffffff', 0.95)} 0%, ${alpha(red[50], 0.8)} 100%)`,
                                border: `1px solid ${alpha(red[300], 0.5)}`,
                                color: 'black', // ✅ ensures all inner text is black
                            }
                        }}
                    >
                        <DialogTitle
                            sx={{
                                background: `linear-gradient(135deg, ${red[500]} 0%, ${red[700]} 100%)`,
                                color: 'white',
                                fontWeight: 'bold',
                                p: 2.5,
                                borderBottom: `1px solid ${alpha(red[300], 0.5)}`
                            }}
                        >
                            <Box display="flex" alignItems="center" gap={1}>
                                <WarningIcon />
                                Delete Credential
                            </Box>
                        </DialogTitle>

                        <DialogContent
                            sx={{
                                p: 3,
                                color: 'black',
                                '& .MuiTypography-root': {
                                    color: 'black'
                                }
                            }}
                        >
                            <Typography variant="body1" gutterBottom>
                                Are you sure you want to delete this credential?
                            </Typography>

                            <Box
                                sx={{
                                    mt: 2,
                                    p: 2,
                                    background: alpha(red[50], 0.6),
                                    borderRadius: 1,
                                    border: `1px solid ${alpha(red[200], 0.6)}`
                                }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    Host: {formCredential.host}
                                </Typography>
                                <Typography variant="body2">
                                    Username: {formCredential.username}
                                </Typography>
                            </Box>
                        </DialogContent>

                        <DialogActions
                            sx={{
                                p: 3,
                                gap: 1,
                                background: alpha('#fff', 0.4),
                                borderTop: `1px solid ${alpha(red[200], 0.5)}`
                            }}
                        >
                            <Button
                                onClick={() => setOpenDeleteDialog(false)}
                                disabled={isDeleting}
                                sx={{
                                    color: 'black',
                                    fontWeight: '600',
                                    borderRadius: 2,
                                    '&:hover': {
                                        backgroundColor: alpha(red[100], 0.5)
                                    }
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                onClick={handleDeleteCredential}
                                disabled={isDeleting}
                                startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : null}
                                sx={{
                                    background: `linear-gradient(135deg, ${red[500]} 0%, ${red[700]} 100%)`,
                                    fontWeight: '600',
                                    borderRadius: 2,
                                    '&:hover': {
                                        background: `linear-gradient(135deg, ${red[600]} 0%, ${red[800]} 100%)`
                                    }
                                }}
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
                            sx: {
                                ...cardStyle,
                                background: `linear-gradient(135deg, ${alpha('#ffffff', 0.95)} 0%, ${alpha(red[50], 0.8)} 100%)`,
                                border: `1px solid ${alpha(red[300], 0.5)}`,
                                color: 'black', // ✅ ensures readability
                            }
                        }}
                    >
                        <DialogTitle
                            sx={{
                                background: `linear-gradient(135deg, ${red[600]} 0%, ${red[800]} 100%)`,
                                color: 'white',
                                fontWeight: 'bold',
                                p: 2.5,
                                borderBottom: `1px solid ${alpha(red[300], 0.5)}`
                            }}
                        >
                            <Box display="flex" alignItems="center" gap={1}>
                                <WarningIcon />
                                Delete Host
                            </Box>
                        </DialogTitle>

                        <DialogContent
                            sx={{
                                p: 3,
                                color: 'black',
                                '& .MuiTypography-root': {
                                    color: 'black'
                                }
                            }}
                        >
                            <Typography variant="body1" gutterBottom>
                                Are you sure you want to delete this host and all its credentials?
                            </Typography>

                            <Box
                                sx={{
                                    mt: 2,
                                    p: 2,
                                    background: alpha(red[50], 0.6),
                                    borderRadius: 1,
                                    border: `1px solid ${alpha(red[200], 0.6)}`
                                }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    Host: {formCredential.host}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="error"
                                    sx={{ mt: 1, fontWeight: 600 }}
                                >
                                    ⚠️ Warning: This will permanently delete all credentials under this host.
                                </Typography>
                            </Box>
                        </DialogContent>

                        <DialogActions
                            sx={{
                                p: 3,
                                gap: 1,
                                background: alpha('#fff', 0.4),
                                borderTop: `1px solid ${alpha(red[200], 0.5)}`
                            }}
                        >
                            <Button
                                onClick={() => setOpenDeleteHostDialog(false)}
                                disabled={isDeletingHost}
                                sx={{
                                    color: 'black',
                                    fontWeight: '600',
                                    borderRadius: 2,
                                    '&:hover': {
                                        backgroundColor: alpha(red[100], 0.5)
                                    }
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                onClick={handleDeleteHost}
                                disabled={isDeletingHost}
                                startIcon={isDeletingHost ? <CircularProgress size={20} color="inherit" /> : null}
                                sx={{
                                    background: `linear-gradient(135deg, ${red[600]} 0%, ${red[800]} 100%)`,
                                    fontWeight: '600',
                                    borderRadius: 2,
                                    '&:hover': {
                                        background: `linear-gradient(135deg, ${red[700]} 0%, ${red[900]} 100%)`
                                    }
                                }}
                            >
                                {isDeletingHost ? 'Deleting...' : 'Delete Host'}
                            </Button>
                        </DialogActions>
                    </Dialog>
                </Container>
            </Box>
        </Box>
    );
};

export default ViewPassword;