import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
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
    Autocomplete
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    ArrowBack,
    ArrowDropDown
} from '@mui/icons-material';
import { color, motion } from 'framer-motion';

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
            Constants.showToast.warning("Please fill all required fields.");
            return false;
        }
        if (!isValidUrl) {
            Constants.showToast.warning("Please enter a valid URL.");
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
                Constants.showToast.success(addCredentialRes.message);
                setInputField({
                    url: '',
                    username: '',
                    password: '',
                    pin: '',
                    notes: ''
                });
                getAllHost();
            } else if (addCredentialRes.httpStatusCode === 401) {
                Constants.showToast.error(addCredentialRes.message, {
                    autoClose: 1000,
                    onClose: () => {
                        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
                    }
                });
            } else {
                Constants.showToast.error(addCredentialRes.message);
            }
        } catch (error) {
            Constants.showToast.error("An error occurred while saving the credential.");
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
                duration: 0.5
            }
        }
    };

    return (
    <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        style={{ padding: 2, color: 'black' }}
    >
        <Card sx={{
            background: 'rgba(255, 255, 255, 0.9)',
            maxWidth: 800,
            margin: '0 auto',
            color: 'black',
            p: 2,
        }}>
            <CardHeader
                title={
                    <motion.div variants={itemVariants}>
                        <Box display="flex" alignItems="center" gap={2}>
                            <Button
                                component={Link}
                                to={Constants.DB_PASSWORD_MANAGER_ROUTE}
                                startIcon={<ArrowBack />}
                                variant="contained"
                                size="small"
                            >
                                Back
                            </Button>
                            <Typography variant="h4" gutterBottom style={{ marginBottom: 0 }}>
                                Save Credential
                            </Typography>
                        </Box>
                    </motion.div>
                }
            />
            <Divider style={{ backgroundColor: 'teal' }} />

            <CardContent>
                <motion.div variants={containerVariants}>
                    <motion.div variants={itemVariants}>
                        <Typography variant="h6" gutterBottom>
                            <u>Save Credential</u>
                        </Typography>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <List>
                            <ListItem>
                                <ListItemText primary="• This will Save Password In Database." />
                            </ListItem>
                            <ListItem>
                                <ListItemText
                                    primary="• Worried about security? No Problem, your credential will be secured in our database using Cypher AES Technology."
                                />
                            </ListItem>
                        </List>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                        <Divider sx={{ my: 2, backgroundColor: 'teal' }} />
                    </motion.div>

                    <Box component="form" onSubmit={onSubmit} sx={{ maxWidth: 600, mx: 'auto' }}>
                        {/* URL Field */}
                        <motion.div variants={itemVariants}>
                            <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
                                <Grid item xs={12} sm={4}>
                                    <InputLabel htmlFor="url" sx={{ color: 'black', minWidth: 120 }}>
                                        Host/Url <span style={{ color: 'red' }}>*</span>
                                    </InputLabel>
                                </Grid>
                                <Grid item xs={12} sm={8}>
                                    <FormControl fullWidth style={{ minWidth: 250 }}>
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
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    error={!isValidUrl}
                                                    helperText={!isValidUrl && "Please enter a valid URL"}
                                                    placeholder="Type or select host URL"
                                                    fullWidth
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': {
                                                            '& fieldset': {
                                                                borderColor: 'teal',
                                                            },
                                                            '&:hover fieldset': {
                                                                borderColor: 'teal',
                                                            },
                                                            '&.Mui-focused fieldset': {
                                                                borderColor: 'teal',
                                                            },
                                                        }
                                                    }}
                                                    InputProps={{
                                                        ...params.InputProps,
                                                        style: { color: 'black' },
                                                    }}
                                                />
                                            )}
                                            popupIcon={<ArrowDropDown style={{ color: 'teal' }} />}
                                        />
                                        {!isValidUrl && (
                                            <FormHelperText error>
                                                <ul style={{ margin: 0, paddingLeft: 20 }}>
                                                    <li>The URL must start with http or https</li>
                                                    <li>Then followed by ://</li>
                                                    <li>Then followed by a valid domain/subdomain</li>
                                                    <li>Ends with a valid TLD like .com, .org</li>
                                                </ul>
                                            </FormHelperText>
                                        )}
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </motion.div>

                        {/* Username */}
                        <motion.div variants={itemVariants}>
                            <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
                                <Grid item xs={12} sm={4}>
                                    <InputLabel htmlFor="username" sx={{ color: 'black', minWidth: 120 }}>
                                        Username <span style={{ color: 'red' }}>*</span>
                                    </InputLabel>
                                </Grid>
                                <Grid item xs={12} sm={8}>
                                    <TextField sx={{ minWidth: 250 }}
                                        fullWidth
                                        id="username"
                                        placeholder="username or email or mobile number"
                                        value={inputField.username}
                                        onChange={onFieldChange}
                                        InputProps={{
                                            style: { color: 'black', border: '1px solid teal' },
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </motion.div>

                        {/* Password */}
                        <motion.div variants={itemVariants}>
                            <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
                                <Grid item xs={12} sm={4}>
                                    <InputLabel htmlFor="password" sx={{ color: 'black', minWidth: 120 }}>
                                        Password <span style={{ color: 'red' }}>*</span>
                                    </InputLabel>
                                </Grid>
                                <Grid item xs={12} sm={8}>
                                    <TextField sx={{ minWidth: 250 }}
                                        fullWidth
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Password"
                                        value={inputField.password}
                                        onChange={onFieldChange}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() => togglePasswordVisibility('password')}
                                                        edge="end"
                                                        sx={{ color: 'teal' }}
                                                    >
                                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                            style: { color: 'black', border: '1px solid teal' },
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </motion.div>

                        {/* Pin */}
                        <motion.div variants={itemVariants}>
                            <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
                                <Grid item xs={12} sm={4}>
                                    <InputLabel htmlFor="pin" sx={{ color: 'black', minWidth: 120 }}>
                                        Pin
                                    </InputLabel>
                                </Grid>
                                <Grid item xs={12} sm={8}>
                                    <TextField sx={{ minWidth: 250 }}
                                        fullWidth
                                        id="pin"
                                        type={showPin ? 'text' : 'password'}
                                        placeholder="Small Pin for mobile app login"
                                        value={inputField.pin}
                                        onChange={onFieldChange}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() => togglePasswordVisibility('pin')}
                                                        edge="end"
                                                        sx={{ color: 'teal' }}
                                                    >
                                                        {showPin ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                            style: { color: 'black', border: '1px solid teal' },
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </motion.div>

                        {/* Notes */}
                        <motion.div variants={itemVariants}>
                            <Grid container spacing={2} alignItems="flex-start" sx={{ mt: 2 }}>
                                <Grid item xs={12} sm={4}>
                                    <InputLabel htmlFor="notes" sx={{ color: 'black', minWidth: 120 }}>
                                        Notes
                                    </InputLabel>
                                </Grid>
                                <Grid item xs={12} sm={8}>
                                    <TextField
                                        fullWidth
                                        id="notes"
                                        multiline
                                        rows={4}
                                        placeholder="Any notes if you want to add"
                                        value={inputField.notes}
                                        onChange={onFieldChange}
                                        inputProps={{
                                            style: { color: 'black', padding: '5px' },
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: 'teal',
                                                },
                                                '&:hover fieldset': {
                                                    borderColor: 'teal',
                                                },
                                                '&.Mui-focused fieldset': {
                                                    borderColor: 'teal',
                                                },
                                            },
                                            minWidth: 250,
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <Divider sx={{ my: 3 }} />
                        </motion.div>

                        {/* Submit Button */}
                        <motion.div variants={itemVariants}>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    disabled={submitLoader}
                                >
                                    {submitLoader ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            &nbsp;&nbsp;Submitting...
                                        </>
                                    ) : (
                                        'Submit'
                                    )}
                                </Button>
                            </Box>
                        </motion.div>
                    </Box>
                </motion.div>
            </CardContent>
        </Card>
        {Constants.TOAST_CONTAINER}
    </motion.div>
);

};

export default AddPassword;