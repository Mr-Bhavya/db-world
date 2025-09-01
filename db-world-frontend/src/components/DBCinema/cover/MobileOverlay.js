import {
  Box,
  Button,
  Typography,
  styled
} from '@mui/material';
import {
  Download as DownloadIcon,
  Add as AddIcon,
  Check as CheckIcon
} from '@mui/icons-material';

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: '4px',
  fontSize: '18px',
  padding: '8px 18px',
  fontWeight: 'bold',
  marginRight: '8px',
  textTransform: 'none',

  '&.play': {
    backgroundColor: theme.palette.common.white,
    color: theme.palette.text.primary,
    '&:hover': {
      opacity: 0.8,
      backgroundColor: theme.palette.common.white
    }
  },

  '&.more': {
    backgroundColor: '#545455',
    color: theme.palette.common.white,
    opacity: 0.8,
    '&:hover': {
      opacity: 1,
      backgroundColor: '#545455'
    }
  },

  [theme.breakpoints.down('md')]: {
    fontSize: '14px',
    width: '43%',
    margin: 'auto'
  }
}));

const MobileOverlay = ({ record, isWatchListed, onToggleWatchlist, navigateToDownload }) => (
  <Box
    sx={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
      p: 2,
      pt: 4,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minHeight: '30%',
    }}
  >
    <Typography
      variant="h5"
      component="h2"
      sx={{
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
        mb: 2,
        fontSize: { xs: '1.2rem', xxs: '1.1rem' },
        textShadow: '0 2px 4px rgba(0,0,0,0.8)',
        maxWidth: '90%',
      }}
    >
      {record.tmdb.title || record.tmdb.name || record.tmdb.original_name}
    </Typography>

    <Box sx={{
      display: 'flex',
      justifyContent: 'center',
      gap: 1,
      flexWrap: 'wrap',
      width: '100%',
      maxWidth: '400px',
    }}>
      <ActionButton
        className="play text-dark"
        variant="contained"
        size="small"
        startIcon={<DownloadIcon />}
        onClick={navigateToDownload}
        sx={{
          minWidth: { xs: '120px', xxs: '100px' },
          fontSize: { xs: '0.8rem', xxs: '0.75rem' },
          py: { xxs: 0.5 },
          flex: 1,
        }}
      >
        Download
      </ActionButton>
      <ActionButton
        variant={isWatchListed ? "contained" : "outlined"}
        color={isWatchListed ? "success" : "inherit"}
        size="small"
        startIcon={isWatchListed ? <CheckIcon /> : <AddIcon />}
        onClick={onToggleWatchlist}
        sx={{
          color: isWatchListed ? 'common.white' : 'common.white',
          borderColor: 'common.white',
          minWidth: { xs: '100px', xxs: '90px' },
          fontSize: { xs: '0.8rem', xxs: '0.75rem' },
          py: { xxs: 0.5 },
          flex: 1,
        }}
      >
        {isWatchListed ? 'Listed' : 'My List'}
      </ActionButton>
    </Box>
  </Box>
);

export default MobileOverlay;