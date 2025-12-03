import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download as DownloadIcon } from '@mui/icons-material';
import StatusCard from './StatusCard';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const DownloadsList = ({ mirrorStatuses = [], loading, isMobile, onStatusChange }) => {
  if (!mirrorStatuses || mirrorStatuses.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          padding: isMobile ? '2rem 1rem' : '3rem 2rem',
          textAlign: 'center',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)',
          border: '2px dashed #ffc107',
          margin: '2rem 0'
        }}
      >
        <DownloadIcon
          style={{
            fontSize: isMobile ? '2rem' : '3rem',
            color: '#ffc107',
            marginBottom: '1rem'
          }}
        />
        <div style={{ 
          color: '#856404', 
          fontWeight: 600, 
          fontSize: isMobile ? '1rem' : '1.2rem', 
          marginBottom: '0.5rem' 
        }}>
          No active downloads
        </div>
        <small style={{ color: '#b08e32' }}>
          Add a new download using the form above to get started
        </small>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: isMobile ? '1rem' : '1.5rem',
        alignItems: 'start'
      }}
    >
      <AnimatePresence>
        {mirrorStatuses.map((mirrorStatus) => (
          <StatusCard 
            key={mirrorStatus.id || mirrorStatus.gid} 
            mirrorStatus={mirrorStatus} 
            onStatusChange={onStatusChange}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

export default React.memo(DownloadsList);