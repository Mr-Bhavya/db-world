import { Menu, MenuItem, Divider } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import { useT } from '@shared/theme';
import { useFileManagerStore } from '../store/useFileManagerStore';

/**
 * Cursor-anchored action menu shared by FileGrid/FileList/FileMobileList —
 * right-click and the MoreVert buttons all feed this single instance via
 * `contextState = { mouseX, mouseY, item }` built from the reported event's
 * `clientX`/`clientY`.
 *
 * Multi-select aware: when the right-clicked item is part of a multi-item
 * selection, the bulk-capable actions (download/move/copy/cut/delete) fire
 * with the full array of selected paths (`Array.from(selection)`) instead of
 * the single item, and single-item-only actions (open/rename/info) are
 * hidden. Page-level handlers must resolve those paths against the current
 * directory listing.
 */
export default function ContextMenu({
  contextState, onClose, onOpen, onDownload, onRename, onMove, onCopy, onCut, onInfo, onDelete,
}) {
  const T = useT();
  const selection = useFileManagerStore((s) => s.selection);

  if (!contextState) return null;

  const { item, mouseX, mouseY } = contextState;
  const multi = !!item && selection.size > 1 && selection.has(item.path);
  const target = multi ? Array.from(selection) : item;

  const menuItemSx = { fontSize: 13, color: T.textPrimary, gap: 1, '&:hover': { bgcolor: T.hoverBg } };
  const iconSx = { fontSize: 17, color: T.textMuted };

  const fireSingle = (fn) => () => { onClose?.(); fn?.(item); };
  const fireTarget = (fn) => () => { onClose?.(); fn?.(target); };

  return (
    <Menu
      open={Boolean(contextState)}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: mouseY, left: mouseX }}
      PaperProps={{
        sx: {
          bgcolor: T.glass, backdropFilter: 'blur(16px)',
          border: `1px solid ${T.glassBorder}`, minWidth: 180,
        },
      }}
    >
      {!multi && (
        <MenuItem onClick={fireSingle(onOpen)} sx={menuItemSx}>
          <OpenInNewIcon sx={iconSx} /> Open
        </MenuItem>
      )}
      {(multi || !item?.directory) && (
        <MenuItem onClick={fireTarget(onDownload)} sx={menuItemSx}>
          <DownloadIcon sx={iconSx} /> Download
        </MenuItem>
      )}
      {!multi && (
        <MenuItem onClick={fireSingle(onRename)} sx={menuItemSx}>
          <EditIcon sx={iconSx} /> Rename
        </MenuItem>
      )}
      <MenuItem onClick={fireTarget(onMove)} sx={menuItemSx}>
        <DriveFileMoveIcon sx={iconSx} /> Move
      </MenuItem>
      <MenuItem onClick={fireTarget(onCopy)} sx={menuItemSx}>
        <ContentCopyIcon sx={iconSx} /> Copy
      </MenuItem>
      <MenuItem onClick={fireTarget(onCut)} sx={menuItemSx}>
        <ContentCutIcon sx={iconSx} /> Cut
      </MenuItem>
      {!multi && (
        <MenuItem onClick={fireSingle(onInfo)} sx={menuItemSx}>
          <InfoOutlinedIcon sx={iconSx} /> Info
        </MenuItem>
      )}
      <Divider sx={{ borderColor: T.border, my: 0.5 }} />
      <MenuItem onClick={fireTarget(onDelete)} sx={{ ...menuItemSx, color: T.error }}>
        <DeleteIcon sx={{ ...iconSx, color: T.error }} /> Delete
      </MenuItem>
    </Menu>
  );
}
