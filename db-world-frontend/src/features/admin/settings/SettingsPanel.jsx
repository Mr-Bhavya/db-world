import React, { useState, useEffect } from 'react';
import { Box, Typography, Switch, TextField, Button, Chip, Tooltip } from '@mui/material';
import { RestartAltRounded, SaveRounded, TuneRounded } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import { AdminPage, SectionCard, LoadingState, ErrorState } from '@features/admin/adminUi';
import settingsApi from './api';

// One editable row. On mobile the label stacks ABOVE the controls so long labels
// don't squeeze into a narrow column and blow up the row height.
function SettingRow({ s, onSave, onReset, saving, last }) {
  const T = useT();
  const isBool = s.valueType === 'BOOLEAN';
  const [draft, setDraft] = useState(s.value ?? '');
  useEffect(() => { setDraft(s.value ?? ''); }, [s.value]);

  const dirty = String(draft) !== String(s.value ?? '');
  const numeric = s.valueType === 'INTEGER' || s.valueType === 'LONG';
  const atDefault = String(s.value ?? '') === String(s.defaultValue ?? '');
  const commit = (val) => onSave(s.key, val);

  return (
    <Box sx={{ py: 1.5, borderBottom: last ? 'none' : `1px solid ${T.border}` }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.25 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.86rem', fontWeight: 600, color: T.text }}>{s.label}</Typography>
            {s.requiresRestart && (
              <Chip label="restart required" size="small"
                sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: T.warningBg, color: T.warning }} />
            )}
          </Box>
          {s.description && (
            <Typography sx={{ fontSize: '0.72rem', color: T.textFaint, mt: 0.25 }}>{s.description}</Typography>
          )}
          <Typography sx={{ fontSize: '0.65rem', color: T.textFaint, mt: 0.25, wordBreak: 'break-word' }}>
            <code>{s.key}</code> · default {String(s.defaultValue)}
            {s.updatedBy ? ` · last by ${s.updatedBy}` : ''}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end', flexShrink: 0 }}>
          {isBool ? (
            <Switch
              checked={draft === 'true' || draft === true}
              disabled={saving}
              onChange={(e) => { const v = e.target.checked ? 'true' : 'false'; setDraft(v); commit(v); }}
            />
          ) : (
            <>
              <TextField
                size="small"
                type={numeric ? 'number' : 'text'}
                value={draft}
                disabled={saving}
                onChange={(e) => setDraft(e.target.value)}
                inputProps={numeric ? { min: s.minValue ?? undefined, max: s.maxValue ?? undefined } : {}}
                sx={{ flex: { xs: 1, sm: 'unset' }, width: { sm: numeric ? 130 : 220 } }}
              />
              <Tooltip title={dirty ? 'Save' : 'No changes'}>
                <span>
                  <Button size="small" variant="contained" disabled={!dirty || saving} onClick={() => commit(draft)}
                    sx={{ minWidth: 0, px: 1, bgcolor: T.teal, '&:hover': { bgcolor: '#0f766e' } }}>
                    <SaveRounded sx={{ fontSize: 16 }} />
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
          <Tooltip title={atDefault ? 'Already at default' : 'Reset to default'}>
            <span>
              <Button size="small" disabled={atDefault || saving} onClick={() => onReset(s.key)}
                sx={{ minWidth: 0, px: 1, color: T.textMuted }}>
                <RestartAltRounded sx={{ fontSize: 16 }} />
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

const SettingsPanel = () => {
  const qc = useQueryClient();

  const { data: categories = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: settingsApi.list,
  });

  const saveMut = useMutation({
    mutationFn: ({ key, value }) => settingsApi.update(key, value),
    onSuccess: (_r, { key }) => { notify.success(`Saved ${key}`); qc.invalidateQueries({ queryKey: ['admin', 'config'] }); },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Save failed'),
  });

  const resetMut = useMutation({
    mutationFn: (key) => settingsApi.reset(key),
    onSuccess: (_r, key) => { notify.info(`Reset ${key}`); qc.invalidateQueries({ queryKey: ['admin', 'config'] }); },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Reset failed'),
  });

  const saving = saveMut.isPending || resetMut.isPending;

  return (
    <AdminPage
      title="Settings"
      subtitle="Runtime configuration — changes apply live unless a setting is flagged as restart-required."
      icon={TuneRounded}
      onRefresh={refetch}
      refreshing={isLoading}
    >
      {isLoading ? (
        <LoadingState label="Loading settings…" />
      ) : isError ? (
        <ErrorState message="Failed to load settings." onRetry={refetch} />
      ) : (
        // Masonry columns pack categories of different lengths and use the full
        // desktop width instead of a narrow centred column.
        <Box sx={{ columnCount: { xs: 1, md: 2, xl: 3 }, columnGap: 20 }}>
          {categories.map((cat) => (
            <SectionCard key={cat.category} title={cat.category} sx={{ breakInside: 'avoid', mb: 2.5 }}>
              {(cat.settings ?? []).map((s, i) => (
                <SettingRow
                  key={s.key}
                  s={s}
                  saving={saving}
                  last={i === (cat.settings.length - 1)}
                  onSave={(key, value) => saveMut.mutate({ key, value })}
                  onReset={(key) => resetMut.mutate(key)}
                />
              ))}
            </SectionCard>
          ))}
        </Box>
      )}
    </AdminPage>
  );
};

export default SettingsPanel;
