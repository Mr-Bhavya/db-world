import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    CircularProgress,
    Grid,
    Paper,
    Chip,
    Container,
    IconButton,
    Divider,
    useTheme,
    useMediaQuery,
    alpha,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText
} from '@mui/material';
import {
    LocationOn,
    Refresh,
    Search,
    WbSunny,
    NightsStay,
    Thermostat,
    Air,
    Compress,
    Visibility,
    LocationCity,
    MapRounded,
    MapOutlined,
    GpsFixed
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Constants from '../Constants';
import CommonServices from '../CommonServices';
import Map from './Map';
import { toast } from '../Toast';

// Custom weather icon mapping
const weatherIcons = {
    '01d': '☀️',
    '01n': '🌙',
    '02d': '⛅',
    '02n': '⛅',
    '03d': '☁️',
    '03n': '☁️',
    '04d': '☁️',
    '04n': '☁️',
    '09d': '🌧️',
    '09n': '🌧️',
    '10d': '🌦️',
    '10n': '🌦️',
    '11d': '⛈️',
    '11n': '⛈️',
    '13d': '❄️',
    '13n': '❄️',
    '50d': '🌫️',
    '50n': '🌫️'
};

function Weather() {
    const [weatherData, setWeatherData] = useState(null);
    const [city, setCity] = useState("Pune");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const getWeatherFromCity = async () => {
        setRefreshing(true);
        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=5ac693a87e8bebb7c7b40655e85dde50`);
            const data = await res.json();

            if (res.status === 200) {
                setWeatherData(data);
                // toast.success(`Weather data for ${city} loaded successfully!`);
            } else {
                toast.error("City not found. Please try another location.");
            }
        } catch (err) {
            toast.error("Failed to fetch weather data. Please check your connection.");
        }
        setRefreshing(false);
        setLoading(false);
    };

    const getWeatherFromCoords = async (coords) => {
        setLoading(true);
        try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${coords.latitude}&lon=${coords.longitude}&appid=5ac693a87e8bebb7c7b40655e85dde50`);
            const data = await res.json();

            if (res.status === 200) {
                setWeatherData(data);
                setPermissionDenied(false);
            } else {
                toast.error("Unable to get location data.");
                getWeatherFromCity();
            }
        } catch (err) {
            toast.error("Failed to fetch location data.");
            getWeatherFromCity();
        }
        setLoading(false);
    };

    const checkLocationPermission = async () => {
        if (!navigator.permissions) {
            return 'prompt'; // Default to prompt if Permissions API is not available
        }
        
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            //console.log('Geolocation permission state:', result);
            return result.state;
        } catch (error) {
            console.error('Error checking geolocation permission:', error);
            toast.error(error.message || "Error checking location permission.");
            return 'prompt';
        }
    };

    const getGeoLocationDetails = async (showPrompt = false) => {
        if (navigator.geolocation) {
            // Check current permission state
            const permissionState = await checkLocationPermission();
            //console.log('Permission state:', permissionState);
            //console.log('Show prompt:', showPrompt);
            if (permissionState === 'denied' && !showPrompt) {
                //console.log('Permission denied, showing dialog');
                setPermissionDenied(true);
                setShowPermissionDialog(true);
                getWeatherFromCity();
                return;
            }
            
            //console.log('Requesting geolocation');
            navigator.geolocation.getCurrentPosition(
                position => getWeatherFromCoords(position.coords),
                error => {
                    toast.error('Geolocation error:' + error.message);
                    if (error.code === error.PERMISSION_DENIED) {
                        setPermissionDenied(true);
                        setShowPermissionDialog(true);
                    } else {
                        toast.error("Failed to get your location. Using default city.");
                    }
                    getWeatherFromCity();
                },
                { timeout: 10000 }
            );
        } else {
            toast.error("Geolocation not supported by your browser.");
            getWeatherFromCity();
        }
    };

    const requestLocationPermission = () => {
        setShowPermissionDialog(false);
        getGeoLocationDetails(true);
    };

    useEffect(() => {
        getGeoLocationDetails();
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        getWeatherFromCity();
    };

    const WeatherCard = ({ children, sx = {} }) => (
        <Paper
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            elevation={3}
            sx={{
                p: 3,
                borderRadius: 3,
                background: alpha('#0a0e17', 0.85),
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                ...sx
            }}
        >
            {children}
        </Paper>
    );

    const WeatherInfoItem = ({ icon, label, value, unit }) => (
        <Grid item xs={6} sm={4} md={3}>
            <Box sx={{ textAlign: 'center', p: 1 }}>
                <Typography variant="h6" color="primary.light" gutterBottom>
                    {icon}
                </Typography>
                <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" gutterBottom>
                    {label}
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="white">
                    {value} {unit}
                </Typography>
            </Box>
        </Grid>
    );

    if (loading) {
        return (
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight="60vh"
                flexDirection="column"
                gap={2}
                sx={{ background: 'linear-gradient(135deg, #0a0e17 0%, #1a2438 100%)', minHeight: '100vh' }}
            >
                <CircularProgress size={60} thickness={4} sx={{ color: 'primary.light' }} />
                <Typography variant="h6" color="rgba(255, 255, 255, 0.7)">
                    Loading weather data...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{
            background: 'linear-gradient(135deg, #0a0e17 0%, #0d8f8fff 100%)',
            minHeight: '100vh',
            py: 4
        }}>
            <Container maxWidth="lg" sx={{ py: 4 }}>
                {/* Permission Request Dialog */}
                <Dialog 
                    open={showPermissionDialog} 
                    onClose={() => setShowPermissionDialog(false)}
                    PaperProps={{
                        sx: {
                            background: alpha('#0a0e17', 0.95),
                            color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.2)'
                        }
                    }}
                >
                    <DialogTitle sx={{ textAlign: 'center' }}>
                        <GpsFixed sx={{ fontSize: 40, color: 'primary.light', mb: 1 }} />
                        <Typography variant="h5" color="white">
                            Location Access Needed
                        </Typography>
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText sx={{ color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center' }}>
                            To provide accurate weather information for your current location, 
                            we need access to your device's location. Please allow location 
                            permissions when prompted.
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
                        <Button 
                            onClick={() => setShowPermissionDialog(false)} 
                            variant="outlined"
                            sx={{ 
                                color: 'rgba(255, 255, 255, 0.7)', 
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                '&:hover': {
                                    borderColor: 'primary.light',
                                    color: 'primary.light'
                                }
                            }}
                        >
                            Maybe Later
                        </Button>
                        <Button 
                            onClick={requestLocationPermission} 
                            variant="contained"
                            autoFocus
                            sx={{ 
                                bgcolor: 'primary.main',
                                '&:hover': { bgcolor: 'primary.dark' }
                            }}
                        >
                            Allow Location
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Box sx={{ mb: 4, textAlign: 'center' }}>
                        <Typography
                            variant="h3"
                            component="h1"
                            fontWeight="bold"
                            gutterBottom
                            color="primary.light"
                        >
                            🌤️ Weather Information
                        </Typography>
                        <Typography variant="subtitle1" color="rgba(255, 255, 255, 0.7)">
                            Real-time weather updates for your location
                        </Typography>
                    </Box>
                </motion.div>

                {/* Search Section */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <WeatherCard>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" gutterBottom color="white">
                                    Change Location
                                </Typography>
                                <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" sx={{ mb: 2 }}>
                                    Enter city name or zip code
                                </Typography>
                                {permissionDenied && (
                                    <Chip 
                                        icon={<LocationOn />} 
                                        label="Location access denied" 
                                        color="error" 
                                        variant="outlined"
                                        size="small"
                                        sx={{ mt: 1 }}
                                    />
                                )}
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Box component="form" onSubmit={handleSearch} sx={{ display: 'flex', gap: 1 }}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        placeholder="Enter city or zip code"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        variant="outlined"
                                        sx={{
                                            input: { color: 'white' },
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                                },
                                                '&:hover fieldset': {
                                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                                },
                                                '&.Mui-focused fieldset': {
                                                    borderColor: 'primary.light',
                                                },
                                            },
                                            '& .MuiInputLabel-root': {
                                                color: 'rgba(255, 255, 255, 0.7)',
                                            }
                                        }}
                                    />
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        startIcon={<Search />}
                                        disabled={refreshing}
                                        sx={{
                                            bgcolor: 'primary.main',
                                            '&:hover': { bgcolor: 'primary.dark' }
                                        }}
                                    >
                                        Search
                                    </Button>
                                    <IconButton
                                        onClick={() => getGeoLocationDetails(true)}
                                        disabled={refreshing}
                                        sx={{
                                            color: permissionDenied ? 'error.main' : 'primary.light',
                                            border: '1px solid',
                                            borderColor: permissionDenied ? 'error.main' : 'primary.main',
                                            '&:hover': {
                                                bgcolor: permissionDenied ? 'rgba(244, 67, 54, 0.1)' : 'rgba(25, 118, 210, 0.1)'
                                            }
                                        }}
                                        title="Get current location"
                                    >
                                        <LocationOn />
                                    </IconButton>
                                </Box>
                            </Grid>
                        </Grid>
                    </WeatherCard>
                </motion.div>

                <Box sx={{ mt: 3 }} />

                {/* Main Weather Card */}
                <AnimatePresence mode="wait">
                    {weatherData && (
                        <motion.div
                            key={weatherData.name}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.5 }}
                        >
                            <WeatherCard>
                                {/* Location and Basic Info */}
                                <Grid container spacing={3} alignItems="center">
                                    <Grid item xs={12} md={6}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <LocationOn sx={{ mr: 1, color: 'primary.light' }} />
                                            <Typography variant="h4" component="h2" fontWeight="bold" color="white">
                                                {weatherData.name}, {weatherData.sys.country}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h2" component="span" fontWeight="bold" color="primary.light">
                                                {weatherIcons[weatherData.weather[0].icon] || '🌤️'}
                                            </Typography>
                                            <Box sx={{ ml: 2 }}>
                                                <Typography variant="h5" fontWeight="medium" color="white">
                                                    {weatherData.weather[0].main}
                                                </Typography>
                                                <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                                                    {weatherData.weather[0].description}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Typography variant="h3" component="div" fontWeight="bold" color="primary.light">
                                            {Math.round(weatherData.main.temp - 273.15)}°C
                                        </Typography>

                                        <Chip
                                            label={CommonServices.getTimeDateFromTimeStamp(weatherData.dt * 1000).date}
                                            variant="outlined"
                                            sx={{
                                                mt: 1,
                                                color: 'white',
                                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                                bgcolor: 'rgba(255, 255, 255, 0.1)'
                                            }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                            <img
                                                src={`https://openweathermap.org/img/w/${weatherData.weather[0].icon}.png`}
                                                alt={weatherData.weather[0].description}
                                                style={{ width: 120, height: 120, filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.3))' }}
                                            />
                                        </Box>
                                    </Grid>
                                </Grid>

                                <Divider sx={{ my: 3, bgcolor: 'rgba(255, 255, 255, 0.1)' }} />

                                {/* Weather Details Grid */}
                                <Grid container spacing={2}>
                                    <WeatherInfoItem
                                        icon="🌡️"
                                        label="Feels Like"
                                        value={Math.round(weatherData.main.feels_like - 273.15)}
                                        unit="°C"
                                    />
                                    <WeatherInfoItem
                                        icon="💧"
                                        label="Humidity"
                                        value={weatherData.main.humidity}
                                        unit="%"
                                    />
                                    <WeatherInfoItem
                                        icon="💨"
                                        label="Wind Speed"
                                        value={weatherData.wind.speed}
                                        unit="m/s"
                                    />
                                    <WeatherInfoItem
                                        icon="📊"
                                        label="Pressure"
                                        value={weatherData.main.pressure}
                                        unit="hPa"
                                    />
                                    <WeatherInfoItem
                                        icon="🌅"
                                        label="Sunrise"
                                        value={CommonServices.getTimeDateFromTimeStamp(weatherData.sys.sunrise * 1000).time}
                                        unit=""
                                    />
                                    <WeatherInfoItem
                                        icon="🌇"
                                        label="Sunset"
                                        value={CommonServices.getTimeDateFromTimeStamp(weatherData.sys.sunset * 1000).time}
                                        unit=""
                                    />
                                    <WeatherInfoItem
                                        icon="👀"
                                        label="Visibility"
                                        value={(weatherData.visibility / 1000).toFixed(1)}
                                        unit="km"
                                    />
                                    <WeatherInfoItem
                                        icon="☁️"
                                        label="Cloudiness"
                                        value={weatherData.clouds?.all || 0}
                                        unit="%"
                                    />
                                </Grid>

                                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Refresh />}
                                        onClick={() => getGeoLocationDetails(true)}
                                        disabled={refreshing}
                                        sx={{
                                            color: 'primary.light',
                                            borderColor: 'primary.main',
                                            '&:hover': {
                                                borderColor: 'primary.light',
                                                bgcolor: 'rgba(25, 118, 210, 0.1)'
                                            }
                                        }}
                                    >
                                        Refresh Data
                                    </Button>
                                </Box>
                            </WeatherCard>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Map Section */}
                {weatherData && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                    >
                        <Box sx={{ mt: 4 }}>
                            <Typography
                                variant="h5"
                                component="h3"
                                gutterBottom
                                textAlign="center"
                                fontWeight="bold"
                                color="primary.light"
                            >
                                <MapOutlined sx={{ verticalAlign: 'middle', mr: 1 }} />
                                Location on Map
                            </Typography>

                            <Map
                                lat={weatherData.coord.lat}
                                lon={weatherData.coord.lon}
                                name={weatherData.name}
                            />
                        </Box>
                    </motion.div>
                )}

                {/* Note */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                >
                    <Typography
                        variant="body2"
                        color="rgba(255, 255, 255, 0.7)"
                        sx={{
                            mt: 3,
                            p: 2,
                            bgcolor: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: 2,
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                    >
                        <strong>Note:</strong> For accurate current location data, please allow location permissions in your browser.
                    </Typography>
                </motion.div>
            </Container>
        </Box>
    );
}

export default Weather;