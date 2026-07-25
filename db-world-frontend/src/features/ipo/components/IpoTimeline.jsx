import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useT } from '@shared/theme';
import { buildTimelineStages, formatStageDate } from '../utils/format';

const NODE_SIZE = 36;

const STAGE_ICONS = {
  open: EventOutlinedIcon,
  close: HourglassBottomOutlinedIcon,
  allotment: AssignmentTurnedInOutlinedIcon,
  refund: PaymentsOutlinedIcon,
  demat: AccountBalanceOutlinedIcon,
  listing: TrendingUpIcon,
};

/** Short descriptor shown under each stage's date on desktop only — there's no room for
 * these on the compact mobile layout, which stays label+date only. */
const STAGE_DESCRIPTIONS = {
  open: 'Bidding opens',
  close: 'Bidding closes',
  allotment: 'Basis of allotment',
  refund: 'Refunds initiated',
  demat: 'Shares credited',
  listing: 'Lists on exchange',
};

/** `desktop` swaps this from a fixed-width node (mobile, inside the horizontally-scrolling
 * strip) to a flex-growing one that shares the full row evenly with its siblings, and adds
 * the stage's short descriptor line — everything else (state colors, TBA handling) is
 * identical between the two. */
function StageNode({ stage, desktop }) {
  const T = useT();
  const Icon = STAGE_ICONS[stage.key];
  const isDone = stage.status === 'done';
  const isCurrent = stage.status === 'current';
  const dateInfo = formatStageDate(stage.date);

  const circleBg = isDone ? T.teal : isCurrent ? T.tealBg : T.glass;
  const circleBorderColor = isDone || isCurrent ? T.teal : T.border;
  const iconColor = isDone ? '#fff' : isCurrent ? T.teal : T.textFaint;
  const labelColor = isDone || isCurrent ? T.textPrimary : T.textFaint;
  const dateColor = isCurrent ? T.teal : T.textFaint;

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      ...(desktop
        ? { flex: '1 1 0', minWidth: 0, px: 0.5 }
        : { width: { xs: 78, sm: 96 }, flexShrink: 0 }),
    }}>
      <Box sx={{
        width: NODE_SIZE, height: NODE_SIZE, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: circleBg, border: `2px solid ${circleBorderColor}`,
        boxShadow: isCurrent ? `0 0 0 4px ${T.tealBg}` : 'none',
      }}>
        {isDone
          ? <CheckRoundedIcon sx={{ fontSize: 18, color: iconColor }} />
          : Icon
            ? <Icon sx={{ fontSize: 17, color: iconColor }} />
            : null}
      </Box>
      <Typography sx={{ fontSize: 11, fontWeight: 800, color: labelColor, mt: 0.75, whiteSpace: 'nowrap' }}>
        {stage.label}
      </Typography>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: dateColor, whiteSpace: 'nowrap', lineHeight: 1.3 }}>
        {dateInfo?.dayMonth ?? 'TBA'}
      </Typography>
      {dateInfo?.year && (
        <Typography sx={{ fontSize: 9, color: T.textFaint, whiteSpace: 'nowrap', lineHeight: 1.2 }}>
          {dateInfo.year}
        </Typography>
      )}
      {desktop && (
        <Typography sx={{ fontSize: 10, color: T.textFaint, mt: 0.5, lineHeight: 1.3, maxWidth: 140 }}>
          {STAGE_DESCRIPTIONS[stage.key]}
        </Typography>
      )}
    </Box>
  );
}

/** Connector segment between two stage nodes — filled teal once the stage before it has
 * fully completed ('done'); still an outline while that stage is only 'current' (in
 * progress) or 'upcoming', so the line's fill always trails one step behind the active node.
 * On desktop it grows to fill the gap between nodes (full-width row, no scroll); on mobile
 * it's a fixed short segment inside the horizontally-scrolling strip. */
function Connector({ filled, desktop }) {
  const T = useT();
  return (
    <Box sx={{
      height: 2, mt: `${NODE_SIZE / 2 - 1}px`,
      bgcolor: filled ? T.teal : T.border, transition: 'background-color 0.2s',
      ...(desktop ? { flex: '1 1 auto', minWidth: 16 } : { flex: '0 0 auto', width: { xs: 24, sm: 40 } }),
    }} />
  );
}

/**
 * Horizontal stepper across all six IPO lifecycle stages (Open → Close → Allotment →
 * Refund → Demat → Listing) — `buildTimelineStages` always returns all six, in order,
 * even when some dates aren't known yet (those render with a muted "TBA" date and an
 * upcoming/pending treatment), so an open or upcoming IPO's timeline always shows the
 * full journey ahead rather than stopping at whatever's already happened. Each stage is
 * shown as an icon node + label + date, joined by connector lines whose fill reflects
 * overall progress (filled up to the current stage, muted after).
 *
 * Responsive, via two distinct layouts (not just CSS tweaks on one shared tree — the flex
 * distribution and scroll behavior genuinely differ):
 *   - Desktop (md+): a full-width row, stages evenly distributed and connectors stretching
 *     to fill the gaps between them, plus a short descriptor line under each stage's date.
 *     No horizontal scroll — everything fits the row.
 *   - Mobile/tablet: unchanged from before — a compact, fixed-width, horizontally-scrolling
 *     strip past ~5 visible nodes, no descriptor line (no room for it).
 */
export default function IpoTimeline({ ipo }) {
  const T = useT();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const stages = buildTimelineStages(ipo);
  if (stages.length === 0) return null;

  if (isDesktop) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', pt: 0.25, pb: 0.5 }}>
        {stages.map((stage, i) => (
          <Box key={stage.key} sx={{ display: 'contents' }}>
            {i > 0 && <Connector filled={stages[i - 1].status === 'done'} desktop />}
            <StageNode stage={stage} desktop />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{
      overflowX: 'auto', overflowY: 'hidden', pb: 0.5, pt: 0.25,
      scrollSnapType: 'x proximity',
      '&::-webkit-scrollbar': { height: 5 },
      '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 999 },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content', px: 0.5 }}>
        {stages.map((stage, i) => (
          <Box key={stage.key} sx={{ display: 'flex', alignItems: 'flex-start', scrollSnapAlign: 'start' }}>
            {i > 0 && <Connector filled={stages[i - 1].status === 'done'} />}
            <StageNode stage={stage} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
