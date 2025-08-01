import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  Paper,
  CircularProgress,
  Tooltip,
  Breadcrumbs,
  Link,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  MoreVert as MoreVertIcon,
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  ChevronRight
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { getStreamMediaList } from '../../ApiServices';
import FileInfoModal from './FileInfoModal';
import FileActionModal from './FileActionModal';
import useFileOperations from './useFileOperations';
import { FileContextMenu, FileActionMenu, FileSelectMenu, FileSortMenu } from './FileMenus';

const FileExplorer = () => {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState(null);
  const [fileMenuAnchor, setFileMenuAnchor] = useState(null);

  const {
    showRenameModal,
    showDeleteModal,
    showInfoModal,
    showMoveModal,
    showCopyModal,
    selectedFile,
    setSelectedFile,
    handleOpenModal,
    handleCloseModal,
    handleFileAction
  } = useFileOperations();

  const fetchFiles = useCallback(async (path) => {
    setLoading(true);
    try {
      const response = await getStreamMediaList(encodeURIComponent(path));
      if (response.httpStatusCode === 200) {
        setFiles(response.data);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentPath);
    setSelectedFiles([]);
    setSearchTerm('');
  }, [currentPath, fetchFiles]);

  const handleDoubleClick = useCallback((file) => {
    if (file.isDirectory) {
      setCurrentPath(file.filePath);
    }
  }, []);

  const handleToggleSelect = useCallback((file, e) => {
    e.stopPropagation();
    setSelectedFiles((prev) => (
      prev.find((f) => f.filePath === file.filePath)
        ? prev.filter((f) => f.filePath !== file.filePath)
        : [...prev, file]
    ));
  }, []);

  const handleContextMenu = useCallback((event, file) => {
    event.preventDefault();
    setSelectedFile(file);
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4
    });
  }, [setSelectedFile]);

  const handleFileMenuClick = useCallback((event, file) => {
    event.stopPropagation();
    setSelectedFile(file);
    setFileMenuAnchor(event.currentTarget);
  }, [setSelectedFile]);

  const handleSortMenuClick = useCallback((event) => {
    event.stopPropagation();
    setSortMenuAnchor(event.currentTarget);
  }, []);

  const handleBack = useCallback(() => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length ? `/${parts.join('/')}` : '/');
  }, [currentPath]);

  const getFilteredAndSortedFiles = useCallback(() => {
    const filtered = files.filter((file) =>
      file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortFunctions = {
      name: (a, b) => a.fileName.localeCompare(b.fileName),
      date: (a, b) => new Date(b.lastModifiedTime) - new Date(a.lastModifiedTime),
      'folders-first': (a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.fileName.localeCompare(b.fileName);
      },
      'files-first': (a, b) => {
        if (!a.isDirectory && b.isDirectory) return -1;
        if (a.isDirectory && !b.isDirectory) return 1;
        return a.fileName.localeCompare(b.fileName);
      }
    };

    return filtered.sort(sortFunctions[sortBy]);
  }, [files, searchTerm, sortBy]);

  const filteredFiles = getFilteredAndSortedFiles();

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {/* Controls Section */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        mb: 2,
        gap: 2,
        flexWrap: 'wrap'
      }}>
        <TextField
          fullWidth
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 400, flexGrow: 1 }}
        />

        <Button
          variant="outlined"
          onClick={handleSortMenuClick}
          sx={{ minWidth: 120 }}
        >
          Sort: {sortBy.replace('-', ' ')}
        </Button>

        <FileSortMenu
          setSortBy={setSortBy}
          setSortMenuAnchor={setSortMenuAnchor}
          sortMenuAnchor={sortMenuAnchor}
        />
      </Box>

      {/* Path Navigation */}
      <Paper sx={{
        p: 1,
        mb: 2,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider'
      }}>

        <Breadcrumbs
          separator={<ChevronRight fontSize="small" />}
          aria-label="breadcrumb"
          sx={{
            flexWrap: 'wrap',
            '& .MuiBreadcrumbs-ol': {
              flexWrap: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }
          }}
        >
          {currentPath !== '/' && (
            <Tooltip title="Go back">
              <IconButton onClick={handleBack}>
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
          )}

          <Link
            underline="hover"
            color="inherit"
            onClick={() => setCurrentPath('/')}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              minWidth: 0
            }}
          >
            <FolderIcon sx={{ mr: 0.5, fontSize: 'inherit' }} />
            <Typography noWrap>Root</Typography>
          </Link>
          {currentPath.split('/').filter(Boolean).map((part, index) => {
            const pathUpToHere = `/${currentPath.split('/').filter(Boolean).slice(0, index + 1).join('/')}`;
            return (
              <Link
                key={index}
                underline="hover"
                color="inherit"
                onClick={() => setCurrentPath(pathUpToHere)}
                sx={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 0
                }}
              >
                <FolderIcon sx={{ mr: 0.5, fontSize: 'inherit' }} />
                <Typography noWrap>{part}</Typography>
              </Link>
            );
          })}
        </Breadcrumbs>
      </Paper>

      {/* Menu Components */}
      <FileSelectMenu
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        handleOpenModal={handleOpenModal}
      />

      <FileContextMenu
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        handleOpenModal={handleOpenModal}
      />

      <FileActionMenu
        fileMenuAnchor={fileMenuAnchor}
        setFileMenuAnchor={setFileMenuAnchor}
        handleOpenModal={handleOpenModal}
      />

      {/* Files Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(150px, 1fr))`,
          gap: 2
        }}>
          {filteredFiles.map((file) => {
            const isSelected = selectedFiles.find((f) => f?.filePath === file?.filePath);
            return (
              <motion.div
                key={file.filePath}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                style={{ width: '100%' }}
              >
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    border: isSelected ? '2px solid' : '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    cursor: 'pointer'
                  }}
                  onDoubleClick={() => handleDoubleClick(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                >
                  <CardContent sx={{
                    flexGrow: 1,
                    p: 1,
                    '&:last-child': { pb: 1 }
                  }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          overflow: 'hidden',
                          width: 'calc(100% - 40px)'
                        }}
                        onClick={(e) => handleToggleSelect(file, e)}
                      >
                        {file.isDirectory ? (
                          <FolderIcon color="primary" fontSize="medium" />
                        ) : (
                          <FileIcon fontSize="medium" />
                        )}
                        <Tooltip title={file.fileName} placement="top">
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              flexGrow: 1,
                              textOverflow: 'ellipsis',
                              overflow: 'hidden'
                            }}
                          >
                            {file.fileName}
                          </Typography>
                        </Tooltip>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => handleFileMenuClick(e, file)}
                        sx={{ p: 0.5 }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </Box>
      )}

      {/* Modals */}
      <FileActionModal
        open={showRenameModal}
        onClose={() => handleCloseModal('rename')}
        title="Rename File"
        action="rename"
        onSubmit={handleFileAction}
        selectedFile={selectedFile}
        currentPath={currentPath}
        fetchFiles={fetchFiles}
      />

      <FileActionModal
        open={showMoveModal}
        onClose={() => handleCloseModal('move')}
        title="Move File"
        action="move"
        onSubmit={handleFileAction}
        selectedFile={selectedFile}
        currentPath={currentPath}
        fetchFiles={fetchFiles}
      />

      <FileActionModal
        open={showCopyModal}
        onClose={() => handleCloseModal('copy')}
        title="Copy File"
        action="copy"
        onSubmit={handleFileAction}
        selectedFile={selectedFile}
        currentPath={currentPath}
        fetchFiles={fetchFiles}
      />

      <FileActionModal
        open={showDeleteModal}
        onClose={() => handleCloseModal('delete')}
        title="Delete File"
        action="delete"
        onSubmit={handleFileAction}
        selectedFile={selectedFile}
        currentPath={currentPath}
        fetchFiles={fetchFiles}
      />

      <FileInfoModal
        open={showInfoModal}
        onClose={() => handleCloseModal('info')}
        file={selectedFile}
      />
    </Container>
  );
};

export default FileExplorer;