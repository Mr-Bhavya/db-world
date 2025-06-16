import React, { useCallback, useEffect, useState } from 'react'
import Cover from '../../cover'
import Navbar from '../../navbar'
import TilesRow from '../../tilesRow'
import requests from '../../services/requests'
import { styled } from '@mui/material'
import Constants from '../../../Constants'

export default function SeriesPage() {

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
        {/* passing special prop topRow for as top row is rendered differently in terms of size and design */}
        <TilesRow title="Newly Added shows" requestUrl={requests.fetchAllSeries} horizontal={true} />
        {/* Rest of the tiles */}
        <TilesRow title="Bollywood" requestUrl={requests.fetchBollywoodSeries} />
        <TilesRow title="Hollywood" requestUrl={requests.fetchHollywoodSeries} />
        <TilesRow title="South" requestUrl={requests.fetchSouthSeries} />
        <TilesRow title="Gujarati" requestUrl={requests.fetchGujaratiSeries} />
        <TilesRow title="K-Drama" requestUrl={requests.fetchKoreanSeries} />
      </div>
    </div>
  )
  return (
    <div className='container-main-page'>

      {/* navbar */}
      {/* <Navbar selectedProfile={selectedProfile} /> */}

      {/* cover */}
      <Cover />

      {/* resuable component tile */}
      <div style={{ paddingTop: 16, }}>
        {/* passing special prop topRow for as top row is rendered differently in terms of size and design */}
        <TilesRow title="Newly Added shows" requestUrl={requests.fetchAllSeries} horizontal={true} />
        {/* Rest of the tiles */}
        <TilesRow title="Bollywood" requestUrl={requests.fetchBollywoodSeries} />
        <TilesRow title="Hollywood" requestUrl={requests.fetchHollywoodSeries} />
        <TilesRow title="South" requestUrl={requests.fetchSouthSeries} />
        <TilesRow title="Gujarati" requestUrl={requests.fetchGujaratiSeries} />
        <TilesRow title="K-Drama" requestUrl={requests.fetchKoreanSeries} />
      </div>
    </div>
  )
}
