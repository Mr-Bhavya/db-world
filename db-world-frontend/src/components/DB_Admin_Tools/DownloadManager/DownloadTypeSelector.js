import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box } from '@mui/material';
import HttpFile from './Mirror/HttpFile';
import Youtube_dl from './youtubedl/Youtube_dl';

const DownloadTypeSelector = ({ 
  selectedDownloader, 
  isMobile,
  onDownloadAdded,
  showDownloadForm
}) => {
  const renderDownloaderComponent = () => {
    switch (selectedDownloader) {
      case "youtube":
        return <Youtube_dl onDownloadAdded={onDownloadAdded} />;
      case "httpFile":
      default:
        return <HttpFile onDownloadAdded={onDownloadAdded} />;
    }
  };

  return (
    <AnimatePresence>
      {showDownloadForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            overflow: 'hidden',
            marginBottom: '2rem'
          }}
        >
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            exit={{ y: -20 }}
            transition={{ duration: 0.3 }}
            style={{
            //   padding: isMobile ? '1.5rem' : '2rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {renderDownloaderComponent()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(DownloadTypeSelector);