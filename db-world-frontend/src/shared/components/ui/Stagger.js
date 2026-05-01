// src/shared/components/ui/Stagger.js
import React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 14,
    },
  },
};

export function StaggerContainer({ children, style, className }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, style, className }) {
  return (
    <motion.div variants={itemVariants} style={style} className={className}>
      {children}
    </motion.div>
  );
}
