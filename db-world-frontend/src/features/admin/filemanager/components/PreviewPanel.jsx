import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Box, Drawer, Dialog, IconButton, Typography, Tooltip, CircularProgress, Button,
  useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { downloadTicketUrl, fetchTextPreview } from '../api/fileManagerApi';
import { getFileColor, getFileEmoji } from './fileIcons';

const PdfViewer = lazy(() => import('@shared/components/pdf/PdfViewer'));

/** Extensions treated as inline-previewable "code/text" even when the server-reported MIME isn't `text/*`. */
const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp',
  'cs', 'rb', 'php', 'sh', 'bash', 'yml', 'yaml', 'xml', 'html', 'htm', 'css', 'scss', 'less',
  'sql', 'md', 'txt', 'log', 'ini', 'conf', 'env', 'gradle', 'properties',
]);

const TEXT_MIME_PREFIXES = ['text/'];
const TEXT_MIME_EXACT = new Set([
  'application/json', 'application/javascript', 'application/xml',
  'application/x-yaml', 'application/x-sh', 'application/x-httpd-php',
]);

function isTextPreviewable(item) {
  if (!item) return false;
  const mime = item.mimeType || '';
  if (TEXT_MIME_PREFIXES.some((p) => mime.startsWith(p))) return true;
  if (TEXT_MIME_EXACT.has(mime)) return true;
  return CODE_EXTENSIONS.has((item.extension || '').toLowerCase());
}

function previewKind(item) {
  if (!item) return 'none';
  if (item.directory) return 'none';
  const mime = item.mimeType || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (isTextPreviewable(item)) return 'text';
  return 'unsupported';
}

/** Simple click-to-zoom image viewer — no new pan/zoom dependency. */
function ImageViewer({ src, name }) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <Box
      onClick={() => setZoomed((v) => !v)}
      sx={{
        flex: 1, display: 'flex',
        alignItems: zoomed ? 'flex-start' : 'center',
        justifyContent: zoomed ? 'flex-start' : 'center',
        overflow: 'auto', cursor: zoomed ? 'zoom-out' : 'zoom-in', bgcolor: 'rgba(0,0,0,0.35)',
      }}
    >
      <Box
        component="img"
        src={src}
        alt={name}
        sx={{
          maxWidth: zoomed ? 'none' : '100%',
          maxHeight: zoomed ? 'none' : '100%',
          width: zoomed ? '160%' : 'auto',
          objectFit: 'contain',
          transition: 'width 0.2s ease',
          display: 'block',
        }}
      />
    </Box>
  );
}

function TextViewer({ T, loading, isError, data }) {
  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={24} sx={{ color: T.teal }} />
      </Box>
    );
  }
  if (isError || !data) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Typography sx={{ fontSize: 13, color: T.error }}>Failed to load preview</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {data.truncated && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: T.warningBg }}>
          <Typography sx={{ fontSize: 11.5, color: T.warning }}>
            Preview truncated — showing only the first portion of this file.
          </Typography>
        </Box>
      )}
      <Box
        component="pre"
        sx={{
          flex: 1, overflow: 'auto', m: 0, p: 2,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 12.5, lineHeight: 1.6, color: T.textPrimary,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}
      >
        {data.content}
      </Box>
    </Box>
  );
}

