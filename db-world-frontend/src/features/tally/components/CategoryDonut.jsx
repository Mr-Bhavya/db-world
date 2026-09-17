import { Box, Typography } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import { useT } from '@shared/theme';
import { formatMoney, formatMoneyCompact } from '../utils/tallyFormat';

/**
 * Where the money went, as a ring with the total standing in the hole.
 *
 * <p>A ring rather than a pie because the middle of a pie is its least useful area — every slice
 * is thinnest there — and putting the period's total in it turns dead space into the one figure
 * the slices are shares <em>of</em>.
 *
 * <p>Never shown on its own. It sits beside the ranked list, which carries the label, the amount
 * and the percentage for every row, so identity is never left to colour alone and the two
 * lightest hues are allowed to be lighter than a label would be. The ring answers "was it mostly
 * one thing"; the list answers "which thing, and how much".
 *
 * <p>No labels on the slices themselves. At this size a five-way split cannot hold five legible
 * captions, and the list is already printing them a few pixels to the right.
 */
export default function CategoryDonut({ slices = [], total, size = 180 }) {
  const T = useT();

  if (!slices.length) return null;

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0, mx: 'auto' }}>
      <PieChart
        width={size}
        height={size}
        hideLegend
        series={[{
          data: slices.map((slice) => ({
            id: slice.key,
            value: Number(slice.amount ?? 0),
            label: slice.label,
            color: slice.color,
          })),
          innerRadius: size * 0.3,
          outerRadius: size * 0.48,
          // A gap in the surface colour between neighbours, so two similar hues still read as
          // two slices rather than one band that changes colour halfway.
          paddingAngle: 2,
          cornerRadius: 4,
          highlightScope: { fade: 'global', highlight: 'item' },
          valueFormatter: (item) => formatMoney(item.value),
        }]}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      />

      {/* Sits over the hole rather than inside the chart's own layout, and takes no pointer
          events, so it never eats a hover meant for the slice underneath it. */}
      <Box sx={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        pointerEvents: 'none', textAlign: 'center',
      }}>
        <Box>
          <Typography sx={{
            fontSize: 16, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.4,
            lineHeight: 1.1,
          }}>
            {formatMoneyCompact(total)}
          </Typography>
          <Typography sx={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6,
            textTransform: 'uppercase', color: T.textFaint,
          }}>
            total
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
