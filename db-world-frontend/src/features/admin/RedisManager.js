import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Grid,
    Divider,
    Snackbar,
    CircularProgress,
    IconButton,
    Tooltip,
    Box,
    InputAdornment,
    Checkbox,
    FormControlLabel,
    Chip,
    Alert,
    Paper,
    alpha,
    useTheme
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Clear as ClearIcon,
    Search as SearchIcon,
    Key as KeyIcon,
    DataArray as DataIcon,
    Schedule as TTLIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { debounce } from 'lodash';

const RedisManager = () => {
    const theme = useTheme();
    const [keys, setKeys] = useState([]);
    const [pattern, setPattern] = useState('*');
    const [selectedKey, setSelectedKey] = useState('');
    const [value, setValue] = useState('');
    const [ttl, setTtl] = useState('');
    const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
    const [loading, setLoading] = useState({
        keys: false,
        value: false,
        operation: false
    });
    const [selectedKeys, setSelectedKeys] = useState(new Set());
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const notify = (message, severity = 'success') => 
        setSnack({ open: true, message, severity });

    const fetchKeys = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, keys: true }));
            setError(null);
            const res = await axiosInstance.get(`/api/redis/keys?pattern=${pattern}`);
            const fetchedKeys = res.data ? Array.from(res.data) : [];
            setKeys(fetchedKeys);
            setSelectedKeys(prev => new Set([...prev].filter(k => fetchedKeys.includes(k))));
        } catch (err) {
            setError('Failed to fetch keys from Redis server');
            notify('Failed to fetch keys', 'error');
        } finally {
            setLoading(prev => ({ ...prev, keys: false }));
        }
    }, [pattern]);

    const debouncedFetchKeys = useCallback(debounce(fetchKeys, 500), [fetchKeys]);

    const getValue = useCallback(async () => {
        if (!selectedKey) return;
        try {
            setLoading(prev => ({ ...prev, value: true }));
            const res = await axiosInstance.get(`/api/redis/get?key=${selectedKey}`);
            setValue(typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : res.data || '');
        } catch {
            notify('Failed to fetch value for the selected key', 'error');
        } finally {
            setLoading(prev => ({ ...prev, value: false }));
        }
    }, [selectedKey]);

    const performOperation = async (operation, successMessage) => {
        try {
            setLoading(prev => ({ ...prev, operation: true }));
            await operation();
            notify(successMessage, 'success');
            fetchKeys();
        } catch {
            notify('Operation failed. Please try again.', 'error');
        } finally {
            setLoading(prev => ({ ...prev, operation: false }));
        }
    };

    const setValueApi = () => {
        if (!selectedKey) return notify('Please select or enter a key', 'warning');
        performOperation(
            () => axiosInstance.post(`/api/redis/set`, null, {
                params: {
                    key: selectedKey,
                    value,
                    ttlSeconds: ttl || undefined,
                },
            }),
            'Key set successfully in Redis'
        );
    };

    const updateValue = () => {
        if (!selectedKey) return notify('Please select a key to update', 'warning');
        performOperation(
            () => axiosInstance.put(`/api/redis/update`, null, {
                params: {
                    key: selectedKey,
                    newValue: value,
                },
            }),
            'Key value updated successfully'
        );
    };

    const deleteKey = () => {
        if (!selectedKey) return;
        performOperation(
            async () => {
                await axiosInstance.delete(`/api/redis/delete?key=${selectedKey}`);
                setSelectedKey('');
                setValue('');
            },
            'Key deleted from Redis'
        );
    };

    const deleteAll = () => {
        if (!keys.length) return notify('No keys to delete', 'warning');
        performOperation(
            async () => {
                await axiosInstance.delete(`/api/redis/delete-all`, {
                    params: {
                        pattern,
                        confirm: true
                    }
                });
                setSelectedKey('');
                setValue('');
            },
            'All matching keys deleted successfully'
        );
    };

    const deleteSelected = () => {
        if (!selectedKeys.size) return notify('No keys selected for deletion', 'warning');
        performOperation(
            async () => {
                await axiosInstance.delete(`/api/redis/delete/batch`, {
                    data: Array.from(selectedKeys)
                });
                setSelectedKey('');
                setValue('');
                setSelectedKeys(new Set());
            },
            'Selected keys deleted successfully'
        );
    };

    const toggleKeySelection = (key) => {
        const updated = new Set(selectedKeys);
        updated.has(key) ? updated.delete(key) : updated.add(key);
        setSelectedKeys(updated);
    };

    const filteredKeys = keys.filter(key => 
        key.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        debouncedFetchKeys();
        return () => debouncedFetchKeys.cancel();
    }, [pattern]);

    useEffect(() => {
        if (selectedKey) getValue();
    }, [selectedKey, getValue]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
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
                stiffness: 100
            }
        }
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            style={{ height: '100%' }}
        >
            <Box sx={{ p: 3, height: '100%' }}>
                {/* Header */}
                <motion.div variants={itemVariants}>
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        mb: 4,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                        p: 3,
                        borderRadius: 3,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
                    }}>
                        <Box>
                            <Typography 
                                variant="h3" 
                                fontWeight="bold"
                                gutterBottom
                                sx={{
                                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent'
                                }}
                            >
                                Redis Cache Manager
                            </Typography>
                            <Typography variant="h6" color="text.secondary">
                                Manage Redis keys and values in real-time
                            </Typography>
                        </Box>
                        <Tooltip title="Refresh Redis keys">
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                <IconButton 
                                    onClick={fetchKeys} 
                                    disabled={loading.keys}
                                    sx={{
                                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                                        color: 'white',
                                        '&:hover': {
                                            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                                        }
                                    }}
                                >
                                    {loading.keys ? <CircularProgress size={24} sx={{ color: 'white' }} /> : <RefreshIcon />}
                                </IconButton>
                            </motion.div>
                        </Tooltip>
                    </Box>
                </motion.div>

                {/* Stats Bar */}
                <motion.div variants={itemVariants}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                        <Chip 
                            icon={<KeyIcon />} 
                            label={`${keys.length} Keys`}
                            variant="outlined"
                            color="primary"
                        />
                        <Chip 
                            icon={<DataIcon />} 
                            label={`${selectedKeys.size} Selected`}
                            variant="outlined"
                            color="secondary"
                        />
                        {error && (
                            <Chip 
                                icon={<WarningIcon />} 
                                label="Connection Error"
                                color="error"
                                variant="outlined"
                            />
                        )}
                    </Box>
                </motion.div>

                <Grid container spacing={3}>
                    {/* Left Panel - Keys List */}
                    <Grid item xs={12} md={4}>
                        <motion.div variants={itemVariants}>
                            <Card
                                sx={{
                                    height: '100%',
                                    background: alpha(theme.palette.background.paper, 0.8),
                                    backdropFilter: 'blur(10px)',
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                                    borderRadius: 3,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                                }}
                            >
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <KeyIcon color="primary" />
                                        Redis Keys
                                    </Typography>
                                    
                                    <TextField
                                        label="Key Pattern"
                                        value={pattern}
                                        onChange={(e) => setPattern(e.target.value)}
                                        fullWidth
                                        size="small"
                                        sx={{ mb: 2 }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon color="action" />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />

                                    <TextField
                                        placeholder="Search keys..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        fullWidth
                                        size="small"
                                        sx={{ mb: 2 }}
                                    />

                                    <Divider sx={{ my: 2 }} />

                                    {/* Keys List */}
                                    <Box sx={{ maxHeight: '50vh', overflowY: 'auto', pr: 1 }}>
                                        <AnimatePresence>
                                            {filteredKeys.map((key) => (
                                                <motion.div
                                                    key={key}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    <Card
                                                        sx={{
                                                            mb: 1,
                                                            cursor: 'pointer',
                                                            background: selectedKey === key 
                                                                ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`
                                                                : alpha(theme.palette.background.paper, 0.6),
                                                            border: selectedKey === key 
                                                                ? `2px solid ${theme.palette.primary.main}`
                                                                : `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                                                            transition: 'all 0.3s ease',
                                                            '&:hover': {
                                                                borderColor: theme.palette.primary.main,
                                                                boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`
                                                            }
                                                        }}
                                                    >
                                                        <CardContent
                                                            sx={{ py: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                                                            onClick={() => setSelectedKey(key)}
                                                        >
                                                            <Checkbox
                                                                checked={selectedKeys.has(key)}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleKeySelection(key);
                                                                }}
                                                                size="small"
                                                                color="primary"
                                                            />
                                                            <Typography 
                                                                variant="body2" 
                                                                noWrap 
                                                                sx={{ 
                                                                    flex: 1,
                                                                    fontFamily: 'Monaco, Consolas, monospace',
                                                                    fontSize: '0.8rem'
                                                                }}
                                                            >
                                                                {key}
                                                            </Typography>
                                                        </CardContent>
                                                    </Card>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </Box>

                                    {/* Bulk Actions */}
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                onClick={deleteAll}
                                                disabled={loading.operation || keys.length === 0}
                                                startIcon={<DeleteIcon />}
                                                fullWidth
                                                size="small"
                                            >
                                                Delete All ({keys.length})
                                            </Button>
                                        </motion.div>
                                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                            <Button
                                                variant="contained"
                                                color="error"
                                                onClick={deleteSelected}
                                                disabled={loading.operation || selectedKeys.size === 0}
                                                startIcon={<DeleteIcon />}
                                                fullWidth
                                                size="small"
                                            >
                                                Delete Selected ({selectedKeys.size})
                                            </Button>
                                        </motion.div>
                                    </Box>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>

                    {/* Right Panel - Key Operations */}
                    <Grid item xs={12} md={8}>
                        <motion.div variants={itemVariants}>
                            <Card
                                sx={{
                                    height: '100%',
                                    background: alpha(theme.palette.background.paper, 0.8),
                                    backdropFilter: 'blur(10px)',
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                                    borderRadius: 3,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                                }}
                            >
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <DataIcon color="primary" />
                                        Key Operations
                                    </Typography>

                                    {/* Key Input */}
                                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                                        <TextField
                                            label="Selected Key"
                                            value={selectedKey}
                                            onChange={(e) => setSelectedKey(e.target.value)}
                                            fullWidth
                                            size="small"
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <KeyIcon color="action" />
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                        <Tooltip title="Clear selection">
                                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                                <IconButton
                                                    onClick={() => {
                                                        setSelectedKey('');
                                                        setValue('');
                                                    }}
                                                    disabled={loading.operation}
                                                    sx={{
                                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                                                    }}
                                                >
                                                    <ClearIcon />
                                                </IconButton>
                                            </motion.div>
                                        </Tooltip>
                                    </Box>

                                    {/* Value Editor */}
                                    <TextField
                                        label="Value"
                                        value={value}
                                        onChange={(e) => setValue(e.target.value)}
                                        multiline
                                        fullWidth
                                        rows={12}
                                        sx={{ mb: 2 }}
                                        InputProps={{
                                            startAdornment: loading.value && (
                                                <InputAdornment position="start">
                                                    <CircularProgress size={20} />
                                                </InputAdornment>
                                            ),
                                        }}
                                        placeholder="Enter or edit the value for the selected key..."
                                    />

                                    {/* TTL Input */}
                                    <TextField
                                        label="Time to Live (TTL) in seconds"
                                        value={ttl}
                                        onChange={(e) => setTtl(e.target.value)}
                                        type="number"
                                        fullWidth
                                        size="small"
                                        disabled={loading.operation}
                                        sx={{ mb: 3 }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <TTLIcon color="action" />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />

                                    {/* Action Buttons */}
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={4}>
                                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                                <Button
                                                    variant="contained"
                                                    color="primary"
                                                    onClick={setValueApi}
                                                    fullWidth
                                                    disabled={loading.operation || !selectedKey}
                                                    startIcon={loading.operation ? <CircularProgress size={16} /> : <SaveIcon />}
                                                    sx={{
                                                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                                                        '&:hover': {
                                                            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                                                        }
                                                    }}
                                                >
                                                    Set Key
                                                </Button>
                                            </motion.div>
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                                <Button
                                                    variant="contained"
                                                    color="warning"
                                                    onClick={updateValue}
                                                    fullWidth
                                                    disabled={loading.operation || !selectedKey}
                                                    startIcon={loading.operation ? <CircularProgress size={16} /> : <EditIcon />}
                                                >
                                                    Update
                                                </Button>
                                            </motion.div>
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                                <Button
                                                    variant="contained"
                                                    color="error"
                                                    onClick={deleteKey}
                                                    fullWidth
                                                    disabled={loading.operation || !selectedKey}
                                                    startIcon={loading.operation ? <CircularProgress size={16} /> : <DeleteIcon />}
                                                >
                                                    Delete
                                                </Button>
                                            </motion.div>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>
                </Grid>

                {/* Snackbar Notification */}
                <Snackbar
                    open={snack.open}
                    autoHideDuration={4000}
                    onClose={() => setSnack({ ...snack, open: false })}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    <Alert 
                        onClose={() => setSnack({ ...snack, open: false })} 
                        severity={snack.severity}
                        variant="filled"
                        sx={{ width: '100%' }}
                    >
                        {snack.message}
                    </Alert>
                </Snackbar>
            </Box>
        </motion.div>
    );
};

export default RedisManager;