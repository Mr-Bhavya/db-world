import { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Menu, MenuItem, Skeleton } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LinkIcon from '@mui/icons-material/Link';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import IosShareIcon from '@mui/icons-material/IosShare';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import { useT } from '@shared/theme';
import { fetchThumbnailBlob } from '../api/walletApi';
import { useDocumentTypes } from '../hooks/useWallet';
import { expiryMeta, expiryLabel, formatDocDate, formatFileSize } from '../utils/walletFormat';
import { typeIcon, categoryColor } from '../utils/walletTypes';

const EXPIRY_ICON = {
  expired: EventBusyRoundedIcon,
  expiring: ScheduleRoundedIcon,
};

/**
 * The document's picture — or, failing that, what kind of document it is — as a full-height rail
 * down the left of the card.
 *
 * Full height rather than a floating square: it gives the card a single strong left edge for the
 * whole text column to align against, and for an image it shows a taller slice of the actual scan,
 * which is what makes one ID recognisable from another.
 *
 * With no thumbnail the tile carries the CATEGORY's colour. That is the card's main recognition cue
 * at a glance — a wallet is a grid of near-identical rectangles otherwise — and it is confined to
 * the tile so it can never be confused with the expiry accent on the card's edge.
 */
function ThumbRail({ doc, TypeIcon, tint }) {
  const T = useT();
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(!!doc.hasThumbnail);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!doc.hasThumbnail) return undefined;
    let objectUrl; let cancelled = false;
    setLoading(true);
    setError(false);
    fetchThumbnailBlob(doc.id)
      .then((blob) => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id, doc.hasThumbnail]);

  const shell = {
    width: { xs: 64, sm: 72 },
    flexShrink: 0,
    alignSelf: 'stretch',
    minHeight: { xs: 64, sm: 72 },
    borderRadius: 2.5,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (doc.hasThumbnail && loading) {
    return <Skeleton variant="rounded" sx={{ ...shell, bgcolor: T.glassHover, transform: 'none' }} />;
  }
  if (doc.hasThumbnail && !error && url) {
    return (
      <Box sx={{ ...shell, bgcolor: T.glassHover, border: `1px solid ${T.border}` }}>
        {/* `cover` is right here, unlike a brand logo: a document scan is a photograph, and filling
            the rail reads better than letterboxing a portrait page into it. */}
        <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </Box>
    );
  }
  return (
    <Box sx={{ ...shell, bgcolor: `${tint}1f`, border: `1px solid ${tint}44` }}>
      <TypeIcon sx={{ fontSize: 28, color: tint }} />
    </Box>
  );
}

/** A small labelled pill — the type and the holder, the two things you scan a wallet for. */
function MetaChip({ icon: Icon, label, color }) {
  const T = useT();
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.4, minWidth: 0, maxWidth: '100%',
      px: 0.8, py: 0.25, borderRadius: 1.5,
      bgcolor: color ? `${color}1a` : T.glassHover,
    }}>
      <Icon sx={{ fontSize: 12, color: color ?? T.textMuted, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: color ?? T.textMuted, letterSpacing: 0.1 }} noWrap>
        {label}
      </Typography>
    </Box>
  );
}

/** Expiry pill — rendered only when something needs doing. A document that is simply valid, or has
 * no expiry at all, gets nothing rather than a badge announcing that it is fine. */
function ExpiryPill({ doc }) {
  const T = useT();
  const meta = expiryMeta(doc.expiryDate, T);
  const label = expiryLabel(doc.expiryDate);
  if (!label || !meta.color) return null;
  const Icon = EXPIRY_ICON[meta.key];
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.4, flexShrink: 0,
      px: 0.85, py: 0.25, borderRadius: 999, bgcolor: meta.bg,
      border: meta.key === 'expired' ? `1px solid ${T.error}55` : 'none',
    }}>
      <Icon sx={{ fontSize: 13, color: meta.color }} />
      <Typography sx={{ fontSize: 11, fontWeight: 800, color: meta.color, whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Box>
  );
}

/**
 * One document in the wallet.
 *
 * TWO COLUMNS, ONE TEXT EDGE. The previous card mixed two grids: the title and the number were
 * indented past the thumbnail while the holder line and the entire footer started back at the
 * card's own padding — measured, x=91 against x=13 — so nothing lined up down the card and the
 * thumbnail floated in the top corner. The tile is now a full-height rail, and every piece of text
 * (title, chips, number, footer, and the footer's divider) shares one left edge beside it.
 *
 * Recognition comes from that tile: the document's own thumbnail when there is one, otherwise the
 * type's icon in its category's colour. Beneath the title, the type and the holder ride as two
 * small chips — the pair you actually scan for — rather than being spread over separate lines.
 *
 * Nothing appears twice. The type and holder chips are each dropped when the title already contains
 * them, and `hideHolder` drops the holder inside a person-grouped section, where the name is the
 * heading directly above.
 */
