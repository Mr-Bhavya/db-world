import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Checkbox, CircularProgress, Collapse, DialogActions, DialogContent, DialogTitle, IconButton,
  Typography,
} from '@mui/material';
import {
  CloseRounded, CleaningServicesRounded, ExpandMoreRounded, InfoOutlined, ErrorOutlineRounded,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import SheetDialog from '@shared/components/SheetDialog';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { getHostAction } from '../api/adminApi';
import {
  TEMP_CATEGORY, buildCleanupArgs, defaultCategorySelection, errorMessage, formatKb, hostActionQueryKey,
  isActive, normalizePreview, selectedKb,
} from './hostActionsUtils';

/** How often to ask about the preview while the host measures. */
const PREVIEW_POLL_MS = 1_500;
/** Measuring the media disk can be slow, but not this slow; past it, say so instead of spinning. */
const PREVIEW_TIMEOUT_MS = 3 * 60_000;

/**
 * Cleanup in two steps: the host measures first (`cleanup-preview`), the admin picks, and only
 * then is anything deleted (`cleanup-apply`).
 *
 * The routine categories that would free something are pre-ticked. Ingestion leftovers never
 * are: a folder in /srv/dbworld/temp may be a job someone means to retry, so each one has to be
 * ticked on purpose.
 *
 * Mount with a fresh `key` per opening: each opening asks for a fresh preview.
 *
 * @param onSubmit ({action, args}, {quiet}) => Promise<{id}> — queues an action; the page owns
 *                 the toasts, and `quiet` keeps the preview out of them
 */
export default function HostCleanupDialog({ open, onClose, onSubmit }) {
  const T = useT();
  const S = adminSurface(T);

  const [previewId, setPreviewId] = useState(null);
  const [startError, setStartError] = useState(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [catsPicked, setCatsPicked] = useState(null); // null = the defaults, until the admin touches one
  const [tempPicked, setTempPicked] = useState([]);
  const [applying, setApplying] = useState(false);

  // Ask once per opening. The ref, not state, guards it: StrictMode runs effects twice in dev,
  // and two previews would be two root jobs measuring the same disks.
  const asked = useRef(false);
  useEffect(() => {
    if (!open || asked.current) return;
    asked.current = true;
    onSubmit({ action: 'cleanup-preview', args: {} }, { quiet: true })
      .then((res) => setPreviewId(res?.id ?? null))
      .catch((e) => setStartError(errorMessage(e, 'Could not ask the host for a preview.')));
  }, [open, onSubmit]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => setGaveUp(true), PREVIEW_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [open]);

  const { data: result } = useQuery({
    queryKey: hostActionQueryKey(previewId),
    queryFn: () => getHostAction(previewId),
    enabled: Boolean(previewId),
    // A 404 right after submitting is the moment the host has taken the request but not yet
    // written its result; keep asking rather than treating it as final.
    retry: false,
    refetchInterval: (q) => (!gaveUp && (!q.state.data || isActive(q.state.data.status)) ? PREVIEW_POLL_MS : false),
  });

  const status = result?.status;
  const measuring = !startError && (!result || isActive(status));
  const preview = useMemo(() => (status === 'done' ? normalizePreview(result?.data) : null), [status, result?.data]);
  const cats = catsPicked ?? defaultCategorySelection(preview);
  const args = buildCleanupArgs(cats, tempPicked);
  const freeing = selectedKb(preview, cats, tempPicked);

  const toggleCat = (id) => setCatsPicked((cur) => {
    const base = cur ?? defaultCategorySelection(preview);
    return base.includes(id) ? base.filter((c) => c !== id) : [...base, id];
  });
  const toggleTemp = (name) => setTempPicked((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]));

  const apply = async () => {
    if (!args || applying) return;
    setApplying(true);
    try {
      await onSubmit({ action: 'cleanup-apply', args });
      onClose();
    } catch {
      // The page has already said why; keep the picks so the admin can try again.
    } finally {
      setApplying(false);
    }
  };

  return (
    <SheetDialog
      open={open}
      onClose={() => { if (!applying) onClose(); }}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6, fontSize: '1rem', fontWeight: 800, color: T.text }}>
        <CleaningServicesRounded sx={{ fontSize: 20, color: T.teal }} />
        Clean up disk space
        <IconButton onClick={onClose} disabled={applying} size="small" aria-label="Close" sx={{ position: 'absolute', top: 12, right: 12, color: T.textFaint }}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: '4px !important' }}>
        {startError && <Problem title="The preview could not start" message={startError} />}

        {!startError && measuring && !gaveUp && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25, py: 5 }}>
            <CircularProgress size={28} sx={{ color: T.teal }} />
            <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, textAlign: 'center' }}>
              {status === 'running' ? 'Measuring what can be freed…' : 'Asking the Pi what can be cleaned…'}
            </Typography>
          </Box>
        )}

        {!startError && measuring && gaveUp && (
          <Problem
            title="No answer from the host"
            message={result?.message || 'The preview has not finished after three minutes. Check Recent actions below, or try again later.'}
          />
        )}

        {result && !measuring && status !== 'done' && (
          <Problem
            title={status === 'rejected' ? 'The host refused the preview' : 'The preview failed'}
            message={result.message || 'No reason given.'}
            output={result.output}
          />
        )}

        {preview && (
          <>
            <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, mb: 1.5 }}>
              Up to <Box component="b" sx={{ color: T.text }}>{formatKb(preview.totalKb)}</Box> can be freed.
              Pick what to clear; nothing is deleted until you apply.
            </Typography>
            <Box sx={{ border: `1px solid ${S.border}`, borderRadius: 2, overflow: 'hidden', bgcolor: S.inset }}>
              {preview.categories.length === 0 && (
                <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, p: 2, textAlign: 'center' }}>
                  The host found nothing to clean up.
                </Typography>
              )}
              {preview.categories.map((c, i) => (
                c.id === TEMP_CATEGORY
                  ? <TempCategory key={c.id} category={c} picked={tempPicked} onToggle={toggleTemp} onSetAll={setTempPicked} last={i === preview.categories.length - 1} />
                  : <CategoryRow key={c.id} category={c} checked={cats.includes(c.id)} onToggle={() => toggleCat(c.id)} last={i === preview.categories.length - 1} />
              ))}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        {preview && (
          <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, mr: 'auto', fontVariantNumeric: 'tabular-nums' }}>
            {args ? `Frees about ${formatKb(freeing)}` : 'Nothing picked'}
          </Typography>
        )}
        <Button onClick={onClose} disabled={applying} sx={{ color: T.textMuted, textTransform: 'none', fontWeight: 600 }}>
          {preview ? 'Cancel' : 'Close'}
        </Button>
        {preview && (
          <Button
            variant="contained" disabled={!args || applying} onClick={apply}
            startIcon={applying ? <CircularProgress size={14} color="inherit" /> : <CleaningServicesRounded sx={{ fontSize: 18 }} />}
            sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none', bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover, boxShadow: 'none' } }}
          >
            Clean up
          </Button>
        )}
      </DialogActions>
    </SheetDialog>
  );
}

