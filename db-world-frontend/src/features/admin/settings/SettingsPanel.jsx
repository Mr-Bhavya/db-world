import React, { useState, useEffect } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Switch, TextField,
  Button, Chip, Divider, Tooltip,
} from '@mui/material';
import { RestartAlt, Save } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT } from '@shared/theme';
import settingsApi from './api';

// One editable row. Local draft state; commits on Save (or toggle for booleans).
function SettingRow({ s, onSave, onReset, saving }) {
  const T = useT();
  const isBool = s.valueType === 'BOOLEAN';
  const [draft, setDraft] = useState(s.value ?? '');
  useEffect(() => { setDraft(s.value ?? ''); }, [s.value]);

  const dirty = String(draft) !== String(s.value ?? '');
  const numeric = s.valueType === 'INTEGER' || s.valueType === 'LONG';
  const atDefault = String(s.value ?? '') === String(s.defaultValue ?? '');

  const commit = (val) => onSave(s.key, val);

  return (
    <Box sx={{ py: 1.5, borderBottom: `1px solid ${T.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.86rem', fontWeight: 600, color: T.text }}>
              {s.label}
            </Typography>
            {s.requiresRestart && (
              <Chip label="restart required" size="small"
                sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#f59e0b', color: '#fff' }} />
            )}
          </Box>
          {s.description && (
            <Typography sx={{ fontSize: '0.72rem', color: T.textFaint, mt: 0.25 }}>
              {s.description}
            </Typography>
          )}
          <Typography sx={{ fontSize: '0.65rem', color: T.textFaint, mt: 0.25 }}>
            <code>{s.key}</code> · default {String(s.defaultValue)}
            {s.updatedBy ? ` · last by ${s.updatedBy}` : ''}
          </Typography>
        </Box>

        {isBool ? (
          <Switch
            checked={draft === 'true' || draft === true}
            disabled={saving}
            onChange={(e) => { const v = e.target.checked ? 'true' : 'false'; setDraft(v); commit(v); }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              type={numeric ? 'number' : 'text'}
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              inputProps={numeric ? { min: s.minValue ?? undefined, max: s.maxValue ?? undefined } : {}}
              sx={{ width: numeric ? 130 : 220 }}
            />
            <Tooltip title={dirty ? 'Save' : 'No changes'}>
              <span>
                <Button size="small" variant="contained" disabled={!dirty || saving}
                  onClick={() => commit(draft)}
                  sx={{ minWidth: 0, px: 1, bgcolor: T.teal }}>
                  <Save sx={{ fontSize: 16 }} />
                </Button>
              </span>
            </Tooltip>
          </Box>
        )}

        <Tooltip title={atDefault ? 'Already at default' : 'Reset to default'}>
          <span>
            <Button size="small" disabled={atDefault || saving} onClick={() => onReset(s.key)}
              sx={{ minWidth: 0, px: 1, color: T.textMuted }}>
              <RestartAlt sx={{ fontSize: 16 }} />
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

const SettingsPanel = () => {
  const T = useT();
  const qc = useQueryClient();

  const { data: categories = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: settingsApi.list,
  });

  const saveMut = useMutation({
    mutationFn: ({ key, value }) => settingsApi.update(key, value),
    onSuccess: (_r, { key }) => {
      notify.success(`Saved ${key}`);
      qc.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Save failed'),
  });

  const resetMut = useMutation({
    mutationFn: (key) => settingsApi.reset(key),
    onSuccess: (_r, key) => {
      notify.info(`Reset ${key}`);
      qc.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Reset failed'),
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
      <CircularProgress sx={{ color: T.teal }} /></Box>;
  }
  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">Failed to load settings.</Alert></Box>;
  }

  const saving = saveMut.isPending || resetMut.isPending;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: T.text, mb: 0.5 }}>
        Settings
      </Typography>
      <Typography sx={{ fontSize: '0.82rem', color: T.textFaint, mb: 3 }}>
        Runtime configuration — changes apply live (no restart) unless flagged.
      </Typography>

      {categories.map((cat) => (
        <Box key={cat.category} sx={{
          mb: 3, p: 2, borderRadius: 2,
          bgcolor: T.glass, border: `1px solid ${T.border}`,
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: T.teal, mb: 1 }}>
            {cat.category}
          </Typography>
          <Divider sx={{ borderColor: T.border, mb: 0.5 }} />
          {(cat.settings ?? []).map((s) => (
            <SettingRow
              key={s.key}
              s={s}
              saving={saving}
              onSave={(key, value) => saveMut.mutate({ key, value })}
              onReset={(key) => resetMut.mutate(key)}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default SettingsPanel;
