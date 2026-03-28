import React, { useState, useCallback, useEffect } from 'react';
import {
  Grid, Typography, IconButton, Tooltip, Box, CircularProgress, Fade,
  CardContent, Card, FormControlLabel, CardActions, Chip, Avatar,
  LinearProgress, Rating, useTheme, useMediaQuery,
  Button, Pagination, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Star as StarIcon,
  Theaters as MovieIcon,
  LiveTv as TVIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Visibility as VisibilityIcon,
  Schedule as ScheduleIcon,
  ViewList as ViewListIcon,
  GridView as GridViewIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import SwitchWithLoader from './SwitchWithLoader';

const MotionCard = motion(Card);

// View mode constants
const VIEW_MODES = {
  PAGINATION: 'pagination',
  INFINITE_SCROLL: 'infinite'
};

const StatusBadge = ({ status, size = 'small' }) => {
  const statusConfig = {
    active: { color: 'success', label: 'Active' },
    inactive: { color: 'default', label: 'Inactive' },
    pending: { color: 'warning', label: 'Pending' },
    error: { color: 'error', label: 'Error' }
  };

  const config = statusConfig[status] || statusConfig.inactive;

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      variant="filled"
      sx={{ fontWeight: 600, fontSize: '0.7rem' }}
    />
  );
};

const TypeIcon = ({ type, sx }) => {
  const Icon = type === 'MOVIE' ? MovieIcon : TVIcon;
  return <Icon sx={sx} />;
};

