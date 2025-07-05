import React, { useCallback, useEffect, useState } from 'react';
import { styled, useTheme } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import Cover from '../../cover';
import Navbar from '../../navbar';
import TilesRow from '../../tilesRow';
import requests from '../../services/requests';
import CommonServices from '../../../CommonServices';
import Constants from '../../../Constants';

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
  // zIndex: 1
}));

export default function MainPage() {
  const theme = useTheme();
  const [coverColor, setCoverColor] = useState('rgba(0,0,0,0.9)');
  const [navbarCollapsed, setNavbarCollapsed] = useState(() => {
    const categories = [
      { route: Constants.DB_CINEMA_MOVIES_ROUTE },
      { route: Constants.DB_CINEMA_SERIES_ROUTE }
    ];
    const initialPath = window.location.pathname;
    return categories.some(cat => initialPath.includes(cat.route));
  });
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Handlers
  const handleCategorySelect = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  const handleNavbarCollapsed = useCallback((collapsed) => {
    setNavbarCollapsed(Boolean(collapsed));
  }, []);

  const handleColorChange = useCallback((newColor) => {
    setCoverColor(newColor);
  }, []);

  // Tiles configuration
  const tilesConfig = [
    { title: "Newly Added Movies & TV Shows", requestUrl: requests.fetchNewlyAdded },
    { title: "Movies", requestUrl: requests.fetchAllMovies, horizontal: true, category: selectedCategory },
    { title: "TV Shows", requestUrl: requests.fetchAllSeries, horizontal: true, category: selectedCategory },
    { title: "My List", requestUrl: requests.fetchWatchlist },
    { title: "Bollywood", requestUrl: requests.fetchBollywoodRecords, category: selectedCategory },
    { title: "Hollywood", requestUrl: requests.fetchHollywoodRecords, category: selectedCategory },
    { title: "South", requestUrl: requests.fetchSouthRecord, category: selectedCategory },
    { title: "Gujarati", requestUrl: requests.fetchGujaratiRecords, category: selectedCategory },
    { title: "K-Drama", requestUrl: requests.fetchKoreanRecords, category: selectedCategory }
  ];

  // Set status bar color for Capacitor apps
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
      <Navbar
        onCollapseChange={handleNavbarCollapsed}
        coverColor="transparent"
        onCategorySelect={handleCategorySelect}
      />

      <CoverWrapper>
        <Cover
          isNavbarCollapsed={navbarCollapsed}
          recordCount={5}
          onColorChange={handleColorChange}
        />
      </CoverWrapper>

      <TilesWrapper>
        {/* <TopFadeEffect /> */}
        <AnimatePresence>
          {tilesConfig.map((tile, index) => (
            <motion.div
              key={`${tile.title}-${index}`}
              variants={tileRowVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              custom={index}
            >
              <TilesRow
                title={tile.title}
                requestUrl={tile.requestUrl}
                horizontal={tile.horizontal}
                category={tile.category}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </TilesWrapper>
    </MainContainer>
  );
}