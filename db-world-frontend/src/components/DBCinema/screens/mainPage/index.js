import React, { useCallback, useEffect, useState } from 'react'
import './index.css'
import Cover from '../../cover'
import Navbar from '../../navbar'
import TilesRow from '../../tilesRow'
import requests from '../../services/requests'
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core'
import CommonServices from '../../../CommonServices'
import Constants from '../../../Constants'
import { styled } from '@mui/material'
import { motion } from 'framer-motion'

export default function MainPage() {
  const [coverColor, setCoverColor] = useState('rgba(0,0,0,0.9)')

  // Add explicit state initialization
  const [navbarCollapsed, setNavbarCollapsed] = useState(() => {
    // Define categories here or get from props
    const categories = [
      { route: Constants.DB_CINEMA_MOVIES_ROUTE },
      { route: Constants.DB_CINEMA_SERIES_ROUTE }
    ];
    const initialPath = window.location.pathname;
    return categories.some(cat => initialPath.includes(cat.route));
  });

  // Manage selected category at parent level
  const [selectedCategory, setSelectedCategory] = useState(null);

  // This callback will be passed to Navbar so that when a category is selected,
  // the parent state is updated.
  const handleCategorySelect = (category) => {
    console.log(category)
    setSelectedCategory(category);
  };
  // Enhance handleNavbarCollapsed
  const handleNavbarCollapsed = useCallback((collapsed) => {
    setNavbarCollapsed(Boolean(collapsed));
  }, []);

  const handleColorChange = useCallback((newColor) => {
    setCoverColor(newColor);
  }, []);

  const TopFadeEffect = styled('div')(({ theme }) => ({
    position: 'absolute',
    top: 100,
    left: 0,
    width: '100%',
    height: '15%',
    background: `linear-gradient(to bottom, var(--navbar-bg-color, rgba(0,0,0,0.7)), transparent)`,
    pointerEvents: 'none',
    zIndex: 2
  }));

  return (
    <div className="container-main-page">

      <Navbar
        onCollapseChange={handleNavbarCollapsed}
        coverColor="transparent"
        onCategorySelect={handleCategorySelect}
      />

      {/* Cover wrapper with fade overlay */}
      <div className="cover-wrapper">
        <Cover
          isNavbarCollapsed={navbarCollapsed}
          recordCount={5}
          // The Cover component should call onColorChange when its image changes
          onColorChange={handleColorChange}
        />
      </div>

      {/* Tiles area which will overlap with the fade */}
      <div className="tiles-wrapper">
        <TopFadeEffect />
        <TilesRow title="Newly Added Movies & TV Shows" requestUrl={requests.fetchNewlyAdded} />
        <TilesRow title="Movies" requestUrl={requests.fetchAllMovies} horizontal={true} category={selectedCategory} />
        <TilesRow title="TV Shows" requestUrl={requests.fetchAllSeries} horizontal={true} category={selectedCategory} />
        <TilesRow title="My List" requestUrl={requests.fetchWatchlist} />
        <TilesRow title="Bollywood" requestUrl={requests.fetchBollywoodRecords} category={selectedCategory} />
        <TilesRow title="Hollywood" requestUrl={requests.fetchHollywoodRecords} category={selectedCategory} />
        <TilesRow title="South" requestUrl={requests.fetchSouthRecord} category={selectedCategory} />
        <TilesRow title="Gujarati" requestUrl={requests.fetchGujaratiRecords} category={selectedCategory} />
        <TilesRow title="K-Drama" requestUrl={requests.fetchKoreanRecords} category={selectedCategory} />
      </div>
    </div>
  )
}
