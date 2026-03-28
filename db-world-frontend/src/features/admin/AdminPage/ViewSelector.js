import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Grid,
  Card,
  Box,
  Button,
  alpha,
  Tooltip,
  useTheme,
  useMediaQuery,
  Chip,
  Slide,
  Fade,
  useScrollTrigger
} from '@mui/material';
import {
  TableView as TabViewIcon,
  GridView as GridViewIcon,
  Close as CloseIcon,
  KeyboardArrowRight as ArrowRightIcon,
  CheckCircle as CheckCircleIcon,
  Settings as SettingsIcon,
  AutoAwesome as AutoAwesomeIcon,
  AccessTime as AccessTimeIcon,
  Smartphone,
  Tablet,
  DesktopWindows,
  TouchApp,
  ArrowBack
} from '@mui/icons-material';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

const ViewSelector = ({ 
  showViewSelector, 
  handleViewSelect, 
  setShowViewSelector, 
  adminTheme,
  currentViewMode = null
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  
  const [selectedView, setSelectedView] = useState(null);
  const [showFeatures, setShowFeatures] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [deviceType, setDeviceType] = useState('desktop');
  const dialogRef = useRef(null);
  const controls = useAnimation();

  // Detect device type
  useEffect(() => {
    if (isMobile) setDeviceType('mobile');
    else if (isTablet) setDeviceType('tablet');
    else setDeviceType('desktop');
  }, [isMobile, isTablet]);

  // Handle swipe gestures for mobile
  const handleTouchStart = (e) => {
    if (!isMobile) return;
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (!isMobile) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isMobile || !touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && selectedView) {
      handleViewSelect(selectedView);
    } else if (isRightSwipe && showFeatures) {
      setShowFeatures(false);
      setSelectedView(null);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Auto-close timer
  useEffect(() => {
    if (showViewSelector) {
      const timer = setTimeout(() => {
        if (showViewSelector && !selectedView && !showFeatures) {
          setShowViewSelector(false);
        }
      }, 30000);
      
      return () => clearTimeout(timer);
    }
  }, [showViewSelector, selectedView, showFeatures]);

  // Handle view selection with animation
  const handleViewClick = useCallback((view) => {
    setSelectedView(view);
    
    controls.start({
      scale: [1, 1.1, 1],
      rotate: [0, 5, -5, 0],
      transition: { duration: 0.5 }
    });

    setTimeout(() => {
      setShowFeatures(true);
      setTimeout(() => {
        handleViewSelect(view);
      }, isMobile ? 1000 : 1500);
    }, 300);
  }, [controls, handleViewSelect, isMobile]);

  const handleCancel = useCallback(() => {
    setShowViewSelector(false);
  }, []);

  const handleBack = useCallback(() => {
    setShowFeatures(false);
    setSelectedView(null);
  }, []);

  // View options configuration
  const viewOptions = [
    {
      id: 'tabs',
      title: 'Tab View',
      description: 'Classic horizontal navigation',
      icon: <TabViewIcon />,
      color: adminTheme.palette.primary.main,
      gradient: `linear-gradient(135deg, ${adminTheme.palette.primary.main}, ${adminTheme.palette.secondary.main})`,
      features: [
        'Quick navigation between tools',
        'Space-efficient layout',
        'Familiar interface for power users',
        'Keyboard shortcuts enabled'
      ],
      bestFor: 'Administrators & Power Users',
      deviceIcons: {
        mobile: <Smartphone fontSize="small" />,
        tablet: <Tablet fontSize="small" />,
        desktop: <DesktopWindows fontSize="small" />
      }
    },
    {
      id: 'grid',
      title: 'Grid View',
      description: 'Visual application launcher',
      icon: <GridViewIcon />,
      color: adminTheme.palette.secondary.main,
      gradient: `linear-gradient(135deg, ${adminTheme.palette.secondary.main}, ${adminTheme.palette.primary.light})`,
      features: [
        'Visual tool discovery',
        'Drag & drop organization',
        'Quick search and filter',
        'Customizable favorites'
      ],
      bestFor: 'New Users & Visual Learners',
      deviceIcons: {
        mobile: <TouchApp fontSize="small" />,
        tablet: <Tablet fontSize="small" />,
        desktop: <DesktopWindows fontSize="small" />
      }
    }
  ];

  // Responsive dialog styles
  const dialogStyles = {
    mobile: {
      PaperProps: {
        sx: {
          margin: 1,
          width: 'calc(100% - 16px)',
          maxHeight: 'calc(100% - 32px)',
          borderRadius: 3,
          background: `linear-gradient(135deg, 
            ${alpha(adminTheme.palette.background.paper, 0.98)} 0%, 
            ${alpha(adminTheme.palette.background.paper, 0.92)} 100%)`,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${alpha(adminTheme.palette.primary.main, 0.15)}`,
          boxShadow: `0 10px 40px ${alpha(adminTheme.palette.primary.main, 0.15)}`,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, 
              ${adminTheme.palette.primary.main} 0%, 
              ${adminTheme.palette.secondary.main} 100%)`,
            borderRadius: '4px 4px 0 0',
          }
        }
      },
      Content: {
        p: 2,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }
    },
    tablet: {
      PaperProps: {
        sx: {
          margin: 2,
          width: 'calc(100% - 32px)',
          maxHeight: 'calc(100% - 64px)',
          borderRadius: 3,
          background: `linear-gradient(135deg, 
            ${alpha(adminTheme.palette.background.paper, 0.96)} 0%, 
            ${alpha(adminTheme.palette.background.paper, 0.88)} 100%)`,
          backdropFilter: 'blur(30px)',
          border: `1px solid ${alpha(adminTheme.palette.primary.main, 0.2)}`,
          boxShadow: `0 15px 50px ${alpha(adminTheme.palette.primary.main, 0.2)}`,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, 
              ${adminTheme.palette.primary.main} 0%, 
              ${adminTheme.palette.secondary.main} 50%, 
              ${adminTheme.palette.primary.light} 100%)`,
            borderRadius: '4px 4px 0 0',
          }
        }
      },
      Content: {
        p: 3,
        overflowY: 'auto'
      }
    },
    desktop: {
      PaperProps: {
        sx: {
          borderRadius: 4,
          background: `linear-gradient(135deg, 
            ${alpha(adminTheme.palette.background.paper, 0.95)} 0%, 
            ${alpha(adminTheme.palette.background.paper, 0.85)} 100%)`,
          backdropFilter: 'blur(40px)',
          border: `1px solid ${alpha(adminTheme.palette.primary.main, 0.2)}`,
          boxShadow: `0 20px 60px ${alpha(adminTheme.palette.primary.main, 0.2)}`,
          minHeight: 500,
          maxHeight: '90vh',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, 
              ${adminTheme.palette.primary.main} 0%, 
              ${adminTheme.palette.secondary.main} 50%, 
              ${adminTheme.palette.primary.light} 100%)`,
            borderRadius: '4px 4px 0 0',
          }
        }
      },
      Content: {
        p: 0,
        overflow: 'hidden'
      }
    }
  };

  const currentStyles = dialogStyles[deviceType];

  return (
    <Dialog
      open={showViewSelector}
      onClose={handleCancel}
      maxWidth={isMobile ? false : 'md'}
      fullWidth={!isMobile}
      fullScreen={isMobile}
      PaperProps={currentStyles.PaperProps}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      TransitionComponent={isMobile ? Slide : Fade}
      TransitionProps={{ direction: isMobile ? 'up' : 'left' }}
    >
      {/* Header Bar for Mobile */}
      {isMobile && !showFeatures && (
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          p: 2,
          background: alpha(adminTheme.palette.background.paper, 0.9),
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${alpha(adminTheme.palette.primary.main, 0.1)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <IconButton onClick={handleCancel} size="small">
            <CloseIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight="bold">
            Choose View
          </Typography>
          <Box sx={{ width: 40 }} /> {/* Spacer for alignment */}
        </Box>
      )}

      {/* Back Button for Mobile Features View */}
      {isMobile && showFeatures && (
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          p: 2,
          background: alpha(adminTheme.palette.background.paper, 0.9),
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${alpha(adminTheme.palette.primary.main, 0.1)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <IconButton onClick={handleBack} size="small">
            <ArrowBack />
          </IconButton>
          <Typography variant="subtitle1" fontWeight="bold">
            Getting Started
          </Typography>
        </Box>
      )}

      {/* Close Button for Desktop/Tablet */}
      {!isMobile && (
        <Tooltip title="Close (Esc)">
          <IconButton
            onClick={handleCancel}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 10,
              background: alpha(adminTheme.palette.background.paper, 0.3),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(adminTheme.palette.primary.main, 0.2)}`,
              color: adminTheme.palette.primary.main,
              '&:hover': {
                background: alpha(adminTheme.palette.primary.main, 0.1),
                transform: 'rotate(90deg)',
              },
              transition: 'all 0.3s ease',
              width: 40,
              height: 40,
            }}
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Animated Background Elements */}
      {!isMobile && (
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
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                width: 100 + i * 50,
                height: 100 + i * 50,
                background: `radial-gradient(circle, ${alpha(adminTheme.palette.primary.main, 0.03)} 0%, transparent 70%)`,
                borderRadius: '50%',
                top: `${20 + i * 20}%`,
                left: `${10 + i * 30}%`,
              }}
              animate={{
                y: [0, 20, 0],
                x: [0, 10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 8 + i * 2,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
        </Box>
      )}

      <DialogContent sx={currentStyles.Content}>
        <AnimatePresence mode="wait">
          {!showFeatures ? (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: isMobile ? 20 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              style={{ height: '100%' }}
            >
              {/* Header Section */}
              <Box sx={{ 
                p: isMobile ? 2 : { xs: 3, sm: 4 }, 
                textAlign: 'center',
                position: 'relative',
                pt: isMobile ? 0 : undefined
              }}>
                {!isMobile && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 200, 
                      damping: 15,
                      delay: 0.1 
                    }}
                  >
                    <Box
                      sx={{
                        width: isMobile ? 60 : 80,
                        height: isMobile ? 60 : 80,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${alpha(adminTheme.palette.primary.main, 0.1)} 0%, ${alpha(adminTheme.palette.secondary.main, 0.1)} 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                        border: `2px solid ${alpha(adminTheme.palette.primary.main, 0.2)}`,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <AutoAwesomeIcon 
                        sx={{ 
                          fontSize: isMobile ? 30 : 40,
                          color: adminTheme.palette.primary.main,
                          position: 'relative',
                          zIndex: 1,
                        }} 
                      />
                    </Box>
                  </motion.div>
                )}

                <Typography
                  variant={isMobile ? "h5" : "h4"}
                  fontWeight="bold"
                  gutterBottom
                  sx={{
                    background: `linear-gradient(135deg, ${adminTheme.palette.primary.main} 0%, ${adminTheme.palette.secondary.main} 100%)`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    mb: 1,
                  }}
                >
                  Choose Your View Style
                </Typography>

                <Typography
                  variant={isMobile ? "body2" : "body1"}
                  color="text.secondary"
                  sx={{ mb: 1, mx: 'auto', maxWidth: 600 }}
                >
                  Select how you'd like to navigate the admin dashboard
                </Typography>

                {!isMobile && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                      opacity: 0.7,
                    }}
                  >
                    <AccessTimeIcon fontSize="inherit" />
                    You can change this later in settings
                  </Typography>
                )}

                {/* Device Indicator for Mobile */}
                {isMobile && (
                  <Chip
                    icon={deviceType === 'mobile' ? <Smartphone /> : <Tablet />}
                    label={`${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} View`}
                    size="small"
                    sx={{ mt: 1, background: alpha(adminTheme.palette.primary.main, 0.1) }}
                  />
                )}
              </Box>

              {/* View Options Grid */}
              <Box sx={{ 
                p: isMobile ? 2 : { xs: 2, sm: 3, md: 4 }, 
                pt: isMobile ? 0 : undefined,
                pb: isMobile ? 6 : undefined // Extra padding for mobile bottom buttons
              }}>
                <Grid 
                  container 
                  spacing={isMobile ? 2 : 3} 
                  justifyContent="center"
                  direction={isMobile ? "column" : "row"}
                >
                  {viewOptions.map((option, index) => (
                    <Grid 
                      item 
                      xs={12} 
                      sm={6} 
                      key={option.id}
                      sx={isMobile ? { width: '100%' } : {}}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: isMobile ? 10 : 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 + 0.2 }}
                        whileHover={!isMobile ? { 
                          y: -8,
                          transition: { duration: 0.2 }
                        } : {}}
                        whileTap={isMobile ? { scale: 0.98 } : {}}
                      >
                        <Card
                          onClick={() => handleViewClick(option.id)}
                          sx={{
                            height: '100%',
                            cursor: 'pointer',
                            borderRadius: isMobile ? 2 : 3,
                            overflow: 'hidden',
                            position: 'relative',
                            background: `linear-gradient(135deg, 
                              ${alpha(option.color, 0.05)} 0%, 
                              ${alpha(option.color, 0.02)} 100%)`,
                            border: `2px solid ${alpha(option.color, selectedView === option.id ? 0.4 : 0.1)}`,
                            transition: 'all 0.3s ease',
                            boxShadow: selectedView === option.id 
                              ? `0 ${isMobile ? '8' : '20'}px ${isMobile ? '20' : '40'}px ${alpha(option.color, isMobile ? 0.1 : 0.2)}`
                              : `0 ${isMobile ? '4' : '8'}px ${isMobile ? '12' : '24'}px ${alpha(option.color, isMobile ? 0.05 : 0.1)}`,
                            '&:hover': {
                              borderColor: alpha(option.color, 0.3),
                              boxShadow: `0 ${isMobile ? '12' : '20'}px ${isMobile ? '24' : '40'}px ${alpha(option.color, isMobile ? 0.08 : 0.15)}`,
                              transform: isMobile ? 'none' : 'translateY(-4px)',
                            },
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '4px',
                              background: option.gradient,
                              opacity: selectedView === option.id ? 1 : 0.7,
                              transition: 'opacity 0.3s ease',
                            }
                          }}
                        >
                          <Box sx={{ p: isMobile ? 2 : 3 }}>
                            {/* Icon Container */}
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 2,
                              mb: isMobile ? 1 : 2 
                            }}>
                              <motion.div
                                animate={selectedView === option.id ? controls : {}}
                                style={{ display: 'inline-block' }}
                              >
                                <Box
                                  sx={{
                                    width: isMobile ? 48 : 64,
                                    height: isMobile ? 48 : 64,
                                    borderRadius: isMobile ? '12px' : '16px',
                                    background: `linear-gradient(135deg, ${alpha(option.color, 0.2)} 0%, ${alpha(option.color, 0.1)} 100%)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: `2px solid ${alpha(option.color, 0.3)}`,
                                  }}
                                >
                                  {React.cloneElement(option.icon, {
                                    sx: {
                                      fontSize: isMobile ? 24 : 32,
                                      color: option.color,
                                    }
                                  })}
                                </Box>
                              </motion.div>
                              
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  variant={isMobile ? "subtitle1" : "h6"}
                                  fontWeight="bold"
                                  sx={{
                                    color: option.color,
                                  }}
                                >
                                  {option.title}
                                </Typography>
                                
                                {/* Device Compatibility for Mobile */}
                                {isMobile && (
                                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                    {Object.entries(option.deviceIcons).map(([device, icon]) => (
                                      <Box
                                        key={device}
                                        sx={{
                                          opacity: device === 'mobile' ? 1 : 0.5,
                                          display: 'flex',
                                          alignItems: 'center',
                                        }}
                                      >
                                        {icon}
                                      </Box>
                                    ))}
                                  </Box>
                                )}
                              </Box>
                              </Box>
                            {/* </motion.div> */}

                            <Typography
                              variant={isMobile ? "caption" : "body2"}
                              color="text.secondary"
                              sx={{ 
                                mb: isMobile ? 1 : 2,
                                display: 'block',
                                lineHeight: 1.4
                              }}
                            >
                              {option.description}
                            </Typography>

                            <Box sx={{ 
                              mt: isMobile ? 1 : 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: alpha(option.color, 0.8),
                                  fontWeight: 500,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                }}
                              >
                                {isMobile ? option.bestFor.split(' ')[0] : option.bestFor}
                              </Typography>
                              
                              {/* Selection Indicator */}
                              {selectedView === option.id && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                >
                                  <Box
                                    sx={{
                                      width: isMobile ? 24 : 32,
                                      height: isMobile ? 24 : 32,
                                      borderRadius: '50%',
                                      background: option.gradient,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      boxShadow: `0 4px 12px ${alpha(option.color, 0.3)}`,
                                    }}
                                  >
                                    <CheckCircleIcon fontSize={isMobile ? "small" : "medium"} />
                                  </Box>
                                </motion.div>
                              )}
                            </Box>

                            {/* Arrow Indicator */}
                            {!isMobile && (
                              <motion.div
                                animate={{ x: [0, 5, 0] }}
                                transition={{ 
                                  repeat: Infinity, 
                                  duration: 2,
                                  delay: index * 0.2 
                                }}
                                style={{
                                  position: 'absolute',
                                  bottom: 16,
                                  right: 16,
                                }}
                              >
                                <ArrowRightIcon 
                                  sx={{ 
                                    color: alpha(option.color, 0.7),
                                    fontSize: 20,
                                  }} 
                                />
                              </motion.div>
                            )}

                            {/* Swipe Hint for Mobile */}
                            {isMobile && (
                              <motion.div
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ 
                                  repeat: Infinity, 
                                  duration: 2 
                                }}
                                style={{
                                  position: 'absolute',
                                  bottom: 8,
                                  right: 12,
                                }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  {option.id === 'tabs' ? '← Swipe to select' : 'Swipe →'}
                                </Typography>
                              </motion.div>
                            )}
                          </Box>
                        </Card>
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>

                {/* Action Buttons */}
                {!isMobile && (
                  <Box 
                    sx={{ 
                      mt: 4, 
                      display: 'flex', 
                      gap: 2, 
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={handleCancel}
                        variant="outlined"
                        size="large"
                        startIcon={<CloseIcon />}
                        sx={{
                          borderRadius: 2,
                          px: 4,
                          py: 1.5,
                          borderColor: alpha(adminTheme.palette.primary.main, 0.3),
                          color: adminTheme.palette.primary.main,
                          '&:hover': {
                            borderColor: adminTheme.palette.primary.main,
                            background: alpha(adminTheme.palette.primary.main, 0.05),
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    </motion.div>

                    <motion.div 
                      whileHover={{ scale: 1.05 }} 
                      whileTap={{ scale: 0.95 }}
                      animate={{ 
                        scale: [1, 1.02, 1],
                      }}
                      transition={{ 
                        scale: { duration: 0.2, repeat: Infinity, repeatDelay: 1 }
                      }}
                    >
                      <Button
                        onClick={() => handleViewSelect('tabs')}
                        variant="contained"
                        size="large"
                        startIcon={<SettingsIcon />}
                        sx={{
                          borderRadius: 2,
                          px: 4,
                          py: 1.5,
                          background: `linear-gradient(135deg, ${adminTheme.palette.primary.main}, ${adminTheme.palette.secondary.main})`,
                          color: 'white',
                          fontWeight: 600,
                          boxShadow: `0 8px 24px ${alpha(adminTheme.palette.primary.main, 0.3)}`,
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: `0 12px 32px ${alpha(adminTheme.palette.primary.main, 0.4)}`,
                          },
                          transition: 'all 0.3s ease',
                        }}
                      >
                        Quick Start (Tab View)
                      </Button>
                    </motion.div>
                  </Box>
                )}

                {/* Tips */}
                {!isMobile && (
                  <Box sx={{ 
                    mt: 4, 
                    p: 2, 
                    borderRadius: 2,
                    background: alpha(adminTheme.palette.primary.main, 0.03),
                    border: `1px solid ${alpha(adminTheme.palette.primary.main, 0.1)}`,
                    textAlign: 'center',
                  }}>
                    <Typography variant="caption" color="text.secondary">
                      💡 <strong>Tip:</strong> You can switch views anytime from the settings menu
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Mobile Bottom Action Buttons */}
              {isMobile && (
                <Box sx={{
                  position: 'sticky',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  p: 2,
                  background: alpha(adminTheme.palette.background.paper, 0.95),
                  backdropFilter: 'blur(10px)',
                  borderTop: `1px solid ${alpha(adminTheme.palette.primary.main, 0.1)}`,
                  display: 'flex',
                  gap: 1,
                  zIndex: 10
                }}>
                  <Button
                    onClick={handleCancel}
                    variant="outlined"
                    fullWidth
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      borderColor: alpha(adminTheme.palette.primary.main, 0.3),
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleViewSelect('tabs')}
                    variant="contained"
                    fullWidth
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      background: `linear-gradient(135deg, ${adminTheme.palette.primary.main}, ${adminTheme.palette.secondary.main})`,
                      color: 'white',
                      fontWeight: 600,
                    }}
                  >
                    Quick Start
                  </Button>
                </Box>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="features"
              initial={{ opacity: 0, x: isMobile ? (swipeDirection === 'left' ? 50 : -50) : 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isMobile ? (swipeDirection === 'left' ? -50 : 50) : -50 }}
              transition={{ duration: 0.4 }}
              style={{ height: '100%' }}
            >
              {selectedView && (
                <Box sx={{ 
                  p: isMobile ? 3 : 4,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}>
                  <Box sx={{ textAlign: 'center', mb: 4 }}>
                    <Typography
                      variant={isMobile ? "h6" : "h5"}
                      fontWeight="bold"
                      gutterBottom
                      sx={{
                        color: viewOptions.find(o => o.id === selectedView)?.color,
                      }}
                    >
                      Getting Started with {viewOptions.find(o => o.id === selectedView)?.title}
                    </Typography>
                    <Typography variant={isMobile ? "body2" : "body1"} color="text.secondary">
                      Loading your preferred view...
                    </Typography>
                  </Box>

                  {/* Loading Animation */}
                  <Box sx={{ 
                    flex: 1,
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    my: 4 
                  }}>
                    <motion.div
                      animate={{ 
                        rotate: 360,
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                        scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                      }}
                    >
                      <Box
                        sx={{
                          width: isMobile ? 80 : 100,
                          height: isMobile ? 80 : 100,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${adminTheme.palette.primary.main}, ${adminTheme.palette.secondary.main})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          boxShadow: `0 8px 32px ${alpha(adminTheme.palette.primary.main, 0.3)}`,
                        }}
                      >
                        {selectedView === 'tabs' ? 
                          <TabViewIcon sx={{ fontSize: isMobile ? 40 : 48 }} /> : 
                          <GridViewIcon sx={{ fontSize: isMobile ? 40 : 48 }} />
                        }
                      </Box>
                    </motion.div>

                    {/* Loading Progress for Mobile */}
                    {isMobile && (
                      <Box sx={{ width: '80%', mt: 4 }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1.5 }}
                          style={{
                            height: 4,
                            background: `linear-gradient(90deg, ${adminTheme.palette.primary.main}, ${adminTheme.palette.secondary.main})`,
                            borderRadius: 2
                          }}
                        />
                      </Box>
                    )}
                  </Box>

                  {/* Feature List for Desktop/Tablet */}
                  {!isMobile && (
                    <Box sx={{ mt: 'auto' }}>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                        Features you'll enjoy:
                      </Typography>
                      {viewOptions.find(o => o.id === selectedView)?.features.map((feature, index) => (
                        <motion.div
                          key={feature}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mb: 1,
                              p: 1,
                              borderRadius: 1,
                              background: alpha(viewOptions.find(o => o.id === selectedView)?.color, 0.05),
                            }}
                          >
                            <CheckCircleIcon 
                              fontSize="small" 
                              sx={{ 
                                color: viewOptions.find(o => o.id === selectedView)?.color,
                                opacity: 0.8 
                              }} 
                            />
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                              {feature}
                            </Typography>
                          </Box>
                        </motion.div>
                      ))}
                    </Box>
                  )}

                  {/* Swipe Hint for Mobile */}
                  {isMobile && (
                    <Box sx={{ 
                      mt: 'auto', 
                      textAlign: 'center',
                      p: 2,
                      borderRadius: 2,
                      background: alpha(adminTheme.palette.primary.main, 0.05)
                    }}>
                      <Typography variant="caption" color="text.secondary">
                        ← Swipe back to change selection
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default ViewSelector;