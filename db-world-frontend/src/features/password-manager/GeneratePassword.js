import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Constants from '../Constants';
import {
    Box,
    Button,
    Card,
    CardHeader,
    CardContent,
    Divider,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    Slider,
    TextField,
    Typography,
    useTheme
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    ContentCopy,
    ArrowBack
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import CommonServices from '../CommonServices';
import { toast } from '../Toast';

const GeneratePassword = () => {
    const [generatedPassword, setGeneratedPassword] = useState("");
    const [passwordLength, setPasswordLength] = useState(8);
    const [showPassword, setShowPassword] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const theme = useTheme();

    const handleSliderChange = (event, newValue) => {
        setPasswordLength(newValue);
    };

    const handleInputChange = (event) => {
        const value = Math.min(Math.max(parseInt(event.target.value) || 8, 8), 16);
        setPasswordLength(value);
    };

    const copyPassword = async () => {
        const result = await CommonServices.handleCopy(generatedPassword);
        if (result.success) {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 1000);
        } else {
            toast.error(result.message);
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    // const generatePassword = () => {
    //     const numbers = "0123456789";
    //     const upperLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    //     const lowerLetters = "abcdefghijklmnopqrstuvwxyz";
    //     const specialCharacters = "~!@#$%^&*()_-+=<>{}[|]";

    //     // Ensure at least one character from each category
    //     const getRandomChar = (str) => str[Math.floor(Math.random() * str.length)];

    //     let password = [
    //         getRandomChar(numbers),
    //         getRandomChar(upperLetters),
    //         getRandomChar(lowerLetters),
    //         getRandomChar(specialCharacters)
    //     ];

    //     // Fill the rest with random characters from all categories
    //     const allChars = numbers + upperLetters + lowerLetters + specialCharacters;
    //     while (password.length < passwordLength) {
    //         password.push(getRandomChar(allChars));
    //     }

    //     // Shuffle the array to mix the required characters
    //     for (let i = password.length - 1; i > 0; i--) {
    //         const j = Math.floor(Math.random() * (i + 1));
    //         [password[i], password[j]] = [password[j], password[i]];
    //     }

    //     setGeneratedPassword(password.join(''));
    // };

    function generatePassword() {
        const length = passwordLength;
        const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const lower = "abcdefghijklmnopqrstuvwxyz";
        const digits = "0123456789";
        const symbols = "!@#$%^&*()-_=+[]{}|;:,.<>?";
        const allChars = upper + lower + digits + symbols;

        if (length < 8) throw new Error("Password length should be at least 8 characters for security.");

        // Ensure at least one character from each group
        const getRandomChar = (charset) => charset[Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * charset.length)];

        let password = [
            getRandomChar(upper),
            getRandomChar(lower),
            getRandomChar(digits),
            getRandomChar(symbols)
        ];

        // Fill the rest of the password
        for (let i = password.length; i < length; i++) {
            password.push(getRandomChar(allChars));
        }

        // Shuffle the password
        setGeneratedPassword(password.sort(() => 0.5 - Math.random()).join(''));
    }


    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                when: "beforeChildren"
            }
        },
        color: 'black'
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
            style={{ padding: theme.spacing(2) }}
        >
            <Card
                sx={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    maxWidth: 800,
                    margin: '0 auto',
                    color: 'black'
                }}
            >
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
                                    style={{ alignItems: 'center' }}
                                >
                                    Back
                                </Button>
                                <Typography variant="h4" gutterBottom sx={{ alignItems: 'center', mb: 0 }}>
                                    Password Generator
                                </Typography>
                            </Box>
                        </motion.div>
                    }
                />
                <Divider sx={{ backgroundColor: 'teal' }} />

                <CardContent>
                    <motion.div variants={containerVariants}>
                        <motion.div variants={itemVariants}>
                            <Typography variant="h6" gutterBottom>
                                <u>Generate Password</u>
                            </Typography>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <List>
                                <ListItem>
                                    <Typography variant="body1">
                                        • This will generate password for required length.
                                    </Typography>
                                </ListItem>
                                <ListItem>
                                    <Typography variant="body1">
                                        • Password will contain numbers, special characters, uppercase and lowercase letters.
                                    </Typography>
                                </ListItem>
                                <ListItem>
                                    <Typography variant="body1">
                                        • Password length should be between 8 and 16.
                                    </Typography>
                                </ListItem>
                            </List>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <Divider sx={{ my: 2 }} />
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="body1" sx={{ minWidth: 180 }}>
                                    Password length: {passwordLength}
                                </Typography>
                                <Slider
                                    value={passwordLength}
                                    onChange={handleSliderChange}
                                    min={8}
                                    max={16}
                                    sx={{ flexGrow: 1 }}
                                />
                                <TextField
                                    size="small"
                                    type="number"
                                    value={passwordLength}
                                    onChange={handleInputChange}
                                    inputProps={{ min: 8, max: 16 }}
                                    sx={{ width: 80 }}
                                />
                            </Box>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={generatePassword}
                                sx={{ mt: 2 }}
                                fullWidth
                            >
                                Generate Password
                            </Button>
                        </motion.div>

                        {generatedPassword && (
                            <>
                                <motion.div variants={itemVariants}>
                                    <Divider sx={{ my: 2, color: 'InfoBackground' }} />
                                </motion.div>

                                <motion.div variants={itemVariants}>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', color: 'black' }}>
                                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                            Generated Password:
                                        </Typography>
                                        <TextField
                                            type={showPassword ? 'text' : 'password'}
                                            value={generatedPassword}
                                            InputProps={{
                                                readOnly: true,
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton onClick={togglePasswordVisibility} sx={{ color: 'teal' }}>
                                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                                style: { color: 'black', border: '1px solid teal' }
                                            }}
                                            className='text-dark'
                                            sx={{ flexGrow: 1, color: 'teal' }}
                                        />
                                        <Button
                                            variant="contained"
                                            startIcon={<ContentCopy />}
                                            onClick={copyPassword}
                                            color={isCopied ? 'success' : 'primary'}
                                        >
                                            {isCopied ? 'Copied!' : 'Copy'}
                                        </Button>
                                    </Box>
                                </motion.div>
                            </>
                        )}
                    </motion.div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default GeneratePassword;