import { useState } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useT } from '@shared/theme';

/**
 * Shared glass-card section shell used across the detail page's four tabs.
 *
 * Deliberately owns NO outer margin — every tab lays its sections out in a flex column (or, on a
 * wide screen, two of them) and supplies the gap itself. A baked-in `mb` fought both of those and
 * left a stray gap under the last card in each column.
 *
 * `subtitle` carries the one line of context a section needs — a source attribution, an "as of"
 * timestamp, a definition — without spending a full paragraph inside the body. `collapsible` turns
 * the whole header into a disclosure button, for sections that are reference material you read
 * once rather than data you scan every visit.
 */
export default function SectionCard({
  title, icon, subtitle, collapsible = false, defaultOpen = true, children,
}) {
  const T = useT();
  const [open, setOpen] = useState(defaultOpen);

  const header = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, width: '100%' }}>
      {icon}
      <Box sx={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
        <Typography sx={{
          fontSize: 11, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: 0.5, fontWeight: 700,
        }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: 11.5, color: T.textFaint, mt: 0.25, lineHeight: 1.45 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {collapsible && (
        <ExpandMoreRoundedIcon sx={{
          fontSize: 20, color: T.textMuted, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease',
        }} />
      )}
    </Box>
  );

  return (
    <Box sx={{
      bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 3, p: { xs: 1.5, sm: 2 },
      minWidth: 0,
    }}>
      {collapsible ? (
        <Box
          component="button"
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          sx={{
            display: 'flex', width: '100%', p: 0, border: 'none', background: 'none',
            cursor: 'pointer', fontFamily: 'inherit', mb: open ? 1.25 : 0,
            transition: 'margin 0.2s ease',
          }}
        >
          {header}
        </Box>
      ) : (
        <Box sx={{ mb: 1.25 }}>{header}</Box>
      )}
      {collapsible ? <Collapse in={open} unmountOnExit>{children}</Collapse> : children}
    </Box>
  );
}

/**
 * Vertical stack of `SectionCard`s with a single consistent gap. Every tab uses this rather than
 * each card carrying its own bottom margin, so a card can be moved between tabs — or into the
 * Overview's two-column split — without its spacing coming along and being wrong there.
 */
export function SectionStack({ children, ...rest }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }} {...rest}>
      {children}
    </Box>
  );
}
