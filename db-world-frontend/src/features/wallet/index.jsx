import { useMemo, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import { motion, useReducedMotion } from 'framer-motion';
import { useConfirm } from 'material-ui-confirm';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { useDocuments, useDocumentTypes, useDeleteDocument } from './hooks/useWallet';
import { fetchContentBlob } from './api/walletApi';
import { downloadBlob, openDownloaded, documentFileName } from './utils/download';
import {
  computeWalletStats, sortDocuments, filterDocsByStatus, DOC_STATUS_FILTERS,
} from './utils/walletFormat';
import { holderOptions, groupDocsByHolder } from './utils/walletTypes';
import DocumentCard from './components/DocumentCard';
import DocumentCardSkeleton from './components/DocumentCardSkeleton';
import WalletHero from './components/WalletHero';
import WalletToolbar from './components/WalletToolbar';
import AddDocumentDialog from './components/AddDocumentDialog';
import EditDocumentDialog from './components/EditDocumentDialog';
import DocumentPreviewDialog from './components/DocumentPreviewDialog';
import ShareDialog from './components/ShareDialog';

const SKELETON_COUNT = 6;

// Column count follows the available width instead of four guessed breakpoints: `auto-fill` fits as
// many ~300px tracks as there is room for, so a phone gets one, a tablet two, and the capped
// container tops out at four. `min(100%, 300px)` rather than a bare `300px` is what keeps it safe
// at the small end — a grid track's automatic minimum is its content's min-content size, so a long
// unbreakable document label could otherwise force the track, and the page, wider than the viewport.
const GRID_COLUMNS = 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))';

/**
 * Sticky heading for one person's section. Sticks under the fixed app bar so you always know whose
 * documents you are looking at while scrolling — grouping achieves nothing if the name scrolls away
 * from the cards it labels. Opaque page background rather than a blur: cards sliding under a
 * translucent heading on AMOLED black turn it to mud.
 */
function PersonHeading({ label, count }) {
  const T = useT();
  return (
    <Box sx={{
      position: 'sticky', top: { xs: 56, md: 64 }, zIndex: 2,
      display: 'flex', alignItems: 'center', gap: 1, py: 1, mb: 1.25, bgcolor: T.bg,
    }}>
      <PersonOutlineRoundedIcon sx={{ fontSize: 17, color: T.teal, flexShrink: 0 }} />
      <Typography sx={{ fontSize: { xs: 13.5, sm: 14.5 }, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.1 }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: 11, fontWeight: 800, color: T.textMuted,
        px: 0.75, py: 0.15, borderRadius: 999, bgcolor: T.glassHover,
      }}>
        {count}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: T.border }} />
    </Box>
  );
}

/** Shared empty-state shell — same frame whether the wallet is genuinely empty or the filters just
 * don't match, because those are different messages, not different designs. */
function EmptyState({ icon: Icon, title, body, action, reduce }) {
  const T = useT();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? 0.15 : 0.28, ease: 'easeOut' }}
    >
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', gap: 1.5, py: { xs: 6, sm: 9 },
        borderRadius: 4, border: `1px dashed ${T.border}`, bgcolor: T.glass,
      }}>
        <Box sx={{
          width: 60, height: 60, borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', bgcolor: T.glassHover,
        }}>
          <Icon sx={{ fontSize: 30, color: T.textMuted }} />
        </Box>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: T.textPrimary }}>{title}</Typography>
        <Typography sx={{ fontSize: 13.5, color: T.textMuted, maxWidth: 360, lineHeight: 1.6 }}>
          {body}
        </Typography>
        {action}
      </Box>
    </motion.div>
  );
}

/**
 * Document Wallet.
 *
 * Rebuilt around the one question a document store exists to answer: is any of this about to stop
 * being valid? `expiryDate` has been on the summary DTO since the feature shipped and was never
 * rendered anywhere, so a passport with six weeks left looked exactly like a birth certificate —
 * and because the edit form never sent the field either, the API's unconditional `setExpiryDate`
 * quietly cleared it on every save. The card, the header counts and the sort all lead with it now,
 * and both dialogs can set it.
 *
 * Responsive by construction rather than by breakpoint guessing, which matters because this ships
 * to three form factors from one build: the grid follows available width inside a capped container,
 * the toolbar collapses to two deliberate rows on a phone, and the dialogs already go full-screen
 * below `sm` (which is what the Android WebView gets). Motion is opt-out throughout.
 */
