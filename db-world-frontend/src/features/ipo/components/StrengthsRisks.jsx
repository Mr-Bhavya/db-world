import { Box, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import { useT } from '@shared/theme';
import SectionCard from './SectionCard';

/** Tone lookup shared by the bullet row and the column heading — 'strength' reads
 * success/teal (a plus/check), 'risk' reads amber/warning (an alert) — kept in one place
 * so the icon and its tint can never drift apart. */
const KIND_META = {
  strength: { Icon: CheckCircleOutlineIcon },
  risk: { Icon: WarningAmberOutlinedIcon },
};

const toneOf = (T, kind) => (kind === 'strength' ? T.success : T.warning);
const toneBgOf = (T, kind) => (kind === 'strength' ? T.successBg : T.warningBg);

/** One bullet — a small tinted icon chip + the point text. Owns its own `useT()` per the
 * project convention rather than threading raw colors down as props. */
function BulletRow({ text, kind }) {
  const T = useT();
  const { Icon } = KIND_META[kind];
  const color = toneOf(T, kind);
  const bg = toneBgOf(T, kind);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Box sx={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: bg,
      }}>
        <Icon sx={{ fontSize: 13, color }} />
      </Box>
      <Typography sx={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6 }}>{text}</Typography>
    </Box>
  );
}

/** One side of the section (Strengths or Risks) — a tinted heading over its bullet list. */
function StrengthsRisksColumn({ kind, title, items }) {
  const T = useT();
  const color = toneOf(T, kind);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{
        fontSize: 11, color, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 800, mb: 1.25,
      }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {items.map((text, i) => <BulletRow key={i} text={text} kind={kind} />)}
      </Box>
    </Box>
  );
}

/**
 * "Strengths & Risks" detail-page section, from `ipo.strengths[]` / `ipo.risks[]` (added
 * alongside the other prospectus-style detail fields). Renders nothing when both lists are
 * empty, and collapses to a single column when only one side has content — never an empty
 * "Risks" heading with nothing under it. Two columns on desktop, stacked on mobile.
 */
export default function StrengthsRisks({ ipo }) {
  const T = useT();
  const strengths = ipo?.strengths ?? [];
  const risks = ipo?.risks ?? [];
  const hasStrengths = strengths.length > 0;
  const hasRisks = risks.length > 0;
  if (!hasStrengths && !hasRisks) return null;
  const bothPresent = hasStrengths && hasRisks;
  // Title reflects what's actually present, so a source that only lists strengths (e.g.
  // Chittorgarh, which has no risks section) doesn't show a "& Risks" that never appears.
  const title = bothPresent ? 'Strengths & Risks' : hasStrengths ? 'Strengths' : 'Risks';

  return (
    <SectionCard title={title} icon={<BalanceOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: bothPresent ? '1fr 1fr' : '1fr' },
        gap: { xs: 2, md: 3 },
      }}>
        {hasStrengths && <StrengthsRisksColumn kind="strength" title="Strengths" items={strengths} />}
        {hasRisks && <StrengthsRisksColumn kind="risk" title="Risks" items={risks} />}
      </Box>
    </SectionCard>
  );
}