function UnsupportedViewer({ T, item, ticketUrl }) {
  const color = getFileColor(item);
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 3 }}>
      <Box sx={{
        width: 96, height: 96, borderRadius: '50%', bgcolor: `${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography sx={{ fontSize: 44, lineHeight: 1 }}>{getFileEmoji(item)}</Typography>
      </Box>
      <Typography sx={{ fontSize: 13, color: T.textMuted, textAlign: 'center' }}>
        No inline preview available for this file type.
      </Typography>
      <Button
        component="a"
        href={ticketUrl || undefined}
        download={item.name}
        disabled={!ticketUrl}
        variant="contained"
        startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
        sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}
      >
        Download
      </Button>
    </Box>
  );
}

/** Picks exactly one viewer/state so loading, error, and content branches never overlap. */
function renderPreviewBody({ kind, ticketLoading, ticketError, ticketUrl, item, textLoading, textIsError, textData, T }) {
  if (kind === 'none') {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Typography sx={{ fontSize: 13, color: T.textFaint }}>Folders don&apos;t have a preview.</Typography>
      </Box>
    );
  }
  if (kind === 'text') {
    return <TextViewer T={T} loading={textLoading} isError={textIsError} data={textData} />;
  }
  if (ticketLoading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: T.teal }} />
      </Box>
    );
  }
  if (ticketError) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Typography sx={{ fontSize: 13, color: T.error, textAlign: 'center' }}>{ticketError}</Typography>
      </Box>
    );
  }
  if (kind === 'image') return <ImageViewer src={ticketUrl} name={item.name} />;
  if (kind === 'video') {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', bgcolor: '#000' }}>
        <Box component="video" src={ticketUrl} controls sx={{ width: '100%', maxHeight: '100%' }} />
      </Box>
    );
  }
  if (kind === 'audio') {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Box component="audio" src={ticketUrl} controls sx={{ width: '100%' }} />
      </Box>
    );
  }
  if (kind === 'pdf') {
    return (
      <Box sx={{ flex: 1, width: '100%', minHeight: 0 }}>
        <Suspense fallback={<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><CircularProgress size={28} sx={{ color: T.teal }} /></Box>}>
          <PdfViewer src={ticketUrl} T={T} />
        </Suspense>
      </Box>
    );
  }
  return <UnsupportedViewer T={T} item={item} ticketUrl={ticketUrl} />;
}

/**
 * Inline preview: right `Drawer` on desktop, full-screen `Dialog` on mobile.
 * The full file is served by the PUBLIC ticket-gated stream — a fresh ticket
 * is minted (admin-authenticated POST) whenever `item` changes, then bound
 * directly to `<img>/<video>/<audio>/<iframe> src` (those elements can't
 * carry an Authorization header, hence the ticket indirection). Text/code
 * files go through `fetchTextPreview` instead of the raw stream so large
 * files can be head-truncated server-side.
 */
export default function PreviewPanel({ open, item, items = [], onClose, onNavigate }) {
  const T = useT();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const locationId = item?.locationId;
  const path = item?.path;
  const isDir = item?.directory;
  const kind = previewKind(item);
  const currentKey = locationId && path ? `${locationId}:${path}` : null;

  // Keyed by `{ key }` (not just a boolean) so a stale ticket from the
  // previous item can never leak into the next one's <video>/<img> src while
  // the new ticket is in flight (prev/next navigation swaps `item` fast).
  const [ticketState, setTicketState] = useState({ key: null, url: null, error: null, loading: false });

  useEffect(() => {
    let cancelled = false;
    if (!open || !currentKey || isDir) {
      setTicketState({ key: currentKey, url: null, error: null, loading: false });
      return undefined;
    }
    setTicketState({ key: currentKey, url: null, error: null, loading: true });
    downloadTicketUrl({ locationId, path })
      .then((url) => { if (!cancelled) setTicketState({ key: currentKey, url, error: null, loading: false }); })
      .catch((e) => {
        if (!cancelled) {
          setTicketState({
            key: currentKey, url: null,
            error: e?.response?.data?.message ?? 'Failed to load preview',
            loading: false,
          });
        }
      });
    return () => { cancelled = true; };
  }, [open, currentKey, locationId, path, isDir]);

  const ticketReady = ticketState.key === currentKey;
  const ticketUrl = ticketReady ? ticketState.url : null;
  const ticketError = ticketReady ? ticketState.error : null;
  const ticketLoading = !ticketReady || ticketState.loading;

  const { data: textData, isLoading: textLoading, isError: textIsError } = useQuery({
    queryKey: ['file-manager', 'text-preview', locationId, path],
    queryFn: () => fetchTextPreview({ locationId, path }),
    enabled: Boolean(open && kind === 'text' && locationId && path),
    staleTime: 30_000,
  });

  const index = useMemo(() => items.findIndex((i) => i.path === path), [items, path]);
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < items.length - 1;
  const goPrev = () => hasPrev && onNavigate?.(items[index - 1]);
  const goNext = () => hasNext && onNavigate?.(items[index + 1]);

  const body = !item ? null : (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: T.sidebar }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <Typography sx={{
          fontSize: 14, fontWeight: 700, color: T.textPrimary, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.name}
        </Typography>
        {ticketUrl && !isDir && (
          <Tooltip title="Download">
            <IconButton
              component="a" href={ticketUrl} download={item.name} size="small"
              sx={{ color: T.textMuted, '&:hover': { color: T.teal } }}
            >
              <DownloadIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {renderPreviewBody({ kind, ticketLoading, ticketError, ticketUrl, item, textLoading, textIsError, textData, T })}
      </Box>

      {items.length > 1 && (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1, borderTop: `1px solid ${T.border}`,
        }}>
          <IconButton size="small" onClick={goPrev} disabled={!hasPrev} sx={{ color: hasPrev ? T.textMuted : T.textFaint }}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>
            {index >= 0 ? `${index + 1} / ${items.length}` : ''}
          </Typography>
          <IconButton size="small" onClick={goNext} disabled={!hasNext} sx={{ color: hasNext ? T.textMuted : T.textFaint }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      )}
    </Box>
  );

  if (isMobile) {
    return (
      <Dialog fullScreen open={Boolean(open && item)} onClose={onClose} PaperProps={{ sx: { bgcolor: T.sidebar } }}>
        {body}
      </Dialog>
    );
  }

  return (
    <Drawer
      anchor="right"
      open={Boolean(open && item)}
      onClose={onClose}
      PaperProps={{ sx: { width: { sm: '70vw', md: 560 }, bgcolor: T.sidebar, borderLeft: `1px solid ${T.glassBorder}` } }}
    >
      {body}
    </Drawer>
  );
}
