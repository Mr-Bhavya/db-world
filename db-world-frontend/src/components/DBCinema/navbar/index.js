import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Constants from '../../Constants';
import useWindowSize from '../utils/hooks/useWindowSize';
import SearchOverlay from '../screens/search';
import { Capacitor } from '@capacitor/core';
import { getGenresList } from '../../ApiServices';
import DB_WORLD_TEAL_SVG from '../../../images/db_world_teal.svg';

// MUI Components
import {
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  useTheme,
  useMediaQuery,
  Badge,
  styled
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Movie as MovieIcon,
  Tv as TvIcon,
  Category as CategoryIcon
} from '@mui/icons-material';

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';
import CategoryModal from './CategoryModal';

// Styled Components
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: 'var(--navbar-bg-color)',
  backdropFilter: 'blur(10px)',
  transition: 'all 0.3s ease',
  boxShadow: 'none',
  transition: 'background-color var(--color-transition)',

  '&.scrolled': {
    background: 'rgba(0, 0, 0, 0.3) !important',
    backdropFilter: 'blur(12px)',
    boxShadow: theme.shadows[4],
    '& .MuiToolbar-root': {
      minHeight: '50px',
    },
  },
}));

const NavButton = styled(Button)(({ theme }) => ({
  color: theme.palette.text.primary,
  textTransform: 'none',
  fontWeight: 500,
  borderRadius: '8px',
  padding: '8px 16px',
  transition: 'all 0.2s ease',
  '&.active': {
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.action.selected,
    '&:after': {
      content: '""',
      position: 'absolute',
      bottom: 4,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '60%',
      height: 2,
      backgroundColor: theme.palette.primary.main,
      borderRadius: '2px'
    }
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  }
}));



