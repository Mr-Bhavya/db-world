import { Box, Typography } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { useT } from '@shared/theme';

/**
 * The four value props, in display order. Icons deliberately reuse the same ones the
 * GMP tab (`ShowChartRoundedIcon`) and Allotment tab (`FactCheckOutlinedIcon`) already
 * use elsewhere in the feature, so a value prop and the surface it's describing read as
 * the same thing rather than two different icon languages.
 */
const VALUE_PROPS = [
  {
    icon: DashboardCustomizeOutlinedIcon,
    title: 'Everything in one place',
    desc: 'Upcoming, open and listed IPOs — dates, GMP and subscription, together.',
  },
  {
    icon: ShowChartRoundedIcon,
    title: 'Latest GMP & subscription',
    desc: 'Grey-market premium and demand, tracked and updated.',
  },
  {
    icon: FactCheckOutlinedIcon,
    title: 'Allotment made simple',
    desc: 'Save your application details and check your status in a tap.',
  },
  {
    icon: BoltRoundedIcon,
    title: 'Free & fast',
    desc: 'No paywalls, no clutter — just the IPO info you need.',
  },
];

/** One value-prop tile — icon-in-a-tinted-circle over a bold title and a one-line
 * description, matching the icon-badge motif used across the feature (`OverviewTab`'s
 * FactTile, `StrengthsRisks`, `IpoHero`'s stat chips). Owns its own `useT()`. */
function ValuePropCard({ icon: Icon, title, desc }) {
  const T = useT();
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0,
      p: 1.75, borderRadius: 3, bgcolor: T.glass, border: `1px solid ${T.border}`,
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: 2, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: T.tealBg,
      }}>
        <Icon sx={{ fontSize: 18, color: T.teal }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: T.textPrimary }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 12, color: T.textMuted, lineHeight: 1.55, mt: 0.25 }}>
          {desc}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * "Why use this" — a slim value-props section near the bottom of the list page, below
 * the IPO cards. Consumer-facing pitch for why someone would pick this over a competitor
 * (or a spreadsheet): everything in one place, live data, a simple allotment flow, and
 * no login wall. Purely presentational/static — no data dependency, so it renders
 * identically regardless of the list's loading state above it.
 */
export default function WhyUseThis() {
  const T = useT();
  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
        <AutoAwesomeRoundedIcon sx={{ fontSize: 15, color: T.teal }} />
        <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
          Why IPO Radar
        </Typography>
      </Box>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        gap: 1.5,
      }}>
        {VALUE_PROPS.map((prop) => (
          <ValuePropCard key={prop.title} icon={prop.icon} title={prop.title} desc={prop.desc} />
        ))}
      </Box>
    </Box>
  );
}
