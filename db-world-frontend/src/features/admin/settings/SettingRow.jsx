import React from 'react';
import { Box, Typography, Switch, TextField, Chip, Tooltip, IconButton } from '@mui/material';
import { RestartAltRounded, UndoRounded } from '@mui/icons-material';
import { useT } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { asBool, asText, clampNumeric, isBoolean, isModified, isNumeric } from './settingsUtils';

/**
 * One editable setting.
 *
 * Laid out with CSS Grid rather than flex, and the text column is `minmax(0, 1fr)`
 * so it can shrink without overflowing. The previous row was flex with a 220px
 * control marked `flexShrink: 0`, which meant the label column absorbed every
 * pixel of shortfall — inside a 400px masonry column that left it near zero, and
 * `wordBreak: 'break-word'` then shattered `ipo.sources.enabled` one character per
 * line. Nothing here is allowed to wrap character-by-character again: the metadata
 * line ellipsises and puts its full text in a tooltip.
 */
export default function SettingRow({ s, draft, dirty, onDraft, onRevert, onReset, busy, last }) {
  const T = useT();
  const S = adminSurface(T);

  const bool = isBoolean(s);
  const numeric = isNumeric(s);
  const value = draft !== undefined ? draft : asText(s.value);
  const changedFromDefault = isModified(s);

  const meta = `${s.key} · default ${asText(s.defaultValue) || '—'}`
    + (s.updatedBy ? ` · last by ${s.updatedBy}` : '');

  return (
    <Box sx={{
      position: 'relative',
      py: 1.6,
      px: { xs: 1.5, sm: 2 },
      borderBottom: last ? 'none' : `1px solid ${S.divider}`,
      // An unsaved row carries a teal edge, so a page of drafts is scannable before
      // you commit them.
      boxShadow: dirty ? `inset 3px 0 0 ${T.teal}` : 'none',
      bgcolor: dirty ? S.cardHover : 'transparent',
      transition: 'background-color 140ms ease',
      '&:hover .setting-meta': { opacity: 1 },
    }}>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
        alignItems: { xs: 'stretch', sm: 'center' },
        columnGap: 2,
        rowGap: 1.25,
      }}>
        {/* ── Label, description, metadata ───────────────────────────────── */}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: T.text }}>
              {s.label}
            </Typography>
            {s.requiresRestart && (
              <Tooltip title="Takes effect only after the backend restarts">
                <Chip label="restart required" size="small" sx={{
                  height: 18, fontSize: '0.6rem', fontWeight: 700,
                  bgcolor: T.warningBg, color: T.warning,
                }} />
              </Tooltip>
            )}
            {changedFromDefault && !dirty && (
              <Tooltip title={`Default is ${asText(s.defaultValue) || '—'}`}>
                <Chip label="changed" size="small" sx={{
                  height: 18, fontSize: '0.6rem', fontWeight: 700,
                  bgcolor: S.inset, color: T.teal,
                }} />
              </Tooltip>
            )}
            {dirty && (
              <Chip label="unsaved" size="small" sx={{
                height: 18, fontSize: '0.6rem', fontWeight: 700,
                bgcolor: T.teal, color: '#fff',
              }} />
            )}
          </Box>

          {s.description && (
            <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, mt: 0.4, lineHeight: 1.5 }}>
              {s.description}
            </Typography>
          )}

          {/* One line, always. Ellipsis rather than wrapping is what makes this row
              immune to a narrow container, however narrow it gets. */}
          <Tooltip title={meta} placement="bottom-start">
            <Typography
              className="setting-meta"
              noWrap
              sx={{
                mt: 0.5, fontSize: '0.66rem', color: T.textFaint,
                fontFamily: 'monospace', maxWidth: '100%',
                opacity: { xs: 1, md: 0.55 },
                transition: 'opacity 140ms ease',
              }}
            >
              {meta}
            </Typography>
          </Tooltip>
        </Box>

        {/* ── Control ────────────────────────────────────────────────────── */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          justifySelf: { xs: 'stretch', sm: 'end' },
          minWidth: 0,
        }}>
          {bool ? (
            <Switch
              checked={asBool(value)}
              disabled={busy}
              onChange={(e) => onDraft(s.key, e.target.checked ? 'true' : 'false')}
            />
          ) : (
            <TextField
              size="small"
              type={numeric ? 'number' : 'text'}
              value={value}
              disabled={busy}
              onChange={(e) => onDraft(s.key, e.target.value)}
              onBlur={(e) => onDraft(s.key, clampNumeric(s, e.target.value))}
              inputProps={numeric ? { min: s.minValue ?? undefined, max: s.maxValue ?? undefined } : {}}
              sx={{
                flex: { xs: 1, sm: 'unset' },
                width: { sm: numeric ? 140 : 260 },
                maxWidth: '100%',
              }}
            />
          )}

          <Tooltip title={dirty ? 'Discard this change' : 'No unsaved change'}>
            <span>
              <IconButton
                size="small"
                disabled={!dirty || busy}
                onClick={() => onRevert(s.key)}
                sx={{ color: T.textMuted }}
              >
                <UndoRounded sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={changedFromDefault ? 'Reset to default' : 'Already at default'}>
            <span>
              <IconButton
                size="small"
                disabled={!changedFromDefault || busy}
                onClick={() => onReset(s.key)}
                sx={{ color: T.textMuted }}
              >
                <RestartAltRounded sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
