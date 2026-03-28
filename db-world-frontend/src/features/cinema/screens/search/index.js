import React, { useCallback, useEffect, useState } from 'react';
import { saveUserEventInfo, searchRecord, searchStreamFile } from '../../../ApiServices';
import CommonServices from '../../../CommonServices';
import Constants from '../../../Constants';
import { debounce } from 'lodash';
import { useLocation, useNavigate } from 'react-router-dom';
import FileDetailsModal from './FileDetailsModal';
import {
  Box,
  Button,
  IconButton,
  InputBase,
  Paper,
  Tab,
  Tabs,
  Typography,
  styled,
  Skeleton
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import { alpha } from '@mui/material/styles';
import { toast } from '../../../Toast';

const PAGE_SIZE = 12;

// Styled components with proper z-index hierarchy
const SearchOverlayContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.95)',
  color: '#fff',
  zIndex: 1300, // MUI Dialog z-index is 1300 by default
  padding: theme.spacing(2.5),
  overflowY: 'auto',
}));

const SearchHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(2.5),
}));

const SearchInput = styled(InputBase)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(1),
  fontSize: '1rem',
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  borderRadius: theme.shape.borderRadius,
  marginRight: theme.spacing(1.25),
  color: theme.palette.common.white,
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
}));

const ResultsGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: theme.spacing(2),
  marginTop: theme.spacing(1.25),
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: theme.spacing(1.5),
  }
}));

const ResultItem = styled(motion.div)(({ theme }) => ({
  overflow: 'hidden',
  borderRadius: theme.shape.borderRadius,
  cursor: 'pointer',
  '& img': {
    width: '100%',
    display: 'block',
    borderRadius: theme.shape.borderRadius,
    transition: 'transform 0.3s ease',
  },
  '&:hover img': {
    transform: 'scale(1.05)',
  },
}));

const DirectoryGroup = styled(Paper)(({ theme }) => ({
  marginBottom: theme.spacing(2.5),
  padding: theme.spacing(1.25),
  backgroundColor: theme.palette.grey[900],
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.grey[700]}`,
}));

const FilesGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: theme.spacing(1.25),
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  },
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: '1fr',
    gap: theme.spacing(1),
  }
}));

const FileItem = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.grey[800],
  padding: theme.spacing(1.25),
  borderRadius: theme.shape.borderRadius / 2,
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  border: `1px solid ${theme.palette.grey[700]}`,
  '&:hover': {
    backgroundColor: theme.palette.grey[700],
    transform: 'translateY(-2px)',
    boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.3)}`,
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  }
}));

// Responsive CompactGrid component
const CompactGrid = ({ 
  children, 
  columns = { xs: 1, sm: 2, md: 2, lg: 3 },
  spacing = { xs: 1, sm: 1.5, md: 2 },
  sx = {}
}) => {
  const gridSize = {
    xs: 12,
    sm: columns.sm ? 12 / columns.sm : 6,
    md: columns.md ? 12 / columns.md : 6,
    lg: columns.lg ? 12 / columns.lg : 4,
  };

  return (
    <Box 
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: `repeat(${columns.sm || 2}, 1fr)`,
          md: `repeat(${columns.md || 2}, 1fr)`,
          lg: `repeat(${columns.lg || 3}, 1fr)`,
        },
        gap: {
          xs: spacing.xs || 1,
          sm: spacing.sm || 1.5,
          md: spacing.md || 2,
        },
        ...sx
      }}
    >
      {children}
    </Box>
  );
};

