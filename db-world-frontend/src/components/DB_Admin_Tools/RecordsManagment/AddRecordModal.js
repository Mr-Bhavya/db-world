import { Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, Grid, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AddDbCinemaRecord, searchTmdbByQuery, UpdateDbCinemaRecord } from '../../ApiServices';
import Constants from '../../Constants';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from '@mui/icons-material';
import { toast } from '../../Toast';

function AddRecordModal({
    recordDialogOpen,
    recordDialogClose,
    fetchRecords = () => { console.warn('fetchRecords function not provided') },
}) {
    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
    const [newRecordLoader, setNewRecordLoader] = useState(false);
    const [tmdbOptions, setTmdbOptions] = useState([]);
    const [loadingTmdb, setLoadingTmdb] = useState(false);
    const formType = watch('type');
    const formName = watch('name');
    const navigate = useNavigate();
    const location = useLocation();


    const closeRecordDialog = () => {
        setTmdbOptions([]);
        reset({
            type: '',
            name: '',
            releaseYear: '',
            tmdb: '',
            showOnTop: false
        });
        recordDialogClose();
    };

    // Form Submission
    const onSubmit = async (data) => {
        try {
            setNewRecordLoader(true);
            const res = await AddDbCinemaRecord(data.name, data.type, data.tmdb);
            handleApiResponse(res, 'Record added successfully', true);
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setNewRecordLoader(false);
            closeRecordDialog();
        }
    };

    const handleApiResponse = (res, successMessage, isAdd = false) => {
        if (res.httpStatusCode === (isAdd ? 201 : 200)) {
            toast.success(successMessage);
            if (successMessage !== 'TMDB data refreshed') {
                fetchRecords();
            }
        } else if (res.httpStatusCode === 401) {
            toast.error(res.message + Constants.RE_LOGIN);
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        } else {
            toast.error(res.message || 'Operation failed');
        }
    };

    // TMDB Search
    const searchTmdb = async () => {
        if (!formType || !formName) {
            toast.warning('Please fill in both Type and Name fields');
            return;
        }

        setLoadingTmdb(true);
        try {
            const res = await searchTmdbByQuery(
                formType,
                formName,
                watch('releaseYear')
            );
            if (res.httpStatusCode === 200) {
                setTmdbOptions(res.data);
            } else if (res.httpStatusCode === 401) {
                navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error('Failed to search TMDB');
        } finally {
            setLoadingTmdb(false);
        }
    };

    return (
        <Dialog open={recordDialogOpen} onClose={closeRecordDialog} maxWidth="sm" fullWidth>
            <DialogTitle>{'Add New Record'}</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Grid container spacing={2}>
                        {/* Type */}
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth sx={{ width: '150px' }}>
                                <InputLabel>Type</InputLabel>
                                <Select
                                    label="Type"
                                    {...register('type', { required: 'Type is required' })}
                                    error={!!errors.type}
                                    value={watch('type') || ''}
                                >
                                    <MenuItem value="movie">Movie</MenuItem>
                                    <MenuItem value="series">TV Show</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Name */}
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Name"
                                {...register('name', { required: 'Name is required' })}
                                error={!!errors.name}
                                helperText={errors.name?.message}
                            />
                        </Grid>

                        {/* Release Year */}
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Release Year"
                                type="number"
                                {...register('releaseYear')}
                            />
                        </Grid>

                        {/* TMDB Select + Search */}
                        <Grid item xs={12}>
                            <Grid container spacing={1}>
                                <Grid item xs={12} sm={9}>
                                    <FormControl fullWidth sx={{ width: '200px' }}>
                                        <InputLabel>TMDB Results</InputLabel>
                                        <Select
                                            label="TMDB Results"
                                            onChange={(e) => setValue('tmdb', e.target.value)}
                                            value={watch('tmdb') || ''}
                                        >
                                            {tmdbOptions.map((option) => (
                                                <MenuItem key={option.id} value={option.id}>
                                                    {option.title} | {option.originalTitle} | {option.releaseDate}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        onClick={searchTmdb}
                                        disabled={loadingTmdb || !formType || !formName}
                                        startIcon={loadingTmdb ? <CircularProgress size={20} /> : <Search />}
                                    >
                                        Search TMDB
                                    </Button>
                                </Grid>
                            </Grid>
                        </Grid>

                        {/* Show on Top */}
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={<Checkbox {...register('showOnTop')} />}
                                label="Show on Top"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>

                <DialogActions>
                    <Button onClick={closeRecordDialog}>Cancel</Button>
                    {
                        newRecordLoader && (
                            <Button disabled variant="contained" color="primary">
                                <CircularProgress size={24} sx={{ mx: 1 }} /> adding...
                            </Button>
                        ) ||
                        <Button type="submit" variant="contained">
                            {'Create'}
                        </Button>
                    }
                </DialogActions>
            </form>
        </Dialog>
    );
}

export default AddRecordModal;