import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Box, styled, useTheme, Typography, CircularProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import Footer from '../../components/Footer/Footer';
import { useIntersectionObserver } from '../../services/cinemaConfig';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      when: "beforeChildren"
    }
  }
};

const tileRowVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  }
};

// Styled components
const MainContainer = styled(motion.div)(({ theme }) => ({
  backgroundColor: 'black',
  overflow: 'hidden',
  position: 'relative',
  minHeight: '100vh',
  transition: 'background-color 0.5s ease-out',
  display: 'flex',
  flexDirection: 'column'
}));

const ContentWrapper = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column'
});

const CoverWrapper = styled(motion.div)({
  position: 'relative',
});

const TilesWrapper = styled(motion.div)(({ theme }) => ({
  background: 'black',
  marginTop: -100,
  position: 'relative',
  paddingTop: 100,
  flex: 1
}));

const TopFadeEffect = styled('div')(({ theme }) => ({
  position: 'absolute',
  top: 100,
  left: 0,
  width: '100%',
  height: '15%',
  background: `linear-gradient(to bottom, black, transparent)`,
  pointerEvents: 'none',
  zIndex: 2
}));

// Hook for infinite loading
const useInfiniteTiles = (initialConfig, fetchMoreTiles) => {
  const [tiles, setTiles] = useState(initialConfig);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [triggerRef, isTriggerVisible] = useIntersectionObserver({ rootMargin: '500px' });

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const newTiles = await fetchMoreTiles(nextPage);

      if (newTiles && newTiles.length > 0) {
        setTiles(prev => [...prev, ...newTiles]);
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more tiles:', err);
      setError(err.message || 'Failed to load more content');
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, fetchMoreTiles]);

  // Load more when trigger becomes visible
  useEffect(() => {
    if (isTriggerVisible && hasMore && !loading && fetchMoreTiles) {
      loadMore();
    }
  }, [isTriggerVisible, hasMore, loading, loadMore, fetchMoreTiles]);

  // Reset when initial config changes
  useEffect(() => {
    setTiles(initialConfig);
    setPage(1);
    setHasMore(true);
    setError(null);
  }, [initialConfig]);

  return {
    tiles, loading, hasMore, error, triggerRef, reset: () => {
      setTiles(initialConfig);
      setPage(1);
      setHasMore(true);
      setError(null);
      setLoading(false);
    }
  };
};

// Lazy-loaded TilesRow component wrapper
const LazyTilesRow = React.memo(({
  tile,
  index,
  onGenreSelect,
  TilesRowComponent
}) => {
  const [ref, isIntersecting] = useIntersectionObserver();
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isIntersecting && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isIntersecting, hasLoaded]);

  // Show loading skeleton when not loaded yet
  if (!hasLoaded) {
    return (
      <motion.div
        key={`${tile.title}-${index}-skeleton`}
        ref={ref}
        variants={tileRowVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        custom={index}
        style={{
          height: tile.horizontal ? '280px' : '450px',
          marginBottom: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(30, 30, 30, 0.5)',
          borderRadius: '8px',
          margin: '0 16px'
        }}
      >
        <CircularProgress size={40} thickness={4} sx={{ color: 'primary.main' }} />
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      key={`${tile.title}-${index}-${tile.requestUrl || ''}-loaded`}
      variants={tileRowVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      custom={index}
    >
      <TilesRowComponent
        title={tile.title}
        requestUrl={tile.requestUrl}
        horizontal={tile.horizontal}
        category={tile.category}
        recordTypes={tile.recordTypes}
        onGenreSelect={onGenreSelect}
        {...tile}
      />
    </motion.div>
  );
});

LazyTilesRow.displayName = 'LazyTilesRow';

// Loading component for suspense fallback
const LoadingSpinner = () => (
  <Box
    sx={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'black'
    }}
  >
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          border: '3px solid',
          borderColor: 'primary.main',
          borderTopColor: 'transparent',
          borderRadius: '50%'
        }}
      />
    </motion.div>
  </Box>
);

/**
 * CinemaPage Component - Specialized for cinema browsing with infinite scrolling
 */
