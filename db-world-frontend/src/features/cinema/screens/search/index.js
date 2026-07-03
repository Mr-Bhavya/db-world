import React, { useCallback, useEffect, useRef, useState } from 'react';
import { saveUserEventInfo, searchRecord, searchStreamFile } from '@shared/services/ApiServices';
import CommonServices from '@shared/services/CommonServices';
import Constants from '@shared/constants';
import { debounce } from 'lodash-es';
import { useLocation, useNavigate } from 'react-router-dom';
import MediaDetailsDrawer from '../MediaFileInfo/MediaDetailsDrawer';
import {
  Box,
  Button,
  IconButton,
  InputBase,
  Skeleton,
  Typography,
  styled,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CatalogRequestModal from '../../components/catalog-request/CatalogRequestModal';
import { motion, AnimatePresence } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { toast } from '@shared/components/ui/Toast';

const PAGE_SIZE = 12;

// ─── Styled Components ───────────────────────────────────────────────────────

const Overlay = styled(Box)(() => ({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.92)',
  zIndex: 1300,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
}));

const TopBar = styled(Box)(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 10,
  backgroundColor: 'rgba(0,0,0,0.92)',
  padding: theme.spacing(3, 3, 2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2, 1.5, 1.5),
    gap: theme.spacing(1),
  },
}));

const SearchBarWrapper = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  borderBottom: '2px solid rgba(255,255,255,0.6)',
  paddingBottom: theme.spacing(0.5),
  gap: theme.spacing(1),
  transition: 'border-color 0.2s',
  '&:focus-within': {
    borderColor: '#fff',
  },
}));

const NetflixInput = styled(InputBase)(() => ({
  flex: 1,
  fontSize: '1.5rem',
  fontWeight: 300,
  color: '#fff',
  letterSpacing: '0.02em',
  '& input': {
    padding: '4px 0',
    '&::placeholder': {
      color: 'rgba(255,255,255,0.4)',
    },
  },
  '& input:-webkit-autofill': {
    WebkitBoxShadow: '0 0 0 100px transparent inset',
    WebkitTextFillColor: '#fff',
  },
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  color: 'rgba(255,255,255,0.5)',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: theme.spacing(1.5),
  cursor: 'pointer',
  transition: 'color 0.2s',
  '&.active': {
    color: '#fff',
  },
}));

const TabRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(3),
  padding: theme.spacing(0, 3, 1.5),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0, 1.5, 1),
    gap: theme.spacing(2),
  },
}));

const ResultsGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
  gap: theme.spacing(1.5),
  padding: theme.spacing(0, 3, 3),
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 1.5, 2),
  },
}));

const PosterCard = styled(motion.div)(() => ({
  position: 'relative',
  borderRadius: 4,
  overflow: 'hidden',
  cursor: 'pointer',
  aspectRatio: '2/3',
  backgroundColor: '#1a1a1a',
  '&:hover .poster-overlay': {
    opacity: 1,
  },
}));

const PosterImg = styled('img')(() => ({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  transition: 'transform 0.3s ease',
}));

const PosterOverlay = styled(Box)(() => ({
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  padding: '8px',
  opacity: 0,
  transition: 'opacity 0.25s ease',
}));

const AvailableBadge = styled(Box)(() => ({
  position: 'absolute',
  top: 6,
  left: 6,
  backgroundColor: '#1db954',
  color: '#fff',
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  padding: '2px 6px',
  borderRadius: 3,
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  zIndex: 2,
}));

