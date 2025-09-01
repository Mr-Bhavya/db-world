import {
  Box,
  Button,
  styled
} from '@mui/material';
import {
  Download as DownloadIcon,
  Add as AddIcon,
  Check as CheckIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

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


const CoverContents = styled(motion.div)(({ theme }) => ({
  paddingBottom: '30px',
  width: '600px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  lineHeight: 1.6,
  color: theme.palette.common.white,
  zIndex: 2,

  [theme.breakpoints.down('md')]: {
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '320px',
    padding: theme.spacing(1),
    textAlign: 'center'
  }
}));

const MovieTitle = styled(motion.div)(({ theme }) => ({
  fontSize: '80px',
  lineHeight: 'normal',
  textShadow: '2px 2px 4px rgba(0,0,0,0.5)',

  [theme.breakpoints.down('md')]: {
    fontSize: '32px'
  }
}));

const MovieOverview = styled(motion.div)(({ theme }) => ({
  fontSize: '18px',
  fontWeight: 'normal',
  marginTop: '10px',
  textShadow: '1px 1px 2px rgba(0,0,0,0.5)',

  [theme.breakpoints.down('md')]: {
    fontSize: '16px'
  }
}));

const DesktopContent = ({ record, isWatchListed, onToggleWatchlist, navigateToDetails, navigateToDownload }) => (
  <CoverContents
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.3 }}
    sx={{
      background: 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, transparent 100%)',
      p: 4,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      maxWidth: '60%',
      position: 'relative',
      zIndex: 5,
    }}
  >
    <MovieTitle
      sx={{
        fontSize: { md: '2.5rem', lg: '3rem', xl: '3.5rem' },
        textShadow: '0 2px 8px rgba(0,0,0,0.8)'
      }}
    >
      {record.tmdb.title || record.tmdb.name || record.tmdb.original_name}
    </MovieTitle>

    <MovieOverview
      sx={{
        fontSize: { md: '1rem', lg: '1.1rem' },
        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
        maxWidth: '80%',
        mb: 2
      }}
    >
      {record.tmdb.overview?.substring(0, 200)}
      {record.tmdb.overview?.length > 200 && '...'}
    </MovieOverview>

    <Box sx={{
      display: 'flex',
      mt: 2,
      gap: 2,
      flexWrap: 'wrap'
    }}>
      <ActionButton
        className="play text-dark"
        variant="contained"
        size="large"
        startIcon={<DownloadIcon />}
        onClick={navigateToDownload}
        sx={{
          minWidth: '140px',
          fontSize: '1rem'
        }}
      >
        Download
      </ActionButton>
      <ActionButton
        className="more"
        variant="contained"
        size="large"
        onClick={navigateToDetails}
        sx={{
          minWidth: '140px',
          fontSize: '1rem'
        }}
      >
        More Info
      </ActionButton>
      <ActionButton
        variant={isWatchListed ? "contained" : "outlined"}
        color={isWatchListed ? "success" : "inherit"}
        size="large"
        startIcon={isWatchListed ? <CheckIcon /> : <AddIcon />}
        onClick={onToggleWatchlist}
        sx={{
          color: isWatchListed ? 'common.white' : 'common.white',
          borderColor: 'common.white',
          minWidth: '140px',
          fontSize: '1rem'
        }}
      >
        {isWatchListed ? 'Listed' : 'My List'}
      </ActionButton>
    </Box>
  </CoverContents>
);

export default DesktopContent;
