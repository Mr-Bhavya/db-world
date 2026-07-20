import { useMemo, useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Skeleton } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT, useThemeMode } from '@shared/theme';
import { fetchStats, fetchConfig, updateConfig } from './adminWalletApi';

const fmtBytes = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB`
  : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`;

function StatCard({ T, label, value }) {
  return (
    <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, p: 2, flex: 1, minWidth: 160 }}>
      <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: T.textPrimary }}>{value}</Typography>
    </Box>
  );
}

export default function MonitorTab() {
  const T = useT();
  const { mode } = useThemeMode();
  const qc = useQueryClient();
  const { data: stats, isLoading } = useQuery({ queryKey: ['wallet-admin', 'stats'], queryFn: fetchStats });
  const { data: config = [] } = useQuery({ queryKey: ['app-config'], queryFn: fetchConfig });

  // find the two wallet settings across the grouped config payload
  const flat = useMemo(() => (Array.isArray(config) ? config.flatMap((c) => c.settings ?? []) : []), [config]);
  const maxSizeSetting = flat.find((s) => s.key === 'wallet.max-file-size-bytes');
  const [maxSize, setMaxSize] = useState('');
  useEffect(() => { if (maxSizeSetting) setMaxSize(maxSizeSetting.value ?? maxSizeSetting.defaultValue); }, [maxSizeSetting]);

  const saveConfig = useMutation({
    mutationFn: ({ key, value }) => updateConfig(key, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-config'] }); notify.success('Setting saved'); },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Failed to save'),
  });

  const perType = stats?.perType ?? [];
  const axisColor = mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.55)';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {isLoading ? <Skeleton variant="rounded" height={80} width={480} /> : (
          <>
            <StatCard T={T} label="Documents" value={stats?.totalDocuments ?? 0} />
            <StatCard T={T} label="Storage used" value={fmtBytes(stats?.totalStorageBytes ?? 0)} />
            <StatCard T={T} label="Active shares" value={stats?.activeShares ?? 0} />
          </>
        )}
      </Box>

      <Box sx={{ bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, p: 2, width: '100%' }}>
        <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', mb: 1 }}>Documents by type</Typography>
        {perType.length === 0 ? <Typography sx={{ color: T.textMuted, fontSize: 13 }}>No documents yet.</Typography> : (
          <BarChart height={260}
            xAxis={[{ scaleType: 'band', data: perType.map((t) => t.displayName) }]}
            series={[{ data: perType.map((t) => t.count), color: '#0d9488' }]}
            sx={{ '.MuiChartsAxis-tickLabel': { fill: axisColor, fontSize: 10 } }} />
        )}
      </Box>

      <Box sx={{
        bgcolor: T.glass, border: `1px solid ${T.border}`, borderRadius: 2, p: 2,
        display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { xs: 'stretch', sm: 'center' },
      }}>
        <TextField size="small" label="Max file size (bytes)" type="number" value={maxSize}
          onChange={(e) => setMaxSize(e.target.value)}
          sx={{ maxWidth: { xs: '100%', sm: 240 }, width: { xs: '100%', sm: 'auto' } }} />
        <Button variant="contained" onClick={() => saveConfig.mutate({ key: 'wallet.max-file-size-bytes', value: String(maxSize) })}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, width: { xs: '100%', sm: 'auto' } }}>Save</Button>
        <Typography sx={{ fontSize: 12, color: T.textFaint }}>
          Allowed types and other settings are on the Settings page.
        </Typography>
      </Box>
    </Box>
  );
}
