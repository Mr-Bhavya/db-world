import { useState } from 'react';
import {
  Box, Typography, Button, Chip, CircularProgress,
  IconButton, Tooltip, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControl, InputLabel, Divider,
} from '@mui/material';
import CloseIcon              from '@mui/icons-material/Close';
import TuneIcon               from '@mui/icons-material/Tune';
import SettingsIcon           from '@mui/icons-material/Settings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@shared/notify';
import { useT, getSelectMenuProps } from '@shared/theme';
import { SectionCard, adminSurface } from '@features/admin/adminUi';
import { getTagDefinitions, updateTagDefinition } from '../api/adminApi';
import { useTagDefs } from '../records/useTagDefs';
import { useRailMeta } from './useRailMeta';
import { adminInputSx, fmtLastRefreshed } from './tagsUtils';

// ── Tag definitions panel ─────────────────────────────────────────────────────
export default function TagDefinitionsPanel() {
  const T = useT();
  const S = adminSurface(T);
  const { tagColor, tagLabel } = useTagDefs();
  const qc = useQueryClient();
  const [editDef, setEditDef] = useState(null); // { tagType, displayName, ... }

  const { data: defs = [], isLoading: defsLoading } = useQuery({
    queryKey: ['tagDefinitions'],
    queryFn:  getTagDefinitions,
    staleTime: 60_000,
  });

  const { sortFields } = useRailMeta();

  const { mutate: doSaveDef, isPending: savingDef } = useMutation({
    mutationFn: ({ tagType, ...body }) => updateTagDefinition(tagType, body),
    onSuccess: () => {
      notify.success('Tag config saved');
      qc.invalidateQueries({ queryKey: ['tagDefinitions'] });
      setEditDef(null);
    },
    onError: () => notify.error('Save failed'),
  });

  const inputSx = adminInputSx(T, S);

  if (defsLoading) return null;

  return (
    <SectionCard title="Tag Configurations" icon={TuneIcon} padding={false} sx={{ mt: 2 }}>
      <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Box sx={{ minWidth: 520 }}>
          {/* Header row */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 104px 56px 48px', gap: 1,
            px: 2, py: 0.75, bgcolor: S.inset, borderBottom: `1px solid ${S.divider}` }}>
            {['Tag', 'Default Sort', 'Direction', 'Last Refreshed', 'Active', ''].map(h => (
              <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {h}
              </Typography>
            ))}
          </Box>

          {defs.map((def, i) => {
            const color = tagColor(def.tagType) ?? T.teal;
            const label = tagLabel(def.tagType);
            return (
              <Box key={def.tagType}>
                {i > 0 && <Divider sx={{ borderColor: S.divider }} />}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 104px 56px 48px', gap: 1,
                  px: 2, py: 1, alignItems: 'center', '&:hover': { bgcolor: S.cardHover } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 12, color: T.textMuted, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {def.defaultSort ?? '—'}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: T.textMuted }}>
                    {def.defaultDirection ?? '—'}
                  </Typography>
                  {/* Whether the scheduler is actually running this tag — an old date on an
                      ON tag means the scheduler job itself is stalled, not the tag config. */}
                  <Typography sx={{ fontSize: 11, color: T.textMuted, whiteSpace: 'nowrap' }}>
                    {fmtLastRefreshed(def.lastRefreshedAt)}
                  </Typography>
                  <Chip
                    label={def.active ? 'ON' : 'OFF'}
                    size="small"
                    sx={{
                      height: 18, fontSize: '0.6rem', fontWeight: 700,
                      bgcolor: def.active ? `${T.teal}22` : `${T.error}18`,
                      color: def.active ? T.teal : T.error,
                      border: `1px solid ${def.active ? T.teal : T.error}44`,
                    }}
                  />
                  <Tooltip title="Edit config">
                    <IconButton size="small" onClick={() => setEditDef({ ...def })}
                      sx={{ color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.tealBg } }}>
                      <SettingsIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Edit dialog */}
      {editDef && (
        <Dialog open onClose={() => setEditDef(null)} maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, color: T.textPrimary, borderRadius: 2 } }}>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontWeight: 700, fontSize: '0.95rem', pb: 1, borderBottom: `1px solid ${S.divider}` }}>
            Configure: {tagLabel(editDef.tagType)}
            <IconButton size="small" onClick={() => setEditDef(null)} sx={{ color: T.textMuted }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField label="Display Name" size="small" fullWidth sx={inputSx}
              value={editDef.displayName ?? ''} onChange={e => setEditDef(p => ({ ...p, displayName: e.target.value }))} />

            <TextField label="Description" size="small" fullWidth multiline rows={2} sx={inputSx}
              value={editDef.description ?? ''} onChange={e => setEditDef(p => ({ ...p, description: e.target.value }))} />

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <FormControl size="small" fullWidth sx={inputSx}>
                <InputLabel>Default Sort Field</InputLabel>
                <Select value={editDef.defaultSort ?? ''} label="Default Sort Field"
                  onChange={e => setEditDef(p => ({ ...p, defaultSort: e.target.value }))}
                  MenuProps={getSelectMenuProps(T)}>
                  {/* value must be f.value, not f: sortFields are { value, label } objects, and
                      defaultSort is a plain string. Using the object made the Select match nothing
                      (so it rendered blank for a tag that had a perfectly good sort) and would have
                      PUT an object into the String column. */}
                  {sortFields.map(f => (
                    <MenuItem key={f.value} value={f.value}>
                      <Typography sx={{ fontSize: 13 }}>{f.label}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 110, ...inputSx }}>
                <InputLabel>Direction</InputLabel>
                <Select value={editDef.defaultDirection ?? 'DESC'} label="Direction"
                  onChange={e => setEditDef(p => ({ ...p, defaultDirection: e.target.value }))}
                  MenuProps={getSelectMenuProps(T)}>
                  <MenuItem value="DESC">DESC</MenuItem>
                  <MenuItem value="ASC">ASC</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Switch size="small" checked={editDef.active ?? true}
                onChange={e => setEditDef(p => ({ ...p, active: e.target.checked }))}
                sx={{ '& .MuiSwitch-thumb': { bgcolor: editDef.active ? T.teal : undefined },
                  '& .MuiSwitch-track': { bgcolor: editDef.active ? `${T.teal}66 !important` : undefined } }} />
              <Typography sx={{ fontSize: 13, color: T.textMuted }}>Active</Typography>
            </Box>
            {!editDef.active && (
              <Typography sx={{ fontSize: 11, color: T.warning }}>
                The scheduler will stop refreshing this tag. Records already tagged stay tagged, so
                rails using it freeze at their current contents rather than going empty — clear them
                from the tag&apos;s record list if you want it emptied.
              </Typography>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2, borderTop: `1px solid ${S.divider}`, pt: 1.5 }}>
            <Button onClick={() => setEditDef(null)} sx={{ color: T.textMuted }}>Cancel</Button>
            <Button variant="contained" disabled={savingDef}
              onClick={() => doSaveDef(editDef)}
              sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
              {savingDef ? <CircularProgress size={18} color="inherit" /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </SectionCard>
  );
}
