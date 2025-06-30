import React from 'react';
import { Box, Chip, Typography } from '@mui/material';

const GenresList = ({ genres = [] }) => {
  if (!genres.length) return (
    <Typography variant="body2" color="text.secondary">
      No genres available
    </Typography>
  );

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {genres.map((genre) => (
        <Chip
          key={genre.id}
          label={genre.name}
          variant="outlined"
        />
      ))}
    </Box>
  );
};

export default GenresList;
