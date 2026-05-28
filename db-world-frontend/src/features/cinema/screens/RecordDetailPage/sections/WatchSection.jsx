import React from 'react';
import { Box } from '@mui/material';
import { motion } from 'framer-motion';
import MediaDownloadViewer from '../../media-files';

/**
 * Watch section — delegates to the existing MediaFilesPage component which
 * already handles file fetch, quality grouping, audio/sub mapping and
 * play/download. Passes showBack/showHeroSection=false so we get the file
 * grid only (Hero + back are owned by the parent RecordDetailContent).
 */
export default function WatchSection({ recordId, record }) {
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.4 }}
      sx={{ py: 2 }}
    >
      <MediaDownloadViewer
        recordId={recordId}
        record={record}
        showBack={false}
        showHeroSection={false}
      />
    </Box>
  );
}
