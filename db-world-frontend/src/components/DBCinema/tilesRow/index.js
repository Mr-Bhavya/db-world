import React, { useRef, useMemo } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import ImageCard from './ImageCard';

// Animation variants defined outside component to prevent recreation on each render
const titleVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  }
};

const rowVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const TilesRow = React.memo(({ title, requestUrl, horizontal = false, category }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const containerRef = useRef(null);

  // Memoize styles to prevent unnecessary recalculations
  const containerStyles = useMemo(() => ({
    pt: isMobile ? 2 : 4,
    px: isMobile ? 2 : 4,
    width: '100%',
    overflow: 'hidden'
  }), [isMobile]);

  const titleContainerStyles = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    mb: 2
  }), []);

  const accentBarStyles = useMemo(() => ({
    width: 5,
    height: 30,
    backgroundColor: 'primary.main',
    transformOrigin: 'left'
  }), []);

  const titleTextStyles = useMemo(() => ({
    ml: 3,
    fontWeight: 700,
    color: 'text.primary'
  }), []);

  return (
    <Box 
      ref={containerRef}
      component={motion.div}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: isMobile ? "0px" : "-100px" }}
      variants={rowVariants}
      sx={containerStyles}
    >
      <Box 
        component={motion.div}
        variants={titleVariants}
        sx={titleContainerStyles}
      >
        <Box 
          component={motion.div}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          sx={accentBarStyles}
        />
        <Typography 
          variant={isMobile ? 'h6' : 'h5'} 
          component={motion.h3}
          sx={titleTextStyles}
        >
          {title}
        </Typography>
      </Box>

      <ImageCard 
        title={title} 
        horizontal={horizontal} 
        requestUrl={requestUrl} 
        category={category} 
        containerRef={containerRef}
        key={`${requestUrl}-${category?.id || 'all'}`}
      />
    </Box>
  );
});

export default TilesRow;