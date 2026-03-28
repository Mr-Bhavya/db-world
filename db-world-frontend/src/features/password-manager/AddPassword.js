import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CommonServices from '../CommonServices';
import Constants from '../Constants';
import { addCredential, findAllHost, getUserRole } from '../ApiServices';
import {
    Box,
    Button,
    Card,
    CardHeader,
    CardContent,
    Checkbox,
    Divider,
    FormControl,
    FormHelperText,
    Grid,
    IconButton,
    InputAdornment,
    InputLabel,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Select,
    TextField,
    Typography,
    Autocomplete,
    Chip,
    alpha,
    Container,
    Paper,
    Fade,
    CircularProgress
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    ArrowBack,
    ArrowDropDown,
    Security,
    VpnKey,
    Lock,
    NoteAdd,
    Public,
    Person,
    Save
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../Toast';

// Advanced Background Component
const AdvancedBackground = () => {
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
                    ${alpha('#01004dff', 0.95)} 0%, 
                    ${alpha('#001069ff', 0.9)} 50%, 
                    ${alpha('#000425ff', 0.95)} 100%)`,
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `
                        radial-gradient(circle at 15% 20%, ${alpha('#00796b', 0.15)} 0%, transparent 25%),
                        radial-gradient(circle at 85% 30%, ${alpha('#004d40', 0.15)} 0%, transparent 25%),
                        radial-gradient(circle at 25% 80%, ${alpha('#00695c', 0.1)} 0%, transparent 20%),
                        radial-gradient(circle at 75% 75%, ${alpha('#00897b', 0.1)} 0%, transparent 20%)
                    `,
                    animation: 'pulse 8s ease-in-out infinite alternate'
                }
            }}
        >
            {/* Animated Particles */}
            {[...Array(15)].map((_, i) => (
                <motion.div
                    key={i}
                    style={{
                        position: 'absolute',
                        width: Math.random() * 3 + 1,
                        height: Math.random() * 3 + 1,
                        background: [
                            alpha('#00796b', 0.6),
                            alpha('#004d40', 0.6),
                            alpha('#00695c', 0.6),
                            alpha('#00897b', 0.6)
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

const AddPassword = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [submitLoader, setSubmitLoader] = useState(false);
    const [isValidUrl, setIsValidUrl] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [host, setHost] = useState([]);
    const [inputField, setInputField] = useState({
        url: '',
        username: '',
        password: '',
        pin: '',
        notes: ''
    });

    // Dark teal color palette
    const tealColors = {
        dark: '#004d40',
        main: '#00796b',
        light: '#00897b',
        lighter: '#4db6ac',
        contrast: '#e0f2f1'
    };

    const onFieldChange = (e) => {
        const { id, value } = e.target;
        if (id === "url") {
            setIsValidUrl(CommonServices.isValidUrl(value));
        }
        setInputField(prev => ({ ...prev, [id]: value }));
    };

    const getAllHost = async () => {
        let hostRes = await findAllHost();
        if (hostRes.httpStatusCode === 200) {
            setHost(hostRes.data);
        } else if (hostRes.httpStatusCode === 401) {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        }
    };

    useEffect(() => {
        getAllHost();
    }, []);

    const togglePasswordVisibility = (field) => {
        if (field === 'password') {
            setShowPassword(!showPassword);
        } else {
            setShowPin(!showPin);
        }
    };

    const validateInputField = () => {
        const { url, username, password } = inputField;
        if (!url || !username || !password) {
            toast.warning("Please fill all required fields.");
            return false;
        }
        if (!isValidUrl) {
            toast.warning("Please enter a valid URL.");
            return false;
        }
        return true;
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setSubmitLoader(true);

        if (!validateInputField()) {
            setSubmitLoader(false);
            return;
        }

        const payload = {
            ...inputField,
            pin: inputField.pin || null
        };

        try {
            const addCredentialRes = await addCredential(payload);

            if (addCredentialRes.httpStatusCode === 201) {
                toast.success(addCredentialRes.message);
                setInputField({
                    url: '',
                    username: '',
                    password: '',
                    pin: '',
                    notes: ''
                });
                getAllHost();
            } else if (addCredentialRes.httpStatusCode === 401) {
                toast.error(addCredentialRes.message, {
                    autoClose: 1000,
                    onClose: () => {
                        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
                    }
                });
            } else {
                toast.error(addCredentialRes.message);
            }
        } catch (error) {
            toast.error("An error occurred while saving the credential.");
        } finally {
            setSubmitLoader(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                when: "beforeChildren"
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 100,
                damping: 15
            }
        },
        hover: {
            scale: 1.02,
            transition: {
                type: "spring",
                stiffness: 400,
                damping: 25
            }
        }
    };

    const securityFeatures = [
        { icon: <Security />, text: "AES-256 Encryption", color: tealColors.main },
        { icon: <Lock />, text: "Military Grade Security", color: tealColors.dark },
        { icon: <VpnKey />, text: "Zero-Knowledge Architecture", color: tealColors.light }
    ];

    // Responsive text sizes
    const responsiveTypography = {
        h1: { xs: '2rem', sm: '2.5rem', md: '3rem' },
        h2: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
        h3: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
        body: { xs: '0.875rem', sm: '0.9rem', md: '1rem' }
    };

    return (
        <Box sx={{
            minHeight: '100vh',
            position: 'relative',
            overflow: 'hidden',
            py: { xs: 2, sm: 3, md: 4 }
        }}>
            {/* Advanced Background */}
            <AdvancedBackground />

            {/* Main Content */}
            <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                >
                    {/* Header Section */}
                    <motion.div variants={itemVariants}>
                        <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                transition={{ type: "spring", stiffness: 300 }}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: { xs: 'column', sm: 'row' },
                                        alignItems: 'center',
                                        gap: { xs: 2, sm: 3 },
                                        mb: 3,
                                        p: { xs: 2, sm: 3, md: 4 },
                                        borderRadius: { xs: 2, sm: 3, md: 4 },
                                        background: alpha('#ffffff', 0.95),
                                        backdropFilter: 'blur(20px)',
                                        border: `1px solid ${alpha(tealColors.main, 0.2)}`,
                                        boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
                                        mx: 'auto',
                                        maxWidth: '100%'
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: { xs: 60, sm: 70, md: 80 },
                                            height: { xs: 60, sm: 70, md: 80 },
                                            borderRadius: '50%',
                                            background: `linear-gradient(135deg, ${tealColors.dark} 0%, ${tealColors.main} 100%)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: `3px solid ${alpha(tealColors.main, 0.3)}`,
                                            flexShrink: 0
                                        }}
                                    >
                                        <Lock sx={{ fontSize: { xs: 30, sm: 35, md: 40 }, color: 'white' }} />
                                    </Box>
                                    <Box textAlign={{ xs: 'center', sm: 'left' }}>
                                        <Typography
                                            variant="h1"
                                            component="h1"
                                            gutterBottom
                                            sx={{
                                                fontWeight: 800,
                                                background: `linear-gradient(135deg, ${tealColors.dark} 0%, ${tealColors.main} 100%)`,
                                                backgroundClip: 'text',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                                fontSize: responsiveTypography.h1,
                                                lineHeight: 1.2
                                            }}
                                        >
                                            Add Credential
                                        </Typography>
                                        <Typography
                                            variant="h6"
                                            color="text.secondary"
                                            sx={{
                                                maxWidth: 600,
                                                fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' }
                                            }}
                                        >
                                            Securely store your credentials with military-grade encryption
                                        </Typography>
                                    </Box>
                                </Box>
                            </motion.div>

                            {/* Security Features */}
                            <Grid container spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                                {securityFeatures.map((feature, index) => (
                                    <Grid item xs={12} sm={4} key={feature.text}>
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 + 0.5 }}
                                        >
                                            <Chip
                                                icon={feature.icon}
                                                label={feature.text}
                                                sx={{
                                                    background: alpha(feature.color, 0.1),
                                                    color: feature.color,
                                                    border: `1px solid ${alpha(feature.color, 0.3)}`,
                                                    fontWeight: 600,
                                                    py: { xs: 1, sm: 1.5 },
                                                    px: 1,
                                                    fontSize: { xs: '0.7rem', sm: '0.8rem' },
                                                    '& .MuiChip-icon': { color: feature.color },
                                                    width: { xs: '100%', sm: 'auto' },
                                                    maxWidth: 300
                                                }}
                                            />
                                        </motion.div>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    </motion.div>

                    {/* Main Form Card */}
                    <motion.div variants={itemVariants}>
                        <Card sx={{
                            background: alpha('#ffffff', 0.95),
                            backdropFilter: 'blur(20px)',
                            border: `1px solid ${alpha(tealColors.main, 0.2)}`,
                            borderRadius: { xs: 2, sm: 3, md: 4 },
                            boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
                            overflow: 'hidden',
                            position: 'relative',
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 4,
                                background: `linear-gradient(90deg, ${tealColors.dark}, ${tealColors.main})`,
                                zIndex: 1
                            }
                        }}>
                            <CardHeader
                                title={
                                    <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                            <Button
                                                component={Link}
                                                to={Constants.DB_PASSWORD_MANAGER_ROUTE}
                                                startIcon={<ArrowBack />}
                                                variant="outlined"
                                                size="small"
                                                sx={{
                                                    borderColor: tealColors.main,
                                                    color: tealColors.main,
                                                    fontWeight: 600,
                                                    borderRadius: 2,
                                                    fontSize: { xs: '0.8rem', sm: '0.9rem' },
                                                    minWidth: 'auto',
                                                    '&:hover': {
                                                        borderColor: tealColors.dark,
                                                        backgroundColor: alpha(tealColors.main, 0.1)
                                                    }
                                                }}
                                            >
                                                Back to Manager
                                            </Button>
                                        </motion.div>
                                        <Typography
                                            variant="h2"
                                            sx={{
                                                fontWeight: 700,
                                                color: tealColors.dark,
                                                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' }
                                            }}
                                        >
                                            Save New Credential
                                        </Typography>
                                    </Box>
                                }
                                sx={{
                                    pb: 2,
                                    borderBottom: `1px solid ${alpha(tealColors.main, 0.1)}`,
                                    px: { xs: 2, sm: 3, md: 4 },
                                    pt: { xs: 2, sm: 3 }
                                }}
                            />

                            <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
                                {/* Security Info */}
                                <motion.div variants={itemVariants}>
                                    <Paper
                                        elevation={0}
                                        sx={{
                                            background: alpha(tealColors.main, 0.05),
                                            border: `1px solid ${alpha(tealColors.main, 0.2)}`,
                                            borderRadius: 2,
                                            p: { xs: 2, sm: 3 },
                                            mb: { xs: 3, sm: 4 }
                                        }}
                                    >
                                        <Typography
                                            variant="h3"
                                            gutterBottom
                                            sx={{
                                                color: tealColors.dark,
                                                fontWeight: 600,
                                                fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
                                            }}
                                        >
                                            🔒 Your Credentials Are Secure
                                        </Typography>
                                        <List dense>
                                            <ListItem sx={{ px: 0, py: 0.5 }}>
                                                <ListItemText
                                                    primary="• Encrypted with AES-256 military-grade encryption"
                                                    primaryTypographyProps={{
                                                        variant: 'body2',
                                                        color: 'text.secondary',
                                                        fontSize: responsiveTypography.body
                                                    }}
                                                />
                                            </ListItem>
                                            <ListItem sx={{ px: 0, py: 0.5 }}>
                                                <ListItemText
                                                    primary="• Zero-knowledge architecture - only you can access your data"
                                                    primaryTypographyProps={{
                                                        variant: 'body2',
                                                        color: 'text.secondary',
                                                        fontSize: responsiveTypography.body
                                                    }}
                                                />
                                            </ListItem>
                                            <ListItem sx={{ px: 0, py: 0.5 }}>
                                                <ListItemText
                                                    primary="• Regular security audits and monitoring"
                                                    primaryTypographyProps={{
                                                        variant: 'body2',
                                                        color: 'text.secondary',
                                                        fontSize: responsiveTypography.body
                                                    }}
                                                />
                                            </ListItem>
                                        </List>
                                    </Paper>
                                </motion.div>

                                <Box component="form" onSubmit={onSubmit}>
                                    <Grid container spacing={{ xs: 2, sm: 3 }}>
                                        {/* URL Field */}
                                        <Grid item xs={12} sm={12} md={6} sx={{ minWidth: 250 }}>
                                            <motion.div variants={itemVariants}>
                                                <FormControl fullWidth>
                                                    <Autocomplete
                                                        freeSolo
                                                        id="url"
                                                        options={host.map((item) => `https://${item}/`)}
                                                        value={inputField.url}
                                                        onChange={(e, newValue) => {
                                                            setInputField({ ...inputField, url: newValue });
                                                            setIsValidUrl(CommonServices.isValidUrl(newValue));
                                                        }}
                                                        onInputChange={(e, newInputValue) => {
                                                            setInputField({ ...inputField, url: newInputValue });
                                                            setIsValidUrl(CommonServices.isValidUrl(newInputValue));
                                                        }}
                                                        popupIcon={<ArrowDropDown sx={{ color: tealColors.main }} />}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label={
                                                                    <Box display="flex" alignItems="center" gap={1}>
                                                                        <Public fontSize="small" />
                                                                        Website URL *
                                                                    </Box>
                                                                }
                                                                error={!isValidUrl && inputField.url !== ''}
                                                                helperText={
                                                                    !isValidUrl &&
                                                                    inputField.url !== '' &&
                                                                    'Please enter a valid URL starting with http:// or https://'
                                                                }
                                                                placeholder="https://example.com"
                                                                sx={{
                                                                    '& .MuiInputLabel-root': {
                                                                        color: tealColors.main,
                                                                        fontWeight: 600,
                                                                        fontSize: responsiveTypography.body,
                                                                        '&.Mui-focused': { color: tealColors.main },
                                                                    },
                                                                    '& .MuiOutlinedInput-root': {
                                                                        '& fieldset': {
                                                                            borderColor: tealColors.main,
                                                                            borderWidth: 2,
                                                                        },
                                                                        '&:hover fieldset': {
                                                                            borderColor: tealColors.dark,
                                                                        },
                                                                        '&.Mui-focused fieldset': {
                                                                            borderColor: tealColors.main,
                                                                            borderWidth: 2,
                                                                        },
                                                                        '& .MuiInputBase-input': {
                                                                            color: '#000',
                                                                            fontSize: responsiveTypography.body,
                                                                        },
                                                                    },
                                                                    '& input::placeholder': {
                                                                        color: '#555',
                                                                        opacity: 1,
                                                                    },
                                                                    '& .MuiFormHelperText-root': {
                                                                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                                    },
                                                                }}
                                                            />
                                                        )}
                                                    />
                                                </FormControl>
                                            </motion.div>
                                        </Grid>

                                        {/* Username & Password Row */}
                                        <Grid item xs={12} container spacing={{ xs: 2, sm: 3 }}>
                                            <Grid item xs={12} md={6}>
                                                <motion.div variants={itemVariants}>
                                                    <TextField
                                                        fullWidth
                                                        id="username"
                                                        label={
                                                            <Box display="flex" alignItems="center" gap={1}>
                                                                <Person fontSize="small" />
                                                                Username *
                                                            </Box>
                                                        }
                                                        placeholder="username, email, or mobile number"
                                                        value={inputField.username}
                                                        onChange={onFieldChange}
                                                        sx={{
                                                            '& .MuiInputLabel-root': {
                                                                color: tealColors.main,
                                                                fontWeight: 600,
                                                                fontSize: responsiveTypography.body
                                                            },
                                                            '& .MuiOutlinedInput-root': {
                                                                '& fieldset': {
                                                                    borderColor: tealColors.main,
                                                                    borderWidth: 2,
                                                                },
                                                                '&:hover fieldset': {
                                                                    borderColor: tealColors.dark,
                                                                },
                                                                '&.Mui-focused fieldset': {
                                                                    borderColor: tealColors.main,
                                                                    borderWidth: 2,
                                                                },
                                                                '& input': {
                                                                    color: '#000000', // Black text for input
                                                                    fontSize: responsiveTypography.body
                                                                },
                                                            },
                                                        }}
                                                    />
                                                </motion.div>
                                            </Grid>

                                            <Grid item xs={12} md={6}>
                                                <motion.div variants={itemVariants}>
                                                    <TextField
                                                        fullWidth
                                                        id="password"
                                                        label={
                                                            <Box display="flex" alignItems="center" gap={1}>
                                                                <VpnKey fontSize="small" />
                                                                Password *
                                                            </Box>
                                                        }
                                                        type={showPassword ? 'text' : 'password'}
                                                        placeholder="Enter your password"
                                                        value={inputField.password}
                                                        onChange={onFieldChange}
                                                        InputProps={{
                                                            endAdornment: (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        onClick={() => togglePasswordVisibility('password')}
                                                                        edge="end"
                                                                        sx={{ color: tealColors.main }}
                                                                        size="small"
                                                                    >
                                                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            ),
                                                        }}
                                                        sx={{
                                                            '& .MuiInputLabel-root': {
                                                                color: tealColors.main,
                                                                fontWeight: 600,
                                                                fontSize: responsiveTypography.body
                                                            },
                                                            '& .MuiOutlinedInput-root': {
                                                                '& fieldset': {
                                                                    borderColor: tealColors.main,
                                                                    borderWidth: 2,
                                                                },
                                                                '&:hover fieldset': {
                                                                    borderColor: tealColors.dark,
                                                                },
                                                                '&.Mui-focused fieldset': {
                                                                    borderColor: tealColors.main,
                                                                    borderWidth: 2,
                                                                },
                                                                '& input': {
                                                                    color: '#000000', // Black text for input
                                                                    fontSize: responsiveTypography.body
                                                                },
                                                            },
                                                        }}
                                                    />
                                                </motion.div>
                                            </Grid>
                                        </Grid>

                                        {/* Pin Field */}
                                        <Grid item xs={12} md={6}>
                                            <motion.div variants={itemVariants}>
                                                <TextField
                                                    fullWidth
                                                    id="pin"
                                                    label="PIN (Optional)"
                                                    type={showPin ? 'text' : 'password'}
                                                    placeholder="Mobile app PIN or backup code"
                                                    value={inputField.pin}
                                                    onChange={onFieldChange}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    onClick={() => togglePasswordVisibility('pin')}
                                                                    edge="end"
                                                                    sx={{ color: tealColors.main }}
                                                                    size="small"
                                                                >
                                                                    {showPin ? <VisibilityOff /> : <Visibility />}
                                                                </IconButton>
                                                            </InputAdornment>
                                                        ),
                                                    }}
                                                    sx={{
                                                        '& .MuiInputLabel-root': {
                                                            color: tealColors.main,
                                                            fontWeight: 600,
                                                            fontSize: responsiveTypography.body
                                                        },
                                                        '& .MuiOutlinedInput-root': {
                                                            '& fieldset': {
                                                                borderColor: tealColors.main,
                                                                borderWidth: 2,
                                                            },
                                                            '&:hover fieldset': {
                                                                borderColor: tealColors.dark,
                                                            },
                                                            '&.Mui-focused fieldset': {
                                                                borderColor: tealColors.main,
                                                                borderWidth: 2,
                                                            },
                                                            '& input': {
                                                                color: '#000000', // Black text for input
                                                                fontSize: responsiveTypography.body
                                                            },
                                                        },
                                                    }}
                                                />
                                            </motion.div>
                                        </Grid>

                                        {/* Notes Field */}
                                        <Grid item xs={12} sx={{ minWidth: 250 }}>
                                            <motion.div variants={itemVariants}>
                                                <TextField
                                                    fullWidth
                                                    id="notes"
                                                    label={
                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            <NoteAdd fontSize="small" />
                                                            Additional Notes (Optional)
                                                        </Box>
                                                    }
                                                    multiline
                                                    minRows={3}
                                                    maxRows={6}
                                                    placeholder="Add security questions, backup codes, or any additional information...
