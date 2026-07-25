import { Box, Typography } from '@mui/material';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useT } from '@shared/theme';
import SectionCard from './SectionCard';

/**
 * The five steps, in order. Deliberately spells out — in step 3 — that there IS a CAPTCHA
 * and this app never fills it in, and — in step 5 — that recording the result is optional
 * and separate from checking it, so nobody mistakes "save your application" for "we'll
 * check it for you". Icons are reused from elsewhere in the feature where the same idea
 * already has one (the registrar-link icon from `GuidedCheckButton`, the "my application"
 * icon from `AllotmentTab`'s form, the Save icon from its submit button) for cohesion.
 */
const STEPS = [
  {
    icon: EventAvailableOutlinedIcon,
    title: 'Wait for the allotment date',
    desc: 'Registrars only publish allotment status on or after the date shown on the IPO’s timeline.',
  },
  {
    icon: OpenInNewIcon,
    title: 'Tap "Check allotment status"',
    desc: 'Opens the registrar’s (or BSE’s) official allotment page for this IPO in a new tab.',
  },
  {
    icon: AssignmentIndOutlinedIcon,
    title: 'Enter your PAN or application number',
    desc: 'Fill in the requested detail and solve the CAPTCHA on their page — that step happens on the registrar’s site, not here.',
  },
  {
    icon: FactCheckOutlinedIcon,
    title: 'See whether shares were allotted',
    desc: 'The registrar’s page shows your result directly — allotted, or not this time.',
  },
  {
    icon: SaveOutlinedIcon,
    title: 'Optionally, record the result here',
    desc: 'Save it under "My Application" below so it’s on file next to your other saved details.',
  },
];

/** One connected step: an icon-badge node + a vertical connector to the next step (last
 * step has none), and a title/description pair. Owns its own `useT()`. */
function StepRow({ step, index, isLast }) {
  const T = useT();
  const Icon = step.icon;
  return (
    <Box sx={{ display: 'flex', gap: 1.25 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <Box sx={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: T.tealBg, border: `1px solid ${T.teal}55`,
        }}>
          <Icon sx={{ fontSize: 15, color: T.teal }} />
        </Box>
        {!isLast && <Box sx={{ width: 2, flex: 1, minHeight: 20, bgcolor: T.border, my: 0.5 }} />}
      </Box>
      <Box sx={{ minWidth: 0, pb: isLast ? 0 : 2 }}>
        <Typography sx={{ fontSize: 10, color: T.textFaint, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Step {index + 1}
        </Typography>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: T.textPrimary, mt: 0.15 }}>
          {step.title}
        </Typography>
        <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25, lineHeight: 1.55 }}>
          {step.desc}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * "How to check allotment" — a short, numbered, icon-led guide, reusable anywhere in the
 * Allotment flow (currently `AllotmentTab`). Purely presentational/static: no props, no
 * data dependency, so it can drop into any IPO's Allotment tab unchanged.
 */
export default function AllotmentGuide() {
  const T = useT();
  return (
    <SectionCard
      title="How to check allotment"
      icon={<AssignmentTurnedInOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {STEPS.map((step, i) => (
          <StepRow key={step.title} step={step} index={i} isLast={i === STEPS.length - 1} />
        ))}
      </Box>
    </SectionCard>
  );
}
