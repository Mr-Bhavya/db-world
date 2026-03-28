import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  GridView as GridViewIcon,
  ViewList as ListViewIcon,
  Sort as SortIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Apps as AppsIcon,
} from '@mui/icons-material';

const AdvancedGridView = ({
  fullScreenComponent,
  currentTabConfig,
  handleBackToGrid,
  handleListItemClick,
  tabConfigs = [], // Provide default empty array
  renderTabContent
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('default');
  const [favorites, setFavorites] = useState(['download-manager', 'users']);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hoveredCard, setHoveredCard] = useState(null);
  const searchRef = useRef(null);

  // Extract unique categories safely
  const categories = useMemo(() => {
    if (!Array.isArray(tabConfigs)) return ['all'];
    
    const allCategories = tabConfigs
      .map(tab => tab?.category)
      .filter(category => category && typeof category === 'string')
      .filter(Boolean);
    
    return ['all', ...new Set(allCategories)];
  }, [tabConfigs]);

  // Filter and sort tabs with safety checks
  const filteredTabs = useMemo(() => {
    if (!Array.isArray(tabConfigs)) return [];
    
    return tabConfigs
      .filter(tab => {
        if (!tab || !tab.id) return false;
        
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
          (tab.label?.toLowerCase() || '').includes(searchLower) ||
          (tab.description?.toLowerCase() || '').includes(searchLower) ||
          (tab.category?.toLowerCase() || '').includes(searchLower);
        
        const matchesCategory = selectedCategory === 'all' || tab.category === selectedCategory;
        
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          const labelA = a.label || '';
          const labelB = b.label || '';
          return labelA.localeCompare(labelB);
        }
        if (sortBy === 'category') {
          const categoryA = a.category || '';
          const categoryB = b.category || '';
          return categoryA.localeCompare(categoryB);
        }
        if (sortBy === 'favorites') {
          const aIsFavorite = favorites.includes(a.id);
          const bIsFavorite = favorites.includes(b.id);
          return (bIsFavorite ? 1 : 0) - (aIsFavorite ? 1 : 0);
        }
        return 0;
      });
  }, [tabConfigs, searchQuery, selectedCategory, sortBy, favorites]);

  const toggleFavorite = useCallback((tabId, e) => {
    e?.stopPropagation();
    if (!tabId) return;
    
    setFavorites(prev => 
      prev.includes(tabId) 
        ? prev.filter(id => id !== tabId)
        : [...prev, tabId]
    );
  }, []);

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

  // Safe currentTabConfig access
  const safeCurrentTabConfig = useMemo(() => {
    if (!currentTabConfig) {
      return {
        color: '#008080',
        label: 'Unknown',
        description: '',
        icon: <AppsIcon />,
        id: 'unknown',
      };
    }
    return currentTabConfig;
  }, [currentTabConfig]);

  if (fullScreenComponent) {
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Box
            sx={{
              px: { xs: 2, sm: 3 },
              py: 2,
              borderBottom: `1px solid ${alpha(safeCurrentTabConfig.color, 0.15)}`,
              background: `linear-gradient(135deg, 
                ${alpha(safeCurrentTabConfig.color, 0.08)} 0%, 
                ${alpha(safeCurrentTabConfig.color, 0.03)} 100%)`,
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1, sm: 2 },
              minHeight: 72,
              flexShrink: 0,
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backdropFilter: 'blur(20px)',
            }}
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <IconButton 
                onClick={handleBackToGrid} 
                size={isMobile ? "small" : "medium"}
                aria-label="Back to app selector"
                sx={{ 
                  flexShrink: 0,
                  background: `linear-gradient(135deg, ${alpha(safeCurrentTabConfig.color, 0.2)}, ${alpha(safeCurrentTabConfig.color, 0.1)})`,
                }}
              >
                <BackIcon sx={{ color: safeCurrentTabConfig.color, fontSize: isMobile ? '1.25rem' : '1.5rem' }} />
              </IconButton>
            </motion.div>
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <Box
                sx={{
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  borderRadius: { xs: '12px', sm: '16px' },
                  background: `linear-gradient(135deg, ${safeCurrentTabConfig.color}, ${alpha(safeCurrentTabConfig.color, 0.7)})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0,
                }}
                aria-label={`${safeCurrentTabConfig.label} icon`}
              >
                {React.cloneElement(safeCurrentTabConfig.icon, {
                  sx: { fontSize: isMobile ? '1.25rem' : '1.5rem' }
                })}
              </Box>
            </motion.div>

            <Box sx={{ 
              flex: 1, 
              minWidth: 0,
              overflow: 'hidden',
            }}>
              <Typography 
                variant={isMobile ? "subtitle1" : "h6"} 
                fontWeight="bold" 
                noWrap
                sx={{
                  background: `linear-gradient(135deg, ${safeCurrentTabConfig.color}, ${alpha(safeCurrentTabConfig.color, 0.8)})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {safeCurrentTabConfig.label}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{
                  fontSize: isMobile ? '0.75rem' : '0.875rem',
                  lineHeight: 1.4,
                  display: 'block',
                  mt: 0.5,
                }}
              >
                {safeCurrentTabConfig.description}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              {safeCurrentTabConfig.badge && (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Chip
                    label={safeCurrentTabConfig.badge}
                    size="small"
                    sx={{
                      height: 24,
                      px: 1,
                      bgcolor: safeCurrentTabConfig.color,
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  />
                </motion.div>
              )}
              
              <Tooltip title="Toggle Favorite">
                <IconButton
                  onClick={(e) => toggleFavorite(safeCurrentTabConfig.id, e)}
                  size="small"
                  sx={{
                    color: favorites.includes(safeCurrentTabConfig.id) ? '#FFD700' : 'action.active',
                  }}
                >
                  {favorites.includes(safeCurrentTabConfig.id) ? <StarIcon /> : <StarBorderIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </motion.div>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            position: 'relative',
          }}
        >
          {renderTabContent?.() || (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              <Typography>No content available</Typography>
            </Box>
          )}
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
        position: 'relative',
      }}
    >
      {/* Control Bar */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{ zIndex: 10 }}
      >
        <Box
          sx={{
            p: { xs: 1.5, sm: 2, md: 3 },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 2,
            background: theme.palette.background.paper,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flex: 1 }}>
            <AppsIcon sx={{ color: '#008080', fontSize: { xs: 24, sm: 32 } }} />
            <Typography 
              variant={isMobile ? "h6" : "h5"} 
              fontWeight="bold" 
              sx={{ 
                background: 'linear-gradient(135deg, #008080, #006666)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {isMobile ? 'Admin Tools' : 'Admin Tools Dashboard'}
            </Typography>
          </Box>

          {/* Search Bar */}
          <Box
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
                fontSize: isMobile ? '1rem' : '1.25rem',
              }}
            />
            <InputBase
              inputRef={searchRef}
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                width: '100%',
                pl: { xs: 4, sm: 5 },
                pr: searchQuery ? { xs: 7, sm: 8 } : { xs: 3, sm: 3 },
                py: { xs: 1, sm: 1.5 },
                borderRadius: 2,
                backgroundColor: alpha('#008080', 0.05),
                border: `1px solid ${alpha('#008080', 0.2)}`,
                fontSize: isMobile ? '0.875rem' : '0.9rem',
                '&:focus-within': {
                  borderColor: '#008080',
                  boxShadow: `0 0 0 2px ${alpha('#008080', 0.2)}`,
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
          </Box>

          {/* View Controls */}
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Tooltip title="Grid View">
              <IconButton
                onClick={() => setViewMode('grid')}
                size={isMobile ? "small" : "medium"}
                sx={{
                  bgcolor: viewMode === 'grid' ? alpha('#008080', 0.1) : 'transparent',
                  color: viewMode === 'grid' ? '#008080' : 'text.secondary',
                }}
              >
                <GridViewIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>
            <Tooltip title="List View">
              <IconButton
                onClick={() => setViewMode('list')}
                size={isMobile ? "small" : "medium"}
                sx={{
                  bgcolor: viewMode === 'list' ? alpha('#008080', 0.1) : 'transparent',
                  color: viewMode === 'list' ? '#008080' : 'text.secondary',
                }}
              >
                <ListViewIcon fontSize={isMobile ? "small" : "medium"} />
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
            px: { xs: 1.5, sm: 2, md: 3 },
            py: 1,
            display: 'flex',
            gap: 0.5,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            background: theme.palette.background.paper,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          {categories.map((category) => (
            <motion.div
              key={category}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Chip
                label={category?.charAt(0)?.toUpperCase() + category?.slice(1) || 'Unknown'}
                onClick={() => setSelectedCategory(category)}
                size={isMobile ? "small" : "medium"}
                sx={{
                  backgroundColor: selectedCategory === category 
                    ? alpha('#008080', 0.15) 
                    : alpha('#008080', 0.05),
                  color: selectedCategory === category ? '#008080' : 'text.primary',
                  fontWeight: selectedCategory === category ? 600 : 400,
                  border: `1px solid ${alpha('#008080', selectedCategory === category ? 0.3 : 0.1)}`,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: alpha('#008080', 0.1),
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
          p: { xs: 1.5, sm: 2, md: 3 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {filteredTabs.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
            }}
          >
            <SearchIcon sx={{ fontSize: { xs: 48, sm: 64, md: 80 }, color: alpha('#008080', 0.3), mb: 2 }} />
            <Typography variant={isMobile ? "subtitle1" : "h6"} color="text.secondary" gutterBottom>
              No tools found
            </Typography>
            <Typography variant={isMobile ? "caption" : "body2"} color="text.secondary" align="center">
              Try adjusting your search or filter
            </Typography>
          </Box>
        ) : viewMode === 'grid' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)',
                xl: 'repeat(5, 1fr)',
              },
              gap: { xs: 1.5, sm: 2, md: 3 },
            }}
          >
            <AnimatePresence>
              {filteredTabs.map((tab) => (
                <motion.div
                  key={tab.id}
                  layout
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ y: -4 }}
                  onHoverStart={() => setHoveredCard(tab.id)}
                  onHoverEnd={() => setHoveredCard(null)}
                  style={{ height: '100%' }}
                >
                  <Card
                    sx={{
                      height: '100%',
                      cursor: 'pointer',
                      borderRadius: 2,
                      overflow: 'hidden',
                      position: 'relative',
                      backgroundColor: 'background.paper',
                      border: `1px solid ${theme.palette.divider}`,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: alpha(tab.color || '#008080', 0.3),
                        boxShadow: `0 8px 24px ${alpha(tab.color || '#008080', 0.1)}`,
                      },
                    }}
                    onClick={() => handleListItemClick(tab.id)}
                  >
                    <Box sx={{ p: { xs: 2, sm: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      {/* Header */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, gap: 1.5 }}>
                        <Box
                          sx={{
                            width: { xs: 40, sm: 48 },
                            height: { xs: 40, sm: 48 },
                            borderRadius: { xs: '10px', sm: '12px' },
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `linear-gradient(135deg, ${alpha(tab.color || '#008080', 0.15)} 0%, ${alpha(tab.color || '#008080', 0.05)} 100%)`,
                            color: tab.color || '#008080',
                            flexShrink: 0,
                          }}
                        >
                          {tab.icon && React.cloneElement(tab.icon, {
                            sx: { fontSize: { xs: '1.25rem', sm: '1.5rem' } }
                          })}
                        </Box>
                        
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant={isMobile ? "subtitle2" : "subtitle1"}
                            fontWeight="bold"
                            sx={{
                              fontSize: isMobile ? '0.875rem' : '1rem',
                              lineHeight: 1.3,
                              color: tab.color || '#008080',
                            }}
                          >
                            {tab.label || 'Unnamed Tool'}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              color: alpha(tab.color || '#008080', 0.8),
                              fontWeight: 500,
                              mt: 0.25,
                              textTransform: 'uppercase',
                              fontSize: isMobile ? '0.65rem' : '0.75rem',
                            }}
                          >
                            {tab.category || 'Uncategorized'}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {tab.badge && (
                            <Chip
                              label={tab.badge}
                              size="small"
                              sx={{
                                height: 20,
                                px: 0.5,
                                bgcolor: alpha(tab.color || '#008080', 0.9),
                                color: 'white',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                              }}
                            />
                          )}
                          <IconButton
                            onClick={(e) => toggleFavorite(tab.id, e)}
                            size="small"
                            sx={{
                              color: favorites.includes(tab.id) ? '#FFD700' : 'action.active',
                            }}
                          >
                            {favorites.includes(tab.id) ? 
                              <StarIcon fontSize="small" /> : 
                              <StarBorderIcon fontSize="small" />
                            }
                          </IconButton>
                        </Box>
                      </Box>

                      {/* Description */}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: isMobile ? '0.75rem' : '0.875rem',
                          lineHeight: 1.5,
                          mb: 2,
                          flex: 1,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {tab.description || 'No description available'}
                      </Typography>

                      {/* Footer */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          pt: 2,
                          borderTop: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontSize: '0.75rem',
                          }}
                        >
                          Click to open
                        </Typography>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `linear-gradient(135deg, ${tab.color || '#008080'}, ${alpha(tab.color || '#008080', 0.7)})`,
                            color: 'white',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </Box>
                      </Box>
                    </Box>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>
        ) : (
          // List View
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filteredTabs.map((tab) => (
              <motion.div
                key={tab.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                whileHover={{ x: 4 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    cursor: 'pointer',
                    borderRadius: 1.5,
                    backgroundColor: 'background.paper',
                    border: `1px solid ${theme.palette.divider}`,
                    '&:hover': {
                      borderColor: alpha(tab.color || '#008080', 0.3),
                      backgroundColor: alpha(tab.color || '#008080', 0.02),
                    },
                  }}
                  onClick={() => handleListItemClick(tab.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
                    <Box
                      sx={{
                        width: { xs: 36, sm: 40 },
                        height: { xs: 36, sm: 40 },
                        borderRadius: { xs: '8px', sm: '10px' },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `linear-gradient(135deg, ${alpha(tab.color || '#008080', 0.15)} 0%, ${alpha(tab.color || '#008080', 0.05)} 100%)`,
                        color: tab.color || '#008080',
                        flexShrink: 0,
                      }}
                    >
                      {tab.icon && React.cloneElement(tab.icon, {
                        sx: { fontSize: { xs: '1rem', sm: '1.25rem' } }
                      })}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant={isMobile ? "subtitle2" : "subtitle1"} fontWeight="bold" noWrap>
                        {tab.label || 'Unnamed Tool'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {tab.description || 'No description'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      {tab.badge && (
                        <Chip 
                          label={tab.badge} 
                          size="small" 
                          sx={{ bgcolor: alpha(tab.color || '#008080', 0.9), color: 'white' }} 
                        />
                      )}
                      <IconButton size="small" onClick={(e) => toggleFavorite(tab.id, e)}>
                        {favorites.includes(tab.id) ? 
                          <StarIcon fontSize="small" /> : 
                          <StarBorderIcon fontSize="small" />
                        }
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
      <Box
        sx={{
          px: { xs: 1.5, sm: 2, md: 3 },
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Showing {filteredTabs.length} of {tabConfigs?.length || 0} tools
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
    </Box>
  );
};

export default React.memo(AdvancedGridView);