function Navbar({ coverColor, onCollapseChange = () => { }, onCategorySelect }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isAndroidApp = Capacitor.getPlatform() === 'android';
  const navigate = useNavigate();
  const location = useLocation();
  const screenSize = useWindowSize();

  const containerRef = useRef(null);
  const selectedRef = useRef(null);
  const buttonRefs = useRef({});

  const [selectedNavbarButton, setSelectedCategory] = useState(null);
  const [categoryList, setCategoryList] = useState([]);
  const [selectedCategoryOption, setSelectedCategoryOption] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [categoryAnchorEl, setCategoryAnchorEl] = useState(false);

  // Memoized navbar buttons configuration
  const navbarButtons = useMemo(() => [
    { id: 1, title: 'Movies', route: Constants.DB_CINEMA_MOVIES_ROUTE, icon: <MovieIcon /> },
    { id: 2, title: 'TV Shows', route: Constants.DB_CINEMA_SERIES_ROUTE, icon: <TvIcon /> },
    { id: 3, title: 'Categories', icon: <CategoryIcon /> }
  ], []);

  // Update selected navbarButton based on current location
  useEffect(() => {
    const currentNavbarButton = navbarButtons.find((cat) =>
      location.pathname.includes(cat.route)
    );
    setSelectedCategory(currentNavbarButton || null);
    if (typeof onCollapseChange === 'function') {
      onCollapseChange(Boolean(currentNavbarButton));
    }
  }, [location, onCollapseChange, navbarButtons]);

  // Toggle "scrolled" class based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsScrolled(scrollTop > 55);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update CSS variable for navbar background
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--navbar-bg-color',
      coverColor || 'transparent'
    );
  }, [coverColor]);

  // Fetch categories
  const fetchCategory = useCallback(async () => {
    const response = await getGenresList();
    if (response.httpStatusCode === 200) {
      setCategoryList(response.data);
    }
  }, []);

  useEffect(() => {
    fetchCategory();
  }, [fetchCategory]);

  const handleNavbarButtonSelect = useCallback((navbarButton, event) => {
    if (navbarButton.id === 3) {
      setCategoryAnchorEl(event.currentTarget);
    } else {
      setSelectedCategory(navbarButton);
      if (selectedCategoryOption) {
        navigate(`${navbarButton.route}?genre=${selectedCategoryOption.id}`);
      } else {
        navigate(navbarButton.route);
      }
      // Close category modal when selecting a different tab
      setCategoryAnchorEl(false);
    }
  }, [navigate, selectedCategoryOption]);

  const handleBack = useCallback(() => {
    setSelectedCategory(null);
    setSelectedCategoryOption(null); // Clear category selection when going back
    navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
    if (typeof onCollapseChange === 'function') {
      onCollapseChange(false);
    }
  }, [navigate, onCollapseChange]);

  const handleCategorySelect = useCallback((category) => {
    setSelectedCategoryOption(category);
    setCategoryAnchorEl(false); // FIX: Close the modal after selection
    onCategorySelect(category);
    
    // If we're on a specific tab, navigate with the category
    if (selectedNavbarButton && selectedNavbarButton.route) {
      navigate(`${selectedNavbarButton.route}?genre=${category.id}`);
    }
  }, [selectedNavbarButton, navigate, onCategorySelect]);

  const handleCloseCategoryModal = useCallback(() => {
    setCategoryAnchorEl(false);
  }, []);

  // Scroll selected button into view
  useEffect(() => {
    if (selectedNavbarButton && buttonRefs.current[selectedNavbarButton.id]) {
      buttonRefs.current[selectedNavbarButton.id].scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedNavbarButton]);

  const renderNavbarButtons = useCallback(() => {
    return (
      <Box
        ref={containerRef}
        sx={{
          display: 'flex',
          overflowX: 'auto',
          gap: 1,
          px: 1,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        }}
      >
        {navbarButtons.map((navbarButton) => (
          <motion.div
            key={navbarButton.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            ref={(el) => (buttonRefs.current[navbarButton.id] = el)}
          >
            <NavButton
              className={selectedNavbarButton?.id === navbarButton.id ? 'active' : ''}
              onClick={(e) => handleNavbarButtonSelect(navbarButton, e)}
              startIcon={navbarButton.icon}
              endIcon={navbarButton.id === 3 ? <ExpandMoreIcon /> : null}
              sx={{
                borderRadius: '999px',
                padding: '6px 16px',
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                textTransform: 'none',
                fontWeight: 500,
                border: '1px solid',
                borderColor: selectedNavbarButton?.id === navbarButton.id ? 'primary.main' : 'divider',
                backgroundColor: selectedNavbarButton?.id === navbarButton.id ? 'primary.light' : 'transparent',
                color: selectedNavbarButton?.id === navbarButton.id ? 'primary.main' : 'text.primary',
                '&:hover': {
                  backgroundColor: 'primary.light',
                  borderColor: 'primary.main',
                },
              }}
            >
              {navbarButton.id !== 3
                ? navbarButton.title
                : selectedCategoryOption?.name || navbarButton.title}
            </NavButton>
          </motion.div>
        ))}
      </Box>
    );
  }, [navbarButtons, selectedNavbarButton, selectedCategoryOption, handleNavbarButtonSelect]);

  return (
    <>
      <StyledAppBar
        position="fixed"
        className={isScrolled ? 'scrolled' : ''}
        sx={{
          backgroundImage: 'none'
        }}
      >
        <Toolbar sx={{ minHeight: '50px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            {selectedNavbarButton ? (
              <motion.div
                style={{ display: 'flex', alignItems: 'center' }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <IconButton
                  onClick={handleBack}
                  size="large"
                  edge="start"
                  color="inherit"
                  sx={{ mr: 2 }}
                >
                  <ArrowBackIcon />
                </IconButton>

                <Typography
                  variant="h6"
                  sx={{ ml: 1, color: 'text.primary', fontWeight: 500 }}
                >
                  {selectedNavbarButton.title}
                </Typography>
              </motion.div>
            ) : (
              <Link to={Constants.DB_WORLD_HOME_ROUTE}>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <img
                    className="logo"
                    src={DB_WORLD_TEAL_SVG}
                    alt="Logo"
                    style={{ height: '40px' }}
                  />
                </motion.div>
              </Link>
            )}

            {!isMobile && !isScrolled && !selectedNavbarButton && (
              <Box sx={{ display: 'flex', ml: 3, gap: 1 }}>
                {renderNavbarButtons()}
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <IconButton
                color="inherit"
                onClick={() => setSearchActive(true)}
                size="large"
              >
                <SearchIcon />
              </IconButton>
            </motion.div>
          </Box>
        </Toolbar>

        {isMobile && !isScrolled && !selectedNavbarButton && (
          <Toolbar sx={{ justifyContent: 'center', py: 1, gap: 1 }}>
            {renderNavbarButtons()}
          </Toolbar>
        )}

        {isMobile && !isScrolled && selectedNavbarButton && (
          <Toolbar
            sx={{
              justifyContent: 'flex-start',
              py: 1,
              px: 1,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': {
                display: 'none',
              },
            }}
            ref={containerRef}
          >
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <IconButton onClick={handleBack} color="inherit" size="small">
                <CloseIcon />
              </IconButton>
            </motion.div>

            {navbarButtons.map((navbarButton) =>
              navbarButton?.id === selectedNavbarButton?.id ? (
                <motion.div
                  key={navbarButton.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  ref={selectedRef}
                  style={{ marginLeft: 8 }}
                >
                  <NavButton
                    className="active"
                    onClick={(e) => handleNavbarButtonSelect(navbarButton, e)}
                    sx={{
                      borderRadius: '999px',
                      border: '1px solid',
                      borderColor: 'primary.main',
                      px: 2,
                      py: 0.5,
                      textTransform: 'none',
                      fontWeight: 500,
                      color: 'primary.main',
                      backgroundColor: 'background.paper',
                      '&:hover': {
                        backgroundColor: 'primary.light',
                        borderColor: 'primary.dark',
                      },
                    }}
                  >
                    {navbarButton.title}
                  </NavButton>
                </motion.div>
              ) : null
            )}

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <NavButton
                onClick={(e) => setCategoryAnchorEl(e.currentTarget)}
                endIcon={<ExpandMoreIcon />}
                sx={{
                  borderRadius: '999px',
                  px: 2,
                  py: 0.5,
                  textTransform: 'none',
                  ml: 1,
                }}
              >
                {navbarButtons.find((cat) => cat.id === 3)?.title}
                {selectedCategoryOption && (
                  <Typography
                    component="span"
                    sx={{ ml: 1, color: 'primary.main' }}
                  >
                    {selectedCategoryOption.name}
                  </Typography>
                )}
              </NavButton>
            </motion.div>
          </Toolbar>
        )}
      </StyledAppBar>

      <CategoryModal
        open={Boolean(categoryAnchorEl)}
        onClose={handleCloseCategoryModal}
        onSelect={handleCategorySelect}
        categoryList={categoryList}
      />

      <AnimatePresence>
        {searchActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SearchOverlay onClose={() => setSearchActive(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default React.memo(Navbar);