import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { SignalCellularAlt as SignalIcon, Refresh as RefreshIcon } from '@mui/icons-material';

export const ConnectionStatus = ({ isConnected, onReconnect }) => {
  return (
    <Box display="flex" alignItems="center">
      <Box display="flex" alignItems="center" color={isConnected ? 'success.main' : 'error.main'} mr={2}>
        <SignalIcon fontSize="small" sx={{ mr: 1 }} />
        <Typography>{isConnected ? 'Connected' : 'Disconnected'}</Typography>
      </Box>
      <Tooltip title="Refresh connection">
        <IconButton onClick={onReconnect}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
};