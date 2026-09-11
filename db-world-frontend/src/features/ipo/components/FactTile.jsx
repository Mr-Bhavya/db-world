import { Box, Typography } from '@mui/material';
import { useT } from '@shared/theme';

/**
 * One compact stat tile — icon + label + value. Shared by the Overview tab's key facts, the About
 * and Issue-details grids, and the GMP tab's grey-market read, so every labelled fact on the
 * detail page has exactly one implementation.
 *
 * It deliberately has NO fallback for a missing value: the caller decides whether a fact exists
 * and simply doesn't build the tile if it doesn't. Printing an em dash kept grids from reflowing,
 * but the cost was a grid where a third of the cells could be holes on an upcoming IPO — the same
 * problem the list cards had before they became stage-driven, and the same fix.
 *
 * Labels sit at `textMuted` rather than `textFaint`: at 10.5px the fainter token clears 4.5:1 on
 * neither theme. Values wrap to at most two lines — `noWrap` lost the tail of a long fact (a
 * registrar like "MUFG Intime India Private Limited"), and free wrapping took "Skyline Financial
 * Services Private Limited" to five lines in a 113px column.
 */
export default function FactTile({ icon: Icon, label, value, valueColor }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
      <Box sx={{
        width: 30, height: 30, borderRadius: 2, flexShrink: 0, mt: 0.1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: T.tealBg,
      }}>
        <Icon sx={{ fontSize: 16, color: T.teal }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{
          fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: 0.4, fontWeight: 700, lineHeight: 1.4,
        }}>
          {label}
        </Typography>
        <Typography sx={{
          fontSize: 14, fontWeight: 800, color: valueColor ?? T.textPrimary, mt: 0.15,
          lineHeight: 1.35, wordBreak: 'break-word',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * The grid every fact list sits in. Tracks follow the available width rather than guessed
 * breakpoints, so the same grid stays even whether it holds three facts or eleven, and whether
 * it's full-width or in one half of the Overview's two-column split.
 *
 * The 150px floor is measured against the narrowest case: at 360px the tab's content box is
 * ~300px, and `n*150 + (n-1)*16 <= 300` gives two tracks. `min(100%, …)` keeps a track from ever
 * exceeding its container, which a bare `150px` can't promise once a long unbreakable value is
 * involved.
 */
export function FactGrid({ facts }) {
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))',
      gap: 2,
    }}>
      {facts.map((f) => (
        <FactTile key={f.key ?? f.label} icon={f.icon} label={f.label} value={f.value} valueColor={f.valueColor} />
      ))}
    </Box>
  );
}
