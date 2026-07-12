import { useEffect, useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@shared/theme';
import { fetchThumbnailBlob } from '../api/fileManagerApi';
import { getFileColor, getFileEmoji } from './fileIcons';

/** True for MIME types the `/thumbnail` endpoint can actually render (image/video first-frame/PDF first-page). */
const isPreviewableMime = (mimeType) =>
  !!mimeType && (mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType === 'application/pdf');

/**
 * Thumbnail-or-icon tile for a file item.
 *
 * Previewable items (image/video/pdf) are blob-fetched through axios — the
 * `/thumbnail` endpoint is `@AdminAccess`, so a bare `<img src=thumbnailUrl>`
 * would 401 — then rendered via a revocable `URL.createObjectURL`. Anything
 * else (directories, non-previewable mime types, a failed fetch, or a broken
 * image) falls back to the extension icon/color from `fileIcons.js`. A
 * thumbnail never breaks the surrounding card — every failure path just
 * degrades to the icon tile.
 */
export default function ThumbnailImage({ item, size = 44, borderRadius = 2, fill = false }) {
  const T = useT();
  const previewable = !!item && !item.directory && isPreviewableMime(item.mimeType);

  const { data: blob, isLoading } = useQuery({
    queryKey: ['file-manager', 'thumb', item?.locationId, item?.path],
    queryFn: () => fetchThumbnailBlob({ locationId: item.locationId, path: item.path }),
    enabled: previewable,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const [objectUrl, setObjectUrl] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    setImgFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const boxSx = fill
    ? { width: '100%', height: '100%' }
    : { width: size, height: size, flexShrink: 0 };

  if (!item) return <Box sx={{ ...boxSx, borderRadius, bgcolor: T.glassHover }} />;

  if (previewable && isLoading) {
    return <Skeleton variant="rectangular" sx={{ ...boxSx, borderRadius, bgcolor: T.glassHover }} />;
  }

  if (previewable && objectUrl && !imgFailed) {
    return (
      <Box sx={{ ...boxSx, borderRadius, overflow: 'hidden', bgcolor: T.glassHover }}>
        <img
          src={objectUrl}
          alt={item.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setImgFailed(true)}
        />
      </Box>
    );
  }

  const color = getFileColor(item);
  const glyphSize = Math.round((fill ? 40 : size) * 0.55);
  return (
    <Box sx={{
      ...boxSx, borderRadius, bgcolor: `${color}22`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {item.directory
        ? <FolderIcon sx={{ fontSize: glyphSize, color }} />
        : <Typography sx={{ fontSize: glyphSize, lineHeight: 1 }}>{getFileEmoji(item)}</Typography>}
    </Box>
  );
}