const PosterFallback = styled(Box)(() => ({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#2a2a2a',
  color: 'rgba(255,255,255,0.3)',
  fontSize: '0.75rem',
  textAlign: 'center',
  padding: '8px',
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(10, 2),
  gap: theme.spacing(2),
  color: 'rgba(255,255,255,0.35)',
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRoute(record) {
  const isMovie = record.type?.toLowerCase() === Constants.RECORD_TYPE_MOVIE;
  const base = isMovie ? Constants.DB_MOVIE_DETIALS_ROUTE : Constants.DB_SERIES_DETIALS_ROUTE;
  const slug = record.id + '-' + (record.title || '').toLowerCase().replace(/ /g, '-');
  return base.replace(':title', slug);
}

function PosterCardItem({ record, showAvailable, fileCount, onClick }) {
  const [imgError, setImgError] = useState(false);
  const posterPath = record.posterPath;
  const imgSrc = posterPath && !imgError
    ? `https://image.tmdb.org/t/p/w300${posterPath}`
    : null;
  const displayTitle = record.title || '';
  const year = record.releaseDate ? new Date(record.releaseDate).getFullYear() : null;

  return (
    <PosterCard
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
    >
      {showAvailable && (
        <AvailableBadge>
          <FolderOpenIcon sx={{ fontSize: '0.65rem' }} />
          {fileCount > 1 ? `${fileCount} files` : 'Available'}
        </AvailableBadge>
      )}
      {imgSrc ? (
        <PosterImg
          src={imgSrc}
          alt={displayTitle}
          onError={() => setImgError(true)}
          className="poster-img"
        />
      ) : (
        <PosterFallback>
          {displayTitle || 'No Image'}
        </PosterFallback>
      )}
      <PosterOverlay className="poster-overlay">
        <Typography sx={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.3 }}>
          {displayTitle}
        </Typography>
        {year && (
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem' }}>
            {year}
          </Typography>
        )}
      </PosterOverlay>
    </PosterCard>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function SearchOverlay({ onClose }) {
  const [term, setTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const overlayRef = useRef(null);

  // Records state
  const [records, setRecords] = useState([]);
  const [recordsPage, setRecordsPage] = useState(0);
  const [hasMoreRecords, setHasMoreRecords] = useState(true);
  const [isLoadingNextRecords, setIsLoadingNextRecords] = useState(false);
  const [isSearchRecordResDone, setIsSearchRecordResDone] = useState(false);

  // Stream state
  const [streamList, setStreamList] = useState([]);
  const [isSearchStreamResDone, setIsSearchStreamResDone] = useState(false);

  // Active tab: 'records' | 'stream'
  const [activeTab, setActiveTab] = useState('records');

  // Modal
  const [showFileModal, setShowFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Catalog request modal — opened from the "no results" empty state.
  const [catalogRequestOpen, setCatalogRequestOpen] = useState(false);

  // ── Debounced search trigger ────────────────────────────────────────────────
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchTerm(value);
    }, 500),
    []
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setTerm(value);
    debouncedSearch(value);
  };

  // ── API calls ───────────────────────────────────────────────────────────────

  const searchRecords = useCallback(async (page = 0, isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setRecords([]);
        setRecordsPage(0);
        setHasMoreRecords(true);
        setIsSearchRecordResDone(false);
      }
      saveUserEventInfo('SEARCH', searchTerm);
      const modifiedQuery = CommonServices.modifySearchQuery(searchTerm);
      const res = await searchRecord(modifiedQuery, page, PAGE_SIZE);

      if (res.httpStatusCode === 200) {
        const mapped = res.data.content;
        if (isLoadMore) {
          setRecords(prev => [...prev, ...mapped]);
        } else {
          setRecords(mapped);
        }
        if (res.data.last || mapped.length < PAGE_SIZE) setHasMoreRecords(false);
        setIsSearchRecordResDone(true);
      } else if (res.httpStatusCode === 401) {
        toast.error(res.message + Constants.RE_LOGIN);
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to search records');
    }
  }, [searchTerm, location, navigate]);

  const searchStreams = useCallback(async () => {
    try {
      setStreamList([]);
      setIsSearchStreamResDone(false);
      saveUserEventInfo('SEARCH', searchTerm);
      const modifiedQuery = CommonServices.modifySearchQuery(searchTerm);
      const res = await searchStreamFile(modifiedQuery);

      if (res.httpStatusCode === 200) {
        setStreamList(res.data);
        setIsSearchStreamResDone(true);
      } else if (res.httpStatusCode === 401) {
        toast.error(res.message + Constants.RE_LOGIN);
        navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to search stream files');
    }
  }, [searchTerm, location, navigate]);

  // Fire both searches whenever searchTerm changes
  useEffect(() => {
    if (searchTerm.trim() === '') return;
    searchRecords(0, false);
    searchStreams();
  }, [searchTerm]);

  // ── Infinite scroll ─────────────────────────────────────────────────────────

  const handleScroll = useCallback((e) => {
    if (activeTab !== 'records') return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 150) {
      if (hasMoreRecords && !isLoadingNextRecords && isSearchRecordResDone) {
        setIsLoadingNextRecords(true);
        const nextPage = recordsPage + 1;
        searchRecords(nextPage, true).then(() => {
          setRecordsPage(nextPage);
          setIsLoadingNextRecords(false);
        });
      }
    }
  }, [activeTab, hasMoreRecords, isLoadingNextRecords, isSearchRecordResDone, recordsPage, searchRecords]);

  // Auto-load if results don't fill the screen
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    if (
      activeTab === 'records' &&
      searchTerm.trim() !== '' &&
      isSearchRecordResDone &&
      hasMoreRecords &&
      !isLoadingNextRecords &&
      overlay.scrollHeight <= overlay.clientHeight
    ) {
      setIsLoadingNextRecords(true);
      const nextPage = recordsPage + 1;
      searchRecords(nextPage, true).then(() => {
        setRecordsPage(nextPage);
        setIsLoadingNextRecords(false);
      });
    }
  }, [records, isSearchRecordResDone]);

  // ── Derive "available on device" records ────────────────────────────────────
  // Build a map: recordId -> list of stream files
  const streamFilesByRecordId = {};
  streamList.forEach(file => {
    if (file.recordId) {
      if (!streamFilesByRecordId[file.recordId]) streamFilesByRecordId[file.recordId] = [];
      streamFilesByRecordId[file.recordId].push(file);
    }
  });

  const recordsWithFiles = records.filter(r => streamFilesByRecordId[r.id]);
  const hasAvailableTab = isSearchStreamResDone && recordsWithFiles.length > 0;
  const hasMediaTab     = isSearchStreamResDone && streamList.length > 0;

  // ── Tab visibility: fall back to records if active tab disappears ───────────
  useEffect(() => {
    if ((activeTab === 'stream' && !hasAvailableTab) ||
        (activeTab === 'media'  && !hasMediaTab)) {
      setActiveTab('records');
    }
  }, [hasAvailableTab, hasMediaTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleRecordClick = (record) => {
    navigate(buildRoute(record));
    onClose();
  };

  // ── File modal ──────────────────────────────────────────────────────────────
  const handleFileClick = (file) => {
    setSelectedFile(file);
    setShowFileModal(true);
  };
  const handleCloseModal = () => {
    setShowFileModal(false);
    setSelectedFile(null);
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderSkeletons = (count = 8) => (
    <ResultsGrid>
      {[...Array(count)].map((_, i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          width="100%"
          sx={{
            aspectRatio: '2/3',
            bgcolor: 'grey.900',
            borderRadius: '4px',
            transform: 'none',
          }}
          animation="wave"
        />
      ))}
    </ResultsGrid>
  );


  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <>
      <AnimatePresence>
        <Overlay
          component={motion.div}
          key="search-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          ref={overlayRef}
          onScroll={handleScroll}
        >
          {/* ── Top bar ── */}
          <TopBar>
            <SearchBarWrapper>
              <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.6rem', flexShrink: 0 }} />
              <NetflixInput
                placeholder="Search movies, series..."
                value={term}
                onChange={handleSearchChange}
                autoFocus
                inputProps={{ 'aria-label': 'search' }}
              />
            </SearchBarWrapper>
            <IconButton
              onClick={onClose}
              size="large"
              sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
            >
              <CloseIcon />
            </IconButton>
          </TopBar>

          {/* ── Tab row ── */}
          {term.trim() !== '' && isSearchRecordResDone && (
            <TabRow>
              <SectionLabel
                className={activeTab === 'records' ? 'active' : ''}
                onClick={() => setActiveTab('records')}
              >
                All Results
                {records.length > 0 && ` (${records.length}${hasMoreRecords ? '+' : ''})`}
              </SectionLabel>
              {hasAvailableTab && (
                <SectionLabel
                  className={activeTab === 'stream' ? 'active' : ''}
                  onClick={() => setActiveTab('stream')}
                >
                  Available on Device
                  {` (${recordsWithFiles.length})`}
                </SectionLabel>
              )}
              {hasMediaTab && (
                <SectionLabel
                  className={activeTab === 'media' ? 'active' : ''}
                  onClick={() => setActiveTab('media')}
                >
                  Media Files
                  {` (${streamList.length})`}
                </SectionLabel>
              )}
            </TabRow>
          )}

          {/* ── Content ── */}
          {term.trim() === '' ? (
            <EmptyState>
              <SearchIcon sx={{ fontSize: '4rem', opacity: 0.2 }} />
              <Typography sx={{ fontSize: '1rem', fontWeight: 300 }}>
                Search for movies and series
              </Typography>
              <Typography sx={{ fontSize: '0.8rem' }}>
                Trending: Dune, The Bear, Oppenheimer, Shogun
              </Typography>
            </EmptyState>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'records' ? (
                <motion.div
                  key="tab-records"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {!isSearchRecordResDone ? (
                    renderSkeletons(8)
                  ) : records.length === 0 ? (
                    <EmptyState>
                      <SearchOffIcon sx={{ fontSize: '3.5rem', opacity: 0.25 }} />
                      <Typography sx={{ fontSize: '1rem', fontWeight: 500 }}>
                        No results for &ldquo;{term}&rdquo;
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', opacity: 0.6 }}>
                        Try a different spelling, or request this title to be added.
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        disableElevation
                        startIcon={<AddCircleOutlineIcon sx={{ fontSize: 18 }} />}
                        onClick={() => setCatalogRequestOpen(true)}
                        sx={{ mt: 1.5, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                      >
                        Request this title
                      </Button>
                    </EmptyState>
                  ) : (
                    <>
                      <ResultsGrid>
                        <AnimatePresence>
                          {records.map(record => (
                            <PosterCardItem
                              key={record.id}
                              record={record}
                              showAvailable={!!streamFilesByRecordId[record.id]}
                              fileCount={streamFilesByRecordId[record.id]?.length || 0}
                              onClick={() => handleRecordClick(record)}
                            />
                          ))}
                        </AnimatePresence>
                      </ResultsGrid>
                      {isLoadingNextRecords && renderSkeletons(4)}
                    </>
                  )}
                </motion.div>
              ) : activeTab === 'stream' ? (
                <motion.div
                  key="tab-stream"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {!isSearchRecordResDone || !isSearchStreamResDone ? (
                    renderSkeletons(6)
                  ) : recordsWithFiles.length === 0 ? (
                    <EmptyState>
                      <FolderOpenIcon sx={{ fontSize: '3rem', opacity: 0.2 }} />
                      <Typography sx={{ fontSize: '1rem' }}>
                        No files available on device for &ldquo;{term}&rdquo;
                      </Typography>
                    </EmptyState>
                  ) : (
                    <ResultsGrid>
                      <AnimatePresence>
                        {recordsWithFiles.map(record => {
                          const files = streamFilesByRecordId[record.id] || [];
                          return (
                            <PosterCardItem
                              key={record.id}
                              record={record}
                              showAvailable
                              fileCount={files.length}
                              onClick={() => {
                                if (files.length === 1) {
                                  handleFileClick(files[0]);
                                } else {
                                  handleRecordClick(record);
                                }
                              }}
                            />
                          );
                        })}
                      </AnimatePresence>
                    </ResultsGrid>
                  )}
                </motion.div>
              ) : (
                /* ── Media Files tab ── */
                <motion.div
                  key="tab-media"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {!isSearchStreamResDone ? (
                    <Box sx={{ px: { xs: 1.5, sm: 3 }, pt: 1 }}>
                      {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} variant="rectangular" height={56} sx={{ bgcolor: 'grey.900', borderRadius: 1, mb: 1 }} />
                      ))}
                    </Box>
                  ) : streamList.length === 0 ? (
                    <EmptyState>
                      <PlayCircleOutlineIcon sx={{ fontSize: '3rem', opacity: 0.2 }} />
                      <Typography sx={{ fontSize: '1rem' }}>
                        No media files found for &ldquo;{term}&rdquo;
                      </Typography>
                    </EmptyState>
                  ) : (
                    <Box sx={{ px: { xs: 1.5, sm: 3 }, pb: 3 }}>
                      <AnimatePresence>
                        {streamList.map((file, i) => (
                          <motion.div
                            key={file.fileId ?? i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15, delay: i * 0.03 }}
                          >
                            <Box
                              onClick={() => handleFileClick(file)}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: 1.5,
                                p: 1.5, mb: 0.75,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(255,255,255,0.05)',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                              }}
                            >
                              <PlayCircleOutlineIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.4rem', flexShrink: 0 }} />
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {file.fileName ?? file.name ?? file.filePath ?? `File ${i + 1}`}
                                </Typography>
                                {file.filePath && (
                                  <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {file.filePath}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </Box>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </Overlay>
      </AnimatePresence>

      {/* File Details Drawer */}
      <MediaDetailsDrawer
        open={showFileModal}
        onClose={handleCloseModal}
        fileId={selectedFile?.fileId}
        filePath={selectedFile?.filePath}
      />

      {/* Catalog ingest request modal */}
      <CatalogRequestModal
        open={catalogRequestOpen}
        onClose={() => setCatalogRequestOpen(false)}
        initialQuery={term}
      />
    </>
  );
}

export default SearchOverlay;