Example:
• Security Q: What's your pet's name? A: Fluffy
• Backup codes: XXXX-XXXX, YYYY-YYYY
• Recovery email: backup@example.com"
                                                    value={inputField.notes}
                                                    onChange={onFieldChange}
                                                    sx={{
                                                        '& .MuiInputLabel-root': {
                                                            color: tealColors.main,
                                                            fontWeight: 600,
                                                            fontSize: responsiveTypography.body
                                                        },
                                                        '& .MuiOutlinedInput-root': {
                                                            '& fieldset': {
                                                                borderColor: tealColors.main,
                                                                borderWidth: 2,
                                                            },
                                                            '&:hover fieldset': {
                                                                borderColor: tealColors.dark,
                                                            },
                                                            '&.Mui-focused fieldset': {
                                                                borderColor: tealColors.main,
                                                                borderWidth: 2,
                                                            },
                                                            '& textarea': {
                                                                color: '#000000', // Black text for textarea
                                                                fontFamily: 'Monaco, Consolas, monospace',
                                                                fontSize: { xs: '0.8rem', sm: '0.9rem' },
                                                                lineHeight: 1.6,
                                                            }
                                                        },
                                                    }}
                                                />
                                            </motion.div>
                                        </Grid>

                                        {/* Submit Button */}
                                        <Grid item xs={12}>
                                            <motion.div variants={itemVariants}>
                                                <Box sx={{
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    mt: { xs: 2, sm: 3 }
                                                }}>
                                                    <motion.div
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                    >
                                                        <Button
                                                            type="submit"
                                                            variant="contained"
                                                            size="large"
                                                            disabled={submitLoader}
                                                            startIcon={submitLoader ? null : <Save />}
                                                            sx={{
                                                                background: `linear-gradient(135deg, ${tealColors.dark} 0%, ${tealColors.main} 100%)`,
                                                                color: 'white',
                                                                fontWeight: 700,
                                                                fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
                                                                px: { xs: 4, sm: 5, md: 6 },
                                                                py: { xs: 1, sm: 1.25, md: 1.5 },
                                                                borderRadius: 3,
                                                                boxShadow: '0 8px 32px rgba(0,77,64,0.3)',
                                                                minWidth: { xs: '200px', sm: '240px' },
                                                                '&:hover': {
                                                                    background: `linear-gradient(135deg, ${tealColors.main} 0%, ${tealColors.dark} 100%)`,
                                                                    boxShadow: '0 12px 40px rgba(0,77,64,0.4)',
                                                                    transform: 'translateY(-2px)'
                                                                },
                                                                '&:disabled': {
                                                                    background: '#bdbdbd'
                                                                }
                                                            }}
                                                        >
                                                            {submitLoader ? (
                                                                <Box display="flex" alignItems="center" gap={1}>
                                                                    <motion.div
                                                                        animate={{ rotate: 360 }}
                                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                                    >
                                                                        <CircularProgress size={20} color="inherit" />
                                                                    </motion.div>
                                                                    Securing...
                                                                </Box>
                                                            ) : (
                                                                'Save Credential'
                                                            )}
                                                        </Button>
                                                    </motion.div>
                                                </Box>
                                            </motion.div>
                                        </Grid>
                                    </Grid>
                                </Box>
                            </CardContent>
                        </Card>
                    </motion.div>
                </motion.div>
            </Container>
        </Box>
    );
};

export default AddPassword;