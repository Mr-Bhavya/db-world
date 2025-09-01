import {
  Button,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import React from 'react';

const CategoryModal = React.memo(({ open, onClose, onSelect, categoryList }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'center'
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'center'
      }}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 450,
          maxHeight: 500,
          p: 1,
          background: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: '12px',
          boxShadow: theme.shadows[8]
        }
      }}
    >
      <Typography variant="h6" sx={{ px: 2, py: 1, color: theme.palette.text.primary }}>
        Select Category
      </Typography>
      <Divider />
      <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
        {categoryList.map((cat) => (
          <MenuItem
            key={cat.id}
            onClick={() => onSelect(cat)}
            sx={{
              borderRadius: '8px',
              my: 0.5,
              '&:hover': {
                backgroundColor: theme.palette.action.hover
              }
            }}
          >
            <Typography variant="body1">{cat.name}</Typography>
          </MenuItem>
        ))}
      </Box>
      <Divider />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1, gap: 1 }}>
        <Button
          onClick={() => onSelect(null)}
          variant="outlined"
          fullWidth
          sx={{ borderRadius: '8px' }}
        >
          Clear
        </Button>
        <Button
          onClick={onClose}
          variant="contained"
          fullWidth
          sx={{ borderRadius: '8px' }}
        >
          Close
        </Button>
      </Box>
    </Menu>
  );
});

export default CategoryModal;