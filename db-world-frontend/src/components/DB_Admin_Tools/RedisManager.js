import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
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
    FormControlLabel
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import axiosInstance from '../Utils/AxiosInstants';
import { debounce } from 'lodash';

const RedisManager = () => {
    const [keys, setKeys] = useState([]);
    const [pattern, setPattern] = useState('*');
    const [selectedKey, setSelectedKey] = useState('');
    const [value, setValue] = useState('');
    const [ttl, setTtl] = useState('');
    const [snack, setSnack] = useState({ open: false, message: '' });
    const [loading, setLoading] = useState({
        keys: false,
        value: false,
        operation: false
    });
    const [selectedKeys, setSelectedKeys] = useState(new Set());
    const [error, setError] = useState(null);

    const notify = (message) => setSnack({ open: true, message });

    const fetchKeys = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, keys: true }));
            setError(null);
            const res = await axiosInstance.get(`/api/redis/keys?pattern=${pattern}`);
            const fetchedKeys = res.data ? Array.from(res.data) : [];
            setKeys(fetchedKeys);
            setSelectedKeys(prev => new Set([...prev].filter(k => fetchedKeys.includes(k))));
        } catch (err) {
            setError('Failed to fetch keys');
            notify('Failed to fetch keys');
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
            notify('Failed to fetch value');
        } finally {
            setLoading(prev => ({ ...prev, value: false }));
        }
    }, [selectedKey]);

    const performOperation = async (operation, successMessage) => {
        try {
            setLoading(prev => ({ ...prev, operation: true }));
            await operation();
            notify(successMessage);
            fetchKeys();
        } catch {
            notify('Operation failed');
        } finally {
            setLoading(prev => ({ ...prev, operation: false }));
        }
    };

    const setValueApi = () => {
        if (!selectedKey) return notify('Please select or enter a key');
        performOperation(
            () => axiosInstance.post(`/api/redis/set`, null, {
                params: {
                    key: selectedKey,
                    value,
                    ttlSeconds: ttl || undefined,
                },
            }),
            'Key set successfully'
        );
    };

    const updateValue = () => {
        if (!selectedKey) return notify('Please select a key');
        performOperation(
            () => axiosInstance.put(`/api/redis/update`, null, {
                params: {
                    key: selectedKey,
                    newValue: value,
                },
            }),
            'Key updated'
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
            'Key deleted'
        );
    };

    const deleteAll = () => {
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
            'All matching keys deleted'
        );
    };

    const deleteSelected = () => {
        if (!selectedKeys.size) return notify('No keys selected');
        performOperation(
            async () => {
                await axiosInstance.delete(`/api/redis/delete/batch`, {
                    data: Array.from(selectedKeys)
                });
                setSelectedKey('');
                setValue('');
                setSelectedKeys(new Set());
            },
            'Selected keys deleted'
        );
    };

    const toggleKeySelection = (key) => {
        const updated = new Set(selectedKeys);
        updated.has(key) ? updated.delete(key) : updated.add(key);
        setSelectedKeys(updated);
    };

    useEffect(() => {
        debouncedFetchKeys();
        return () => debouncedFetchKeys.cancel();
    }, [pattern]);

    useEffect(() => {
        if (selectedKey) getValue();
    }, [selectedKey, getValue]);

    return (
        <motion.div
            className="p-4"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" gutterBottom>
                    Redis Key Manager
                </Typography>
                <Tooltip title="Refresh all">
                    <IconButton onClick={fetchKeys} disabled={loading.keys}>
                        {loading.keys ? <CircularProgress size={24} /> : <RefreshIcon />}
                    </IconButton>
                </Tooltip>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <TextField
                        label="Pattern"
                        value={pattern}
                        onChange={(e) => setPattern(e.target.value)}
                        fullWidth
                        variant="outlined"
                        size="small"
                    />

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ maxHeight: '60vh', overflowY: 'auto', pr: 1 }}>
                        {keys.map((key) => (
                            <motion.div key={key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Card
                                    sx={{
                                        mb: 1,
                                        cursor: 'pointer',
                                        backgroundColor: selectedKey === key ? '#e0f7fa' : undefined
                                    }}
                                >
                                    <CardContent
                                        sx={{ py: 1, display: 'flex', alignItems: 'center' }}
                                        onClick={() => setSelectedKey(key)}
                                    >
                                        <Checkbox
                                            checked={selectedKeys.has(key)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                toggleKeySelection(key);
                                            }}
                                            size="small"
                                        />
                                        <Typography noWrap>{key}</Typography>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={deleteAll}
                            disabled={loading.operation || keys.length === 0}
                            startIcon={<DeleteIcon />}
                        >
                            Delete All Keys
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={deleteSelected}
                            disabled={loading.operation || selectedKeys.size === 0}
                            startIcon={<DeleteIcon />}
                        >
                            Delete Selected ({selectedKeys.size})
                        </Button>
                    </Box>
                </Grid>

                <Grid item xs={12} md={8}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                            label="Key"
                            value={selectedKey}
                            onChange={(e) => setSelectedKey(e.target.value)}
                            fullWidth
                            size="small"
                        />
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setSelectedKey('');
                                setValue('');
                            }}
                            disabled={loading.operation}
                        >
                            <ClearIcon />
                        </Button>
                    </Box>

                    <TextField
                        label="Value"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        multiline
                        fullWidth
                        rows={12}
                        sx={{ mb: 2 }}
                        InputProps={{
                            endAdornment: loading.value && (
                                <InputAdornment position="end">
                                    <CircularProgress size={20} />
                                </InputAdornment>
                            ),
                        }}
                    />

                    <TextField
                        label="TTL (seconds)"
                        value={ttl}
                        onChange={(e) => setTtl(e.target.value)}
                        type="number"
                        fullWidth
                        size="small"
                        disabled={loading.operation}
                        sx={{ mb: 2 }}
                    />

                    <Grid container spacing={2}>
                        <Grid item xs={4}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={setValueApi}
                                fullWidth
                                disabled={loading.operation || !selectedKey}
                                startIcon={<SaveIcon />}
                            >
                                {loading.operation ? <CircularProgress size={20} /> : 'Set'}
                            </Button>
                        </Grid>
                        <Grid item xs={4}>
                            <Button
                                variant="contained"
                                color="warning"
                                onClick={updateValue}
                                fullWidth
                                disabled={loading.operation || !selectedKey}
                                startIcon={<EditIcon />}
                            >
                                {loading.operation ? <CircularProgress size={20} /> : 'Update'}
                            </Button>
                        </Grid>
                        <Grid item xs={4}>
                            <Button
                                variant="contained"
                                color="error"
                                onClick={deleteKey}
                                fullWidth
                                disabled={loading.operation || !selectedKey}
                                startIcon={<DeleteIcon />}
                            >
                                {loading.operation ? <CircularProgress size={20} /> : 'Delete'}
                            </Button>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack({ open: false, message: '' })}
                message={snack.message}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            />
        </motion.div>
    );
};

export default RedisManager;
