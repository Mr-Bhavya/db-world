import { Box, Skeleton, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';

function CoverSkeleton() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        marginTop: isMobile ? '100px' : '50px',
        height: isMobile ? 'calc(100vh - 250px)' : 'calc(100vh - 120px)',
        backgroundColor: 'grey.900',
        overflow: 'hidden',
        zIndex: 900
      }}
    >
      <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        animation="wave"
      />

      {!isMobile && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '30px',
            left: '60px',
            color: 'common.white',
            zIndex: 2
          }}
        >
          <Skeleton
            variant="text"
            width="60%"
            height="80px"
            animation="wave"
            sx={{ mb: 1 }}
          />
          <Skeleton
            variant="text"
            width="80%"
            height="40px"
            animation="wave"
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton
              variant="rectangular"
              width="140px"
              height="40px"
              animation="wave"
              sx={{ borderRadius: 1 }}
            />
            <Skeleton
              variant="rectangular"
              width="140px"
              height="40px"
              animation="wave"
              sx={{ borderRadius: 1 }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default CoverSkeleton;