export default function DocumentCard({
  doc, onPreview, onDownload, onEdit, onShare, onDelete, index = 0, hideHolder = false,
}) {
  const T = useT();
  const reduce = useReducedMotion();
  const [anchor, setAnchor] = useState(null);
  const isImage = doc.contentType?.startsWith('image/');

  // Cached by React Query and already fetched by the page, so this costs no extra request.
  const { data: types = [] } = useDocumentTypes();
  const type = types.find((t) => t.id === doc.typeId);
  const TypeIcon = typeIcon(type?.iconKey);
  const tint = categoryColor(type?.category);

  const meta = expiryMeta(doc.expiryDate, T);
  const accent = meta.color;

  const labelText = String(doc.label ?? '').toLowerCase();
  const says = (value) => !!value && labelText.includes(String(value).toLowerCase());
  const showTypeChip = !!doc.typeDisplayName && !says(doc.typeDisplayName);
  const showHolder = !!doc.holderName && !hideHolder && !says(doc.holderName);

  const footNotes = [
    isImage ? 'Image' : 'PDF',
    formatFileSize(doc.fileSize),
    doc.issueDate ? `Issued ${formatDocDate(doc.issueDate)}` : null,
  ].filter(Boolean).join(' · ');

  const menuItem = (Icon, label, onClick, danger) => (
    <MenuItem
      onClick={() => { setAnchor(null); onClick(doc); }}
      sx={{ color: danger ? T.error : T.textPrimary, fontSize: 13.5, '&:hover': { bgcolor: danger ? T.errorBg : T.tealBg } }}
    >
      <Icon sx={{ mr: 1.5, fontSize: 18, color: danger ? T.error : T.textMuted }} /> {label}
    </MenuItem>
  );

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      // Stagger caps at 8 so a wallet with thirty documents doesn't spend a second dribbling rows in.
      transition={{
        duration: reduce ? 0.15 : 0.28,
        delay: reduce ? 0 : Math.min(index, 8) * 0.035,
        ease: 'easeOut',
      }}
      whileHover={reduce ? undefined : { y: -4 }}
      whileTap={reduce ? undefined : { scale: 0.995 }}
      style={{ height: '100%', width: '100%', minWidth: 0 }}
    >
      <Box
        onClick={() => onPreview(doc)}
        role="button"
        tabIndex={0}
        aria-label={`Open ${doc.label}`}
        onKeyDown={(e) => {
          // Only react to keydowns landing on the card surface itself — the actions menu button is
          // a nested interactive element and must keep its own Enter/Space.
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPreview(doc); }
        }}
        sx={{
          position: 'relative',
          bgcolor: T.glass,
          border: `1px solid ${T.border}`,
          borderRadius: 3.5,
          cursor: 'pointer',
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          height: '100%',
          display: 'flex',
          alignItems: 'stretch',
          gap: { xs: 1.25, sm: 1.5 },
          p: { xs: 1.5, sm: 1.75 },
          overflow: 'hidden',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
          '&:hover': {
            borderColor: `${accent ?? tint}66`,
            bgcolor: T.glassHover,
            boxShadow: `0 10px 30px -12px ${accent ?? tint}55`,
          },
          '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
          // The edge is reserved for expiry, and only when something needs doing: an expired
          // document gets a solid bar, an expiring one a fade, everything else nothing at all.
          ...(accent && {
            '&::before': {
              content: '""',
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: meta.key === 'expired' ? accent : `linear-gradient(90deg, ${accent}, ${accent}00)`,
            },
          }),
        }}
      >
        <ThumbRail doc={doc} TypeIcon={TypeIcon} tint={tint} />

        {/* One column. Everything below shares this left edge — that is the point of the
            restructure, and why the footer's divider starts here rather than at the card's edge. */}
        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, minWidth: 0 }}>
            <Typography sx={{
              flex: 1, minWidth: 0,
              fontSize: { xs: 14.5, sm: 15 }, fontWeight: 800, color: T.textPrimary,
              lineHeight: 1.3, letterSpacing: -0.2,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {doc.label}
            </Typography>
            <IconButton
              size="small"
              aria-label={`Actions for ${doc.label}`}
              onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
              sx={{ color: T.textMuted, flexShrink: 0, mt: -0.75, mr: -0.75 }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>

          {(showTypeChip || showHolder) && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 0.6, minWidth: 0 }}>
              {showTypeChip && <MetaChip icon={TypeIcon} label={doc.typeDisplayName} color={tint} />}
              {showHolder && <MetaChip icon={PersonOutlineIcon} label={doc.holderName} />}
            </Box>
          )}

          {doc.maskedNumber && (
            <Typography sx={{
              fontSize: 12.5, color: T.textMuted, mt: 0.6, letterSpacing: 0.4,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }} noWrap>
              {doc.maskedNumber}
            </Typography>
          )}

          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 0.75, flexWrap: 'wrap',
            mt: 'auto', pt: 1.25, borderTop: `1px solid ${T.border}`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9, minWidth: 0, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 11.5, color: T.textMuted }} noWrap>{footNotes}</Typography>
              {doc.shared && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, flexShrink: 0 }}>
                  <LinkIcon sx={{ fontSize: 13, color: T.warning }} />
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: T.warning, whiteSpace: 'nowrap' }}>
                    Shared
                  </Typography>
                </Box>
              )}
            </Box>
            <ExpiryPill doc={doc} />
          </Box>
        </Box>

        <Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={() => setAnchor(null)}
          onClick={(e) => e.stopPropagation()}
          slotProps={{ paper: { sx: { bgcolor: T.sidebar, border: `1px solid ${T.glassBorder}`, borderRadius: 2 } } }}
        >
          {menuItem(VisibilityIcon, 'View', onPreview)}
          {menuItem(DownloadIcon, 'Download', onDownload)}
          {menuItem(EditIcon, 'Edit', onEdit)}
          {menuItem(IosShareIcon, doc.shared ? 'Manage sharing' : 'Share', onShare)}
          {menuItem(DeleteOutlineIcon, 'Delete', onDelete, true)}
        </Menu>
      </Box>
    </motion.div>
  );
}
