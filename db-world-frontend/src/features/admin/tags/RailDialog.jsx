import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Chip, CircularProgress,
  IconButton, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Switch, FormControl, InputLabel, Divider, FormHelperText,
} from '@mui/material';
import AddIcon                from '@mui/icons-material/Add';
import CloseIcon              from '@mui/icons-material/Close';
import { useT, getSelectMenuProps } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { useTagDefs } from '../records/useTagDefs';
import { useRailMeta } from './useRailMeta';
import {
  PAGE_TYPES, BLANK_RULE, BLANK_RAIL, IMAGE_VARIANTS, DISPLAY_TYPES,
} from './railConstants';
import { railPageTypes, adminInputSx } from './tagsUtils';

// ── Rail dialog ───────────────────────────────────────────────────────────────
export default function RailDialog({ open, data, onClose, onSave, saving }) {
  const T = useT();
  const S = adminSurface(T);
  const { allTagTypes, tagColor, tagLabel } = useTagDefs();
  const [form, setForm]       = useState({ ...BLANK_RAIL });
  const [langInput, setLangInput] = useState('');

  const { sortFields, ruleTypes } = useRailMeta();

  useEffect(() => {
    if (data) {
      // Normalize pageType (legacy) → pageTypes (current) at load time so the form
      // owns a single source of truth.
      const incoming = { ...BLANK_RAIL, ...data, displayType: data.type ?? data.displayType ?? '', imageVariant: data.imageVariant ?? '', rule: { ...BLANK_RULE, ...(data.rule ?? {}) } };
      const pageTypes = railPageTypes(incoming);
      setForm({ ...incoming, pageTypes: pageTypes.length ? pageTypes : ['HOME'] });
      setLangInput('');
    }
  }, [data]);

  const setField = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setCheck = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.checked }));
  const setRule  = (k) => (e) => setForm(p => ({ ...p, rule: { ...p.rule, [k]: e.target.value } }));
  const setRuleV = (k, v)     => setForm(p => ({ ...p, rule: { ...p.rule, [k]: v } }));

  const togglePage = (page) => setForm(p => {
    const next = new Set(p.pageTypes ?? []);
    if (next.has(page)) {
      // never let the set become empty
      if (next.size > 1) next.delete(page);
    } else {
      next.add(page);
    }
    return { ...p, pageTypes: PAGE_TYPES.filter(t => next.has(t)) };
  });

  const addLang = () => {
    const lang = langInput.trim().toLowerCase();
    if (!lang) return;
    const langs = form.rule?.languages ?? [];
    if (!langs.includes(lang)) setRuleV('languages', [...langs, lang]);
    setLangInput('');
  };
  const removeLang = (l) => setRuleV('languages', (form.rule?.languages ?? []).filter(x => x !== l));

  const inputSx = adminInputSx(T, S);

  const rule = form.rule ?? {};
  const activeRuleType = ruleTypes.find(t => t.value === (rule.type ?? 'tag'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: S.card, border: `1px solid ${S.border}`, color: T.textPrimary, borderRadius: 2, maxHeight: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontWeight: 700, fontSize: '1rem', pb: 1, borderBottom: `1px solid ${S.divider}` }}>
        {form.id ? 'Edit Rail' : 'New Rail'}
        <IconButton size="small" onClick={onClose} sx={{ color: T.textMuted }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important',
        overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: T.scrollThumb, borderRadius: 2 } }}>

        {/* ── Basic ─────────────────────────────────────────── */}
        <TextField label="Title" value={form.title ?? ''} onChange={setField('title')}
          fullWidth size="small" sx={inputSx} />

        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T.textMuted, mb: 0.75 }}>
            Pages — select one or more
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {PAGE_TYPES.map(p => {
              const selected = (form.pageTypes ?? []).includes(p);
              return (
                <Chip key={p} label={p} size="small" clickable
                  onClick={() => togglePage(p)}
                  variant={selected ? 'filled' : 'outlined'}
                  sx={{
                    fontSize: '0.7rem', fontWeight: 600, height: 26,
                    bgcolor: selected ? `${T.teal}20` : 'transparent',
                    color: selected ? T.teal : T.textMuted,
                    borderColor: selected ? T.teal : S.border,
                    '&:hover': { bgcolor: selected ? `${T.teal}30` : S.cardHover },
                  }} />
              );
            })}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField label="Priority" type="number" value={form.priority ?? 0} onChange={setField('priority')}
            size="small" inputProps={{ min: 0 }} sx={{ minWidth: 88, ...inputSx }} />
          <TextField label="Limit" type="number" value={form.limitSize ?? 20} onChange={setField('limitSize')}
            size="small" inputProps={{ min: 1, max: 200 }} sx={{ minWidth: 88, ...inputSx }} />
          <TextField select label="Display Type" value={form.displayType ?? ''} onChange={setField('displayType')}
            size="small" sx={{ minWidth: 230, ...inputSx }}>
            {DISPLAY_TYPES.map(o => <MenuItem key={o.value || 'auto'} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField select label="Image" value={form.imageVariant ?? ''} onChange={setField('imageVariant')}
            size="small" sx={{ minWidth: 190, ...inputSx }}>
            {IMAGE_VARIANTS.map(o => <MenuItem key={o.value || 'auto'} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
        </Box>

        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Switch size="small" checked={form.active ?? true} onChange={setCheck('active')}
              sx={{ '& .MuiSwitch-thumb': { bgcolor: (form.active ?? true) ? T.teal : undefined },
                '& .MuiSwitch-track': { bgcolor: (form.active ?? true) ? `${T.teal}66 !important` : undefined } }} />
            <Typography sx={{ fontSize: 12, color: T.textMuted }}>Active</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Switch size="small" checked={form.infiniteScroll ?? true} onChange={setCheck('infiniteScroll')}
              sx={{ '& .MuiSwitch-thumb': { bgcolor: (form.infiniteScroll ?? true) ? T.teal : undefined },
                '& .MuiSwitch-track': { bgcolor: (form.infiniteScroll ?? true) ? `${T.teal}66 !important` : undefined } }} />
            <Typography sx={{ fontSize: 12, color: T.textMuted }}>Infinite Scroll</Typography>
          </Box>
        </Box>

        <Divider sx={{ borderColor: S.divider }} />

        {/* ── Rule ──────────────────────────────────────────── */}
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Rule — how records are selected
        </Typography>

        <FormControl size="small" fullWidth sx={inputSx}>
          <InputLabel>Rule Type</InputLabel>
          <Select value={rule.type ?? 'tag'} label="Rule Type"
            onChange={e => setRuleV('type', e.target.value)} MenuProps={getSelectMenuProps(T)}>
            {ruleTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </Select>
          {/* Says what the type does — several are per-user and legitimately look empty here. */}
          {activeRuleType?.description && (
            <FormHelperText>{activeRuleType.description}</FormHelperText>
          )}
        </FormControl>

        {/* TAG */}
        {rule.type === 'tag' && (
          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>Tag</InputLabel>
            <Select value={rule.tag ?? ''} label="Tag"
              onChange={e => setRuleV('tag', e.target.value)} MenuProps={getSelectMenuProps(T)}>
              {allTagTypes.map(t => (
                <MenuItem key={t} value={t}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tagColor(t), flexShrink: 0 }} />
                    {tagLabel(t)}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* GENRE */}
        {rule.type === 'genre' && (
          <TextField label="Genre ID" type="number" size="small" fullWidth
            value={rule.genreId ?? ''}
            onChange={e => setRuleV('genreId', e.target.value ? Number(e.target.value) : null)}
            helperText="Numeric TMDB genre ID — e.g. 28 = Action, 18 = Drama, 35 = Comedy"
            sx={inputSx} />
        )}

        {/* LANGUAGE */}
        {rule.type === 'language' && (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField placeholder="Language code (hi, en, ta, te, ml…)" size="small"
                value={langInput} onChange={e => setLangInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLang(); } }}
                sx={{ flex: 1, ...inputSx }} />
              <Button size="small" variant="outlined" onClick={addLang}
                sx={{ borderColor: T.teal, color: T.teal, '&:hover': { bgcolor: T.tealBg }, px: 1.5 }}>
                <AddIcon sx={{ fontSize: 16 }} />
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minHeight: 28 }}>
              {(rule.languages ?? []).map(l => (
                <Chip key={l} label={l} size="small" onDelete={() => removeLang(l)}
                  sx={{ bgcolor: `${T.teal}18`, color: T.teal, border: `1px solid ${T.teal}44`,
                    '& .MuiChip-deleteIcon': { color: T.teal, '&:hover': { color: T.tealHover } } }} />
              ))}
              {(rule.languages ?? []).length === 0 && (
                <Typography sx={{ fontSize: 11, color: T.textFaint, lineHeight: '28px' }}>Add at least one language code</Typography>
              )}
            </Box>
          </Box>
        )}

        {/* FILTER */}
        {rule.type === 'filter' && (
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField label="Field" size="small" value={rule.field ?? ''} onChange={setRule('field')}
              fullWidth sx={inputSx} helperText="e.g. popularity, voteAverage" />
            <TextField label="Value" size="small" value={rule.value ?? ''} onChange={setRule('value')}
              fullWidth sx={inputSx} helperText="e.g. 7.5" />
          </Box>
        )}

        {/* MANUAL */}
        {rule.type === 'manual' && (
          <Alert severity="info" sx={{ bgcolor: `${T.teal}12`, color: T.textMuted,
            border: `1px solid ${T.teal}30`, '& .MuiAlert-icon': { color: T.teal }, fontSize: 12 }}>
            Manual rails show records from the rail&apos;s curated item list. Save the rail first, then add records via the rail items API.
          </Alert>
        )}

        {/* WATCHLIST */}
        {rule.type === 'watchlist' && (
          <Alert severity="info" sx={{ bgcolor: `${T.teal}12`, color: T.textMuted,
            border: `1px solid ${T.teal}30`, '& .MuiAlert-icon': { color: T.teal }, fontSize: 12 }}>
            <strong>My List</strong> shows each user their own watchlisted records, sorted most-recently-added first.
            No additional configuration needed — sorting and record type are determined by the user&apos;s list.
          </Alert>
        )}

        {/* CONTINUE WATCHING */}
        {rule.type === 'continueWatching' && (
          <Alert severity="info" sx={{ bgcolor: `${T.teal}12`, color: T.textMuted,
            border: `1px solid ${T.teal}30`, '& .MuiAlert-icon': { color: T.teal }, fontSize: 12 }}>
            <strong>Continue Watching</strong> shows each user the records they&apos;ve recently watched, most-recent first.
            On the Movies / Series pages the rail auto-filters to that record type — no manual override needed.
          </Alert>
        )}

        {/* BECAUSE YOU WATCHED */}
        {rule.type === 'becauseYouWatched' && (
          <Alert severity="info" sx={{ bgcolor: `${T.teal}12`, color: T.textMuted,
            border: `1px solid ${T.teal}30`, '& .MuiAlert-icon': { color: T.teal }, fontSize: 12 }}>
            <strong>Because You Watched</strong> looks at the user&apos;s most recent watched record and recommends others
            sharing its primary genre. The rail title is appended with the source title at render time — e.g. set the
            title to <em>&quot;Because you watched&quot;</em> and users see <em>&quot;Because you watched Inception&quot;</em>.
            Leave the page selector on the page where you want the rail to appear (set MOVIES / SERIES to auto-filter type).
          </Alert>
        )}

        {rule.type !== 'watchlist' && rule.type !== 'continueWatching' && rule.type !== 'becauseYouWatched' && (<>
          <Divider sx={{ borderColor: S.divider }} />

          {/* ── Sorting & record type ─────────────────────────── */}
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Sorting &amp; Record Type
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <FormControl size="small" fullWidth sx={inputSx}>
              <InputLabel>Sort Field</InputLabel>
              <Select value={rule.sort ?? ''} label="Sort Field"
                onChange={e => setRuleV('sort', e.target.value)} MenuProps={getSelectMenuProps(T)}>
                <MenuItem value=""><em>Default (from Tag Config)</em></MenuItem>
                {/* "Smart ranking (tag score)" only works on tag rails — the computed
                    record_tags.priority can't be ordered on genre/language/filter/manual
                    rails. Hide it elsewhere so the broken combo can't be picked. */}
                {sortFields
                  .filter(f => f.value !== 'tagPriority' || rule.type === 'tag')
                  .map(f => (
                    <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                  ))}
              </Select>
              {rule.sort === 'tagPriority' && rule.type !== 'tag' && (
                <FormHelperText sx={{ color: T.warning }}>
                  “Smart ranking” only applies to tag rails — it’s ignored for this rail type. Pick another sort.
                </FormHelperText>
              )}
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 110, ...inputSx }}>
              <InputLabel>Direction</InputLabel>
              <Select value={rule.direction ?? 'DESC'} label="Direction"
                onChange={e => setRuleV('direction', e.target.value)} MenuProps={getSelectMenuProps(T)}>
                <MenuItem value="DESC">DESC — newest/highest first</MenuItem>
                <MenuItem value="ASC">ASC — oldest/lowest first</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>Record Type Override</InputLabel>
            <Select value={rule.recordType ?? ''} label="Record Type Override"
              onChange={e => setRuleV('recordType', e.target.value)} MenuProps={getSelectMenuProps(T)}>
              <MenuItem value="">Auto (infer from page type)</MenuItem>
              <MenuItem value="MOVIE">Movie only</MenuItem>
              <MenuItem value="TV_SERIES">Series only</MenuItem>
            </Select>
          </FormControl>
        </>)}

      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, borderTop: `1px solid ${S.divider}`, pt: 1.5 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted }}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.title || saving}
          sx={{ bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, fontWeight: 600 }}>
          {saving ? <CircularProgress size={18} color="inherit" /> : (form.id ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
