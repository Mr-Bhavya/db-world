import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Chip,
  alpha,
  CircularProgress,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  Fade
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';

const TabView = ({
  activeTab,
  handleTabChange,
  loading,
  currentTabConfig,
  tabConfigs,
  renderTabContent
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const tabsContainerRef = useRef(null);
  const contentRef = useRef(null);

  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabsScrollPosition, setTabsScrollPosition] = useState(0);

  // Check if tabs need scrolling
  useEffect(() => {
    const checkScroll = () => {
      if (tabsContainerRef.current) {
        const { scrollWidth, clientWidth } = tabsContainerRef.current;
        setShowScrollButtons(scrollWidth > clientWidth);
      }
    };

    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [tabConfigs]);

  const scrollTabs = (direction) => {
    if (tabsContainerRef.current) {
      const scrollAmount = 200;
      const newPosition = tabsContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      tabsContainerRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setTabsScrollPosition(newPosition);
    }
  };

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  const scrollContent = (direction) => {
    if (contentRef.current) {
      const scrollAmount = 300;
      contentRef.current.scrollBy({
        top: direction === 'down' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleRefresh = () => {
    // Add refresh logic here
    console.log('Refreshing content...');
  };

  const getTabBackground = (tabId) => {
    if (tabId === activeTab) {
      return `linear-gradient(135deg, ${currentTabConfig.color} 0%, ${alpha(currentTabConfig.color, 0.8)} 100%)`;
    }
    return 'transparent';
  };

  const getTabBorder = (tabId) => {
    if (tabId === activeTab) {
      return `2px solid ${alpha(currentTabConfig.color, 0.3)}`;
    }
    return `1px solid ${alpha('#008080', 0.1)}`;
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: isFullscreen ? theme.palette.background.default : 'transparent',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Enhanced Tabs Container */}
      <Box
        sx={{
          position: 'relative',
          borderBottom: `1px solid ${alpha('#008080', 0.1)}`,
          backgroundColor: alpha('#008080', 0.02),
          minHeight: 56,
          overflow: 'hidden',
        }}
      >
        {/* Left Scroll Button */}
        {showScrollButtons && tabsScrollPosition > 0 && (
          <IconButton
            onClick={() => scrollTabs('left')}
            sx={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha('#008080', 0.1)}`,
              borderRadius: '0 8px 8px 0',
              height: 48,
              width: 32,
              '&:hover': {
                backgroundColor: alpha('#008080', 0.1),
              }
            }}
          >
            <ChevronLeft />
          </IconButton>
        )}

        {/* Right Scroll Button */}
        {showScrollButtons && (
          <IconButton
            onClick={() => scrollTabs('right')}
            sx={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha('#008080', 0.1)}`,
              borderRadius: '8px 0 0 8px',
              height: 48,
              width: 32,
              '&:hover': {
                backgroundColor: alpha('#008080', 0.1),
              }
            }}
          >
            <ChevronRight />
          </IconButton>
        )}

        {/* Custom Scroll Container */}
        <Box
          ref={tabsContainerRef}
          sx={{
            display: 'flex',
            overflowX: 'auto',
            scrollbarWidth: 'none', // Firefox
            '&::-webkit-scrollbar': {
              display: 'none', // Chrome/Safari
            },
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
            px: 1,
            py: 1,
            gap: 1,
          }}
          onScroll={(e) => setTabsScrollPosition(e.target.scrollLeft)}
        >
          {tabConfigs.map((tab) => (
            <motion.div
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{ flexShrink: 0 }}
            >
              <Box
                component="button"
                onClick={(e) => handleTabChange(e, tab.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1.5,
                  minHeight: 44,
                  borderRadius: 2,
                  border: getTabBorder(tab.id),
                  background: getTabBackground(tab.id),
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    borderColor: alpha(tab.color, 0.4),
                    backgroundColor: tab.id === activeTab
                      ? `linear-gradient(135deg, ${alpha(tab.color, 0.9)} 0%, ${alpha(tab.color, 0.7)} 100%)`
                      : alpha(tab.color, 0.05),
                    transform: 'translateY(-1px)',
                    boxShadow: `0 4px 12px ${alpha(tab.color, 0.15)}`,
                  },
                  '&::before': tab.id === activeTab ? {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${tab.color}, ${alpha(tab.color, 0.7)})`,
                    borderRadius: '2px 2px 0 0',
                  } : {},
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: alpha(tab.color, tab.id === activeTab ? 0.2 : 0.1),
                    color: tab.id === activeTab ? 'white' : tab.color,
                  }}
                >
                  {React.cloneElement(tab.icon, {
                    fontSize: 'small',
                    sx: { fontSize: '1rem' }
                  })}
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{
                      color: tab.id === activeTab ? 'white' : 'text.primary',
                      fontSize: '0.8rem',
                      lineHeight: 1,
                      textAlign: 'left',
                    }}
                  >
                    {tab.label}
                  </Typography>

                  {/* {tab.badge && (
                    <Chip
                      label={tab.badge}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: '0.55rem',
                        backgroundColor: tab.id === activeTab ? 'white' : alpha(tab.color, 0.9),
                        color: tab.id === activeTab ? tab.color : 'white',
                        mt: 0.5,
                        px: 0.5,
                        '& .MuiChip-label': {
                          px: 0.5,
                        },
                      }}
                    />
                  )} */}
                </Box>
              </Box>
            </motion.div>
          ))}
        </Box>
      </Box>

      {/* Content Area with Advanced Scrolling */}
      <Box
        ref={contentRef}
        sx={{
          flex: 1,
          position: 'relative',
          overflow: 'auto',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: alpha('#008080', 0.05),
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha('#008080', 0.2),
            borderRadius: '4px',
            '&:hover': {
              background: alpha('#008080', 0.3),
            },
          },
          padding: isMobile ? 1 : 2,
          backgroundColor: alpha('#008080', 0.01),
        }}
      >

        {/* Loading State */}
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 'calc(100vh - 200px)',
              gap: 2,
            }}
          >
            <CircularProgress
              size={60}
              thickness={3}
              sx={{
                color: currentTabConfig.color,
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                }
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: currentTabConfig.color,
                fontWeight: 500,
                animation: 'pulse 1.5s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                }
              }}
            >
              Loading {currentTabConfig.label}...
            </Typography>
          </Box>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut"
              }}
              style={{ height: '100%' }}
            >
              <Box
                sx={{
                  minHeight: '100%',
                  borderRadius: 2,
                  overflow: 'hidden',
                  backgroundColor: 'background.paper',
                  boxShadow: `0 2px 8px ${alpha('#008080', 0.05)}`,
                  border: `1px solid ${alpha('#008080', 0.08)}`,
                }}
              >
                {/* Tab Content */}
                <Box sx={{ padding: 0 }}>
                  {renderTabContent()}
                </Box>
              </Box>
            </motion.div>
          </AnimatePresence>
        )}
      </Box>

      {/* Status Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          borderTop: `1px solid ${alpha('#008080', 0.08)}`,
          backdropFilter: 'blur(10px)',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {tabConfigs.length} tools available
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Shortcut: <strong>{currentTabConfig.shortcut}</strong>
          </Typography>
          <Chip
            label={currentTabConfig.category}
            size="small"
            sx={{
              backgroundColor: alpha(currentTabConfig.color, 0.1),
              color: currentTabConfig.color,
              fontSize: '0.65rem',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default TabView;