export default function WalletPage() {
  const T = useT();
  const confirm = useConfirm();
  const reduce = useReducedMotion();

  const [q, setQ] = useState('');
  const [typeId, setTypeId] = useState('');
  const [holder, setHolder] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');

  // Search stays server-side (the API filters on `q`); the type filter does NOT, because the type
  // counts in the toolbar have to come from the whole wallet and a server-filtered list can't
  // provide them. One bounded response — a person's documents — makes that cheap.
  const filters = useMemo(() => ({ q }), [q]);
  const { data: allDocs = [], isLoading } = useDocuments(filters);
  const { data: types = [] } = useDocumentTypes();
  const del = useDeleteDocument();

  const [addOpen, setAddOpen] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [shareDoc, setShareDoc] = useState(null);

  const stats = useMemo(() => computeWalletStats(allDocs), [allDocs]);
  const typeCounts = useMemo(() => allDocs.reduce((acc, d) => {
    acc[d.typeId] = (acc[d.typeId] ?? 0) + 1;
    return acc;
  }, {}), [allDocs]);

  // Holders come from the documents themselves rather than a table — see `holderOptions`. Counting
  // is case-insensitive for the same reason the options are de-duplicated that way: "Dad" and "dad"
  // are one person, and a filter that disagreed with its own chip count would be worse than none.
  const holders = useMemo(() => holderOptions(allDocs), [allDocs]);
  const holderCounts = useMemo(() => allDocs.reduce((acc, d) => {
    const match = holders.find((h) => h.toLowerCase() === (d.holderName ?? '').trim().toLowerCase());
    if (match) acc[match] = (acc[match] ?? 0) + 1;
    return acc;
  }, {}), [allDocs, holders]);

  const docs = useMemo(() => {
    let list = typeId ? allDocs.filter((d) => d.typeId === typeId) : allDocs;
    if (holder) {
      const wanted = holder.toLowerCase();
      list = list.filter((d) => (d.holderName ?? '').trim().toLowerCase() === wanted);
    }
    return sortDocuments(filterDocsByStatus(list, status), sort);
  }, [allDocs, typeId, holder, status, sort]);

  const hasFilter = !!q || !!typeId || !!holder || !!status;

  // Group by person only when there is more than one AND no holder is chosen. With one picked the
  // reader has already said whose documents they want, so a single heading over the whole grid
  // would be noise; without one, the sections are what turn a family's pile into "Father's papers,
  // then Mother's". Same rule the IPO list applies to its lifecycle sections.
  const sections = useMemo(
    () => (holders.length > 1 && !holder ? groupDocsByHolder(docs) : null),
    [holders.length, holder, docs],
  );
  const statusLabel = DOC_STATUS_FILTERS.find((f) => f.value === status)?.label;

  const onDownload = async (doc) => {
    try {
      const blob = await fetchContentBlob(doc.id, 'attachment');
      const saved = await downloadBlob(blob, documentFileName(doc.label, doc.contentType));
      if (saved?.uri) {
        notify.success('Saved to Downloads', {
          action: { label: 'Open', onClick: () => { openDownloaded(saved).catch(() => {}); } },
        });
      }
    } catch (_e) {
      notify.error('Failed to download document');
    }
  };

  const onDelete = (doc) => {
    confirm({ title: 'Delete document?', description: `"${doc.label}" will be permanently deleted.` })
      .then(() => del.mutate(doc.id)).catch(() => {});
  };

  const clearFilters = () => { setQ(''); setTypeId(''); setHolder(''); setStatus(''); };

  return (
    <Box sx={{
      pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 24px)' },
      px: { xs: 2, sm: 3 },
      pb: 4,
      // Capped and centred so an ultrawide window doesn't stretch four cards across the whole
      // viewport. `width: 100%` is load-bearing next to `mx: auto` — this Box is a flex item of the
      // app shell's <main> column, and AUTO SIDE MARGINS CANCEL `align-items: stretch`, so without
      // it the Box shrink-wraps its own max-content and gives the page a horizontal scrollbar.
      maxWidth: 1400,
      width: '100%',
      mx: 'auto',
      color: T.textPrimary,
    }}>
      <WalletHero stats={stats} status={status} onStatusChange={setStatus} onAdd={() => setAddOpen(true)} />

      {(allDocs.length > 0 || hasFilter) && (
        <WalletToolbar
          q={q}
          onQueryChange={setQ}
          sort={sort}
          onSortChange={setSort}
          typeId={typeId}
          onTypeChange={setTypeId}
          types={types}
          typeCounts={typeCounts}
          holders={holders}
          holder={holder}
          onHolderChange={setHolder}
          holderCounts={holderCounts}
          total={allDocs.length}
          showing={docs.length}
        />
      )}

      {isLoading ? (
        <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: GRID_COLUMNS }}>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => <DocumentCardSkeleton key={i} />)}
        </Box>
      ) : docs.length === 0 ? (
        hasFilter ? (
          <EmptyState
            reduce={reduce}
            icon={SearchOffRoundedIcon}
            title="Nothing matches"
            body={statusLabel
              ? `No ${statusLabel.toLowerCase()} documents with these filters.`
              : 'No documents match this search or filter.'}
            action={(
              <Button
                variant="outlined"
                size="small"
                onClick={clearFilters}
                sx={{
                  mt: 0.5, textTransform: 'none', fontWeight: 700, fontSize: 12.5,
                  borderColor: T.border, color: T.textPrimary, bgcolor: T.glass,
                  '&:hover': { borderColor: T.teal, bgcolor: T.tealBg, color: T.teal },
                }}
              >
                Clear filters
              </Button>
            )}
          />
        ) : (
          <EmptyState
            reduce={reduce}
            icon={FolderOpenIcon}
            title="No documents yet"
            body="Add your first ID, licence or certificate to keep it encrypted and within reach — on this phone, in the app, or on any browser you sign in from."
            action={(
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddOpen(true)}
                sx={{ mt: 0.5, textTransform: 'none', fontWeight: 700, bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}
              >
                Add document
              </Button>
            )}
          />
        )
      ) : (
        (() => {
          const cardProps = {
            onPreview: setPreviewDoc,
            onDownload,
            onEdit: setEditDoc,
            onShare: setShareDoc,
            onDelete,
          };
          // `hideHolder` inside a grouped section: the person's name is the heading directly
          // above, so repeating it on every card under it says nothing.
          const grid = (list, offset = 0, hideHolder = false) => (
            <Box sx={{ display: 'grid', gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: GRID_COLUMNS }}>
              {list.map((doc, i) => (
                <DocumentCard key={doc.id} doc={doc} index={offset + i} hideHolder={hideHolder} {...cardProps} />
              ))}
            </Box>
          );
          if (!sections) return grid(docs);
          let seen = 0;
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, sm: 3.5 } }}>
              {sections.map((section) => {
                const offset = seen;
                seen += section.docs.length;
                return (
                  <Box key={section.key}>
                    <PersonHeading label={section.label} count={section.docs.length} />
                    {grid(section.docs, offset, section.key !== '__none')}
                  </Box>
                );
              })}
            </Box>
          );
        })()
      )}

      <AddDocumentDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {editDoc && <EditDocumentDialog docId={editDoc.id} open onClose={() => setEditDoc(null)} />}
      {previewDoc && (
        <DocumentPreviewDialog
          doc={previewDoc}
          open
          onClose={() => setPreviewDoc(null)}
          onDownload={onDownload}
          // Hand off to the other dialog rather than stacking two on top of each other: the viewer
          // closes as the editor opens, so back/escape has one thing to dismiss.
          onEdit={(d) => { setPreviewDoc(null); setEditDoc(d); }}
          onShare={(d) => { setPreviewDoc(null); setShareDoc(d); }}
        />
      )}
      {shareDoc && <ShareDialog doc={shareDoc} open onClose={() => setShareDoc(null)} />}
    </Box>
  );
}
