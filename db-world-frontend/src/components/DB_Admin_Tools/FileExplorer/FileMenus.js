import React from 'react';
import {
  Menu,
  MenuItem,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  DriveFileMove,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  // DriveFileMoveRounded as DriveFileMove,
  // DriveFileMoved as DriveFileMove,
  // DriveFileRenameOutline as DriveFileMove,
  Info as InfoIcon,
} from '@mui/icons-material';

export const FileContextMenu = ({
  contextMenu,
  setContextMenu,
  handleOpenModal
}) => {
  return (
    <Menu
      open={contextMenu !== null}
      onClose={() => setContextMenu(null)}
      anchorReference="anchorPosition"
      anchorPosition={
        contextMenu !== null
          ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
          : undefined
      }
    >
      <MenuItem onClick={() => { handleOpenModal('rename'); setContextMenu(null); }}>
        <DriveFileMove sx={{ mr: 1, fontSize: 20 }} /> Rename
      </MenuItem>
      <MenuItem onClick={() => { handleOpenModal('move'); setContextMenu(null); }}>
        <DriveFileMove sx={{ mr: 1, fontSize: 20 }} /> Move
      </MenuItem>
      <MenuItem onClick={() => { handleOpenModal('copy'); setContextMenu(null); }}>
        <CopyIcon sx={{ mr: 1, fontSize: 20 }} /> Copy
      </MenuItem>
      <MenuItem onClick={() => { handleOpenModal('delete'); setContextMenu(null); }}>
        <DeleteIcon sx={{ mr: 1, fontSize: 20 }} /> Delete
      </MenuItem>
      <MenuItem onClick={() => { handleOpenModal('info'); setContextMenu(null); }}>
        <InfoIcon sx={{ mr: 1, fontSize: 20 }} /> Info
      </MenuItem>
    </Menu>
  );
};

export const FileActionMenu = ({
  fileMenuAnchor,
  setFileMenuAnchor,
  handleOpenModal
}) => {
  return (
    <Menu
      anchorEl={fileMenuAnchor}
      open={Boolean(fileMenuAnchor)}
      onClose={() => setFileMenuAnchor(null)}
    >
      <MenuItem onClick={() => { handleOpenModal('rename'); setFileMenuAnchor(null); }}>
        <DriveFileMove sx={{ mr: 1, fontSize: 20 }} /> Rename
      </MenuItem>
      <MenuItem onClick={() => { handleOpenModal('move'); setFileMenuAnchor(null); }}>
        <DriveFileMove sx={{ mr: 1, fontSize: 20 }} /> Move
      </MenuItem>
      <MenuItem onClick={() => { handleOpenModal('copy'); setFileMenuAnchor(null); }}>
        <CopyIcon sx={{ mr: 1, fontSize: 20 }} /> Copy
      </MenuItem>
      <MenuItem onClick={() => { handleOpenModal('delete'); setFileMenuAnchor(null); }}>
        <DeleteIcon sx={{ mr: 1, fontSize: 20 }} /> Delete
      </MenuItem>
      <MenuItem onClick={() => { handleOpenModal('info'); setFileMenuAnchor(null); }}>
        <InfoIcon sx={{ mr: 1, fontSize: 20 }} /> Info
      </MenuItem>
    </Menu>
  );
};

export const FileSelectMenu = ({
  selectedFiles,
  setSelectedFiles,
  handleOpenModal
}) => {
  if (selectedFiles.length === 0) return null;

  return (
    <Paper
      sx={{
        position: 'fixed',
        right: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        p: 1,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      <Tooltip title="Move selected">
        <IconButton onClick={() => handleOpenModal('move')}>
          <DriveFileMove />
        </IconButton>
      </Tooltip>
      <Tooltip title="Copy selected">
        <IconButton onClick={() => handleOpenModal('copy')}>
          <CopyIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete selected">
        <IconButton onClick={() => handleOpenModal('delete')}>
          <DeleteIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Clear selection">
        <IconButton onClick={() => setSelectedFiles([])}>
          <CloseIcon />
        </IconButton>
      </Tooltip>
    </Paper>
  );
};

export const FileSortMenu = ({setSortBy, setSortMenuAnchor, sortMenuAnchor}) => {
  return (
    <Menu
          anchorEl={sortMenuAnchor}
          open={Boolean(sortMenuAnchor)}
          onClose={() => setSortMenuAnchor(null)}
        >
          <MenuItem onClick={() => { setSortBy('name'); setSortMenuAnchor(null); }}>
            Name
          </MenuItem>
          <MenuItem onClick={() => { setSortBy('date'); setSortMenuAnchor(null); }}>
            Date
          </MenuItem>
          <MenuItem onClick={() => { setSortBy('folders-first'); setSortMenuAnchor(null); }}>
            Folders First
          </MenuItem>
          <MenuItem onClick={() => { setSortBy('files-first'); setSortMenuAnchor(null); }}>
            Files First
          </MenuItem>
        </Menu>
  );
}