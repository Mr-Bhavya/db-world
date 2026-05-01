import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Box, 
  CircularProgress, 
  Typography, 
  IconButton, 
  Tooltip,
  useTheme,
  useMediaQuery,
  Drawer,
  Fab,
  Zoom,
  Alert,
  Snackbar,
  alpha
} from '@mui/material';
import { 
  Fullscreen, 
  FullscreenExit, 
  OpenInNew,
  Menu as MenuIcon,
  Close as CloseIcon,
  ViewCompact,
  ViewList,
  Refresh,
  Error as ErrorIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
// import { DB_FILE_MANAGER_ROUTE } from '@shared/constants';

// Import CSS module
import styles from './FlmngrManager.module.css';

// Import custom hook
import { useDynamicCSS } from './useDynamicCSS';
import Constants from '@shared/constants';

// Dynamic import to reduce initial bundle size
const FlmngrPanel = React.lazy(() => import('@flmngr/flmngr-react').then(module => ({ default: module.FlmngrPanel })));

const FLMNGR_API_KEY = import.meta.env.VITE_FLMNGR_API_KEY || 'abPhHyhIfD0gNqWnymrtCPeS';

// ==================== STYLED COMPONENTS ====================
const StyledContainer = styled(Box, {
  shouldForwardProp: (prop) => !['fullscreen', 'mobile', 'tablet'].includes(prop)
})(({ theme, fullscreen, mobile, tablet: _tablet }) => ({
  position: 'relative',
  height: fullscreen ? '100vh' : mobile ? 'calc(100vh - 56px)' : '100%',
  width: '100%',
  overflow: 'hidden',
  borderRadius: fullscreen ? 0 : mobile ? 0 : theme.shape.borderRadius,
  border: fullscreen || mobile ? 'none' : `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  display: 'flex',
  flexDirection: 'column',
  isolation: 'isolate', // Creates new stacking context
}));

const Header = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'mobile'
})(({ theme, mobile }) => ({
  padding: mobile ? theme.spacing(1) : theme.spacing(1, 2),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
  backgroundColor: alpha(theme.palette.background.default, 0.95),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
  zIndex: 10,
  minHeight: mobile ? 48 : 56,
}));

const ContentWrapper = styled(Box, {
  shouldForwardProp: (prop) => !['mobile', 'tablet'].includes(prop)
})(({ theme, mobile, tablet }) => ({
  flex: 1,
  minHeight: 0,
  position: 'relative',
  overflow: 'auto',
  padding: mobile ? 0 : tablet ? theme.spacing(1) : theme.spacing(2),
  '& iframe, & > div': {
    width: '100% !important',
    height: '100% !important',
    minHeight: mobile ? 'calc(100vh - 100px)' : '500px',
    border: 'none',
    borderRadius: mobile ? 0 : theme.shape.borderRadius,
  },
  // Performance optimizations
  transform: 'translateZ(0)',
  backfaceVisibility: 'hidden',
  perspective: 1000,
}));

const LoadingOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 20,
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
}));

const ErrorContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(4),
  textAlign: 'center',
  color: theme.palette.error.main,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  background: `linear-gradient(135deg, ${alpha(theme.palette.error.light, 0.1)} 0%, ${alpha(theme.palette.error.main, 0.05)} 100%)`,
}));

const MobileControls = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(2),
  right: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  zIndex: 1000,
}));

const ResponsiveDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== 'mobile'
})(({ theme, mobile }) => ({
  '& .MuiDrawer-paper': {
    width: mobile ? '100%' : '320px',
    maxWidth: '100vw',
    padding: theme.spacing(2),
    backgroundColor: alpha(theme.palette.background.paper, 0.98),
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTopLeftRadius: mobile ? 16 : theme.shape.borderRadius,
    borderTopRightRadius: mobile ? 16 : theme.shape.borderRadius,
    borderLeft: mobile ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.2)}`,
    boxShadow: theme.shadows[8],
  },
}));

