import { Box, Typography } from '@mui/material';
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

function StageNode({ stage }) {
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
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: { xs: 78, sm: 96 }, flexShrink: 0, textAlign: 'center',
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
        {dateInfo?.dayMonth ?? '—'}
      </Typography>
      {dateInfo?.year && (
        <Typography sx={{ fontSize: 9, color: T.textFaint, whiteSpace: 'nowrap', lineHeight: 1.2 }}>
          {dateInfo.year}
        </Typography>
      )}
    </Box>
  );
}

/** Connector segment between two stage nodes — filled teal once the stage before it has
 * fully completed ('done'); still an outline while that stage is only 'current' (in
 * progress) or 'upcoming', so the line's fill always trails one step behind the active node. */
function Connector({ filled }) {
  const T = useT();
  return (
    <Box sx={{
      flex: '0 0 auto', width: { xs: 24, sm: 40 }, height: 2, mt: `${NODE_SIZE / 2 - 1}px`,
      bgcolor: filled ? T.teal : T.border, transition: 'background-color 0.2s',
    }} />
  );
}

/**
 * Horizontal stepper across the six IPO lifecycle stages (Open → Close → Allotment →
 * Refund → Demat → Listing), each shown as an icon node + label + date, joined by
 * connector lines whose fill reflects overall progress. Any stage whose date is null is
 * dropped by `buildTimelineStages` rather than rendered broken (renders nothing at all
 * if the IPO has no dates whatsoever).
 *
 * Responsive: the row scrolls horizontally past ~5 visible nodes instead of wrapping or
 * shrinking illegibly — this stays clean and readable even at a 360px viewport, unlike the
 * card list (where horizontal scroll would be the wrong call).
 */
export default function IpoTimeline({ ipo }) {
  const T = useT();
  const stages = buildTimelineStages(ipo);
  if (stages.length === 0) return null;

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
