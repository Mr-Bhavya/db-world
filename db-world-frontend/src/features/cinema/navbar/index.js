// components/Navbar/Navbar.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Constants from '../../Constants';
import useWindowSize from '../utils/hooks/useWindowSize';
import SearchOverlay from '../screens/search';
import { getGenresList } from '../../ApiServices';
import DB_WORLD_TEAL_SVG from '../../../images/db_world_teal.svg';

// MUI Components
import {
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Typography,
  Box,
  useTheme,
  useMediaQuery,
  Badge,
  styled,
  alpha,
  Slide,
  Collapse
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Movie as MovieIcon,
  Tv as TvIcon,
  Category as CategoryIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';
import CategoryModal from './CategoryModal';

// Context
import { useCategory } from './CategoryContext';

// Netflix-style motion variants
const mobileNavVariants = {
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 120, damping: 20 }
  },
  hidden: {
    y: -40,
    opacity: 0,
    height: 0,
    transition: { type: 'spring', stiffness: 140, damping: 25 }
  }
};

// Blur width animation variants (Netflix style)
const blurWidthVariants = {
  visible: {
    width: '100%',
    backdropFilter: 'blur(20px)',
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  },
  hidden: {
    width: '70%',
    backdropFilter: 'blur(8px)',
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 20
    }
  }
};

