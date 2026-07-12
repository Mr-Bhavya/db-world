import { Box, Typography, ButtonBase, Skeleton } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StorageIcon from '@mui/icons-material/Storage';
import { useT } from '@shared/theme';
import { useFileManagerStore } from '../store/useFileManagerStore';
import { useLocations } from '../hooks/useLocations';

/** Splits the current path into clickable segments; the root chip is the active location's label. */
export default function Breadcrumb() {
  const T = useT();
  const locationId = useFileManagerStore((s) => s.locationId);
  const path = useFileManagerStore((s) => s.path);
  const navigate = useFileManagerStore((s) => s.navigate);
  const { data: locations = [] } = useLocations();
  const activeLocation = locations.find((l) => l.id === locationId);

  const segments = path === '/' ? [] : path.split('/').filter(Boolean);
  const pathForIndex = (idx) => (idx < 0 ? '/' : '/' + segments.slice(0, idx + 1).join('/'));

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.25,
      px: 1, py: 0.75, flexWrap: 'wrap', minHeight: 36,
    }}>
      <ButtonBase
        onClick={() => navigate('/')}
        sx={{
          borderRadius: 1, px: 0.75, py: 0.25, gap: 0.5,
          display: 'flex', alignItems: 'center',
          color: path === '/' ? T.teal : T.textMuted,
          '&:hover': { bgcolor: T.hoverBg, color: T.teal },
        }}
      >
        <StorageIcon sx={{ fontSize: 15 }} />
        <Typography sx={{ fontSize: 13, fontWeight: path === '/' ? 700 : 500 }}>
          {activeLocation ? activeLocation.label : <Skeleton width={60} sx={{ bgcolor: T.glass }} />}
        </Typography>
      </ButtonBase>

      {segments.map((seg, idx) => (
        <Box key={pathForIndex(idx)} sx={{ display: 'flex', alignItems: 'center' }}>
          <ChevronRightIcon sx={{ fontSize: 14, color: T.textFaint }} />
          <ButtonBase
            onClick={() => navigate(pathForIndex(idx))}
            sx={{
              borderRadius: 1, px: 0.75, py: 0.25,
              color: idx === segments.length - 1 ? T.textPrimary : T.textMuted,
              '&:hover': { bgcolor: T.hoverBg, color: T.teal },
            }}
          >
            <Typography sx={{
              fontSize: 13,
              fontWeight: idx === segments.length - 1 ? 700 : 400,
              maxWidth: { xs: 90, sm: 180 },
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {seg}
            </Typography>
          </ButtonBase>
        </Box>
      ))}
    </Box>
  );
}
