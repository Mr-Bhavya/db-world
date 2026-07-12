import { useEffect, useState } from 'react';
import {
  Box, IconButton, Tooltip, Typography, Select, MenuItem,
  CircularProgress, useMediaQuery, useTheme,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StorageIcon from '@mui/icons-material/Storage';
import { useT } from '@shared/theme';
import { useLocations } from '../hooks/useLocations';
import { useFileManagerStore } from '../store/useFileManagerStore';
import FolderTree from './FolderTree';

const RAIL_WIDTH = 232;
const RAIL_WIDTH_COLLAPSED = 52;

/**
 * Left rail: location switcher + lazy folder tree for the active location.
 * Collapses to an icon strip on desktop; replaced entirely by a compact
 * location Select on mobile (the folder tree itself is desktop-only —
 * mobile navigation happens via the Breadcrumb instead).
 */
export default function LocationsRail({ onManageLocations, onDropItems }) {
  const T = useT();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { data: locations = [], isLoading } = useLocations();
  const locationId = useFileManagerStore((s) => s.locationId);
  const setLocation = useFileManagerStore((s) => s.setLocation);
  const [collapsed, setCollapsed] = useState(false);

  // Auto-select the first location once the list loads, if nothing is active yet.
  useEffect(() => {
    if (!locationId && locations.length > 0) setLocation(locations[0].id);
  }, [locationId, locations, setLocation]);

  if (isMobile) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1.5, py: 1, borderBottom: `1px solid ${T.border}`, bgcolor: T.adminBg,
      }}>
        <StorageIcon sx={{ fontSize: 18, color: T.textFaint }} />
        <Select
          size="small"
          value={locationId ?? ''}
          onChange={(e) => setLocation(e.target.value)}
          displayEmpty
          sx={{
            flex: 1, fontSize: 13, height: 32, color: T.textPrimary,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
            '& .MuiSvgIcon-root': { color: T.textMuted },
            bgcolor: T.inputBg ?? T.adminBg,
          }}
        >
          {locations.length === 0 && (
            <MenuItem value="" disabled sx={{ fontSize: 13 }}>No locations</MenuItem>
          )}
          {locations.map((loc) => (
            <MenuItem key={loc.id} value={loc.id} sx={{ fontSize: 13 }}>
              {loc.label}{!loc.available ? ' (unavailable)' : ''}
            </MenuItem>
          ))}
        </Select>
        <Tooltip title="Manage Locations">
          <IconButton size="small" onClick={onManageLocations} sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
            <SettingsIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{
      width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH,
      flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${T.border}`, bgcolor: T.adminBg,
      transition: 'width 0.2s ease', overflow: 'hidden',
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        px: 1.5, py: 1.25, borderBottom: `1px solid ${T.border}`,
      }}>
        {!collapsed && (
          <Typography sx={{
            fontSize: 12, fontWeight: 700, color: T.textFaint,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            Locations
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {!collapsed && (
            <Tooltip title="Manage Locations">
              <IconButton size="small" onClick={onManageLocations} sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                <SettingsIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={collapsed ? 'Expand' : 'Collapse'}>
            <IconButton size="small" onClick={() => setCollapsed((v) => !v)} sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
              {collapsed ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ChevronLeftIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {!collapsed && (
        <Box sx={{ overflowY: 'auto', flex: 1, py: 0.5 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={20} sx={{ color: T.teal }} />
            </Box>
          ) : locations.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: T.textFaint, px: 1.5, py: 1 }}>
              No locations configured
            </Typography>
          ) : (
            locations.map((loc) => (
              <Box key={loc.id} sx={{ mb: 0.5 }}>
                <Box
                  onClick={() => setLocation(loc.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    px: 1.5, py: 0.6, cursor: 'pointer',
                    color: loc.id === locationId ? T.teal : T.textPrimary,
                    bgcolor: loc.id === locationId ? T.tealBg : 'transparent',
                    opacity: loc.available ? 1 : 0.5,
                    '&:hover': { bgcolor: loc.id === locationId ? T.tealBg : T.hoverBg },
                  }}
                >
                  <StorageIcon sx={{ fontSize: 15 }} />
                  <Typography sx={{
                    fontSize: 12.5, fontWeight: loc.id === locationId ? 700 : 500, flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {loc.label}
                  </Typography>
                  {!loc.available && (
                    <Tooltip title="Path unavailable">
                      <Typography sx={{ fontSize: 9, color: T.error, fontWeight: 700 }}>!</Typography>
                    </Tooltip>
                  )}
                </Box>
                {loc.id === locationId && (
                  <FolderTree locationId={loc.id} onDropItems={onDropItems} />
                )}
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  );
}
