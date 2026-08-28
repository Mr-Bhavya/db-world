import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Box, Typography, IconButton, CircularProgress, useMediaQuery, useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import IosShareIcon from '@mui/icons-material/IosShare';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { fetchContentBlob, fetchDocument } from '../api/walletApi';
import { downloadBlob, documentFileName } from '../utils/download';
import { useDocumentTypes } from '../hooks/useWallet';
import { formatDocDate, expiryLabel, expiryMeta, formatFileSize } from '../utils/walletFormat';
import { typeIcon, categoryColor } from '../utils/walletTypes';
import { WalletFormDialog, FormSection, PrimaryButton, GhostButton } from './walletFormUi';
import ImageViewer from './ImageViewer';

const PdfViewer = lazy(() => import('@shared/components/pdf/PdfViewer'));

/** One labelled fact in the details column. */
function Fact({ icon: Icon, label, color, children }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
      <Box sx={{
        width: 28, height: 28, borderRadius: 2, flexShrink: 0, mt: 0.1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: color ? `${color}1a` : T.tealBg,
      }}>
        <Icon sx={{ fontSize: 15, color: color ?? T.teal }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{
          fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: 0.4, fontWeight: 700, lineHeight: 1.4,
        }}>
          {label}
        </Typography>
        <Box sx={{ mt: 0.15 }}>
          {typeof children === 'string'
            ? <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: T.textPrimary, wordBreak: 'break-word' }}>{children}</Typography>
            : children}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * The document number, masked until asked for.
 *
 * Masked by default even here: this dialog is what you open in front of whoever asked to see the
 * document, and the full number of a government ID should be a deliberate act rather than the
 * resting state. Copy is offered separately, because the usual reason to reveal it is to paste it
 * into a form somewhere else.
 */
