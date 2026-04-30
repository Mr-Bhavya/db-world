import { Box, Typography, ButtonBase } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';

export default function FileBreadcrumb() {
  const T = useT();
  const { currentPath, navigate } = useFileManagerStore();

  const segments = currentPath === '/'
    ? []
    : currentPath.split('/').filter(Boolean);

  const getPathForIndex = (idx) =>
    idx < 0 ? '/' : '/' + segments.slice(0, idx + 1).join('/');

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.25,
      px: 1, py: 0.5, flexWrap: 'wrap', minHeight: 36,
    }}>
      <ButtonBase
        onClick={() => navigate('/')}
        sx={{
          borderRadius: 1, px: 0.75, py: 0.25,
          color: currentPath === '/' ? T.teal : T.textMuted,
          '&:hover': { bgcolor: T.hoverBg, color: T.teal },
          display: 'flex', alignItems: 'center', gap: 0.5,
        }}
      >
        <HomeIcon sx={{ fontSize: 16 }} />
        <Typography sx={{ fontSize: 13, fontWeight: currentPath === '/' ? 700 : 400 }}>
          Root
        </Typography>
      </ButtonBase>

      {segments.map((seg, idx) => (
        <Box key={getPathForIndex(idx)} sx={{ display: 'flex', alignItems: 'center' }}>
          <ChevronRightIcon sx={{ fontSize: 14, color: T.textFaint }} />
          <ButtonBase
            onClick={() => navigate(getPathForIndex(idx))}
            sx={{
              borderRadius: 1, px: 0.75, py: 0.25,
              color: idx === segments.length - 1 ? T.textPrimary : T.textMuted,
              '&:hover': { bgcolor: T.hoverBg, color: T.teal },
            }}
          >
            <Typography sx={{
              fontSize: 13,
              fontWeight: idx === segments.length - 1 ? 700 : 400,
              maxWidth: { xs: 80, sm: 160 },
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
