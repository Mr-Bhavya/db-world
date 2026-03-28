// components/ScrollControls.jsx
import React from 'react';
import { motion } from 'framer-motion';

const ScrollControls = ({ isMobile, scrollBy }) => {
  if (isMobile) return null;

  return (
    <>
      <motion.div 
        className="scroll-icon scroll-left" 
        onClick={() => scrollBy(-700)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        &#8249;
      </motion.div>
      <motion.div 
        className="scroll-icon scroll-right" 
        onClick={() => scrollBy(700)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        &#8250;
      </motion.div>
    </>
  );
};

export default React.memo(ScrollControls);