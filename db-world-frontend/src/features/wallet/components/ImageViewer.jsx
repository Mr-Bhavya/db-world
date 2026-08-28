import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded';
import FitScreenRoundedIcon from '@mui/icons-material/FitScreenRounded';
import { useT } from '@shared/theme';

const STEPS = [1, 1.5, 2, 3, 4];
const MIN = STEPS[0];
const MAX = STEPS[STEPS.length - 1];

/**
 * Image viewer for a document scan.
 *
 * A scanned ID is not a picture you look at, it is a thing you read — the number, the date of
 * birth, the small print. The previous preview was a bare `<img>` capped at 70vh, which on a phone
 * rendered a twelve-digit Aadhaar number about eight pixels tall with no way to get closer. Zoom
 * and rotate are the whole point of this component; sideways scans are the norm, not an edge case.
 *
 * Panning is a pointer drag rather than native scrollbars, because at 4x on a phone the scrollbars
 * are the wrong affordance and a drag is what people already try. Pointer events cover mouse, touch
 * and pen from one code path.
 */
export default function ImageViewer({ src, alt, maxHeight }) {
  const T = useT();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  // A different document starts fresh — carrying the last one's 4x zoom into the next is
  // disorienting and looks like a bug.
  useEffect(() => { setZoom(1); setRotation(0); setOffset({ x: 0, y: 0 }); }, [src]);

  const zoomTo = (next) => {
    const clamped = Math.min(MAX, Math.max(MIN, next));
    setZoom(clamped);
    // Returning to 1x re-centres: a pan offset left over from a zoomed view would otherwise park
    // the fitted image off to one side with nothing to drag it back with.
    if (clamped === MIN) setOffset({ x: 0, y: 0 });
  };

  const stepIn = () => zoomTo(STEPS.find((s) => s > zoom) ?? MAX);
  const stepOut = () => zoomTo([...STEPS].reverse().find((s) => s < zoom) ?? MIN);
  const reset = () => { setZoom(1); setRotation(0); setOffset({ x: 0, y: 0 }); };

  const onPointerDown = (e) => {
    if (zoom === MIN) return;
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };
  const onPointerUp = (e) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const control = (title, icon, onClick, disabled) => (
    // `describeChild` so MUI attaches the tooltip via aria-describedby instead of stamping a second
    // `aria-label` onto the wrapper span — without it a screen reader announced every control twice.
    <Tooltip title={title} describeChild>
      {/* A disabled IconButton fires no events, so Tooltip needs a wrapper it can still hear. */}
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          aria-label={title}
          sx={{ color: T.textPrimary, '&.Mui-disabled': { color: T.textFaint } }}
        >
          {icon}
        </IconButton>
      </Box>
    </Tooltip>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Box
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => (zoom === MIN ? zoomTo(2) : reset())}
        sx={{
          position: 'relative',
          height: maxHeight,
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: T.glassHover,
          border: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: zoom === MIN ? 'zoom-in' : 'grab',
          '&:active': { cursor: zoom === MIN ? 'zoom-in' : 'grabbing' },
          // The drag is ours; without this the browser starts its own image-drag or pan gesture
          // and the two fight each other.
          touchAction: 'none',
        }}
      >
        <Box
          component="img"
          src={src}
          alt={alt}
          draggable={false}
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: drag.current ? 'none' : 'transform 0.18s ease-out',
          }}
        />
      </Box>

      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25,
        borderRadius: 999, bgcolor: T.glass, border: `1px solid ${T.border}`, alignSelf: 'center',
        px: 0.5,
      }}>
        {control('Zoom out', <ZoomOutRoundedIcon fontSize="small" />, stepOut, zoom === MIN)}
        <Box sx={{
          minWidth: 44, textAlign: 'center', fontSize: 12, fontWeight: 700,
          color: T.textMuted, fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(zoom * 100)}%
        </Box>
        {control('Zoom in', <ZoomInRoundedIcon fontSize="small" />, stepIn, zoom === MAX)}
        {control('Rotate', <RotateRightRoundedIcon fontSize="small" />, () => setRotation((r) => (r + 90) % 360))}
        {control('Fit to screen', <FitScreenRoundedIcon fontSize="small" />, reset, zoom === MIN && rotation === 0)}
      </Box>
    </Box>
  );
}
