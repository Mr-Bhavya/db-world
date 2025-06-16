// Navbar.js (Revised)
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Constants from '../../Constants';
import useWindowSize from '../utils/hooks/useWindowSize';
import SearchOverlay from '../screens/search';
import "./navbar.css";
import { Capacitor } from '@capacitor/core';
import { getGenresList } from '../../ApiServices';

function CategoryModal({ categoryList, onClose, onSelect }) {
  return (
    <div className="category-modal-overlay">
      <div className="category-modal">
        <h3>Select Category</h3>
        <div className='category-body'>
          <ul className="category-list">
            {categoryList.map((cat) => (
              <li key={cat.id}>
                <button onClick={() => onSelect(cat)} className="category-option">
                  {cat.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="category-footer">
          <button onClick={() => onSelect(null)} className="category-btn clear-btn">
            Clear
          </button>
          <button onClick={onClose} className="category-btn category-close-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Navbar({ coverColor, onCollapseChange = () => { }, onCategorySelect }) {
  // Determine Android via Capacitor
  const isAndroidApp = Capacitor.getPlatform() === "android";

  const [selectedNavbarButton, setSelectedCategory] = useState(null);
  // For category/genre selection
  const [categoryList, setCategoryList] = useState([]);
  const [selectedCategoryOption, setSelectedCategoryOption] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  // Control category modal visibility
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const screenSize = useWindowSize();

  const navbarButtons = [
    { id: 1, title: "Movies", route: Constants.DB_CINEMA_MOVIES_ROUTE },
    { id: 2, title: "TV Shows", route: Constants.DB_CINEMA_SERIES_ROUTE },
    { id: 3, title: "Categories" }
  ];

  // Update selected navbarButton based on current location.
  useEffect(() => {
    const currentNavbarButton = navbarButtons.find(cat => location.pathname.includes(cat.route));
    setSelectedCategory(currentNavbarButton || null);
    if (typeof onCollapseChange === 'function') {
      onCollapseChange(Boolean(currentNavbarButton));
    }
  }, [location, onCollapseChange]);

  // Toggle "scrolled" class based on scroll position.
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollTop > 30) {
        setIsScrolled(true);
        document.querySelector('.navbar-container')?.classList.add('scrolled');
      } else {
        setIsScrolled(false);
        document.querySelector('.navbar-container')?.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    fetchCategory();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update CSS variable for navbar background.
  useEffect(() => {
    document.documentElement.style.setProperty('--navbar-bg-color', coverColor || 'transparent');
  }, [coverColor]);

  const fetchCategory = async () => {
    let response = await getGenresList();
    if (response.httpStatusCode === 200) {
      setCategoryList(response.data);
    }
  }

  const handleNavbarButtonSelect = (navbarButton) => {
    if (navbarButton.id === 3) {
      // Open category selection modal when "Categories" button is clicked.
      setShowCategoryModal(true);
    } else {
      setSelectedCategory(navbarButton);
      // Navigate to the route and apply genre if one was already selected.
      if (selectedCategoryOption) {
        navigate(`${navbarButton.route}?genre=${selectedCategoryOption.id}`);
      } else {
        navigate(navbarButton.route);
      }
    }
  };

  const handleBack = () => {
    setSelectedCategory(null);
    navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
    if (typeof onCollapseChange === 'function') {
      onCollapseChange(false);
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategoryOption(category);
    setShowCategoryModal(false);
    onCategorySelect(category)
    // If the user is already on Movies or TV Shows, update the route with the selected category filter.
    if (selectedNavbarButton && selectedNavbarButton.route) {
      navigate(`${selectedNavbarButton.route}?genre=${category.id}`);
    }
  };

  const renderNavbarButtons = () => (
    navbarButtons.map(navbarButton => (
      <button
        key={navbarButton.id}
        className={`navbar-button-btn ${selectedNavbarButton?.id === navbarButton.id ? 'active' : ''}`}
        onClick={() => handleNavbarButtonSelect(navbarButton)}
      >
        {navbarButton.id !== 3 && navbarButton.title}
        {navbarButton.id === 3 ? selectedCategoryOption && (
          selectedCategoryOption.name
        ) || navbarButton.title : ""}
        {navbarButton.id === 3 && <i className="fas fa-angle-down mx-1" />}
      </button>
    ))
  );

  return (
    <div className="navbar-container">
      <div className="navbar-top-line">
        <div className="left-section">
          {selectedNavbarButton ? (
            <button className="back-button" onClick={handleBack}>
              <i className="fas fa-long-arrow-alt-left me-3 ms-0" />
              <span>{selectedNavbarButton.title}</span>
            </button>
          ) : (
            <Link to={Constants.DB_WORLD_HOME_ROUTE}>
              <img
                className="logo"
                src="https://db-world.in/static/media/db_world_teal.0e35515b2b6f8921003029df632aab7f.svg"
                alt="Logo"
              />
            </Link>
          )}
          {/* For desktop, show navbarButtons in the top line when not scrolled and no navbarButton selected */}
          {screenSize.width >= 768 && !isScrolled && !selectedNavbarButton && (
            <div className="navbar-top-line-navbar-buttons">
              {renderNavbarButtons()}
            </div>
          )}
        </div>
        <div className="right-section">
          {isAndroidApp && (
            <button
              className="nav-icon"
              onClick={() => navigate(Constants.DB_CINEMA_DOWNLOAD_PROGRESS_ROUTE)}
            >
              <i className="fas fa-download" />
            </button>
          )}
          <button className="nav-icon" onClick={() => setSearchActive(true)}>
            <i className="fas fa-search" />
          </button>
        </div>
      </div>
      {/* For mobile, show bottom line if not scrolled and no navbarButton selected */}
      {screenSize.width < 768 && !isScrolled && !selectedNavbarButton && (
        <div className="navbar-bottom-line">
          {renderNavbarButtons()}
        </div>
      )}
      {screenSize.width < 768 && !isScrolled && selectedNavbarButton && (
        <div className="navbar-bottom-line">
          <button className="close-btn" onClick={handleBack}>
            <i className="fa fa-times" />
          </button>
          {navbarButtons.map(navbarButton =>
            navbarButton?.id === selectedNavbarButton?.id && (
              <button
                key={navbarButton.id}
                className={`navbar-button-btn ${selectedNavbarButton?.id === navbarButton.id ? 'active' : ''}`}
                onClick={() => handleNavbarButtonSelect(navbarButton)}
              >
                {navbarButton.title}
              </button>
            )
          )}
          <button className="navbar-button-btn">
            {navbarButtons.filter(cat => cat.id === 3)[0].title}
            {selectedCategoryOption && (
              <span className="selected-category">{selectedCategoryOption.name}</span>
            )}{' '}
            <i className="fas fa-angle-down mx-1" />
          </button>
        </div>
      )}
      {searchActive && <SearchOverlay onClose={() => setSearchActive(false)} />}
      {showCategoryModal && (
        <CategoryModal
          categoryList={categoryList}
          onClose={() => setShowCategoryModal(false)}
          onSelect={handleCategorySelect}
        />
      )}
    </div>
  );
}

export default Navbar;