// Optimized Styled Components
const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'scrolled' && prop !== 'coverColor',
})(({ theme, scrolled, coverColor }) => ({
  background: scrolled
    ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`
    : coverColor || 'transparent',
  backdropFilter: scrolled ? 'blur(20px)' : 'none',
  boxShadow: scrolled ? theme.shadows[4] : 'none',
  borderBottom: scrolled ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : 'none',
  transition: 'all 0.3s ease',
  backgroundImage: 'none',
  transform: 'translateZ(0)',
  willChange: 'transform',
}));

const NavButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'hasnotification',
})(({ theme, active, hasnotification }) => ({
  color: active ? theme.palette.primary.main : theme.palette.text.primary,
  textTransform: 'none',
  fontWeight: active ? 600 : 500,
  borderRadius: '12px',
  padding: '8px 16px',
  position: 'relative',
  transition: 'all 0.2s ease',
  border: `1px solid ${active ? theme.palette.primary.main : alpha(theme.palette.divider, 0.2)}`,
  background: active
    ? alpha(theme.palette.primary.main, 0.1)
    : alpha(theme.palette.background.paper, 0.1),
  backdropFilter: 'blur(10px)',
  overflow: 'hidden',
  transform: 'translateZ(0)',
  minWidth: 'auto',

  '&::before': active ? {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: theme.palette.primary.main,
    borderRadius: '2px 2px 0 0'
  } : {},

  '&::after': hasnotification ? {
    content: '""',
    position: 'absolute',
    top: 8,
    right: 8,
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: theme.palette.secondary.main,
  } : {},

  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
    background: active
      ? alpha(theme.palette.primary.main, 0.15)
      : alpha(theme.palette.background.paper, 0.2),
  },

  '@media (hover: none)': {
    '&:hover': {
      transform: 'none',
      boxShadow: 'none',
    }
  }
}));

function Navbar({ coverColor, onCollapseChange = () => { }, onGenreSelect }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const screenSize = useWindowSize();
  const navigate = useNavigate();
  const location = useLocation();

  // Use category context
  const {
    selectedCategory,
    selectedNav,
    selectCategory,
    clearCategory,
    selectNav,
    clearNav
  } = useCategory();

  const containerRef = useRef(null);
  const buttonRefs = useRef({});
  const navRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  const [categoryList, setCategoryList] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [hasNewContent, setHasNewContent] = useState(true);
  
  // Netflix-style scroll states
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState('up');
  const [scrollVelocity, setScrollVelocity] = useState(0);

  // Memoized navbar buttons configuration
  const navbarButtons = useMemo(() => [
    {
      id: 0,
      title: 'Home',
      route: Constants.DB_CINEMA_BROWSE_ROUTE,
      icon: <HomeIcon />,
      notification: false,
    },
    {
      id: 1,
      title: 'Movies',
      route: Constants.DB_CINEMA_MOVIES_ROUTE,
      icon: <MovieIcon />,
      notification: false,
    },
    {
      id: 2,
      title: 'TV Shows',
      route: Constants.DB_CINEMA_SERIES_ROUTE,
      icon: <TvIcon />,
      notification: false,
    },
    {
      id: 3,
      title: 'Categories',
      icon: <CategoryIcon />,
      notification: true,
    }
  ], []);

  // Set default nav based on current route
  useEffect(() => {
    const currentPath = location.pathname;

    if (!selectedNav) {
      let defaultNav = navbarButtons[0];

      if (currentPath.includes(Constants.DB_CINEMA_MOVIES_ROUTE)) {
        defaultNav = navbarButtons[1];
      } else if (currentPath.includes(Constants.DB_CINEMA_SERIES_ROUTE)) {
        defaultNav = navbarButtons[2];
      }

      selectNav(defaultNav);
    }
  }, [location.pathname, selectedNav, navbarButtons, selectNav]);

  // Check if we're on home page
  const isHomePage = useMemo(() => {
    return !selectedNav || selectedNav.id === 0;
  }, [selectedNav]);

  // Check if we're on movies or tv shows page
  const isMediaPage = useMemo(() => {
    return selectedNav && (selectedNav.id === 1 || selectedNav.id === 2);
  }, [selectedNav]);

  // Netflix-style scroll handling
  useEffect(() => {
    if (!isMobile) return;

    let lastScrollTime = Date.now();
    let lastScrollPosition = 0;

    const handleScroll = () => {
      const currentScroll = window.scrollY;
      const currentTime = Date.now();
      
      // Calculate scroll velocity
      const timeDiff = currentTime - lastScrollTime;
      const scrollDiff = Math.abs(currentScroll - lastScrollPosition);
      const velocity = scrollDiff / (timeDiff || 1);
      setScrollVelocity(velocity);

      // Determine scroll direction
      const direction = currentScroll > lastScrollY ? 'down' : 'up';
      setScrollDirection(direction);

      // Netflix-style logic: Hide on fast scroll down, show on scroll up
      if (direction === 'down' && currentScroll > 100 && velocity > 0.5) {
        setMobileNavVisible(false);
      } else if (direction === 'up' || currentScroll < 50) {
        setMobileNavVisible(true);
      }

      // Update scrolled state
      setIsScrolled(currentScroll > 2);
      
      // Update tracking variables
      setLastScrollY(currentScroll);
      lastScrollPosition = currentScroll;
      lastScrollTime = currentTime;
    };

    // Throttle scroll events
    const throttledScroll = () => {
      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = requestAnimationFrame(handleScroll);
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    
    return () => {
      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }
      window.removeEventListener('scroll', throttledScroll);
    };
  }, [isMobile, lastScrollY]);

  // Fetch categories
  const fetchCategory = useCallback(async () => {
    try {
      const response = await getGenresList();
      if (response?.httpStatusCode === 200 && Array.isArray(response.data)) {
        setCategoryList(response.data);
      } else {
        setCategoryList([]);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategoryList([]);
    }
  }, []);

  useEffect(() => {
    fetchCategory();
  }, [fetchCategory]);

  // Handle navbar button selection with navigation
  const handleNavbarButtonSelect = useCallback((navbarButton) => {
    if (navbarButton.id === 3) {
      setCategoryModalOpen(true);
    } else {
      selectNav(navbarButton);
      setCategoryModalOpen(false);

      if (navbarButton.route) {
        navigate(navbarButton.route);
        onGenreSelect?.(null);
        selectCategory(null);
      }
    }
  }, [selectNav, navigate, onGenreSelect, selectCategory]);

  const handleBack = useCallback(() => {
    clearNav();
    clearCategory();
    onGenreSelect?.(null);
    selectCategory(null);
    navigate(Constants.DB_CINEMA_BROWSE_ROUTE);
  }, [clearNav, clearCategory, navigate, onGenreSelect, selectCategory]);

  const handleCategorySelect = useCallback((category) => {
    selectCategory(category);
    setCategoryModalOpen(false);
    onGenreSelect?.(category);
  }, [selectCategory, onGenreSelect]);

  const handleClearCategory = useCallback(() => {
    clearCategory();
    selectCategory(null);
    onGenreSelect?.(null);
    setCategoryModalOpen(false);
  }, [clearCategory, onGenreSelect, selectCategory]);

  const handleCloseCategoryModal = useCallback(() => {
    setCategoryModalOpen(false);
  }, []);

  // Render main navbar buttons (Home, Movies, TV Shows, Categories)
  const renderMainNavbarButtons = useCallback(() => {
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
          <div
            key={navbarButton.id}
            ref={(el) => (buttonRefs.current[navbarButton.id] = el)}
          >
            <NavButton
              active={selectedNav?.id === navbarButton.id}
              hasnotification={navbarButton.notification && hasNewContent}
              onClick={() => handleNavbarButtonSelect(navbarButton)}
              startIcon={navbarButton.icon}
              endIcon={navbarButton.id === 3 ? <ExpandMoreIcon /> : null}
              sx={{
                minWidth: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {navbarButton.id !== 3
                ? navbarButton.title
                : selectedCategory?.name || navbarButton.title}
            </NavButton>
          </div>
        ))}
      </Box>
    );
  }, [navbarButtons, selectedNav, selectedCategory, handleNavbarButtonSelect, hasNewContent]);

  // Render secondary navbar buttons for mobile (only selected nav + categories)
  const renderMobileSecondaryNavbarButtons = useCallback(() => {
    if (!selectedNav || selectedNav.id === 0) return null;

    return (
      <Box
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
        <NavButton
          active
          onClick={() => handleNavbarButtonSelect(selectedNav)}
          sx={{
            px: 3,
            py: 1,
            flexShrink: 0,
          }}
        >
          {selectedNav.title}
        </NavButton>

        <NavButton
          onClick={() => setCategoryModalOpen(true)}
          endIcon={<ExpandMoreIcon />}
          sx={{
            px: 3,
            py: 1,
            flexShrink: 0,
          }}
        >
          {selectedCategory ? selectedCategory.name : 'Categories'}
          {selectedCategory && (
            <Typography
              component="span"
              sx={{
                ml: 1,
                color: 'primary.main',
                fontWeight: 600
              }}
            >
              •
            </Typography>
          )}
        </NavButton>
      </Box>
    );
  }, [selectedNav, selectedCategory, handleNavbarButtonSelect]);

  const shouldShowBackButton = selectedNav && !isHomePage && isMobile;

  // Netflix-style mobile navigation animation
  const renderMobileNavigation = useCallback(() => {
    if (!isMobile) return null;

    return (
      <motion.div
        initial={false}
        animate={mobileNavVisible ? 'visible' : 'hidden'}
        variants={mobileNavVariants}
        style={{
          position: 'relative',
          willChange: 'transform, opacity, backdrop-filter',
          transformOrigin: 'top center',
        }}
      >
        {/* Blur width animation container (Netflix style) */}
        <motion.div
          initial={false}
          animate={mobileNavVisible ? 'visible' : 'hidden'}
          variants={blurWidthVariants}
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '0 0 12px 12px',
            // background: alpha(theme.palette.background.paper, 0.9),
            margin: '0 auto',
            willChange: 'width, backdrop-filter',
          }}
        >
          {/* Main Navigation - Show when no nav selected or on home */}
          {(!selectedNav || isHomePage) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Box sx={{ py: 1 }}>
                {renderMainNavbarButtons()}
              </Box>
            </motion.div>
          )}

          {/* Secondary Navigation - Show when on Movies/TV Shows */}
          {isMediaPage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Box sx={{ py: 1 }}>
                {renderMobileSecondaryNavbarButtons()}
              </Box>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    );
  }, [
    isMobile,
    mobileNavVisible,
    selectedNav,
    isHomePage,
    isMediaPage,
    renderMainNavbarButtons,
    renderMobileSecondaryNavbarButtons,
    theme
  ]);

  // Calculate spacer height
  const spacerHeight = useMemo(() => {
    if (!isMobile) return '70px';
    
    if (isMediaPage) {
      return mobileNavVisible ? '120px' : '60px';
    }
    
    return (selectedNav && !isHomePage) ? '120px' : (mobileNavVisible ? '120px' : '60px');
  }, [isMobile, isMediaPage, mobileNavVisible, selectedNav, isHomePage]);

  return (
    <>
      <StyledAppBar
        position="fixed"
        scrolled={isScrolled}
        coverColor={coverColor}
        ref={navRef}
      >
        <Toolbar sx={{
          minHeight: { xs: '60px', md: '70px' },
          px: { xs: 2, md: 3 }
        }}>
          {/* Left Section */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            flexGrow: 1,
            gap: 2
          }}>
            {shouldShowBackButton ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton
                  onClick={handleBack}
                  size="large"
                  edge="start"
                  color="inherit"
                  sx={{
                    mr: 1,
                    background: alpha(theme.palette.background.paper, 0.1),
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      background: alpha(theme.palette.primary.main, 0.1),
                    }
                  }}
                >
                  <ArrowBackIcon />
                </IconButton>

                <Typography
                  variant="h6"
                  sx={{
                    color: 'text.primary',
                    fontWeight: 600,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.text.primary} 100%)`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    display: { xs: 'block', sm: 'none' }
                  }}
                >
                  {selectedNav.title}
                </Typography>
              </Box>
            ) : (
              <Link to={Constants.DB_WORLD_HOME_ROUTE} style={{ textDecoration: 'none' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <img
                    className="logo"
                    src={DB_WORLD_TEAL_SVG}
                    alt="Logo"
                    style={{ height: '32px' }}
                  />
                  <Typography
                    variant="h6"
                    sx={{
                      color: 'text.primary',
                      fontWeight: 700,
                      fontSize: '1.25rem',
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      color: 'transparent',
                      display: { xs: 'none', sm: 'block' }
                    }}
                  >
                    DB Cinema
                  </Typography>
                </Box>
              </Link>
            )}

            {/* Desktop Navigation */}
            {!isMobile && (
              <Box sx={{
                display: 'flex',
                ml: { md: 2, lg: 4 },
                gap: 1,
                flexGrow: 1,
                justifyContent: 'center'
              }}>
                {renderMainNavbarButtons()}
              </Box>
            )}
          </Box>

          {/* Right Section */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.5, md: 1 }
          }}>
            <IconButton
              color="inherit"
              onClick={() => setSearchActive(true)}
              size="large"
              sx={{
                background: alpha(theme.palette.background.paper, 0.1),
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  background: alpha(theme.palette.primary.main, 0.1),
                }
              }}
            >
              <SearchIcon />
            </IconButton>
          </Box>
        </Toolbar>

        {/* Netflix-style mobile navigation animation */}
        {isMobile && renderMobileNavigation()}
      </StyledAppBar>

      {/* Category Modal */}
      <CategoryModal
        open={categoryModalOpen}
        categories={categoryList}
        selectedCategory={selectedCategory}
        onSelect={handleCategorySelect}
        onClear={handleClearCategory}
        onClose={handleCloseCategoryModal}
      />

      {/* Search Overlay */}
      <AnimatePresence>
        {searchActive && (
          <SearchOverlay onClose={() => setSearchActive(false)} />
        )}
      </AnimatePresence>

      {/* Spacer */}
      <Box sx={{ height: spacerHeight }} />
    </>
  );
}

export default React.memo(Navbar);