const StatusIndicator = styled(Box, {
  shouldForwardProp: (prop) => !['status'].includes(prop)
})(({ theme, status }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  marginRight: theme.spacing(1),
  backgroundColor: status === 'ready' ? theme.palette.success.main :
                status === 'loading' ? theme.palette.warning.main :
                status === 'error' ? theme.palette.error.main :
                theme.palette.grey[500],
  animation: status === 'loading' ? 'pulse 1.5s ease-in-out infinite' : 'none',
}));

// Adaptive tooltip with better mobile handling
const AdaptiveTooltip = ({ children, title, mobile, forceShow = false, ...props }) => {
  if (mobile && !forceShow) {
    return children;
  }
  return (
    <Tooltip 
      title={title} 
      enterTouchDelay={50}
      leaveTouchDelay={3000}
      disableInteractive={mobile}
      PopperProps={{
        modifiers: [
          {
            name: 'preventOverflow',
            options: {
              boundary: 'viewport',
              padding: 8,
            },
          },
        ],
      }}
      {...props}
    >
      {children}
    </Tooltip>
  );
};

// ==================== MAIN COMPONENT ====================
export default function FlmngrManager({ 
  onSelect,
  height: _height = "500px",
  fullscreen = false, 
  onFullscreenToggle,
  sx = {},
  className = '',
  ...props 
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(fullscreen);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uiMode, setUiMode] = useState('auto');
  const [orientation, setOrientation] = useState('landscape');
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [notification, setNotification] = useState(null);
  
  const containerRef = useRef(null);
  const initializationTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // ==================== DYNAMIC CSS INJECTION ====================
  const dynamicCSS = useMemo(() => {
    return `
      /* Dynamic Flmngr styles based on current state */
      :root {
        /* Theme variables */
        --flmngr-dynamic-primary: ${theme.palette.primary.main};
        --flmngr-dynamic-secondary: ${theme.palette.secondary.main};
        --flmngr-dynamic-background: ${theme.palette.background.paper};
        --flmngr-dynamic-text: ${theme.palette.text.primary};
        --flmngr-dynamic-border: ${theme.palette.divider};
        
        /* Responsive variables */
        --flmngr-dynamic-font-size: ${isMobile ? '14px' : isTablet ? '15px' : '16px'};
        --flmngr-dynamic-spacing: ${isMobile ? '4px' : isTablet ? '8px' : '12px'};
        --flmngr-dynamic-border-radius: ${theme.shape.borderRadius}px;
        
        /* State variables */
        --flmngr-dynamic-opacity: ${loading ? '0.7' : '1'};
        --flmngr-dynamic-transition: ${prefersReducedMotion ? 'none' : 'all 0.3s ease'};
      }
      
      /* Responsive iframe overrides */
      .flmngr-dynamic-container iframe[src*="flmngr"] {
        ${isMobile ? `
          min-height: calc(100vh - 100px) !important;
          font-size: var(--flmngr-dynamic-font-size) !important;
        ` : ''}
        
        ${isTablet ? `
          min-height: 500px !important;
        ` : ''}
        
        ${isFullscreen ? `
          border: none !important;
          border-radius: 0 !important;
        ` : ''}
      }
      
      /* Performance optimizations */
      .flmngr-dynamic-container * {
        ${prefersReducedMotion ? `
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        ` : ''}
      }
      
      /* Dark mode adjustments */
      ${prefersDarkMode ? `
        .flmngr-dynamic-container {
          --flmngr-dynamic-primary: ${theme.palette.primary.light};
          --flmngr-dynamic-background: #1a1a1a;
        }
        
        .flmngr-dynamic-container iframe {
          filter: brightness(0.95) contrast(1.05);
        }
      ` : ''}
      
      /* Orientation-specific styles */
      ${orientation === 'portrait' && isMobile ? `
        .flmngr-portrait-mode {
          --flmngr-dynamic-spacing: 2px;
        }
        
        .flmngr-portrait-mode .flmngr-header {
          padding: 4px !important;
        }
      ` : ''}
    `;
  }, [theme, isMobile, isTablet, loading, isFullscreen, prefersReducedMotion, prefersDarkMode, orientation]);

  useDynamicCSS(dynamicCSS, 'flmngr-dynamic-styles');

  // ==================== EFFECTS ====================
  // Detect orientation
  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      setOrientation(isPortrait ? 'portrait' : 'landscape');
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Auto-set UI mode based on screen size
  useEffect(() => {
    if (isMobile) {
      setUiMode('compact');
    } else if (isTablet) {
      setUiMode('auto');
    } else {
      setUiMode('detailed');
    }
  }, [isMobile, isTablet]);

  // Check network connection
  useEffect(() => {
    const updateConnectionStatus = () => {
      setConnectionStatus(navigator.onLine ? 'online' : 'offline');
    };
    
    updateConnectionStatus();
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    
    return () => {
      window.removeEventListener('online', updateConnectionStatus);
      window.removeEventListener('offline', updateConnectionStatus);
    };
  }, []);

  // ==================== EVENT HANDLERS ====================
  const handleFlmngrLoad = useCallback(() => {
    if (initializationTimeoutRef.current) {
      clearTimeout(initializationTimeoutRef.current);
    }

    initializationTimeoutRef.current = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setNotification({
          type: 'info',
          message: 'File manager loaded with reduced functionality',
        });
      }
    }, isMobile ? 4000 : 3000);

    try {
      const handleReady = () => {
        if (initializationTimeoutRef.current) {
          clearTimeout(initializationTimeoutRef.current);
        }
        setLoading(false);
        setConnectionStatus('ready');
        setNotification({
          type: 'success',
          message: 'File manager ready',
        });
        retryCountRef.current = 0;
      };

      const handleError = (e) => {
        console.error('Flmngr initialization error:', e.detail);
        
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          setNotification({
            type: 'warning',
            message: `Retrying... (${retryCountRef.current}/${maxRetries})`,
          });
          
          // Retry after delay
          setTimeout(() => {
            window.dispatchEvent(new Event('flmngr:retry'));
          }, 1000 * retryCountRef.current);
          return;
        }
        
        setError(e.detail?.message || 'Failed to initialize file manager after multiple attempts');
        setLoading(false);
        setConnectionStatus('error');
      };

      window.addEventListener('flmngr:ready', handleReady);
      window.addEventListener('flmngr:error', handleError);
      window.addEventListener('flmngr:retry', handleFlmngrLoad);

      return () => {
        window.removeEventListener('flmngr:ready', handleReady);
        window.removeEventListener('flmngr:error', handleError);
        window.removeEventListener('flmngr:retry', handleFlmngrLoad);
      };
    } catch (err) {
      console.error('Error setting up Flmngr listeners:', err);
      setLoading(false);
      setConnectionStatus('error');
    }
  }, [isMobile, loading]);

  useEffect(() => {
    const cleanup = handleFlmngrLoad();
    
    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
      if (cleanup) cleanup();
    };
  }, [handleFlmngrLoad]);

  const handleFullscreenToggle = useCallback(() => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    
    if (onFullscreenToggle) {
      onFullscreenToggle(newFullscreenState);
    }
    
    if (isMobile && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
    
    // Dispatch custom event for analytics or other listeners
    window.dispatchEvent(new CustomEvent('flmngr:fullscreen', {
      detail: { fullscreen: newFullscreenState }
    }));
  }, [isFullscreen, onFullscreenToggle, isMobile, mobileMenuOpen]);

  const handleOpenNewWindow = useCallback(() => {
    const url = `${Constants.DB_FILE_MANAGER_ROUTE}?key=${FLMNGR_API_KEY}&mode=${uiMode}&orientation=${orientation}`;
    const features = `noopener,noreferrer,width=${Math.min(window.innerWidth, 1200)},height=${Math.min(window.innerHeight, 800)}`;
    window.open(url, '_blank', features);
  }, [uiMode, orientation]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  const handleUiModeToggle = useCallback(() => {
    setUiMode(prev => {
      if (isMobile) {
        return prev === 'compact' ? 'auto' : 'compact';
      }
      return prev === 'compact' ? 'detailed' : 'compact';
    });
  }, [isMobile]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    retryCountRef.current = 0;
    handleFlmngrLoad();
  }, [handleFlmngrLoad]);

  const getFlmngrOptions = useMemo(() => {
    const baseOptions = {
      theme: 'light',
      defaultAdapter: 'local',
      adapters: {
        local: {
          mounts: [{
            name: 'Local Files',
            path: '/uploads'
          }]
        }
      },
      onSelect: (files) => {
        if (onSelect && files && files.length > 0) {
          onSelect(files);
          setNotification({
            type: 'success',
            message: `${files.length} file(s) selected`,
          });
        }
      }
    };

    // Responsive UI adjustments
    if (isMobile) {
      return {
        ...baseOptions,
        ui: {
          showBreadcrumb: orientation === 'landscape',
          showTree: orientation === 'landscape',
          showToolbar: true,
          showSearch: orientation === 'landscape',
          toolbarCompact: true,
          viewMode: uiMode === 'compact' ? 'grid' : 'list',
          mobileOptimized: true,
        }
      };
    } else if (isTablet) {
      return {
        ...baseOptions,
        ui: {
          showBreadcrumb: true,
          showTree: uiMode !== 'compact',
          showToolbar: true,
          showSearch: true,
          viewMode: uiMode === 'compact' ? 'grid' : 'list',
        }
      };
    } else {
      return {
        ...baseOptions,
        ui: {
          showBreadcrumb: true,
          showTree: true,
          showToolbar: true,
          showSearch: true,
          viewMode: uiMode === 'compact' ? 'grid' : 'list',
        }
      };
    }
  }, [isMobile, isTablet, orientation, uiMode, onSelect]);

  // ==================== RENDER FUNCTIONS ====================
  const renderHeader = () => (
    <Header 
      mobile={isMobile} 
      className={`${styles.mobileHeader} ${isMobile ? styles.glassEffect : ''}`}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isMobile && (
          <AdaptiveTooltip title="Menu" mobile={isMobile}>
            <IconButton 
              size="small" 
              onClick={toggleMobileMenu}
              edge="start"
              className={styles.a11yFocus}
              aria-label="Open menu"
            >
              <MenuIcon fontSize="small" />
            </IconButton>
          </AdaptiveTooltip>
        )}
        <StatusIndicator status={connectionStatus} />
        <Typography 
          variant={isMobile ? "subtitle2" : "subtitle1"} 
          fontWeight="medium"
          noWrap
          sx={{ 
            maxWidth: isMobile ? '120px' : '200px',
            flex: 1
          }}
        >
          File Manager
        </Typography>
        <Typography 
          variant="caption" 
          color="text.secondary"
          sx={{ ml: 1, display: { xs: 'none', sm: 'block' } }}
        >
          {uiMode === 'compact' ? 'Compact' : uiMode === 'auto' ? 'Auto' : 'Detailed'}
        </Typography>
      </Box>
      
      {!isMobile ? (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <AdaptiveTooltip title={`Toggle ${uiMode === 'compact' ? 'Detailed' : 'Compact'} View`} mobile={isMobile}>
            <IconButton 
              size="small" 
              onClick={handleUiModeToggle}
              className={styles.a11yFocus}
              aria-label={`Switch to ${uiMode === 'compact' ? 'detailed' : 'compact'} view`}
            >
              {uiMode === 'compact' ? <ViewList fontSize="small" /> : <ViewCompact fontSize="small" />}
            </IconButton>
          </AdaptiveTooltip>
          <AdaptiveTooltip title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen (F11)"} mobile={isMobile}>
            <IconButton 
              size="small" 
              onClick={handleFullscreenToggle}
              className={styles.a11yFocus}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
            </IconButton>
          </AdaptiveTooltip>
          <AdaptiveTooltip title="Open in New Window" mobile={isMobile}>
            <IconButton 
              size="small" 
              onClick={handleOpenNewWindow}
              className={styles.a11yFocus}
              aria-label="Open in new window"
            >
              <OpenInNew fontSize="small" />
            </IconButton>
          </AdaptiveTooltip>
        </Box>
      ) : (
        <IconButton 
          size="small" 
          onClick={toggleMobileMenu}
          className={styles.a11yFocus}
          aria-label="Open menu"
        >
          <MenuIcon fontSize="small" />
        </IconButton>
      )}
    </Header>
  );

  const renderErrorState = () => (
    <ErrorContainer className={`${styles.errorState} ${styles.fadeInAnimation}`}>
      <ErrorIcon 
        className={styles.errorIcon}
        sx={{ fontSize: 48, mb: 2, opacity: 0.8 }}
      />
      <Typography variant={isMobile ? "h6" : "h5"} color="error" gutterBottom align="center">
        File Manager Error
      </Typography>
      <Typography variant={isMobile ? "body2" : "body1"} align="center" sx={{ mb: 2 }}>
        {error}
      </Typography>
      <Typography variant="caption" sx={{ mt: 2, mb: 3, display: 'block' }} align="center">
        Please check your internet connection and try again
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <IconButton 
          onClick={handleRetry} 
          color="primary"
          variant="contained"
          size={isMobile ? "medium" : "large"}
          className={styles.a11yFocus}
        >
          <Refresh sx={{ mr: 1 }} />
          <Typography variant="button">Retry</Typography>
        </IconButton>
        {!isMobile && (
          <IconButton 
            onClick={handleOpenNewWindow} 
            color="secondary"
            variant="outlined"
            size="large"
            className={styles.a11yFocus}
          >
            <OpenInNew sx={{ mr: 1 }} />
            <Typography variant="button">New Window</Typography>
          </IconButton>
        )}
      </Box>
    </ErrorContainer>
  );

  const renderLoadingState = () => (
    <LoadingOverlay className={styles.fadeInAnimation}>
      <Box className={styles.pulseAnimation}>
        <CircularProgress 
          size={isMobile ? 40 : 48} 
          thickness={4}
          sx={{ mb: 2 }}
        />
      </Box>
      <Typography 
        variant={isMobile ? "body2" : "body1"} 
        color="text.secondary"
        align="center"
        sx={{ mb: 1 }}
      >
        {isMobile ? 'Loading File Manager...' : 'Initializing File Manager...'}
      </Typography>
      <Typography variant="caption" color="text.secondary" align="center">
        {connectionStatus === 'offline' ? 'No internet connection' : 'This may take a moment'}
      </Typography>
      {connectionStatus === 'offline' && (
        <Alert severity="warning" sx={{ mt: 2, width: '80%', maxWidth: 400 }}>
          You are currently offline. Some features may be unavailable.
        </Alert>
      )}
    </LoadingOverlay>
  );

  // ==================== MAIN RENDER ====================
  if (error) {
    return (
      <StyledContainer 
        fullscreen={isFullscreen} 
        mobile={isMobile}
        tablet={isTablet}
        ref={containerRef}
        sx={sx}
        className={`${styles.customContainer} ${styles.errorState} ${className}`}
        {...props}
      >
        {renderErrorState()}
      </StyledContainer>
    );
  }

  return (
    <>
      <StyledContainer 
        fullscreen={isFullscreen} 
        mobile={isMobile}
        tablet={isTablet}
        ref={containerRef}
        sx={{
          // MUI sx prop customizations
          '& .flmngr-header': {
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
          },
          // Custom scrollbar using theme colors
          '& ::-webkit-scrollbar-track': {
            background: alpha(theme.palette.primary.main, 0.05),
          },
          '& ::-webkit-scrollbar-thumb': {
            background: alpha(theme.palette.primary.main, 0.3),
            '&:hover': {
              background: alpha(theme.palette.primary.main, 0.5),
            }
          },
          // Combine with passed sx
          ...sx
        }}
        className={`
          flmngr-dynamic-container
          ${styles.customContainer}
          ${styles.customScrollbar}
          ${isMobile ? styles.mobileOptimized : ''}
          ${isTablet ? styles.tabletOptimized : ''}
          ${isFullscreen ? styles.fullscreenContainer : ''}
          ${orientation === 'portrait' ? 'flmngr-portrait-mode' : ''}
          ${prefersReducedMotion ? styles.reducedMotion : ''}
          ${prefersDarkMode ? styles.darkModeAware : ''}
          ${className}
        `.trim()}
        {...props}
      >
        {loading && renderLoadingState()}
        
        {renderHeader()}

        <ContentWrapper 
          mobile={isMobile} 
          tablet={isTablet}
          className={`
            ${isMobile ? styles.mobileOptimized : ''}
            ${orientation === 'portrait' ? styles.willChangeTransform : ''}
          `.trim()}
        >
          <React.Suspense fallback={renderLoadingState()}>
            <FlmngrPanel 
              apiKey={FLMNGR_API_KEY}
              options={getFlmngrOptions}
              className={styles.a11yFocus}
            />
          </React.Suspense>
        </ContentWrapper>
      </StyledContainer>

      {/* Mobile Floating Action Buttons */}
      {isMobile && !loading && !error && (
        <MobileControls className={styles.printHidden}>
          <Zoom in={!mobileMenuOpen} style={{ transitionDelay: !mobileMenuOpen ? '100ms' : '0ms' }}>
            <Fab
              color="primary"
              size="medium"
              onClick={handleFullscreenToggle}
              sx={{ mb: 1 }}
              className={styles.a11yFocus}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </Fab>
          </Zoom>
          <Zoom in={!mobileMenuOpen} style={{ transitionDelay: !mobileMenuOpen ? '200ms' : '0ms' }}>
            <Fab
              color="secondary"
              size="medium"
              onClick={handleUiModeToggle}
              className={styles.a11yFocus}
              aria-label={`Switch to ${uiMode === 'compact' ? 'detailed' : 'compact'} view`}
            >
              {uiMode === 'compact' ? <ViewList /> : <ViewCompact />}
            </Fab>
          </Zoom>
        </MobileControls>
      )}

      {/* Mobile Settings Drawer */}
      <ResponsiveDrawer
        anchor={isMobile ? "bottom" : "right"}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        mobile={isMobile}
        variant="temporary"
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 2 
        }}>
          <Typography variant="h6" component="h2">
            File Manager Settings
          </Typography>
          <IconButton 
            onClick={() => setMobileMenuOpen(false)}
            className={styles.a11yFocus}
            aria-label="Close menu"
          >
            <CloseIcon />
          </IconButton>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight="medium">
              Display Mode
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <IconButton 
                onClick={() => setUiMode('compact')}
                color={uiMode === 'compact' ? 'primary' : 'default'}
                variant={uiMode === 'compact' ? 'contained' : 'outlined'}
                size="small"
                className={styles.a11yFocus}
              >
                <ViewCompact sx={{ mr: 1 }} />
                Compact
              </IconButton>
              <IconButton 
                onClick={() => setUiMode('auto')}
                color={uiMode === 'auto' ? 'primary' : 'default'}
                variant={uiMode === 'auto' ? 'contained' : 'outlined'}
                size="small"
                className={styles.a11yFocus}
              >
                <ViewList sx={{ mr: 1 }} />
                {isMobile ? 'Auto' : 'Detailed'}
              </IconButton>
            </Box>
          </Box>
          
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight="medium">
              Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <IconButton 
                onClick={handleFullscreenToggle}
                size="medium"
                startIcon={isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                className={styles.a11yFocus}
              >
                <Typography variant="body2" sx={{ flex: 1, textAlign: 'left' }}>
                  {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                </Typography>
              </IconButton>
              <IconButton 
                onClick={handleOpenNewWindow}
                size="medium"
                startIcon={<OpenInNew />}
                className={styles.a11yFocus}
              >
                <Typography variant="body2" sx={{ flex: 1, textAlign: 'left' }}>
                  Open in New Window
                </Typography>
              </IconButton>
              {error && (
                <IconButton 
                  onClick={handleRetry}
                  size="medium"
                  startIcon={<Refresh />}
                  color="primary"
                  className={styles.a11yFocus}
                >
                  <Typography variant="body2" sx={{ flex: 1, textAlign: 'left' }}>
                    Retry Connection
                  </Typography>
                </IconButton>
              )}
            </Box>
          </Box>
          
          <Box sx={{ pt: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.2)}` }}>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              <strong>Status:</strong> {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
              <br />
              <strong>Orientation:</strong> {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
              <br />
              <strong>Screen:</strong> {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}
              <br />
              <strong>Mode:</strong> {uiMode.charAt(0).toUpperCase() + uiMode.slice(1)}
            </Typography>
          </Box>
        </Box>
      </ResponsiveDrawer>

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification(null)} 
          severity={notification?.type || 'info'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </>
  );
}