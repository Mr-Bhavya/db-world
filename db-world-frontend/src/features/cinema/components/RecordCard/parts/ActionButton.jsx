import React from 'react';
import { IconButton, Tooltip } from '@mui/material';

// Circular action button used in the hover popup (Play / My List / Like / Expand).
const ActionButton = ({ icon, activeIcon, active, tooltip, onClick, variant = 'outline' }) => (
  <Tooltip title={tooltip} PopperProps={{ style: { zIndex: 10001 } }}>
    <IconButton
      size="small"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      sx={
        variant === 'filled'
          ? { bgcolor: '#fff', color: '#000', p: 0.8, '&:hover': { bgcolor: 'rgba(255,255,255,.85)' } }
          : {
            border: `1.5px solid ${active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.45)'}`,
            color: active ? '#fff' : 'rgba(255,255,255,.8)',
            bgcolor: active ? 'rgba(255,255,255,.12)' : 'transparent',
            p: 0.7,
            transition: 'all 0.15s',
            '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,.1)' },
          }
      }
    >
      {active ? activeIcon : icon}
    </IconButton>
  </Tooltip>
);

export default ActionButton;