const CinemaPage = ({
  CoverComponent,
  NavbarComponent,
  TilesRowComponent,
  GenreViewComponent,
  FooterComponent = Footer,
  tilesConfig = [],
  fetchMoreTiles, // New prop: function to fetch more tiles
  onColorChange = () => { },
  onGenreSelect = () => { },
  onBackToHome = () => { },
  onNavigate = () => { },
  showTopFade = true,
  showCover = true,
  showFooter = true,
  coverProps = {},
  navbarProps = {},
  genreViewProps = {},
  footerProps = {},
  pageTitle = "Cinema",
  selectedCategory = null,
  clearCategory = () => { }
}) => {
  const theme = useTheme();
  const [coverColor, setCoverColor] = useState('rgba(0,0,0,0.9)');
  const [selectedGenre, setSelectedGenre] = useState(null);

  // Initialize infinite loading
  const {
    tiles: infiniteTiles,
    loading,
    hasMore,
    error,
    triggerRef
  } = useInfiniteTiles(tilesConfig, fetchMoreTiles);

  // Sync selectedGenre with selectedCategory from navbar context
  useEffect(() => {
    //console.log("Selected category changed:", selectedCategory);
    if (selectedCategory && selectedCategory.id) {
      setSelectedGenre(selectedCategory);
      //console.log("Setting selectedGenre to:", selectedCategory);
    } else {
      setSelectedGenre(null);
      //console.log("Clearing selectedGenre");
    }
  }, [selectedCategory]);

  // Reset state when tilesConfig changes (route changes)
  useEffect(() => {
    setSelectedGenre(null);
    setCoverColor('rgba(0,0,0,0.9)');
  }, [tilesConfig]);

  // Memoize the processed tiles config
  const processedTilesConfig = useMemo(() => {
    return infiniteTiles.map(tile => ({
      ...tile,
      recordTypes: tile.recordTypes || ['movie', 'series']
    }));
  }, [infiniteTiles]);

  // Get default record types for cover
  const defaultRecordTypes = useMemo(() => {
    return processedTilesConfig.length > 0
      ? processedTilesConfig[0].recordTypes
      : ['movie', 'series'];
  }, [processedTilesConfig]);

  // Handlers
  const handleCategorySelect = useCallback((genre) => {
    //console.log("Category selected in CinemaPage:", genre);
    setSelectedGenre(genre);
    onGenreSelect(genre);
    window.scrollTo(0, 0);
  }, [onGenreSelect]);

  const handleBackToHome = useCallback(() => {
    //console.log("Back to home from CinemaPage");
    setSelectedGenre(null);
    clearCategory();
    onBackToHome();
    window.scrollTo(0, 0);
  }, [onBackToHome, clearCategory]);

  const handleColorChange = useCallback((newColor) => {
    setCoverColor(newColor);
    onColorChange(newColor);
  }, [onColorChange]);

  const handleNavbarCollapseChange = useCallback((collapsed) => {
    //console.log("Navbar collapse changed:", collapsed);
  }, []);

  const handleFooterNavigation = useCallback((item) => {
    //console.log("Footer navigation:", item);
    onNavigate(item);
  }, [onNavigate]);

  const handleFooterCategorySelect = useCallback((category) => {
    //console.log("Footer category selected:", category);
    handleCategorySelect({ name: category, id: category.toLowerCase() });
  }, [handleCategorySelect]);

  // Set status bar color
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: coverColor });
    }
  }, [coverColor]);

  // Debug logging
  useEffect(() => {
    //console.log("Current state - selectedGenre:", selectedGenre, "selectedCategory:", selectedCategory);
  }, [selectedGenre, selectedCategory]);

  // Calculate content margin based on whether we're in genre view
  const contentMarginTop = useMemo(() => {
    return selectedGenre ? '0px' : (showCover ? '0px' : '0px');
  }, [selectedGenre, showCover]);

  // Calculate content height based on whether we're in genre view
  const contentHeight = useMemo(() => {
    return selectedGenre ? 'calc(100vh - 70px)' : 'auto';
  }, [selectedGenre]);

  // Render Footer component
  const renderFooter = () => {
    if (!showFooter || selectedGenre) return null;

    return (
      <FooterComponent
        onNavigate={handleFooterNavigation}
        onCategorySelect={handleFooterCategorySelect}
        {...footerProps}
      />
    );
  };

  // Render loading indicator or error message
  const renderLoadingOrError = () => {
    if (error) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'rgba(255, 255, 255, 0.7)'
          }}
        >
          <Typography variant="body1" color="error">
            Error: {error}
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, opacity: 0.7 }}>
            Please try again later
          </Typography>
        </motion.div>
      );
    }

    if (loading) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100px',
            margin: '20px 0'
          }}
        >
          <CircularProgress
            size={40}
            thickness={4}
            sx={{ color: 'primary.main' }}
          />
        </motion.div>
      );
    }

    if (!hasMore && processedTilesConfig.length > 0) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'rgba(255, 255, 255, 0.7)'
          }}
        >
          <Typography variant="body1">
            You've reached the end
          </Typography>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <MainContainer
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      style={{ '--navbar-bg-color': coverColor }}
    >

      {/* Navbar - Always visible, even when genre is selected */}
      <NavbarComponent
        onCollapseChange={handleNavbarCollapseChange}
        coverColor={coverColor}
        onGenreSelect={handleCategorySelect}
        {...navbarProps}
      />

      {showTopFade && !selectedGenre && <TopFadeEffect />}

      <ContentWrapper sx={{
        marginTop: contentMarginTop,
        height: contentHeight,
        minHeight: selectedGenre ? 'calc(100vh - 70px)' : '100vh',
        width: '100%',
        overflow: selectedGenre ? 'hidden' : 'visible'
      }}>
        <AnimatePresence mode="wait">
          {selectedGenre && selectedGenre.id ? (
            // Show GenreView when genre is selected (navbar remains visible)
            <motion.div
              key="genre-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                height: '100%',
                width: '100%',
                overflow: 'auto'
              }}
            >
              <GenreViewComponent
                genre={selectedGenre}
                onBack={handleBackToHome}
                {...genreViewProps}
              />
            </motion.div>
          ) : (
            // Show main content when no genre is selected
            <motion.div
              key="main-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              {showCover && (
                <CoverWrapper>
                  <CoverComponent
                    onColorChange={handleColorChange}
                    recordTypes={defaultRecordTypes}
                    {...coverProps}
                  />
                </CoverWrapper>
              )}

              <TilesWrapper
                style={{
                  marginTop: showCover ? -100 : 0,
                  paddingTop: showCover ? 100 : 0
                }}
              >
                <AnimatePresence>
                  {/* Render lazy-loaded tiles */}
                  {processedTilesConfig.map((tile, index) => (
                    <LazyTilesRow
                      key={`${tile.title}-${index}-${tile.requestUrl || ''}`}
                      tile={tile}
                      index={index}
                      onGenreSelect={handleCategorySelect}
                      TilesRowComponent={TilesRowComponent}
                    />
                  ))}

                  {/* Infinite scroll trigger */}
                  {fetchMoreTiles && hasMore && (
                    <div ref={triggerRef} style={{ height: '1px' }} />
                  )}

                  {/* Loading indicator or end message */}
                  {renderLoadingOrError()}
                </AnimatePresence>
              </TilesWrapper>
            </motion.div>
          )}
        </AnimatePresence>
      </ContentWrapper>

      {/* Footer */}
      {renderFooter()}
    </MainContainer>
  );
};