const RecordCard = React.memo(({
  record,
  onToggleShowOnTop,
  onRefreshTmdb,
  onDelete,
  loadingStates,
  refreshingRecords
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const isLoading = loadingStates[record.id];
  const isRefreshing = refreshingRecords[record.id];
  const hasTmdbLink = !!record.tmdb;

  // Calculate rating percentage for visual indicator
  const ratingPercentage = record.rating ? (record.rating / 10) * 100 : 0;

  return (
    <Grid item xs={12} sm={6} md={4} lg={3} xl={2} sx={{ mb: 3 }}>
      <MotionCard
        sx={{
          width: "100%",
          height: "100%",
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: "16px",
          background: `linear-gradient(145deg, ${theme.palette.background.paper} 0%, ${theme.palette.action.hover} 100%)`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          transition: "all 0.3s ease",
          "&:hover": {
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            transform: "translateY(-4px)"
          }
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        layout
      >

        {/* Header with status and type */}
        <CardContent sx={{ p: 0, position: 'relative' }}>
          {/* Background gradient based on type */}
          <Box
            sx={{
              height: 4,
              background: record.type === 'MOVIE'
                ? 'linear-gradient(90deg, #FF6B6B 0%, #FF8E53 100%)'
                : 'linear-gradient(90deg, #4ECDC4 0%, #44A08D 100%)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}
          />

          <Box sx={{ p: 2, pb: 1 }}>
            {/* Title and Type Row */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
              <Tooltip title={record.name} arrow>
                <Typography
                  variant="h6"
                  component="div"
                  sx={{
                    fontWeight: 700,
                    fontSize: isMobile ? '1rem' : '1.1rem',
                    lineHeight: 1.2,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    flex: 1,
                    mr: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {record.name}
                </Typography>
              </Tooltip>
            </Box>

            {/* ID and TMDB Info */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Chip
                label={`ID: ${record.id}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 24 }}
              />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {hasTmdbLink ? (
                  <>
                    <LinkIcon sx={{ fontSize: 16, color: 'success.main' }} />
                    <Chip
                      label={`TMDB: ${record.tmdb}`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 24 }}
                    />
                  </>
                ) : (
                  <>
                    <UnlinkIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.disabled">
                      No TMDB
                    </Typography>
                  </>
                )}
              </Box>
            </Box>

            {/* Rating Section */}
            {record.rating && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Rating
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {record.rating}/10
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={ratingPercentage}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.palette.action.hover,
                    '& .MuiLinearProgress-bar': {
                      background: `linear-gradient(90deg, ${theme.palette.warning.light} 0%, ${theme.palette.warning.main} 100%)`,
                      borderRadius: 3
                    }
                  }}
                />
              </Box>
            )}

            {/* Dates Section */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Tooltip title="Creation Date" arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(record.creationDate).toLocaleDateString()}
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip title="Last Modified" arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(record.lastModifiedDate).toLocaleDateString()}
                  </Typography>
                </Box>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>

        {/* Actions Section */}
        <CardActions sx={{
          p: 2,
          pt: 1,
          mt: 'auto',
          justifyContent: 'space-between',
          borderTop: `1px solid ${theme.palette.divider}`
        }}>
          {/* Show on Top Toggle */}
          <FormControlLabel
            control={
              <SwitchWithLoader
                checked={record.show_on_top}
                onChange={() => onToggleShowOnTop(record.id, record.show_on_top)}
                loading={isLoading}
                size={isMobile ? "small" : "medium"}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Top
                </Typography>
              </Box>
            }
            labelPlacement="start"
            sx={{ m: 0 }}
          />

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {/* Refresh TMDB Button */}
            <Tooltip title={hasTmdbLink ? "Refresh TMDB Data" : "Link to TMDB"} arrow>
              <IconButton
                size={isMobile ? "small" : "medium"}
                onClick={() => onRefreshTmdb(record.id)}
                disabled={isRefreshing}
                sx={{
                  backgroundColor: hasTmdbLink ? 'success.light' : 'action.hover',
                  p: isMobile ? 0.5 : 1,
                  '&:hover': {
                    backgroundColor: hasTmdbLink ? 'success.main' : 'action.selected',
                    '& .MuiSvgIcon-root': {
                      color: 'white'
                    }
                  }
                }}
              >
                {isRefreshing ? (
                  <CircularProgress size={14} /> 
                ) : (
                <RefreshIcon
                  sx={{
                    fontSize: 16,
                    color: hasTmdbLink ? 'success.contrastText' : 'text.secondary'
                  }}
                />)}
              </IconButton>
            </Tooltip>

            {/* Delete Button */}
            <Tooltip title="Delete Record" arrow>
              <IconButton
                size={isMobile ? "small" : "medium"}
                onClick={() => onDelete(record)}
                sx={{
                  backgroundColor: 'error.light',
                  p: isMobile ? 0.5 : 1,
                  '&:hover': {
                    backgroundColor: 'error.main',
                    '& .MuiSvgIcon-root': {
                      color: 'white'
                    }
                  }
                }}
              >
                <DeleteIcon
                  sx={{
                    fontSize: 16,
                    color: 'error.contrastText'
                  }}
                />
              </IconButton>
            </Tooltip>
          </Box>
        </CardActions>
      </MotionCard>
    </Grid>
  );
});

const RecordsCardView = ({
  records,
  loadingMore,
  loaderRef,
  onToggleShowOnTop,
  onRefreshTmdb,
  onDelete,
  loadingStates,
  refreshingRecords,
  // Pagination props
  paginationModel,
  onPaginationModelChange,
  totalRecords,
  pageSizeOptions = [12, 24, 48, 96],
  // View mode control
  viewMode = VIEW_MODES.PAGINATION,
  onViewModeChange
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const { page, pageSize } = paginationModel;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startRecord = page * pageSize + 1;
  const endRecord = Math.min((page + 1) * pageSize, totalRecords);

  // Handle page change
  const handlePageChange = (event, newPage) => {
    onPaginationModelChange({
      page: newPage - 1, // Convert to 0-based
      pageSize
    });
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle page size change
  const handlePageSizeChange = (event) => {
    const newPageSize = event.target.value;
    onPaginationModelChange({
      page: 0, // Reset to first page
      pageSize: newPageSize
    });
  };

  if (records.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">
          No records found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Try adjusting your search or filters
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 2 }}>
      {/* View Controls */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexWrap: 'wrap',
        gap: 2
      }}>
        {/* Records Info */}
        <Typography variant="body2" color="text.primary">
          {totalRecords === 0 ? 'No records' : `Showing ${startRecord}-${endRecord} of ${totalRecords}`}
        </Typography>

        {/* View Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          {/* {onViewModeChange && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Pagination View">
                <IconButton
                  size="small"
                  onClick={() => onViewModeChange(VIEW_MODES.PAGINATION)}
                  color={viewMode === VIEW_MODES.PAGINATION ? 'primary' : 'default'}
                >
                  <ViewListIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Infinite Scroll View">
                <IconButton
                  size="small"
                  onClick={() => onViewModeChange(VIEW_MODES.INFINITE_SCROLL)}
                  color={viewMode === VIEW_MODES.INFINITE_SCROLL ? 'primary' : 'default'}
                >
                  <GridViewIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )} */}

          {/* Page Size Selector - Only show in pagination mode */}
          {viewMode === VIEW_MODES.PAGINATION && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Page Size</InputLabel>
              <Select
                value={pageSize}
                label="Page Size"
                onChange={handlePageSizeChange}
              >
                {pageSizeOptions.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size} per page
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Box>

      {/* Records Grid */}
      <Box
        sx={{
          display: "grid",
          gap: isMobile ? 1 : 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(auto-fill, minmax(280px, 1fr))",
            md: viewMode === VIEW_MODES.INFINITE_SCROLL ? "repeat(auto-fill, minmax(300px, 1fr))" : "repeat(auto-fill, minmax(280px, 1fr))"
          }
        }}
      >
        {records.map(record => (
          <RecordCard
            key={record.id}
            record={record}
            onToggleShowOnTop={onToggleShowOnTop}
            onRefreshTmdb={onRefreshTmdb}
            onDelete={onDelete}
            loadingStates={loadingStates}
            refreshingRecords={refreshingRecords}
          />
        ))}
      </Box>

      {/* Pagination - Only show in pagination mode */}
      {viewMode === VIEW_MODES.PAGINATION && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
          <Pagination
            count={totalPages}
            page={page + 1} // Convert to 1-based for Pagination component
            onChange={handlePageChange}
            color="primary"
            size={isMobile ? "small" : "medium"}
            showFirstButton
            showLastButton
            sx={{
              '& .MuiPaginationItem-root': {
                fontWeight: 600,
                fontSize: isMobile ? '0.875rem' : '1rem',
              }
            }}
          />
        </Box>
      )}

      {/* Infinite Scroll Loading Indicator */}
      {viewMode === VIEW_MODES.INFINITE_SCROLL && loadingMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <CircularProgress
              size={32}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                borderRadius: '50%',
                padding: 0.5
              }}
            />
          </motion.div>
        </Box>
      )}

      {/* Infinite Scroll Trigger */}
      {viewMode === VIEW_MODES.INFINITE_SCROLL && (
        <div ref={loaderRef} style={{ height: 1, width: '100%' }} />
      )}

      {/* Back to Top Button - For infinite scroll */}
      {viewMode === VIEW_MODES.INFINITE_SCROLL && records.length > 12 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="outlined"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            size="small"
          >
            Back to Top
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default RecordsCardView;