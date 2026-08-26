import { useState } from 'react';
import {
  Box, Typography, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Switch, FormControl, InputLabel, Divider,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT, getSelectMenuProps } from '@shared/theme';
import { AdminActionButton, adminSurface } from '@features/admin/adminUi';
import { createTagDefinition, previewTagRule } from '../api/adminApi';
import { useRailMeta } from './useRailMeta';
import { adminInputSx } from './tagsUtils';
import TagRuleBuilder, { BLANK_TAG_RULE, tagRuleIsEmpty, toTagRulePayload } from './TagRuleBuilder';

/**
 * Create an admin-curated tag. Always manual: no strategy computes it, so whatever gets bulk-added
 * stays put. The backend slugs `name` to UPPER_SNAKE for the identity and keeps the typed text as
 * the display label.
 */
export default function CreateTagDialog({ open, onClose }) {
  const T  = useT();
  const S  = adminSurface(T);
  const qc = useQueryClient();
  const { sortFields, providers, providerTypes, filterFields, genres } = useRailMeta();
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [sort, setSort]               = useState('tagPriority');
  const [direction, setDirection]     = useState('DESC');
  const [automatic, setAutomatic]     = useState(false);
  const [rule, setRule]               = useState({ ...BLANK_TAG_RULE });
  const [preview, setPreview]         = useState(null);   // { matched } once dry-run has run

  const reset = () => {
    setName(''); setDescription(''); setSort('tagPriority'); setDirection('DESC');
    setAutomatic(false); setRule({ ...BLANK_TAG_RULE }); setPreview(null);
  };

  const ruleEmpty = tagRuleIsEmpty(rule);

  const { mutate: runPreview, isPending: previewing } = useMutation({
    mutationFn: () => previewTagRule(toTagRulePayload(rule), rule.limit || 60),
    onSuccess: (res) => setPreview(res),
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Could not preview rule'),
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => createTagDefinition({
      name, displayName: name, description, defaultSort: sort, defaultDirection: direction,
      // Omitted entirely when manual — the backend reads a null rule as "hand-curated list".
      rule: automatic ? toTagRulePayload(rule) : null,
    }),
    onSuccess: (created) => {
      notify.success(`Tag "${created?.displayName ?? name}" created`);
      qc.invalidateQueries({ queryKey: ['tagSummary'] });
      qc.invalidateQueries({ queryKey: ['tagDefinitions'] });
      qc.invalidateQueries({ queryKey: ['railMetadata'] });
      reset();
      onClose();
    },
    onError: (e) => notify.error(e?.response?.data?.message ?? 'Could not create tag'),
  });

  // Mirrors TagNames.canonicalize on the backend, so the admin sees the identity before saving.
  const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const inputSx = adminInputSx(T, S);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, color: T.textPrimary, borderRadius: 2 } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>New tag</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <TextField label="Tag name" size="small" fullWidth autoFocus sx={inputSx}
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Diwali Special"
          helperText={slug ? `Stored as ${slug}` : 'Shown on the tag card and in the rail editor'} />
        <TextField label="Description" size="small" fullWidth multiline minRows={2} sx={inputSx}
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder="What belongs in this tag?" />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <FormControl size="small" sx={{ flex: 1, ...inputSx }}>
            <InputLabel>Default sort</InputLabel>
            <Select value={sort} label="Default sort" onChange={e => setSort(e.target.value)}
              MenuProps={getSelectMenuProps(T)}>
              {sortFields.map(f => (
                <MenuItem key={f.value} value={f.value}>
                  <Typography sx={{ fontSize: 13 }}>{f.label}</Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 110, ...inputSx }}>
            <InputLabel>Direction</InputLabel>
            <Select value={direction} label="Direction" onChange={e => setDirection(e.target.value)}
              MenuProps={getSelectMenuProps(T)}>
              <MenuItem value="DESC">DESC</MenuItem>
              <MenuItem value="ASC">ASC</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Divider sx={{ borderColor: S.divider }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Switch size="small" checked={automatic}
            onChange={e => { setAutomatic(e.target.checked); setPreview(null); }}
            sx={{ '& .MuiSwitch-thumb': { bgcolor: automatic ? T.teal : undefined },
              '& .MuiSwitch-track': { bgcolor: automatic ? `${T.teal}66 !important` : undefined } }} />
          <Typography sx={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>
            Fill this tag automatically
          </Typography>
        </Box>

        {!automatic && (
          <Alert severity="info" sx={{ bgcolor: `${T.teal}12`, color: T.textMuted,
            border: `1px solid ${T.teal}30`, '& .MuiAlert-icon': { color: T.teal }, fontSize: 12 }}>
            Manual list — nothing recalculates it, so records you add stay until you remove them.
            Add records from the tag&apos;s card, then point a rail at it.
          </Alert>
        )}

        {automatic && (
          <>
            <Alert severity="info" sx={{ bgcolor: `${T.teal}12`, color: T.textMuted,
              border: `1px solid ${T.teal}30`, '& .MuiAlert-icon': { color: T.teal }, fontSize: 12 }}>
              Records matching these conditions are re-selected on every scheduler run, so the tag
              stays current on its own. Because it is recomputed, you can&apos;t hand-add to it.
            </Alert>
            <TagRuleBuilder rule={rule} onChange={r => { setRule(r); setPreview(null); }}
              sortFields={sortFields} providers={providers} providerTypes={providerTypes}
              filterFields={filterFields} genres={genres} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <AdminActionButton variant="secondary" loading={previewing} disabled={ruleEmpty}
                onClick={() => runPreview()}>Test rule</AdminActionButton>
              {preview && (
                <Typography sx={{ fontSize: 12, color: preview.matched ? T.teal : T.warning }}>
                  {preview.matched
                    ? `${preview.matched} record${preview.matched === 1 ? '' : 's'} would be tagged`
                    : 'No records match — loosen the conditions'}
                </Typography>
              )}
            </Box>
            {ruleEmpty && (
              <Typography sx={{ fontSize: 11, color: T.warning }}>
                Set at least one condition. An empty rule would match the whole catalogue.
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <AdminActionButton variant="secondary" onClick={onClose}>Cancel</AdminActionButton>
        <AdminActionButton variant="primary" loading={isPending}
          disabled={!slug || (automatic && ruleEmpty)}
          onClick={() => save()}>Create tag</AdminActionButton>
      </DialogActions>
    </Dialog>
  );
}
