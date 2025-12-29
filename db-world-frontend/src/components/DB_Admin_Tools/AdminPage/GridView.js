import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  IconButton,
  Typography,
  Chip,
  alpha,
  InputBase,
  Tooltip,
  useTheme,
  useMediaQuery,
  Fade,
  Zoom
} from '@mui/material';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  GridView as GridViewIcon,
  ViewList as ListViewIcon,
  Sort as SortIcon,
  FilterList as FilterIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Apps as AppsIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';

const AdvancedGridView = ({
  fullScreenComponent,
  currentTabConfig,
  handleBackToGrid,
  handleListItemClick,
  tabConfigs,
  renderTabContent
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('default');
  const [favorites, setFavorites] = useState(['download-manager', 'users']);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hoveredCard, setHoveredCard] = useState(null);
  const searchRef = useRef(null);

  // Extract unique categories
  const categories = ['all', ...new Set(tabConfigs.map(tab => tab.category))];

  // Filter and sort tabs
  const filteredTabs = tabConfigs.filter(tab => {
    const matchesSearch = tab.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tab.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tab.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || tab.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.label.localeCompare(b.label);
    if (sortBy === 'category') return a.category.localeCompare(b.category);
    if (sortBy === 'favorites') {
      const aIsFavorite = favorites.includes(a.id);
      const bIsFavorite = favorites.includes(b.id);
      return bIsFavorite - aIsFavorite;
    }
    return 0;
  });

  const toggleFavorite = (tabId, e) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(tabId) 
        ? prev.filter(id => id !== tabId)
        : [...prev, tabId]
    );
  };

  // Focus search on Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (fullScreenComponent) {
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Enhanced Header with glass morphism */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Box
            sx={{
              px: 3,
              py: 2,
              borderBottom: `1px solid ${alpha(currentTabConfig.color, 0.15)}`,
              background: `linear-gradient(135deg, 
                ${alpha(currentTabConfig.color, 0.08)} 0%, 
                ${alpha(currentTabConfig.color, 0.03)} 100%)`,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              minHeight: 72,
              flexShrink: 0,
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backdropFilter: 'blur(20px)',
              boxShadow: `0 4px 20px ${alpha(currentTabConfig.color, 0.1)}`,
            }}
          >
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <IconButton 
                onClick={handleBackToGrid} 
                size="medium"
                aria-label="Back to app selector"
                sx={{ 
                  flexShrink: 0,
                  background: `linear-gradient(135deg, ${alpha(currentTabConfig.color, 0.2)}, ${alpha(currentTabConfig.color, 0.1)})`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(currentTabConfig.color, 0.3)}, ${alpha(currentTabConfig.color, 0.2)})`,
                    transform: 'rotate(-10deg)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <BackIcon sx={{ color: currentTabConfig.color }} />
              </IconButton>
            </motion.div>
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '16px',
                  background: `linear-gradient(135deg, ${currentTabConfig.color}, ${alpha(currentTabConfig.color, 0.7)})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0,
                  boxShadow: `0 8px 32px ${alpha(currentTabConfig.color, 0.4)}`,
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)',
                    animation: 'shimmer 3s infinite linear',
                  },
                  '@keyframes shimmer': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                  }
                }}
                aria-label={`${currentTabConfig.label} icon`}
              >
                {React.cloneElement(currentTabConfig.icon, {
                  sx: { fontSize: '1.5rem' }
                })}
              </Box>
            </motion.div>

            <Box sx={{ 
              flex: 1, 
              minWidth: 0,
              overflow: 'hidden',
            }}>
              <Typography 
                variant="h6" 
                fontWeight="bold" 
                noWrap
                sx={{
                  fontSize: '1.25rem',
                  lineHeight: 1.2,
                  background: `linear-gradient(135deg, ${currentTabConfig.color}, ${alpha(currentTabConfig.color, 0.8)})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {currentTabConfig.label}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{
                  fontSize: '0.875rem',
                  lineHeight: 1.4,
                  display: 'block',
                  mt: 0.5,
                }}
              >
                {currentTabConfig.description}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              {currentTabConfig.badge && (
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Chip
                    label={currentTabConfig.badge}
                    size="medium"
                    aria-label={`${currentTabConfig.badge} badge`}
                    sx={{
                      height: 28,
                      px: 1.5,
                      bgcolor: currentTabConfig.color,
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      flexShrink: 0,
                      '& .MuiChip-label': {
                        px: 1,
                      },
                      boxShadow: `0 4px 12px ${alpha(currentTabConfig.color, 0.3)}`,
                    }}
                  />
                </motion.div>
              )}
              
              <Tooltip title="Toggle Favorite">
                <IconButton
                  onClick={(e) => toggleFavorite(currentTabConfig.id, e)}
                  sx={{
                    color: favorites.includes(currentTabConfig.id) ? '#FFD700' : 'action.active',
                    '&:hover': {
                      background: alpha('#FFD700', 0.1),
                    }
                  }}
                >
                  {favorites.includes(currentTabConfig.id) ? <StarIcon /> : <StarBorderIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </motion.div>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
            '& > *': {
              minHeight: '100%',
            },
          }}
        >
          {renderTabContent()}
        </Box>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: `linear-gradient(135deg, 
          ${alpha('#008080', 0.03)} 0%, 
          ${alpha('#006666', 0.03)} 100%)`,
        position: 'relative',
      }}
    >
      {/* Animated Background Elements */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              width: Math.random() * 200 + 50,
              height: Math.random() * 200 + 50,
              background: `radial-gradient(circle, ${alpha('#008080', 0.05)} 0%, transparent 70%)`,
              borderRadius: '50%',
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, Math.random() * 100 - 50, 0],
              x: [0, Math.random() * 100 - 50, 0],
            }}
            transition={{
              duration: Math.random() * 20 + 20,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </Box>

      {/* Control Bar */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{ zIndex: 10 }}
      >
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 2,
            background: alpha(theme.palette.background.paper, 0.85),
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${alpha('#008080', 0.1)}`,
            boxShadow: `0 4px 30px ${alpha('#008080', 0.08)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}>
              <AppsIcon sx={{ color: '#008080', fontSize: 32 }} />
            </motion.div>
            <Typography variant="h5" fontWeight="bold" sx={{ 
              background: 'linear-gradient(135deg, #008080, #006666)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}>
              Admin Tools Dashboard
            </Typography>
          </Box>

          {/* Search Bar */}
          <Box
            component={motion.div}
            whileFocus={{ scale: 1.02 }}
            sx={{
              position: 'relative',
              flex: 1,
              maxWidth: 400,
            }}
          >
            <SearchIcon
              sx={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'text.secondary',
                zIndex: 1,
              }}
            />
            <InputBase
              inputRef={searchRef}
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                width: '100%',
                pl: 5,
                pr: searchQuery ? 8 : 3,
                py: 1.5,
                borderRadius: 2,
                backgroundColor: alpha('#008080', 0.05),
                border: `1px solid ${alpha('#008080', 0.2)}`,
                fontSize: '0.9rem',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: alpha('#008080', 0.08),
                  borderColor: alpha('#008080', 0.3),
                },
                '&:focus-within': {
                  backgroundColor: alpha('#008080', 0.1),
                  borderColor: '#008080',
                  boxShadow: `0 0 0 3px ${alpha('#008080', 0.2)}`,
                },
              }}
            />
            {searchQuery && (
              <IconButton
                size="small"
                onClick={() => setSearchQuery('')}
                sx={{
                  position: 'absolute',
                  right: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'text.secondary',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              Ctrl+K
            </Typography>
          </Box>

          {/* View Controls */}
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Tooltip title="Grid View">
              <IconButton
                onClick={() => setViewMode('grid')}
                sx={{
                  bgcolor: viewMode === 'grid' ? alpha('#008080', 0.1) : 'transparent',
                  color: viewMode === 'grid' ? '#008080' : 'text.secondary',
                }}
              >
                <GridViewIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="List View">
              <IconButton
                onClick={() => setViewMode('list')}
                sx={{
                  bgcolor: viewMode === 'list' ? alpha('#008080', 0.1) : 'transparent',
                  color: viewMode === 'list' ? '#008080' : 'text.secondary',
                }}
              >
                <ListViewIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </motion.div>

      {/* Category Filter */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{ zIndex: 9 }}
      >
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            py: 1.5,
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            background: alpha(theme.palette.background.paper, 0.7),
            backdropFilter: 'blur(10px)',
            borderBottom: `1px solid ${alpha('#008080', 0.1)}`,
          }}
        >
          {categories.map((category) => (
            <motion.div
              key={category}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Chip
                label={category.charAt(0).toUpperCase() + category.slice(1)}
                onClick={() => setSelectedCategory(category)}
                sx={{
                  backgroundColor: selectedCategory === category 
                    ? alpha('#008080', 0.15) 
                    : alpha('#008080', 0.05),
                  color: selectedCategory === category ? '#008080' : 'text.primary',
                  fontWeight: selectedCategory === category ? 600 : 400,
                  border: `1px solid ${alpha('#008080', selectedCategory === category ? 0.3 : 0.1)}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: alpha('#008080', 0.1),
                    transform: 'translateY(-1px)',
                  },
                }}
              />
            </motion.div>
          ))}
        </Box>
      </motion.div>

      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: { xs: 2, sm: 3 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {filteredTabs.length === 0 ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SearchIcon sx={{ fontSize: 80, color: alpha('#008080', 0.3), mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No tools found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your search or filter
            </Typography>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <LayoutGroup>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)',
                  lg: 'repeat(4, 1fr)',
                },
                gap: 3,
              }}
            >
              <AnimatePresence>
                {filteredTabs.map((tab, index) => (
                  <motion.div
                    key={tab.id}
                    layout
                    initial={{ scale: 0.8, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: -20 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 20,
                      delay: index * 0.03,
                    }}
                    whileHover={{ 
                      y: -8,
                      transition: { duration: 0.2 }
                    }}
                    onHoverStart={() => setHoveredCard(tab.id)}
                    onHoverEnd={() => setHoveredCard(null)}
                    style={{ height: '100%' }}
                  >
                    <Card
                      sx={{
                        height: '100%',
                        cursor: 'pointer',
                        borderRadius: 3,
                        overflow: 'visible',
                        position: 'relative',
                        background: `linear-gradient(135deg, 
                          ${alpha(tab.color, 0.05)} 0%, 
                          ${alpha(tab.color, 0.02)} 100%)`,
                        border: `1px solid ${alpha(tab.color, 0.1)}`,
                        boxShadow: `0 4px 20px ${alpha(tab.color, 0.05)}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          borderColor: alpha(tab.color, 0.3),
                          boxShadow: `0 20px 40px ${alpha(tab.color, 0.15)}`,
                          transform: 'translateY(-4px)',
                        },
                      }}
                      onClick={() => handleListItemClick(tab.id)}
                    >
                      {/* Floating Favorite Button */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: hoveredCard === tab.id || favorites.includes(tab.id) ? 1 : 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          position: 'absolute',
                          top: -10,
                          right: -10,
                          zIndex: 2,
                        }}
                      >
                        <IconButton
                          onClick={(e) => toggleFavorite(tab.id, e)}
                          sx={{
                            backgroundColor: favorites.includes(tab.id) ? '#FFD700' : 'background.paper',
                            color: favorites.includes(tab.id) ? 'white' : 'text.secondary',
                            boxShadow: `0 4px 12px ${alpha('#000', 0.15)}`,
                            '&:hover': {
                              backgroundColor: favorites.includes(tab.id) ? '#FFC400' : 'action.hover',
                            },
                          }}
                          size="small"
                        >
                          {favorites.includes(tab.id) ? <StarIcon /> : <StarBorderIcon />}
                        </IconButton>
                      </motion.div>

                      {/* Animated Gradient Border */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 4,
                          borderRadius: '12px 12px 0 0',
                          background: `linear-gradient(90deg, ${tab.color}, ${alpha(tab.color, 0.5)})`,
                          opacity: hoveredCard === tab.id ? 1 : 0.7,
                          transition: 'opacity 0.3s ease',
                        }}
                      />

                      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Icon Container */}
                        <motion.div
                          animate={{
                            rotate: hoveredCard === tab.id ? [0, 10, -10, 0] : 0,
                          }}
                          transition={{
                            duration: 0.5,
                            times: [0, 0.2, 0.5, 0.8],
                          }}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          <Box
                            sx={{
                              width: 56,
                              height: 56,
                              borderRadius: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: `linear-gradient(135deg, ${alpha(tab.color, 0.2)} 0%, ${alpha(tab.color, 0.1)} 100%)`,
                              border: `2px solid ${alpha(tab.color, 0.3)}`,
                              marginBottom: 2,
                              position: 'relative',
                              overflow: 'hidden',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'radial-gradient(circle at center, transparent 30%, rgba(255,255,255,0.3) 70%, transparent 100%)',
                                opacity: hoveredCard === tab.id ? 1 : 0,
                                transition: 'opacity 0.3s ease',
                              },
                            }}
                          >
                            {React.cloneElement(tab.icon, {
                              sx: {
                                fontSize: '1.75rem',
                                color: tab.color,
                                position: 'relative',
                                zIndex: 1,
                              }
                            })}
                          </Box>
                        </motion.div>

                        {/* Content */}
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                            <Typography
                              variant="subtitle1"
                              fontWeight="bold"
                              sx={{
                                fontSize: '1rem',
                                lineHeight: 1.3,
                                background: `linear-gradient(135deg, ${tab.color}, ${alpha(tab.color, 0.7)})`,
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                color: 'transparent',
                              }}
                            >
                              {tab.label}
                            </Typography>
                            {tab.badge && (
                              <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                              >
                                <Chip
                                  label={tab.badge}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    px: 1,
                                    bgcolor: alpha(tab.color, 0.9),
                                    color: 'white',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    '& .MuiChip-label': {
                                      px: 0.5,
                                    },
                                  }}
                                />
                              </motion.div>
                            )}
                          </Box>

                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              color: alpha(tab.color, 0.8),
                              fontWeight: 500,
                              mb: 1,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {tab.category}
                          </Typography>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              fontSize: '0.85rem',
                              lineHeight: 1.5,
                              mb: 2,
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {tab.description}
                          </Typography>
                        </Box>

                        {/* Footer */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            pt: 2,
                            borderTop: `1px solid ${alpha(tab.color, 0.1)}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              fontSize: '0.75rem',
                              opacity: 0.7,
                            }}
                          >
                            Click to open
                          </Typography>
                          <motion.div
                            animate={{ x: hoveredCard === tab.id ? 5 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Box
                              sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: `linear-gradient(135deg, ${tab.color}, ${alpha(tab.color, 0.7)})`,
                                color: 'white',
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </Box>
                          </motion.div>
                        </Box>
                      </Box>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </Box>
          </LayoutGroup>
        ) : (
          // List View (Optional)
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredTabs.map((tab, index) => (
              <motion.div
                key={tab.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ x: 5 }}
              >
                <Card
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${alpha(tab.color, 0.05)} 0%, transparent 100%)`,
                    border: `1px solid ${alpha(tab.color, 0.1)}`,
                    '&:hover': {
                      borderColor: alpha(tab.color, 0.3),
                      background: `linear-gradient(135deg, ${alpha(tab.color, 0.1)} 0%, transparent 100%)`,
                    },
                  }}
                  onClick={() => handleListItemClick(tab.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `linear-gradient(135deg, ${alpha(tab.color, 0.2)} 0%, ${alpha(tab.color, 0.1)} 100%)`,
                        color: tab.color,
                      }}
                    >
                      {tab.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {tab.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {tab.description}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {tab.badge && (
                        <Chip label={tab.badge} size="small" sx={{ bgcolor: alpha(tab.color, 0.9), color: 'white' }} />
                      )}
                      <IconButton size="small" onClick={(e) => toggleFavorite(tab.id, e)}>
                        {favorites.includes(tab.id) ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                    </Box>
                  </Box>
                </Card>
              </motion.div>
            ))}
          </Box>
        )}
      </Box>

      {/* Stats Bar */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: alpha(theme.palette.background.paper, 0.85),
            backdropFilter: 'blur(10px)',
            borderTop: `1px solid ${alpha('#008080', 0.1)}`,
            boxShadow: `0 -4px 20px ${alpha('#008080', 0.05)}`,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Showing {filteredTabs.length} of {tabConfigs.length} tools
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Favorites: {favorites.length}
            </Typography>
            <Tooltip title="Change Sort Order">
              <IconButton
                size="small"
                onClick={() => setSortBy(sortBy === 'default' ? 'favorites' : sortBy === 'favorites' ? 'name' : 'default')}
                sx={{
                  color: sortBy !== 'default' ? '#008080' : 'text.secondary',
                }}
              >
                <SortIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default AdvancedGridView;