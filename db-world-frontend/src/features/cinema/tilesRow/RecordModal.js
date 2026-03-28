// components/RecordModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RecordPreviewModal from './RecordPreviewModal';
import './ImageCard.css'; // Assuming styles are in this file

const modalVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2
    }
  }
};

const RecordModal = ({ 
  isMobile, 
  activeRecord, 
  modalPosition, 
  title, 
  onClose, 
  onUpdateRecord 
}) => {
  return (
    <AnimatePresence>
      {activeRecord && (
        <motion.div
          key={activeRecord.recordId}
          className={`${isMobile ? 'mobile' : 'desktop'}-modal-overlay`}
          style={!isMobile ? {
            position: "fixed",
            top: modalPosition?.top || 0,
            left: modalPosition?.left || 0,
            width: modalPosition?.width || "auto",
            height: modalPosition?.height || "auto",
            zIndex: 1000,
          } : {}}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={e => e.target === e.currentTarget && onClose()}
        >
          <div className={`${isMobile ? 'mobile' : 'desktop'}-modal`}>
            <RecordPreviewModal
              title={title}
              record={activeRecord}
              onClose={onClose}
              onUpdateRecord={onUpdateRecord}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(RecordModal);