/* ── Rows ────────────────────────────────────────────────────── */

function CategoryRow({ category, checked, onToggle, last }) {
  const T = useT();
  const S = adminSurface(T);
  const disabled = !category.selectable || Boolean(category.skipped) || category.kb <= 0;
  return (
    <Box
      component="label"
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1, px: 1.25, py: 1,
        borderBottom: last ? 'none' : `1px solid ${S.divider}`,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled && !category.skipped ? 0.6 : 1,
      }}
    >
      <Checkbox size="small" checked={checked && !disabled} disabled={disabled} onChange={onToggle} sx={{ p: 0.25, mt: -0.25 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: T.text }}>{category.label}</Typography>
        {category.skipped && <Skipped reason={category.skipped} />}
        {!category.selectable && !category.skipped && (
          <Typography sx={{ fontSize: '0.7rem', color: T.textFaint }}>Shown for information; this server cannot clear it yet.</Typography>
        )}
      </Box>
      <Size kb={category.kb} />
    </Box>
  );
}

function TempCategory({ category, picked, onToggle, onSetAll, last }) {
  const T = useT();
  const S = adminSurface(T);
  const [open, setOpen] = useState(true);
  const names = category.items.map((it) => it.name);
  const allPicked = names.length > 0 && names.every((n) => picked.includes(n));
  const blocked = Boolean(category.skipped);

  return (
    <Box sx={{ borderBottom: last ? 'none' : `1px solid ${S.divider}` }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 1.25, py: 1 }}>
        <IconButton size="small" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Show folders" sx={{ p: 0.25, color: T.textFaint }}>
          <ExpandMoreRounded sx={{ fontSize: 18, transition: 'transform .18s', transform: open ? 'rotate(180deg)' : 'none' }} />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: T.text }}>{category.label}</Typography>
          {blocked ? <Skipped reason={category.skipped} /> : (
            <Typography sx={{ fontSize: '0.7rem', color: T.textFaint }}>
              {names.length ? `${names.length} folder${names.length !== 1 ? 's' : ''}. Tick the ones to delete.` : 'Nothing old enough to clear.'}
            </Typography>
          )}
        </Box>
        <Size kb={category.kb} />
      </Box>

      {!blocked && names.length > 0 && (
        <Collapse in={open}>
          <Box sx={{ pb: 0.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1.25 }}>
              <Button size="small" onClick={() => onSetAll(allPicked ? [] : names)} sx={{ fontSize: '0.7rem', textTransform: 'none', color: T.teal, minHeight: 0, py: 0.25 }}>
                {allPicked ? 'Untick all' : 'Tick all'}
              </Button>
            </Box>
            {category.items.map((it) => (
              <Box
                key={it.name}
                component="label"
                sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 4.5, pr: 1.25, py: 0.5, cursor: 'pointer', '&:hover': { bgcolor: S.cardHover } }}
              >
                <Checkbox size="small" checked={picked.includes(it.name)} onChange={() => onToggle(it.name)} sx={{ p: 0.25 }} />
                <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: T.text, flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
                  {it.name}
                </Typography>
                {it.lastWritten && (
                  <Typography sx={{ fontSize: '0.68rem', color: T.textFaint, whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}>
                    last written {it.lastWritten}
                  </Typography>
                )}
                <Size kb={it.kb} small />
              </Box>
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

function Size({ kb, small = false }) {
  const T = useT();
  return (
    <Typography sx={{ fontSize: small ? '0.7rem' : '0.75rem', fontWeight: 700, color: kb > 0 ? T.text : T.textFaint, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', minWidth: 56, textAlign: 'right' }}>
      {formatKb(kb)}
    </Typography>
  );
}

function Skipped({ reason }) {
  const T = useT();
  return (
    <Typography sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', fontSize: '0.7rem', color: T.warning }}>
      <InfoOutlined sx={{ fontSize: 13, mt: 0.15 }} />
      Skipped: {reason}
    </Typography>
  );
}

function Problem({ title, message, output }) {
  const T = useT();
  const S = adminSurface(T);
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: T.errorBg, border: `1px solid ${T.error}33` }}>
      <Typography sx={{ display: 'flex', gap: 0.75, alignItems: 'center', fontSize: '0.82rem', fontWeight: 700, color: T.text }}>
        <ErrorOutlineRounded sx={{ fontSize: 17, color: T.error }} />
        {title}
      </Typography>
      <Typography sx={{ fontSize: '0.76rem', color: T.textMuted, mt: 0.5, wordBreak: 'break-word' }}>{message}</Typography>
      {output && (
        <Box component="pre" sx={{ m: 0, mt: 1, p: 1, maxHeight: 220, overflow: 'auto', borderRadius: 1.5, bgcolor: S.inset, border: `1px solid ${S.border}`, fontSize: '0.68rem', color: T.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {output}
        </Box>
      )}
    </Box>
  );
}
