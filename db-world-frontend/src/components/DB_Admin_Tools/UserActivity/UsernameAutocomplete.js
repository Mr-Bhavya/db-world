import React, { useState, useEffect, useMemo } from 'react';
import { 
    TextField, 
    Autocomplete, 
    InputAdornment,
    CircularProgress,
    Typography,
    Box
} from '@mui/material';
import { Person as PersonIcon, Error as ErrorIcon } from '@mui/icons-material';
import debounce from 'lodash/debounce';
import axiosInstance from '../../Utils/AxiosInstants';

const UsernameAutocomplete = ({ value, onChange, onInputChange, error, helperText }) => {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [fetchError, setFetchError] = useState(null);

    const fetchUsernames = async (query) => {
        setLoading(true);
        setFetchError(null);
        try {
            const response = await axiosInstance.get('/api/admin/user/search', {
                params: { query, limit: 10 }
            });
            
            // Check if response.data exists and is an array
            if (response.data && Array.isArray(response.data)) {
                setOptions(response.data.map(user => ({
                    label: `${user.fullName} (${user.email})`,
                    value: user.email,
                    userObject: user
                })));
            } else if (response.data?.data && Array.isArray(response.data.data)) {
                // Handle case where users are in response.data.data
                setOptions(response.data.data.map(user => ({
                    label: `${user.fullName} (${user.email})`,
                    value: user.email,
                    userObject: user
                })));
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching usernames:', error);
            setFetchError(error.message || 'Failed to fetch users');
            setOptions([]);
        } finally {
            setLoading(false);
        }
    };

    const debouncedFetch = useMemo(
        () => debounce(fetchUsernames, 500),
        []
    );

    useEffect(() => {
        if (inputValue.length > 2) {
            debouncedFetch(inputValue);
            onInputChange?.(inputValue);
        } else if (inputValue.length === 0) {
            setOptions([]);
            onInputChange?.('');
        }
    }, [inputValue, debouncedFetch, onInputChange]);

    useEffect(() => {
        return () => {
            debouncedFetch.cancel();
        };
    }, [debouncedFetch]);

    const getOptionLabel = (option) => {
        if (typeof option === 'string') return option;
        return option.label;
    };

    const isOptionEqualToValue = (option, value) => {
        if (!option || !value) return false;
        if (typeof option === 'string' || typeof value === 'string') {
            return option === value;
        }
        return option.value === value.value;
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Autocomplete
                options={options}
                value={value}
                onChange={(event, newValue) => onChange(newValue)}
                inputValue={inputValue}
                onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
                freeSolo
                fullWidth
                getOptionLabel={getOptionLabel}
                isOptionEqualToValue={isOptionEqualToValue}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Search user"
                        size="small"
                        error={error || Boolean(fetchError)}
                        helperText={helperText || fetchError}
                        InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                                <InputAdornment position="start">
                                    <PersonIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <>
                                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                    {fetchError && !loading && (
                                        <ErrorIcon color="error" fontSize="small" />
                                    )}
                                    {params.InputProps.endAdornment}
                                </>
                            )
                        }}
                    />
                )}
                renderOption={(props, option) => (
                    <li {...props} key={option.value}>
                        <Typography noWrap>
                            {option.label}
                        </Typography>
                    </li>
                )}
                noOptionsText={
                    inputValue.length > 2 ? 
                        (loading ? 'Searching...' : fetchError || 'No users found') : 
                        'Type at least 3 characters to search'
                }
            />
        </Box>
    );
};

export default React.memo(UsernameAutocomplete);