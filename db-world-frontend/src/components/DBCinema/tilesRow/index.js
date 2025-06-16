import React, { useRef, useState } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import ImageCard from './ImageCard';

const TilesRow = ({ title, requestUrl, horizontal, category }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const containerRef = useRef(null);
  
  // Animation variants
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

  return (
    <Box 
      ref={containerRef}
      component={motion.div}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: isMobile ? "0px" : "-100px" }}
      variants={rowVariants}
      sx={{
        // mb: 6,
        pt: isMobile ? 2 : 4,
        px: isMobile ? 2 : 4,
        width: '100%',
        overflow: 'hidden'
      }}
    >
      <Box 
        component={motion.div}
        variants={titleVariants}
        sx={{ 
          display: 'flex', 
          alignItems: 'center',
          mb: 2
        }}
      >
        <Box 
          component={motion.div}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          sx={{
            width: 5,
            height: 30,
            backgroundColor: 'primary.main',
            transformOrigin: 'left'
          }}
        />
        <Typography 
          variant={isMobile ? 'h6' : 'h5'} 
          component={motion.h3}
          sx={{ 
            ml: 3,
            fontWeight: 700,
            color: 'text.primary'
          }}
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
      />
    </Box>
  );
};

export default TilesRow;