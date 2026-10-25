import React, { memo, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Box, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { CheckCircleRounded, ContentCopyRounded, Visibility, VisibilityOff } from '@mui/icons-material';
import { useT } from '@shared/theme';
import { isSecretField, linkTarget } from './entryUtils';
import { iconButtonSx } from './vaultShared';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const COLLAPSED_LINES = 3;

// useLayoutEffect warns when rendered on a server, where there is nothing to measure anyway.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * One custom field on a credential card, shown the way its type asks for:
 * HIDDEN masked, TEXT plain, URL a link, MULTILINE a masked block that collapses to three lines.
 * Every type has a copy button. onCopy(value, copyKey) does the copying; copied says it just happened.
 * Pass a stable onCopy and field (and a copyKey to tell fields apart) so memo can skip re-renders.
 */
const FieldValue = memo(({ field, onCopy, copyKey, copied = false }) => {
  const T = useT();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);   // measured: the collapsed block hides lines
  const boxRef = useRef(null);
  const boxId = useId();

  const value = field.fieldValue == null ? '' : String(field.fieldValue);
  const type = field.fieldType ?? 'HIDDEN';
  const masked = isSecretField(field) && !visible;
  const multiline = type === 'MULTILINE' && !masked;

  // A long line wraps to many visual lines, so counting characters and newlines is only a guess:
  // when the collapsed block can be measured, ask it whether it is cutting something off.
  useIsoLayoutEffect(() => {
    const el = boxRef.current;
    if (!multiline || expanded || !el) return undefined;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [multiline, expanded, value]);

  if (!value.trim()) return null;

  const label = field.fieldKey || 'Custom';
  const href = type === 'URL' ? linkTarget(value) : null;
  // The measurement wins; the count is for when nothing can be measured (first paint, no layout).
  const longValue = type === 'MULTILINE' && (overflows || value.split('\n').length > COLLAPSED_LINES || value.length > 240);

  const valueSx = {
    flex: '1 1 140px', minWidth: 0, color: T.textMuted,
    fontFamily: type === 'MULTILINE' ? MONO : undefined,
    fontSize: { xs: '0.78rem', sm: '0.82rem' }, lineHeight: 1.45,
    overflowWrap: 'anywhere', wordBreak: 'break-word',
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: { xs: 0.75, sm: 1 }, rowGap: 0.35, py: 0.38, minWidth: 0 }}>
      <Typography
        sx={{
          flex: { xs: '1 1 92px', sm: '0 0 92px', md: '0 0 104px' }, maxWidth: { xs: '100%', sm: 104 },
          color: T.textMuted, fontSize: { xs: '0.7rem', sm: '0.72rem' }, lineHeight: 1.25, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: 0.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}
        title={label}
      >
        {label}
      </Typography>

      {multiline ? (
        <Box sx={valueSx}>
          <Box
            component="pre" id={boxId} ref={boxRef}
            sx={{
              m: 0, p: 0.9, borderRadius: 1.5, whiteSpace: 'pre-wrap', fontFamily: MONO, fontSize: 'inherit', lineHeight: 'inherit',
              bgcolor: T.bg === '#000000' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)',
              ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: COLLAPSED_LINES, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
            }}
          >
            {value}
          </Box>
          {longValue && (
            <Link
              component="button" type="button" underline="hover" onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded} aria-controls={boxId}
              sx={{ mt: 0.4, fontSize: '0.72rem', fontWeight: 700, color: T.teal }}
            >
              {expanded ? 'Show less' : 'Show all'}
            </Link>
          )}
        </Box>
      ) : href ? (
        <Typography component="span" sx={valueSx}>
          <Link href={href} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ color: T.teal }}>{value}</Link>
        </Typography>
      ) : (
        <Typography sx={{ ...valueSx, fontFamily: masked ? MONO : valueSx.fontFamily, letterSpacing: masked ? { xs: 1.1, sm: 1.4 } : 0 }}>
          {masked ? '••••••' : value}
        </Typography>
      )}

      {isSecretField(field) && (
        <Tooltip title={visible ? `Hide ${label}` : `Show ${label}`}>
          <IconButton size="small" onClick={() => setVisible((v) => !v)} sx={iconButtonSx(T, T.teal)} aria-label={visible ? `Hide ${label}` : `Show ${label}`}>
            {visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={copied ? 'Copied!' : `Copy ${label}`}>
        <IconButton
          size="small" onClick={() => onCopy(value, copyKey)} aria-label={`Copy ${label}`}
          sx={{ ...iconButtonSx(T, copied ? '#22c55e' : T.teal), color: copied ? '#22c55e' : T.textMuted }}
        >
          {copied ? <CheckCircleRounded fontSize="small" /> : <ContentCopyRounded fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  );
});
FieldValue.displayName = 'FieldValue';

export default FieldValue;
