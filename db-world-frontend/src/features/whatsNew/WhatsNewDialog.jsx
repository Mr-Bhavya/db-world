import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Dialog, DialogActions, DialogContent, IconButton, Stack, Typography,
} from '@mui/material';
import { ArrowForwardRounded, CloseRounded } from '@mui/icons-material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { useT } from '@shared/theme';
import { pendingAnnouncements } from './announcements';
import { markSeen, useSeenFeatures } from './seenFeatures';

/**
 * First-run introduction to features this device has not been shown yet.
 *
 * <p>A stepped dialog rather than spotlights on the real controls: it renders the same on
 * the website and inside the Android WebView, and cannot break because the element it
 * wanted to point at is unmounted, scrolled away, or laid out differently on a phone.
 *
 * <p>Dismissing marks every announcement it covered as seen — including ones the reader
 * skipped past — so it never reappears and the matching "New" badges clear at the same
 * moment. Closing counts as seeing it: re-showing something the reader deliberately
 * dismissed is the behaviour that makes these things hated.
 */
export default function WhatsNewDialog() {
  const T = useT();
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { seen } = useSeenFeatures();

  // Frozen on mount. Marking things seen mutates `seen`, and without this the dialog
  // would empty itself mid-interaction as the user stepped through it.
  const [items] = useState(() => pendingAnnouncements(seen));
  const [open, setOpen] = useState(() => items.length > 0);
  const [index, setIndex] = useState(0);

  // One flat list of steps across every pending announcement, so "3 of 6" counts the
  // whole walkthrough rather than restarting per feature.
  const steps = useMemo(
    () => items.flatMap((item) => item.steps.map((step) => ({ ...step, item }))),
    [items],
  );

  if (!open || steps.length === 0) return null;

  const step = steps[index];
  const last = index === steps.length - 1;
  const { Icon, accent, label } = step.item;

  const finish = (destination) => {
    markSeen(items.map((i) => i.id));
    setOpen(false);
    if (destination) navigate(destination);
  };

  return (
    <Dialog
      open
      onClose={() => finish()}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: T.bg, backgroundImage: 'none', borderRadius: 3,
            border: `1px solid ${T.glassBorder}`,
          },
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1, color: T.textFaint }}>
          WHAT&rsquo;S NEW
        </Typography>
        <IconButton size="small" onClick={() => finish()} sx={{ color: T.textFaint }} aria-label="Close">
          <CloseRounded fontSize="small" />
        </IconButton>
      </Stack>

      <DialogContent sx={{ pt: 1, pb: 2, textAlign: 'center' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={reduce ? false : { opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -14 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Box sx={{
              width: 56, height: 56, mx: 'auto', mb: 1.5, borderRadius: 2.5,
              display: 'grid', placeItems: 'center',
              bgcolor: `${accent}22`, border: `1px solid ${accent}55`,
            }}>
              {Icon && <Icon sx={{ fontSize: 28, color: accent }} />}
            </Box>

            <Typography sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.6, color: accent, mb: 0.5 }}>
              {label.toUpperCase()}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: T.text, mb: 1 }}>
              {step.title}
            </Typography>
            <Typography sx={{ fontSize: 14, color: T.textMuted, lineHeight: 1.55 }}>
              {step.body}
            </Typography>
          </motion.div>
        </AnimatePresence>

        {steps.length > 1 && (
          <Stack direction="row" spacing={0.75} justifyContent="center" sx={{ mt: 2.5 }}>
            {steps.map((s, i) => (
              <Box
                key={`${s.item.id}-${i}`}
                onClick={() => setIndex(i)}
                sx={{
                  width: i === index ? 18 : 6, height: 6, borderRadius: 999, cursor: 'pointer',
                  bgcolor: i === index ? accent : T.glassBorder,
                  transition: 'width 0.2s ease, background-color 0.2s ease',
                }}
              />
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button onClick={() => finish()} sx={{ textTransform: 'none', color: T.textMuted }}>
          {last ? 'Close' : 'Skip'}
        </Button>
        <Box sx={{ flex: 1 }} />
        {last ? (
          <Button
            variant="contained"
            endIcon={<ArrowForwardRounded />}
            onClick={() => finish(step.item.route)}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: accent, '&:hover': { bgcolor: accent, filter: 'brightness(0.92)' } }}
          >
            {`Open ${label}`}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => setIndex((i) => i + 1)}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: accent, '&:hover': { bgcolor: accent, filter: 'brightness(0.92)' } }}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
