import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Box, styled, useTheme } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

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
  transition: 'background-color 0.5s ease-out'
}));

const CoverWrapper = styled(motion.div)({
  position: 'relative',
});

const TilesWrapper = styled(motion.div)(({ theme }) => ({
  background: 'black',
  marginTop: -100,
  position: 'relative',
  paddingTop: 100,
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

/**
 * CinemaPage Component - Specialized for cinema browsing
 */
const CinemaPage = ({
  CoverComponent,
  NavbarComponent,
  TilesRowComponent,
  GenreViewComponent,
  tilesConfig = [],
  onColorChange = () => {},
  onGenreSelect = () => {},
  onBackToHome = () => {},
  showTopFade = true,
  showCover = true,
  coverProps = {},
  navbarProps = {},
  genreViewProps = {},
  pageTitle = "Cinema"
}) => {
  const theme = useTheme();
  const [coverColor, setCoverColor] = useState('rgba(0,0,0,0.9)');
  const [navbarCollapsed, setNavbarCollapsed] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState(null);

  // Reset state when tilesConfig changes (route changes)
  useEffect(() => {
    setSelectedGenre(null);
    setCoverColor('rgba(0,0,0,0.9)');
    setNavbarCollapsed(false);
  }, [tilesConfig]);

  // Memoize the processed tiles config to prevent unnecessary re-renders
  const processedTilesConfig = useMemo(() => {
    return tilesConfig.map(tile => ({
      ...tile,
      recordTypes: tile.recordTypes || ['movie', 'series']
    }));
  }, [tilesConfig]);

  // Get default record types for cover
  const defaultRecordTypes = useMemo(() => {
    return processedTilesConfig.length > 0 
      ? processedTilesConfig[0].recordTypes 
      : ['movie', 'series'];
  }, [processedTilesConfig]);

  // Handlers
  const handleCategorySelect = useCallback((genre) => {
    setSelectedGenre(genre);
    onGenreSelect(genre);
    window.scrollTo(0, 0);
  }, [onGenreSelect]);

  const handleBackToHome = useCallback(() => {
    setSelectedGenre(null);
    onBackToHome();
  }, [onBackToHome]);

  const handleColorChange = useCallback((newColor) => {
    setCoverColor(newColor);
    onColorChange(newColor);
  }, [onColorChange]);

  // Set status bar color
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: coverColor });
    }
  }, [coverColor]);

  return (
    <MainContainer
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      style={{ '--navbar-bg-color': coverColor }}
    >
      <NavbarComponent
        onCollapseChange={setNavbarCollapsed}
        coverColor="transparent"
        onCategorySelect={handleCategorySelect}
        onBack={selectedGenre ? handleBackToHome : null}
        showBackButton={!!selectedGenre}
        pageTitle={pageTitle}
        {...navbarProps}
      />

      {showTopFade && <TopFadeEffect />}

      {!selectedGenre ? (
        <>
          {showCover && (
            <CoverWrapper>
              <CoverComponent
                isNavbarCollapsed={navbarCollapsed}
                onColorChange={handleColorChange}
                recordTypes={defaultRecordTypes}
                {...coverProps}
              />
            </CoverWrapper>
          )}

          <TilesWrapper style={{ marginTop: showCover ? -100 : 0, paddingTop: showCover ? 100 : 0 }}>
            <AnimatePresence>
              {processedTilesConfig.map((tile, index) => (
                <motion.div
                  key={`${tile.title}-${index}-${tile.requestUrl}`}
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
                    {...tile}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </TilesWrapper>
        </>
      ) : (
        <GenreViewComponent 
          genre={selectedGenre}
          onBack={handleBackToHome}
          {...genreViewProps}
        />
      )}
    </MainContainer>
  );
};

export default CinemaPage;

// Default export with default components
export const CinemaPageWithDefaults = (props) => {
  // Import components dynamically to avoid circular dependencies
  const Cover = React.lazy(() => import('../../cover'));
  const Navbar = React.lazy(() => import('../../navbar'));
  const TilesRow = React.lazy(() => import('../../tilesRow'));
  const GenreView = React.lazy(() => import('../GenreView'));

  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <CinemaPage
        CoverComponent={Cover}
        NavbarComponent={Navbar}
        TilesRowComponent={TilesRow}
        GenreViewComponent={GenreView}
        {...props}
      />
    </React.Suspense>
  );
};

// Helper function to create tiles configuration
export const createTilesConfig = (configs) => {
  return configs.map(config => ({
    title: config.title,
    requestUrl: config.requestUrl,
    horizontal: config.horizontal || false,
    recordTypes: config.recordTypes || ['movie', 'series'],
    ...config
  }));
};