// Default export with default components
const DefaultCinemaPage = (props) => {
  // Import components with proper error handling
  const [components, setComponents] = useState({
    CoverComponent: null,
    NavbarComponent: null,
    TilesRowComponent: null,
    GenreViewComponent: null
  });

  useEffect(() => {
    const loadComponents = async () => {
      try {
        // Dynamic imports with proper error handling
        const Cover = (await import('../../cover')).default;
        const Navbar = (await import('../../navbar')).default;
        const TilesRow = (await import('../../tilesRow')).default;
        const GenreView = (await import('../GenreView')).default;

        setComponents({
          CoverComponent: Cover,
          NavbarComponent: Navbar,
          TilesRowComponent: TilesRow,
          GenreViewComponent: GenreView
        });
      } catch (error) {
        console.error('Failed to load components:', error);

        // Fallback components
        const FallbackComponent = ({ children }) => (
          <Box sx={{ p: 3, color: 'white' }}>
            {children}
          </Box>
        );

        setComponents({
          CoverComponent: () => <FallbackComponent>Cover Loading...</FallbackComponent>,
          NavbarComponent: () => <FallbackComponent>Navbar Loading...</FallbackComponent>,
          TilesRowComponent: () => <FallbackComponent>Tiles Row Loading...</FallbackComponent>,
          GenreViewComponent: () => <FallbackComponent>Genre View Loading...</FallbackComponent>
        });
      }
    };

    loadComponents();
  }, []);

  // Show loading until components are loaded
  if (!components.CoverComponent || !components.NavbarComponent ||
    !components.TilesRowComponent || !components.GenreViewComponent) {
    return <LoadingSpinner />;
  }

  return (
    <CinemaPage
      CoverComponent={components.CoverComponent}
      NavbarComponent={components.NavbarComponent}
      TilesRowComponent={components.TilesRowComponent}
      GenreViewComponent={components.GenreViewComponent}
      {...props}
    />
  );
};

// Enhanced version with proper context integration
export const CinemaPageWithContext = (props) => {
  // Use category context properly
  let categoryContext = { selectedCategory: null, clearCategory: () => { } };

  try {
    // Try to import and use the actual context
    const { useCategory } = require('../navbar/CategoryContext');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    categoryContext = useCategory();
  } catch (error) {
    console.warn('CategoryContext not available, using fallback');
  }

  return (
    <DefaultCinemaPage
      selectedCategory={categoryContext.selectedCategory}
      clearCategory={categoryContext.clearCategory}
      {...props}
    />
  );
};

// Simple version without context for basic usage
export const SimpleCinemaPage = (props) => (
  <DefaultCinemaPage {...props} />
);

// Default export
export default DefaultCinemaPage;