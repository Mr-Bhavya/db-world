import React from 'react';
import {
  Grid, Typography, IconButton, Tooltip, Box, CircularProgress, Fade,
  CardContent,
  Card,
  FormControlLabel,
  CardActions
} from '@mui/material';
import { Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';
import SwitchWithLoader from './SwitchWithLoader';

const MotionCard = motion(Card);

const RecordCard = React.memo(({ 
  record, 
  onToggleShowOnTop, 
  onRefreshTmdb, 
  onDelete,
  loadingStates,
  refreshingRecords 
}) => {
  const isLoading = loadingStates[record.id];
  const isRefreshing = refreshingRecords[record.id];

  return (
    <Grid item xs={12} sm={6} md={4} lg={3} sx={{ mb: 2 }}>
      <MotionCard
        sx={{ border: '1px solid black', borderRadius: '10px' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="h6" component="div" noWrap>
            {record.name}
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            {record.type} • ID: {record.id}
          </Typography>
          <Typography variant="body2" noWrap>
            TMDB: {record.tmdb || 'Not linked'}
          </Typography>
          <Typography variant="caption" display="block">
            Created: {new Date(record.creationDate).toLocaleDateString()}
          </Typography>
          <Typography variant="caption" display="block">
            Modified: {new Date(record.lastModifiedDate).toLocaleDateString()}
          </Typography>
        </CardContent>
        <CardActions sx={{ justifyContent: 'space-between' }}>
          <FormControlLabel
            control={
              <SwitchWithLoader
                checked={record.show_on_top}
                onChange={() => onToggleShowOnTop(record.id, record.show_on_top)}
                loading={isLoading}
              />
            }
            label="Top"
            labelPlacement="start"
          />
          <Box>
            <Tooltip title="Refresh TMDB">
              <IconButton
                size="small"
                onClick={() => onRefreshTmdb(record.id)}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <CircularProgress size={16} />
                ) : (
                  <RefreshIcon fontSize="small" color="action" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => onDelete(record)}
              >
                <DeleteIcon fontSize="small" color="error" />
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
  refreshingRecords
}) => {
  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
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

      {loadingMore && (
        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Grid>
      )}

      <div ref={loaderRef} style={{ height: 1, width: '100%' }} />
    </Grid>
  );
};

export default RecordsCardView;