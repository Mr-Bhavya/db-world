import { useMemo, useState, useEffect } from 'react';
import { Box, Typography, TextField } from '@mui/material';
import { DescriptionRounded, StorageRounded, ShareRounded } from '@mui/icons-material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT, useThemeMode } from '@shared/theme';
import { StatGrid, StatCard, SectionCard, AdminActionButton } from '@features/admin/adminUi';
import { fetchStats, fetchConfig, updateConfig } from './adminWalletApi';

const fmtBytes = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB`
  : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`;

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <StatGrid min={160}>
        <StatCard icon={DescriptionRounded} label="Documents"    value={stats?.totalDocuments ?? 0}            loading={isLoading} index={0} />
        <StatCard icon={StorageRounded}     label="Storage used"  value={fmtBytes(stats?.totalStorageBytes ?? 0)} loading={isLoading} index={1} />
        <StatCard icon={ShareRounded}       label="Active shares" value={stats?.activeShares ?? 0}              loading={isLoading} index={2} />
      </StatGrid>

      <SectionCard title="Documents by type">
        {perType.length === 0 ? (
          <Typography sx={{ color: T.textMuted, fontSize: 13 }}>No documents yet.</Typography>
        ) : (
          <BarChart height={260}
            xAxis={[{ scaleType: 'band', data: perType.map((t) => t.displayName) }]}
            series={[{ data: perType.map((t) => t.count), color: T.teal }]}
            sx={{ '.MuiChartsAxis-tickLabel': { fill: axisColor, fontSize: 10 } }} />
        )}
      </SectionCard>

      <SectionCard title="Storage limit">
        <Box sx={{
          display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5,
          alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap',
        }}>
          <TextField size="small" label="Max file size (bytes)" type="number" value={maxSize}
            onChange={(e) => setMaxSize(e.target.value)}
            sx={{ maxWidth: { xs: '100%', sm: 240 }, width: { xs: '100%', sm: 'auto' } }} />
          <AdminActionButton
            onClick={() => saveConfig.mutate({ key: 'wallet.max-file-size-bytes', value: String(maxSize) })}
            loading={saveConfig.isPending}
          >
            Save
          </AdminActionButton>
          <Typography sx={{ fontSize: 12, color: T.textFaint }}>
            Allowed types and other settings are on the Settings page.
          </Typography>
        </Box>
      </SectionCard>
    </Box>
  );
}
