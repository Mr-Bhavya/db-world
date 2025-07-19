import React from 'react';
import { Box, Switch, CircularProgress, Fade } from '@mui/material';

const SwitchWithLoader = ({ checked, onChange, loading }) => (
  <Box sx={{ position: 'relative' }}>
    <Switch
      size="small"
      checked={checked}
      onChange={onChange}
      color="primary"
      disabled={loading}
    />
    {loading && (
      <Fade in={loading}>
        <CircularProgress
          size={24}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: '-12px',
            marginLeft: '-12px',
          }}
        />
      </Fade>
    )}
  </Box>
);

export default SwitchWithLoader;