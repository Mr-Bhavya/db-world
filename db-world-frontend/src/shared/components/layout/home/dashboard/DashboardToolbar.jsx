import React from 'react';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import {
  Add as AddIcon,
  Check as DoneIcon,
  RestartAlt as ResetIcon,
  Tune as CustomiseIcon,
} from '@mui/icons-material';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { useT } from '@shared/theme';

/**
 * Enter/leave edit mode, reset the layout, and — while editing — put back anything hidden.
 *
 * The tray only exists in edit mode: a permanent "add a widget" row would be clutter for the
 * overwhelming majority of visits, which never customise anything.
 */
export default function DashboardToolbar({
  editing,
  onToggleEditing,
  available,
  onShow,
  onReset,
  isCustomised,
}) {
  const T = useT();
  const prefersReducedMotion = useReducedMotion();

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {editing && isCustomised && (
          <Tooltip title="Restore the default arrangement">
            <Button
              onClick={onReset}
              startIcon={<ResetIcon sx={{ fontSize: 18 }} />}
              sx={{
                color: T.textMuted,
                borderRadius: 2,
                px: 1.75,
                height: 46,
                fontSize: '0.82rem',
                fontWeight: 800,
                textTransform: 'none',
                '&:hover': { color: T.error, bgcolor: T.errorBg },
              }}
            >
              Reset
            </Button>
          </Tooltip>
        )}

        <Button
          onClick={onToggleEditing}
          variant={editing ? 'contained' : 'outlined'}
          startIcon={
            editing ? <DoneIcon sx={{ fontSize: 18 }} /> : <CustomiseIcon sx={{ fontSize: 18 }} />
          }
          aria-pressed={editing}
          sx={{
            borderRadius: 2,
            px: 2.2,
            // Same height as the sign-in pair it shares the band with.
            height: 46,
            fontSize: '0.85rem',
            fontWeight: 850,
            textTransform: 'none',
            whiteSpace: 'nowrap',
            ...(editing
              ? {
                  bgcolor: T.teal,
                  color: '#fff',
                  '&:hover': { bgcolor: T.tealHover },
                }
              : {
                  borderColor: T.borderHover,
                  color: T.textMuted,
                  '&:hover': { borderColor: T.teal, color: T.teal, bgcolor: T.tealBg },
                }),
          }}
        >
          {editing ? 'Done' : 'Customise'}
        </Button>
      </Box>

      <AnimatePresence initial={false}>
        {editing && available.length > 0 && (
          <Box
            component={motion.div}
            initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0 }}
            sx={{ overflow: 'hidden', width: '100%' }}
          >
            <Box sx={{ pt: 1.5, minWidth: 0 }}>
              <Typography
                sx={{
                  color: T.textMuted,
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  mb: 0.85,
                }}
              >
                Add back
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {available.map((widget) => {
                  const WidgetIcon = widget.Icon;

                  return (
                    <Box
                      key={widget.id}
                      component="button"
                      type="button"
                      onClick={() => onShow(widget.id)}
                      aria-label={`Add the ${widget.label} widget back to the dashboard`}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.6,
                        px: 1.1,
                        py: 0.6,
                        borderRadius: 1.8,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        color: T.textMuted,
                        bgcolor: T.glass,
                        border: `1px dashed ${T.glassBorder}`,
                        transition: 'color 0.2s ease, border-color 0.2s ease',
                        '&:hover': { color: widget.accent, borderColor: `${widget.accent}88` },
                        '&:focus-visible': { outline: `2px solid ${widget.accent}`, outlineOffset: 2 },
                      }}
                    >
                      <AddIcon sx={{ fontSize: 15 }} />
                      {WidgetIcon && <WidgetIcon sx={{ fontSize: 15, color: widget.accent }} />}
                      {widget.label}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        )}
      </AnimatePresence>
    </Box>
  );
}
