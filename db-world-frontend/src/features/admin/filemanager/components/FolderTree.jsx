import { useState } from 'react';
import { Box, Collapse, IconButton, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { listDirectory } from '../api/fileManagerApi';
import { useFileManagerStore } from '../store/useFileManagerStore';

/**
 * One lazily-expanding node. Children are fetched (and cached) only once the
 * node is expanded, filtered down to directories — this is a navigation
 * tree, not a full listing.
 */
function FolderTreeNode({
  locationId, path, name, depth, defaultExpanded = false, onDropItems, onSelect, selectedPath,
}) {
  const T = useT();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [dragOver, setDragOver] = useState(false);
  const storePath = useFileManagerStore((s) => s.path);
  const navigate = useFileManagerStore((s) => s.navigate);
  const activePath = onSelect ? selectedPath : storePath;
  const active = activePath === path;

  const { data, isLoading } = useQuery({
    // Namespaced under 'tree' so this cache entry never collides with the
    // main content-pane listing query for the same locationId/path.
    queryKey: ['file-manager', 'tree', locationId, path],
    queryFn: () => listDirectory({ locationId, path, sortBy: 'name', order: 'asc' }),
    enabled: expanded,
    staleTime: 30_000,
  });

  const children = (data?.items ?? []).filter((i) => i.directory);

  return (
    <Box>
      <Box
        onClick={() => (onSelect ? onSelect(path) : navigate(path))}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDropItems?.(path); }}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          pl: 1 + depth * 1.5, pr: 1, py: 0.5, borderRadius: 1,
          cursor: 'pointer', userSelect: 'none',
          color: active ? T.teal : T.textMuted,
          bgcolor: dragOver ? T.tealBgHover : active ? T.tealBg : 'transparent',
          outline: dragOver ? `1px dashed ${T.teal}` : 'none',
          outlineOffset: -2,
          '&:hover': { bgcolor: active ? T.tealBg : T.hoverBg, color: T.teal },
        }}
      >
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          sx={{ p: 0.25, color: 'inherit' }}
        >
          <ChevronRightIcon
            sx={{ fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </IconButton>
        {active ? <FolderOpenIcon sx={{ fontSize: 16 }} /> : <FolderIcon sx={{ fontSize: 16 }} />}
        <Typography sx={{
          fontSize: 12.5, fontWeight: active ? 700 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </Typography>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        {isLoading ? (
          <Typography sx={{ fontSize: 11, color: T.textFaint, pl: 1 + (depth + 1) * 1.5, py: 0.5 }}>
            Loading…
          </Typography>
        ) : (
          children.map((child) => (
            <FolderTreeNode
              key={child.path}
              locationId={locationId}
              path={child.path}
              name={child.name}
              depth={depth + 1}
              onDropItems={onDropItems}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))
        )}
      </Collapse>
    </Box>
  );
}

/**
 * Lazy directory tree for one location, rooted at "/". `onDropItems(destPath)`
 * is an optional hook for future drag-to-move — nodes render as drop targets
 * (highlighted on dragover) but the drag *source* wiring (selected items) is
 * owned by the grid/list views built in a later group.
 */
export default function FolderTree({ locationId, onDropItems, onSelect, selectedPath }) {
  if (!locationId) return null;
  return (
    <Box sx={{ py: 0.5 }}>
      <FolderTreeNode
        locationId={locationId}
        path="/"
        name="Root"
        depth={0}
        defaultExpanded
        onDropItems={onDropItems}
        onSelect={onSelect}
        selectedPath={selectedPath}
      />
    </Box>
  );
}
