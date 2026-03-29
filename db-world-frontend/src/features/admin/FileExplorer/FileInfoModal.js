import React, { useMemo } from 'react';
import {
  Modal,
  Box,
  Typography,
  Button,
  Divider,
  Paper,
  IconButton,
  Stack,
  Chip,
  alpha,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import CommonServices from '@shared/services/CommonServices';
import {
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  Folder as FolderIcon,
  AccessTime as TimeIcon,
  Edit as EditIcon,
  Storage as StorageIcon,
  TextSnippet as PathIcon,
  Description as TypeIcon
} from '@mui/icons-material';

// Move the function outside the component or declare it before useMemo
const getFileType = (fileName) => {
  const extension = fileName?.split('.').pop().toLowerCase() || '';
  const typeMap = {
    'pdf': 'PDF Document',
    'doc': 'Word Document',
    'docx': 'Word Document',
    'xls': 'Excel Spreadsheet',
    'xlsx': 'Excel Spreadsheet',
    'ppt': 'PowerPoint',
    'pptx': 'PowerPoint',
    'jpg': 'JPEG Image',
    'jpeg': 'JPEG Image',
    'png': 'PNG Image',
    'gif': 'GIF Image',
    'txt': 'Text File',
    'zip': 'ZIP Archive',
    'rar': 'RAR Archive',
    'mp4': 'MP4 Video',
    'mp3': 'MP3 Audio',
    'avi': 'AVI Video',
    'mov': 'QuickTime Video',
    'wmv': 'Windows Media Video',
    'flv': 'Flash Video',
    'webm': 'WebM Video',
    'm4v': 'MPEG-4 Video',
    'mkv': 'Matroska Video',
    'wav': 'WAV Audio',
    'aac': 'AAC Audio',
    'wma': 'Windows Media Audio',
    'flac': 'FLAC Audio',
    'ogg': 'OGG Audio',
    'html': 'HTML File',
    'htm': 'HTML File',
    'css': 'CSS File',
    'js': 'JavaScript File',
    'json': 'JSON File',
    'xml': 'XML File',
    'csv': 'CSV File',
    'svg': 'SVG Image',
    'ico': 'Icon File',
    'exe': 'Executable',
    'msi': 'Windows Installer',
    'dmg': 'Disk Image',
    'iso': 'Disc Image',
    'torrent': 'Torrent File'
  };
  return typeMap[extension] || 'File';
};

const FileInfoModal = ({ open, onClose, file }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fileInfo = useMemo(() => {
    if (!file) return null;
    
    const fileSize = CommonServices.bytesToReadbleFormat(file?.fileSize);
    const isDirectory = file.isDirectory;
    
    return {
      ...file,
      fileSize,
      isDirectory,
      icon: isDirectory ? FolderIcon : FileIcon,
      type: isDirectory ? 'Folder' : getFileType(file.fileName),
      color: isDirectory ? theme.palette.warning.main : theme.palette.info.main,
      // Ensure fileSize is an object with value and suffix properties
      ...(fileSize && typeof fileSize === 'object' && fileSize.value && fileSize.suffix ? {} : {
        fileSize: { value: fileSize || '0', suffix: 'B' }
      })
    };
  }, [file, theme.palette.warning.main, theme.palette.info.main]);

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8,
      y: -20
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300,
        duration: 0.5
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9,
      y: 20,
      transition: {
        duration: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
        ease: "easeOut"
      }
    })
  };

  if (!fileInfo) return null;

  // Safely access fileSize properties
  const fileSizeValue = fileInfo.fileSize?.value || '0';
  const fileSizeSuffix = fileInfo.fileSize?.suffix || 'B';

  return (
    <AnimatePresence mode="wait">
      {open && (
        <Modal
          open={open}
          onClose={onClose}
          closeAfterTransition
          sx={{
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
          }}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ width: '100%', maxWidth: isMobile ? '100%' : 480 }}
          >
            <Paper
              sx={{
                position: 'relative',
                bgcolor: 'background.paper',
                borderRadius: 3,
                boxShadow: `0 20px 60px ${alpha(theme.palette.common.black, 0.3)}`,
                overflow: 'hidden',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                mx: isMobile ? 1 : 0
              }}
            >
              {/* Header with gradient background */}
              <Box
                sx={{
                  background: `linear-gradient(135deg, ${fileInfo.color} 0%, ${alpha(fileInfo.color, 0.7)} 100%)`,
                  p: 3,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Animated background pattern */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `radial-gradient(${alpha(theme.palette.common.white, 0.1)} 1px, transparent 1px)`,
                    backgroundSize: '20px 20px',
                    opacity: 0.3
                  }}
                />
                
                <Stack direction="row" alignItems="center" spacing={2} position="relative">
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.common.white, 0.2),
                      backdropFilter: 'blur(10px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.1)}`
                    }}
                  >
                    <fileInfo.icon sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        color: 'white',
                        fontWeight: 700,
                        mb: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {fileInfo.fileName}
                    </Typography>
                    <Chip
                      label={fileInfo.type}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.common.white, 0.2),
                        color: 'white',
                        fontWeight: 500,
                        backdropFilter: 'blur(5px)'
                      }}
                    />
                  </Box>
                  
                  <IconButton
                    onClick={onClose}
                    sx={{
                      color: 'white',
                      bgcolor: alpha(theme.palette.common.black, 0.2),
                      backdropFilter: 'blur(5px)',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.common.black, 0.3),
                        transform: 'rotate(90deg)'
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Stack>
              </Box>

              {/* Content with scroll */}
              <Box
                sx={{
                  p: 3,
                  flex: 1,
                  overflowY: 'auto',
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    bgcolor: alpha(theme.palette.divider, 0.1),
                    borderRadius: 4,
                  },
                  '&::-webkit-scrollbar-thumb': {
                    bgcolor: alpha(theme.palette.primary.main, 0.3),
                    borderRadius: 4,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.5),
                    }
                  }
                }}
              >
                <Stack spacing={2}>
                  {/* File Path */}
                  <motion.div
                    custom={0}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.default, 0.5),
                        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.background.default, 0.8),
                          transform: 'translateX(4px)',
                          boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.05)}`
                        }
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <PathIcon sx={{ color: theme.palette.primary.main }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            File Path
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              wordBreak: 'break-all'
                            }}
                          >
                            {fileInfo.filePath}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </motion.div>

                  {/* File Details Grid */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                      gap: 2
                    }}
                  >
                    {/* File Type */}
                    <motion.div custom={1} variants={itemVariants} initial="hidden" animate="visible">
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.default, 0.8),
                            transform: 'translateY(-2px)'
                          }
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette.info.main, 0.1),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <TypeIcon sx={{ color: theme.palette.info.main }} />
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              Type
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              {fileInfo.isDirectory ? 'Folder' : fileInfo.type}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    </motion.div>

                    {/* File Size */}
                    {!fileInfo.isDirectory && (
                      <motion.div custom={2} variants={itemVariants} initial="hidden" animate="visible">
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.background.default, 0.5),
                            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              bgcolor: alpha(theme.palette.background.default, 0.8),
                              transform: 'translateY(-2px)'
                            }
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 2,
                                bgcolor: alpha(theme.palette.success.main, 0.1),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <StorageIcon sx={{ color: theme.palette.success.main }} />
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                Size
                              </Typography>
                              <Typography variant="body2" fontWeight={500}>
                                {fileSizeValue} <Typography component="span" variant="caption" color="text.secondary">{fileSizeSuffix}</Typography>
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      </motion.div>
                    )}

                    {/* Created Time */}
                    <motion.div custom={3} variants={itemVariants} initial="hidden" animate="visible">
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.default, 0.8),
                            transform: 'translateY(-2px)'
                          }
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette.warning.main, 0.1),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <TimeIcon sx={{ color: theme.palette.warning.main }} />
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              Created
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              {fileInfo.creationTime || 'Unknown'}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    </motion.div>

                    {/* Modified Time */}
                    <motion.div custom={4} variants={itemVariants} initial="hidden" animate="visible">
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.background.default, 0.5),
                          border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.default, 0.8),
                            transform: 'translateY(-2px)'
                          }
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette.secondary.main, 0.1),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <EditIcon sx={{ color: theme.palette.secondary.main }} />
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              Modified
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              {fileInfo.lastModifiedTime || 'Unknown'}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    </motion.div>
                  </Box>
                </Stack>
              </Box>

              {/* Footer */}
              <Box
                sx={{
                  p: 3,
                  pt: 2,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  bgcolor: alpha(theme.palette.background.default, 0.5),
                  backdropFilter: 'blur(10px)'
                }}
              >
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    onClick={onClose}
                    sx={{
                      borderRadius: 2,
                      px: 3,
                      borderColor: alpha(theme.palette.divider, 0.3),
                      '&:hover': {
                        borderColor: alpha(theme.palette.primary.main, 0.5),
                        transform: 'translateY(-1px)',
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    variant="contained"
                    sx={{
                      borderRadius: 2,
                      px: 3,
                      background: `linear-gradient(135deg, ${fileInfo.color} 0%, ${alpha(fileInfo.color, 0.8)} 100%)`,
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: `0 8px 20px ${alpha(fileInfo.color, 0.3)}`
                      },
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Open File
                  </Button>
                </Stack>
              </Box>
            </Paper>
          </motion.div>
        </Modal>
      )}
    </AnimatePresence>
  );
};

export default React.memo(FileInfoModal);