function NumberFact({ detail, doc }) {
  const T = useT();
  const [revealed, setRevealed] = useState(false);
  const full = detail?.documentNumber;
  const shown = revealed && full ? full : doc.maskedNumber;

  const copy = async () => {
    if (!full) return;
    try {
      await navigator.clipboard.writeText(full);
      notify.success('Number copied');
    } catch {
      notify.error('Failed to copy number');
    }
  };

  return (
    <Fact icon={DescriptionOutlinedIcon} label="Document number">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
        <Typography sx={{
          fontSize: 14, fontWeight: 700, color: T.textPrimary, letterSpacing: 0.5, minWidth: 0,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }} noWrap>
          {shown}
        </Typography>
        <IconButton
          size="small"
          aria-label={revealed ? 'Hide number' : 'Reveal number'}
          onClick={() => setRevealed((r) => !r)}
          disabled={!full}
          sx={{ color: T.textMuted }}
        >
          {revealed ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" aria-label="Copy number" disabled={!full} onClick={copy} sx={{ color: T.textMuted }}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Box>
    </Fact>
  );
}

/**
 * View a document.
 *
 * Rebuilt on the same shell as the two forms, so opening, editing and adding all feel like one
 * feature rather than three. Two things it now does that it did not:
 *
 * The viewer is chosen for the FILE. An image gets zoom, rotate and drag-to-pan, because a scanned
 * ID is something you read — the previous bare `<img>` capped at 70vh rendered a twelve-digit
 * number a few pixels tall on a phone with no way to get closer, and sideways scans had no remedy
 * at all. A PDF gets the shared page-stack viewer.
 *
 * And the actions that belong to a document — download, share, edit — are here, rather than only in
 * the card's overflow menu. Opening something and then having to close it to act on it is a step
 * that never needed to exist.
 */
export default function DocumentPreviewDialog({ doc, open, onClose, onEdit, onShare, onDownload }) {
  const T = useT();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const [url, setUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const isPdf = doc.contentType === 'application/pdf';

  const { data: detail } = useQuery({
    queryKey: ['wallet', 'document', doc.id],
    queryFn: () => fetchDocument(doc.id),
  });
  const { data: types = [] } = useDocumentTypes();
  const type = types.find((t) => t.id === doc.typeId);
  const TypeIcon = typeIcon(type?.iconKey);
  const tint = categoryColor(type?.category);

  useEffect(() => {
    let objectUrl; let cancelled = false;
    setLoading(true); setBlob(null); setUrl(null);
    fetchContentBlob(doc.id, 'inline')
      .then((b) => {
        if (cancelled) return;
        setBlob(b);
        // PDFs are handed to pdf.js as a Blob; only images need an object URL for <img>.
        if (!isPdf) { objectUrl = URL.createObjectURL(b); setUrl(objectUrl); }
      })
      .catch(() => { if (!cancelled) notify.error('Failed to load document'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id, isPdf]);

  const download = async () => {
    if (onDownload) { onDownload(doc); return; }
    try {
      const b = await fetchContentBlob(doc.id, 'attachment');
      await downloadBlob(b, documentFileName(doc.label, doc.contentType));
    } catch {
      notify.error('Failed to download document');
    }
  };

  const holderName = detail?.holderName ?? doc.holderName;
  const issueDate = detail?.issueDate ?? doc.issueDate;
  const expiryDate = detail?.expiryDate ?? doc.expiryDate;
  const expiry = expiryMeta(expiryDate, T);
  const hasNumber = !!(doc.maskedNumber || detail?.documentNumber);
  const viewerHeight = isPhone ? '46vh' : '58vh';

  return (
    <WalletFormDialog
      open={open}
      onClose={onClose}
      fullScreen={isPhone}
      title={doc.label}
      subtitle={[doc.typeDisplayName, formatFileSize(doc.fileSize)].filter(Boolean).join(' · ')}
      actions={(
        <>
          {onShare && (
            <GhostButton startIcon={<IosShareIcon sx={{ fontSize: 18 }} />} onClick={() => onShare(doc)}>
              Share
            </GhostButton>
          )}
          {onEdit && (
            <GhostButton startIcon={<EditIcon sx={{ fontSize: 18 }} />} onClick={() => onEdit(doc)}>
              Edit
            </GhostButton>
          )}
          <PrimaryButton startIcon={<DownloadIcon sx={{ fontSize: 18 }} />} onClick={download}>
            Download
          </PrimaryButton>
        </>
      )}
    >
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: viewerHeight }}>
          <CircularProgress size={26} sx={{ color: T.teal }} />
        </Box>
      ) : isPdf ? (
        <Box sx={{
          height: viewerHeight, borderRadius: 3, overflow: 'auto',
          bgcolor: T.glassHover, border: `1px solid ${T.border}`, p: 1,
        }}>
          <Suspense fallback={(
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <CircularProgress size={22} sx={{ color: T.teal }} />
            </Box>
          )}>
            <PdfViewer src={blob} T={T} />
          </Suspense>
        </Box>
      ) : (
        <ImageViewer src={url} alt={doc.label} maxHeight={viewerHeight} />
      )}

      <FormSection title="Details">
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))',
          gap: 2,
        }}>
          {doc.typeDisplayName && <Fact icon={TypeIcon} label="Type" color={tint}>{doc.typeDisplayName}</Fact>}
          {holderName && <Fact icon={PersonOutlineIcon} label="Belongs to">{holderName}</Fact>}
          {hasNumber && <NumberFact detail={detail} doc={doc} />}
          {issueDate && <Fact icon={EventOutlinedIcon} label="Issued">{formatDocDate(issueDate)}</Fact>}
          {expiryDate && (
            <Fact icon={EventBusyRoundedIcon} label="Validity" color={expiry.color}>
              <Typography sx={{
                fontSize: 13.5, fontWeight: 700, color: expiry.color ?? T.textPrimary,
              }}>
                {expiryLabel(expiryDate)}
              </Typography>
            </Fact>
          )}
        </Box>
      </FormSection>

      {detail?.notes && (
        <FormSection title="Notes">
          <Typography sx={{
            fontSize: 13, color: T.textMuted, lineHeight: 1.7,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {detail.notes}
          </Typography>
        </FormSection>
      )}
    </WalletFormDialog>
  );
}
