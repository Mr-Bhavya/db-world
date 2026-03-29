import React, { useState } from 'react';
import {
  Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, Grid, InputLabel, MenuItem, Select, TextField,
  Box, Typography, Chip, Avatar, Card, CardContent, Divider, IconButton,
  useTheme, useMediaQuery, Stepper, Step, StepLabel, Tooltip, Fade
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { 
  Search as SearchIcon,
  Close as CloseIcon,
  Movie as MovieIcon,
  LiveTv as TvIcon,
  Star as StarIcon,
  CalendarToday as CalendarIcon,
  Language as LanguageIcon,
  Theaters as TheatersIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { AddDbCinemaRecord, searchTmdbByQuery, UpdateDbCinemaRecord } from '@shared/services/ApiServices';
import Constants from '@shared/constants';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from '@shared/components/ui/Toast';

const MotionDialog = motion(Dialog);
const MotionCard = motion(Card);

const TMDBResultCard = ({ option, isSelected, onSelect, type }) => {
  const theme = useTheme();
  
  return (
    <MotionCard
      sx={{
        border: isSelected ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        background: isSelected 
          ? `linear-gradient(135deg, ${theme.palette.primary.light}15 0%, ${theme.palette.primary.main}15 100%)`
          : theme.palette.background.paper,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          {/* Poster */}
          <Avatar
            variant="rounded"
            src={option.posterPath ? `https://image.tmdb.org/t/p/w200${option.posterPath}` : undefined}
            sx={{ 
              width: 60, 
              height: 90,
              bgcolor: theme.palette.action.hover,
              fontSize: '2rem'
            }}
          >
            {type === 'movie' ? <MovieIcon /> : <TvIcon />}
          </Avatar>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Title Row */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}
              >
                {option.title || option.name}
              </Typography>
              {option.voteAverage && (
                <Chip
                  icon={<StarIcon sx={{ fontSize: 16 }} />}
                  label={option.voteAverage.toFixed(1)}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Box>

            {/* Original Title */}
            {option.originalTitle && option.originalTitle !== option.title && (
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: 1
                }}
              >
                <LanguageIcon sx={{ fontSize: 14 }} />
                {option.originalTitle}
              </Typography>
            )}

            {/* Details */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {option.releaseDate && (
                <Chip
                  icon={<CalendarIcon sx={{ fontSize: 14 }} />}
                  label={new Date(option.releaseDate).getFullYear()}
                  size="small"
                  variant="outlined"
                />
              )}
              {option.mediaType && (
                <Chip
                  icon={<TheatersIcon sx={{ fontSize: 14 }} />}
                  label={option.mediaType}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              )}
            </Box>

            {/* Overview */}
            {option.overview && (
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{
                  mt: 1,
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}
              >
                {option.overview}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </MotionCard>
  );
};

function AddRecordModal({
  recordDialogOpen,
  recordDialogClose,
  fetchRecords = () => { console.warn('fetchRecords function not provided') },
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
  const [newRecordLoader, setNewRecordLoader] = useState(false);
  const [tmdbOptions, setTmdbOptions] = useState([]);
  const [loadingTmdb, setLoadingTmdb] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  
  const formType = watch('type');
  const formName = watch('name');
  const selectedTmdb = watch('tmdb');
  
  const navigate = useNavigate();
  const location = useLocation();

  const steps = ['Basic Info', 'TMDB Link', 'Review'];

  const closeRecordDialog = () => {
    setTmdbOptions([]);
    setActiveStep(0);
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
      const res = error.response?.data;
      if (res) {
        handleApiResponse(res, 'Record added successfully', false);
        return;
      }
      toast.error('An error occurred');
    } finally {
      setNewRecordLoader(false);
      closeRecordDialog();
    }
  };

  const handleApiResponse = (res, successMessage, isAdd = false) => {
    if (res.httpStatusCode === (isAdd ? 201 : 200)) {
      toast.success(res.message || successMessage);
      fetchRecords();
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
        setActiveStep(1);
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

  const handleTmdbSelect = (tmdbId) => {
    setValue('tmdb', tmdbId);
    setActiveStep(2);
  };

  const selectedTmdbOption = tmdbOptions.find(opt => opt.id === selectedTmdb);

  return (
    <MotionDialog
      open={recordDialogOpen}
      onClose={closeRecordDialog}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      TransitionComponent={Fade}
      transitionDuration={400}
    >
      <DialogTitle sx={{ 
        background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}15 100%)`,
        borderBottom: `1px solid ${theme.palette.divider}`,
        py: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" fontWeight="bold">
            Add New Record
          </Typography>
          <IconButton onClick={closeRecordDialog} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mt: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{!isMobile && label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ p: 3 }}>
          <AnimatePresence mode="wait">
            {/* Step 1: Basic Information */}
            {activeStep === 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <Grid container spacing={3}>
                  {/* Type Selection */}
                  <Grid item xs={12} sm={6} sx={{minWidth: 180}}>
                    <FormControl fullWidth>
                      <InputLabel>Record Type</InputLabel>
                      <Select
                        label="Record Type"
                        {...register('type', { required: 'Type is required' })}
                        error={!!errors.type}
                        value={watch('type') || ''}
                        startAdornment={
                          formType && (
                            <Box sx={{ mr: 1, display: 'flex' }}>
                              {formType === 'movie' ? (
                                <MovieIcon color="primary" />
                              ) : (
                                <TvIcon color="secondary" />
                              )}
                            </Box>
                          )
                        }
                      >
                        <MenuItem value="movie">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {/* <MovieIcon color="primary" sx={{ fontSize: 20 }} /> */}
                            Movie
                          </Box>
                        </MenuItem>
                        <MenuItem value="series">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {/* <TvIcon color="secondary" sx={{ fontSize: 20 }} /> */}
                            TV Show
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Name */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Title"
                      {...register('name', { required: 'Title is required' })}
                      error={!!errors.name}
                      helperText={errors.name?.message}
                    />
                  </Grid>

                  {/* Release Year */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Release Year"
                      type="number"
                      {...register('releaseYear')}
                      InputProps={{
                        startAdornment: (
                          <CalendarIcon sx={{ color: 'text.secondary', mr: 1 }} />
                        )
                      }}
                    />
                  </Grid>

                  {/* Action Button */}
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      onClick={searchTmdb}
                      disabled={loadingTmdb || !formType || !formName}
                      startIcon={loadingTmdb ? <CircularProgress size={20} /> : <SearchIcon />}
                      sx={{
                        py: 1.5,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                        }
                      }}
                    >
                      {loadingTmdb ? 'Searching TMDB...' : 'Search TMDB'}
                    </Button>
                  </Grid>
                </Grid>
              </motion.div>
            )}

            {/* Step 2: TMDB Results */}
            {activeStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    TMDB Search Results
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Select the correct title from TMDB database
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  {tmdbOptions.map((option) => (
                    <Grid item xs={12} key={option.id}>
                      <TMDBResultCard
                        option={option}
                        type={formType}
                        isSelected={selectedTmdb === option.id}
                        onSelect={() => handleTmdbSelect(option.id)}
                      />
                    </Grid>
                  ))}
                  
                  {tmdbOptions.length === 0 && !loadingTmdb && (
                    <Grid item xs={12}>
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          No results found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Try adjusting your search terms
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </motion.div>
            )}

            {/* Step 3: Review & Submit */}
            {activeStep === 2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.3 }}
              >
                <Typography variant="h6" gutterBottom>
                  Review & Create
                </Typography>

                <Card sx={{ mb: 3, border: `1px solid ${theme.palette.divider}` }}>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Type
                        </Typography>
                        <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {formType === 'movie' ? <MovieIcon color="primary" /> : <TvIcon color="secondary" />}
                          {formType?.charAt(0).toUpperCase() + formType?.slice(1)}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Title
                        </Typography>
                        <Typography variant="body1" fontWeight="600">
                          {formName}
                        </Typography>
                      </Grid>

                      {selectedTmdbOption && (
                        <>
                          <Grid item xs={12}>
                            <Divider sx={{ my: 1 }} />
                          </Grid>
                          
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              Selected TMDB Entry
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                              <Avatar
                                variant="rounded"
                                src={selectedTmdbOption.posterPath ? `https://image.tmdb.org/t/p/w200${selectedTmdbOption.posterPath}` : undefined}
                                sx={{ width: 60, height: 90 }}
                              >
                                {formType === 'movie' ? <MovieIcon /> : <TvIcon />}
                              </Avatar>
                              <Box>
                                <Typography variant="body1" fontWeight="600">
                                  {selectedTmdbOption.title || selectedTmdbOption.name}
                                </Typography>
                                {selectedTmdbOption.releaseDate && (
                                  <Typography variant="body2" color="text.secondary">
                                    {new Date(selectedTmdbOption.releaseDate).getFullYear()}
                                  </Typography>
                                )}
                                {selectedTmdbOption.voteAverage && (
                                  <Typography variant="body2" color="text.secondary">
                                    Rating: {selectedTmdbOption.voteAverage.toFixed(1)}/10
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Grid>
                        </>
                      )}
                    </Grid>
                  </CardContent>
                </Card>

                <FormControlLabel
                  control={<Checkbox {...register('showOnTop')} color="primary" />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StarIcon color="warning" />
                      <Typography variant="body2" fontWeight="600">
                        Show on Top
                      </Typography>
                    </Box>
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
          {activeStep > 0 && (
            <Button 
              onClick={() => setActiveStep(activeStep - 1)}
              variant="outlined"
            >
              Back
            </Button>
          )}
          
          <Button 
            onClick={closeRecordDialog} 
            variant="outlined"
            color="inherit"
          >
            Cancel
          </Button>

          {activeStep === 2 ? (
            newRecordLoader ? (
              <Button disabled variant="contained" sx={{ minWidth: 120 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Creating...
              </Button>
            ) : (
              <Button 
                type="submit" 
                variant="contained"
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                  minWidth: 120
                }}
              >
                Create Record
              </Button>
            )
          ) : (
            <Button 
              onClick={searchTmdb}
              disabled={loadingTmdb || !formType || !formName}
              variant="contained"
            >
              {loadingTmdb ? <CircularProgress size={20} /> : 'Continue'}
            </Button>
          )}
        </DialogActions>
      </form>
    </MotionDialog>
  );
}

export default AddRecordModal;