function SearchOverlay({ onClose }) {
  const [term, setTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Records State
  const [records, setRecords] = useState([]);
  const [recordsPage, setRecordsPage] = useState(0);
  const [hasMoreRecords, setHasMoreRecords] = useState(true);
  const [isLoadingNextRecords, setIsLoadingNextRecords] = useState(false);
  const [isSearchRecordResDone, setIsSearchRecordResDone] = useState(false);

  // Streams State
  const [streamList, setStreamList] = useState([]);
  const [isSearchStreamResDone, setIsSearchStreamResDone] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState('records');

  // Modal State
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Helper Functions
  const formatFileSize = (size) => {
    if (!size) return "Unknown";
    if (size < 1024) return size + " B";
    else if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    else return (size / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((searchValue) => {
      setSearchTerm(searchValue);
    }, 800),
    []
  );

  const groupByDirectory = (files) => {
    return files.reduce((acc, file) => {
      const lastSlash = file.filePath?.lastIndexOf('/') || -1;
      const directory = lastSlash !== -1 ? file.filePath.substring(0, lastSlash) : 'Root';
      if (!acc[directory]) acc[directory] = [];
      acc[directory].push(file);
      return acc;
    }, {});
  };

  // API Calls
  const searchRecords = async (page = 0, isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setRecords([]);
        setRecordsPage(0);
        setHasMoreRecords(true);
        setIsSearchRecordResDone(false);
      }
      
      saveUserEventInfo("SEARCH", term);
      const modifiedQuery = CommonServices.modifySearchQuery(term);
      const recordResponse = await searchRecord(modifiedQuery, page, PAGE_SIZE);
      
      if (recordResponse.httpStatusCode === 200) {
        const mappedRecords = recordResponse.data.records.map(record => {
          record.tmdb = record.type === Constants.RECORD_TYPE_MOVIE ? record.movieTmdb : record.seriesTmdb;
          return record;
        });
        
        if (isLoadMore) {
          setRecords(prev => [...prev, ...mappedRecords]);
        } else {
          setRecords(mappedRecords);
        }
        
        if (mappedRecords.length < PAGE_SIZE) {
          setHasMoreRecords(false);
        }
        setIsSearchRecordResDone(true);
      } else if (recordResponse.httpStatusCode === 401) {
        toast.error(recordResponse.message + Constants.RE_LOGIN);
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        toast.error(recordResponse.message);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to search records');
    }
  };

  const searchStreams = async () => {
    try {
      setStreamList([]);
      setIsSearchStreamResDone(false);
      saveUserEventInfo("SEARCH", term);
      const modifiedQuery = CommonServices.modifySearchQuery(term);
      const streamResponse = await searchStreamFile(modifiedQuery);
      
      if (streamResponse.httpStatusCode === 200) {
        setStreamList(streamResponse.data);
        setIsSearchStreamResDone(true);
      } else if (streamResponse.httpStatusCode === 401) {
        toast.error(streamResponse.message + Constants.RE_LOGIN);
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        toast.error(streamResponse.message);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to search stream files');
    }
  };

  // Effects
  useEffect(() => {
    if (searchTerm.trim() !== '') {
      if (activeTab === 'records') {
        searchRecords(0, false);
      } else if (activeTab === 'stream') {
        searchStreams();
      }
    }
  }, [searchTerm, activeTab]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setTerm(value);
    debouncedSearch(value);
  };

  // Scroll Handler for Infinite Loading
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (activeTab === 'records' && scrollHeight - scrollTop <= clientHeight + 100) {
      if (hasMoreRecords && !isLoadingNextRecords) {
        setIsLoadingNextRecords(true);
        searchRecords(recordsPage + 1, true).then(() => {
          setRecordsPage(prev => prev + 1);
          setIsLoadingNextRecords(false);
        });
      }
    }
  };

  // Auto-load More if Content is Too Short
  useEffect(() => {
    const overlay = document.querySelector('.search-overlay');
    if (
      overlay &&
      overlay.scrollHeight <= overlay.clientHeight &&
      term.trim() !== '' &&
      isSearchRecordResDone &&
      activeTab === 'records'
    ) {
      if (hasMoreRecords && !isLoadingNextRecords) {
        setIsLoadingNextRecords(true);
        searchRecords(recordsPage + 1, true).then(() => {
          setRecordsPage(prev => prev + 1);
          setIsLoadingNextRecords(false);
        });
      }
    }
  }, [records, hasMoreRecords, isLoadingNextRecords, term, activeTab, recordsPage, isSearchRecordResDone]);

  // Modal Handlers
  const handleFileClick = (file) => {
    setSelectedFile(file);
    setShowFileModal(true);
  };

  const handleCloseModal = () => {
    setShowFileModal(false);
    setSelectedFile(null);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <>
      <SearchOverlayContainer 
        component={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onScroll={handleScroll}
        className="search-overlay"
      >
        <SearchHeader>
          <SearchInput
            placeholder="Search movies, series, or files..."
            value={term}
            onChange={handleSearchChange}
            autoFocus
            inputProps={{ 'aria-label': 'search' }}
          />
          <IconButton onClick={onClose} color="inherit" size="large">
            <CloseIcon />
          </IconButton>
        </SearchHeader>

        {/* Tab Header */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="secondary"
          textColor="inherit"
          variant="fullWidth"
          sx={{
            marginBottom: 2,
            '& .MuiTabs-indicator': {
              backgroundColor: 'secondary.main',
            },
          }}
        >
          <Tab
            value="records"
            label="Records"
            sx={{
              '&.Mui-selected': {
                color: 'secondary.main',
              },
            }}
          />
          <Tab
            value="stream"
            label="Stream Files"
            sx={{
              '&.Mui-selected': {
                color: 'secondary.main',
              },
            }}
          />
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ p: { xs: 1, sm: 2 } }}>
          {activeTab === 'records' ? (
            <Box>
              {term ? (
                <Box>
                  <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
                    Showing results for: <strong>"{term}"</strong>
                  </Typography>
                  {isSearchRecordResDone ? (
                    <Box>
                      {records.length > 0 ? (
                        <ResultsGrid>
                          <AnimatePresence>
                            {records.map(record => (
                              <ResultItem
                                key={record.id}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.3 }}
                              >
                                <motion.img
                                  src={`https://image.tmdb.org/t/p/w500${record.tmdb?.poster_path}`}
                                  alt={record.name || record.tmdb?.title}
                                  onClick={() =>
                                    navigate(
                                      record.type?.toLowerCase() === Constants.RECORD_TYPE_MOVIE
                                        ? Constants.DB_MOVIE_DETIALS_ROUTE.replace(
                                          ":title",
                                          record.recordId +
                                          "-" +
                                          record.name.toLowerCase().replace(/ /g, "-")
                                        )
                                        : Constants.DB_SERIES_DETIALS_ROUTE.replace(
                                          ":title",
                                          record.recordId +
                                          "-" +
                                          record.name.toLowerCase().replace(/ /g, "-")
                                        )
                                    )
                                  }
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                />
                              </ResultItem>
                            ))}
                          </AnimatePresence>
                        </ResultsGrid>
                      ) : (
                        <Typography variant="body1" align="center" sx={{ py: 4 }}>
                          No records found for "{term}"
                        </Typography>
                      )}
                      {isLoadingNextRecords && (
                        <ResultsGrid sx={{ mt: 2 }}>
                          {[...Array(4)].map((_, index) => (
                            <Skeleton
                              key={index}
                              variant="rectangular"
                              width="100%"
                              height={180}
                              animation="wave"
                              sx={{ bgcolor: 'grey.800', borderRadius: 1 }}
                            />
                          ))}
                        </ResultsGrid>
                      )}
                    </Box>
                  ) : (
                    <ResultsGrid>
                      {[...Array(8)].map((_, index) => (
                        <Skeleton
                          key={index}
                          variant="rectangular"
                          width="100%"
                          height={180}
                          animation="wave"
                          sx={{ bgcolor: 'grey.800', borderRadius: 1 }}
                        />
                      ))}
                    </ResultsGrid>
                  )}
                </Box>
              ) : (
                <Typography variant="body1" align="center" sx={{ mt: 6, color: 'grey.400' }}>
                  Start typing to search for movies and series...
                </Typography>
              )}
            </Box>
          ) : (
            <Box>
              {term ? (
                <Box>
                  <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
                    Showing stream files for: <strong>"{term}"</strong>
                  </Typography>
                  {isSearchStreamResDone ? (
                    <Box>
                      {streamList.length > 0 ? (
                        <Box>
                          {Object.entries(groupByDirectory(streamList)).map(([directory, files]) => (
                            <DirectoryGroup key={directory}>
                              <Typography 
                                variant="h6" 
                                color="secondary" 
                                gutterBottom 
                                sx={{ 
                                  borderBottom: '1px solid', 
                                  borderColor: 'grey.700',
                                  pb: 1,
                                  fontSize: { xs: '1rem', sm: '1.25rem' }
                                }}
                              >
                                {directory}
                              </Typography>
                              <FilesGrid>
                                {files.map(file => (
                                  <FileItem
                                    key={file.fileId}
                                    onClick={() => handleFileClick(file)}
                                    component={motion.div}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    <Typography 
                                      variant="body2" 
                                      fontWeight="bold" 
                                      color="common.white" 
                                      sx={{ 
                                        wordBreak: 'break-word',
                                        mb: 0.5,
                                        fontSize: { xs: '0.875rem', sm: '0.9rem' }
                                      }}
                                    >
                                      {file.fileName}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatFileSize(file.fileSize)}
                                    </Typography>
                                  </FileItem>
                                ))}
                              </FilesGrid>
                            </DirectoryGroup>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body1" align="center" sx={{ py: 4 }}>
                          No stream files found for "{term}"
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    // Stream Files Skeleton
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {[...Array(2)].map((_, groupIndex) => (
                        <Box key={groupIndex} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Skeleton
                            variant="text"
                            width={150}
                            height={24}
                            animation="wave"
                            sx={{ bgcolor: 'grey.800' }}
                          />
                          <FilesGrid>
                            {[...Array(6)].map((_, fileIndex) => (
                              <Skeleton
                                key={fileIndex}
                                variant="rectangular"
                                width="100%"
                                height={80}
                                animation="wave"
                                sx={{ bgcolor: 'grey.800', borderRadius: 1 }}
                              />
                            ))}
                          </FilesGrid>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography variant="body1" align="center" sx={{ mt: 6, color: 'grey.400' }}>
                  Start typing to search for stream files...
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </SearchOverlayContainer>

      {/* File Details Modal - Now with proper z-index */}
      <FileDetailsModal
        open={showFileModal}
        onClose={handleCloseModal}
        fileId={selectedFile?.fileId}
      />
    </>
  );
}

export default SearchOverlay;