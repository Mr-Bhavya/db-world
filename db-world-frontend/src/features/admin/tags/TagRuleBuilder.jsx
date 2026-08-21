import {
  Box, Typography, Select, MenuItem, TextField,
  FormControl, InputLabel, Divider, FormHelperText,
} from '@mui/material';
import { useT, getSelectMenuProps } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { adminInputSx } from './tagsUtils';
import TagConditionRows from './TagConditionRows';

/** A blank rule. Every field optional; they AND together on the backend. */
export const BLANK_TAG_RULE = {
  recordType: '', genreIds: '', languages: '',
  minVoteAverage: '', minVoteCount: '', minPopularity: '',
  releasedWithinDays: '', addedWithinDays: '', publishedWithinDays: '',
  newContentWithinDays: '', releasingWithinNextDays: '',
  conditions: [],
  // '' = don't care | 'true' = playable now | 'false' = not yet available (Coming Soon)
  availability: '',
  providerIds: [], providerType: 'FLATRATE', providerRegion: '',
  scoreBy: 'popularity', scoreDirection: 'DESC', limit: 60,
};

/** True when nothing has been narrowed — mirrors TagRule.isEmpty() on the backend. */
export function tagRuleIsEmpty(r) {
  return !r.recordType && !r.genreIds.trim() && !r.languages.trim()
    && r.minVoteAverage === '' && r.minVoteCount === '' && r.minPopularity === ''
    && r.releasedWithinDays === '' && r.addedWithinDays === '' && r.publishedWithinDays === ''
    && r.newContentWithinDays === '' && r.releasingWithinNextDays === ''
    && r.availability === '' && (r.providerIds ?? []).length === 0
    && !(r.conditions ?? []).some(c => c.field && c.operator);
}

/** Form state → the JSON shape TagRule deserialises from. Blank fields are dropped, not sent as 0. */
export function toTagRulePayload(r) {
  const num  = (v) => (v === '' || v === null ? null : Number(v));
  const list = (v) => {
    const parts = String(v).split(',').map(x => x.trim()).filter(Boolean);
    return parts.length ? parts : null;
  };
  return {
    recordType:           r.recordType || null,
    genreIds:             list(r.genreIds)?.map(Number) ?? null,
    languages:            list(r.languages),
    minVoteAverage:       num(r.minVoteAverage),
    minVoteCount:         num(r.minVoteCount),
    minPopularity:        num(r.minPopularity),
    releasedWithinDays:   num(r.releasedWithinDays),
    addedWithinDays:      num(r.addedWithinDays),
    publishedWithinDays:  num(r.publishedWithinDays),
    newContentWithinDays: num(r.newContentWithinDays),
    releasingWithinNextDays: num(r.releasingWithinNextDays),
    // Tri-state: '' -> null (don't care), 'true' -> has files, 'false' -> has NO files.
    // Must send a real false, not drop it — false is what makes a Coming Soon rail work.
    requiresMediaFiles:   r.availability === '' ? null : r.availability === 'true',
    providerIds:          (r.providerIds ?? []).length ? r.providerIds : null,
    providerType:         (r.providerIds ?? []).length ? (r.providerType || 'FLATRATE') : null,
    providerRegion:       (r.providerIds ?? []).length ? (r.providerRegion || null) : null,
    // Drop half-filled rows — the backend skips them anyway, and sending them makes the stored
    // rule noisy and harder to read back in the editor.
    conditions:           (r.conditions ?? []).filter(c => c.field && c.operator),
    scoreBy:              r.scoreBy || null,
    scoreDirection:       r.scoreDirection || 'DESC',
    limit:                num(r.limit),
  };
}

/**
 * Structured criteria for an automatic tag. Deliberately not a SQL box: the backend compiles this
 * into a JPA Specification, so admin input arrives as bound parameters and a bad rule can only ever
 * match nothing.
 */
export default function TagRuleBuilder({ rule, onChange, sortFields, providers = [], providerTypes = [],
                          filterFields = [], genres = [] }) {
  const T = useT();
  const S = adminSurface(T);
  const inputSx = adminInputSx(T, S);
  const set = (k, v) => onChange({ ...rule, [k]: v });

  const numField = (key, label, helper, extra = {}) => (
    <TextField label={label} size="small" type="number" sx={{ flex: 1, minWidth: 130, ...inputSx }}
      value={rule[key]} onChange={e => set(key, e.target.value)}
      helperText={helper} inputProps={extra} />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 150, ...inputSx }}>
          <InputLabel>Type</InputLabel>
          <Select value={rule.recordType} label="Type"
            onChange={e => set('recordType', e.target.value)} MenuProps={getSelectMenuProps(T)}>
            <MenuItem value=""><em>Movies &amp; series</em></MenuItem>
            <MenuItem value="MOVIE">Movies only</MenuItem>
            <MenuItem value="TV_SERIES">Series only</MenuItem>
          </Select>
        </FormControl>
        <TextField label="Genre IDs" size="small" sx={{ flex: 1, minWidth: 150, ...inputSx }}
          value={rule.genreIds} onChange={e => set('genreIds', e.target.value)}
          placeholder="28, 12" helperText="TMDB genre ids, comma-separated. Matches ANY." />
        <TextField label="Languages" size="small" sx={{ flex: 1, minWidth: 150, ...inputSx }}
          value={rule.languages} onChange={e => set('languages', e.target.value)}
          placeholder="hi, en" helperText="Original language codes. Matches ANY." />
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {numField('minVoteAverage', 'Min rating', '0-10, e.g. 7.5', { min: 0, max: 10, step: 0.1 })}
        {numField('minVoteCount', 'Min votes', 'Excludes tiny samples', { min: 0 })}
        {numField('minPopularity', 'Min popularity', 'TMDB popularity', { min: 0 })}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {numField('releasedWithinDays', 'Released in last N days', 'By release / air date', { min: 1 })}
        {numField('publishedWithinDays', 'Published in last N days', 'When it went live here', { min: 1 })}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {numField('addedWithinDays', 'Added in last N days', 'When the draft was created', { min: 1 })}
        {numField('newContentWithinDays', 'New episode in last N days', 'Series that gained content', { min: 1 })}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {numField('releasingWithinNextDays', 'Releasing in next N days',
                  'Future dates only — for a Coming Soon rail', { min: 1 })}
        <FormControl size="small" sx={{ flex: 1, minWidth: 200, ...inputSx }}>
          <InputLabel>Availability</InputLabel>
          <Select value={rule.availability} label="Availability"
            onChange={e => set('availability', e.target.value)} MenuProps={getSelectMenuProps(T)}>
            <MenuItem value=""><em>Any</em></MenuItem>
            <MenuItem value="true">Playable now (has files)</MenuItem>
            <MenuItem value="false">Not yet available (no files)</MenuItem>
          </Select>
          <FormHelperText>
            &ldquo;Not yet available&rdquo; is what makes a Coming Soon rail. Such a record still has
            to be PUBLISHED to appear on any rail.
          </FormHelperText>
        </FormControl>
      </Box>

      <Divider sx={{ borderColor: S.divider }} />

      {/* Watch providers — "only on Netflix / Hotstar / Prime". Sourced from TMDB at ingest, so
          this is where TMDB says a title streams, not what's in your own library. */}
      {providers.length > 0 ? (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ flex: 1, minWidth: 220, ...inputSx }}>
            <InputLabel>Streaming on</InputLabel>
            <Select multiple value={rule.providerIds ?? []} label="Streaming on"
              onChange={e => set('providerIds', e.target.value)}
              MenuProps={getSelectMenuProps(T)}
              renderValue={(ids) => providers.filter(p => ids.includes(p.id))
                .map(p => p.name).join(', ')}>
              {providers.map(p => (
                <MenuItem key={p.id} value={p.id}>
                  <Typography sx={{ fontSize: 13 }}>{p.name}</Typography>
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Matches ANY of the selected services</FormHelperText>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140, ...inputSx }}
            disabled={(rule.providerIds ?? []).length === 0}>
            <InputLabel>How</InputLabel>
            <Select value={rule.providerType ?? 'FLATRATE'} label="How"
              onChange={e => set('providerType', e.target.value)} MenuProps={getSelectMenuProps(T)}>
              {(providerTypes.length ? providerTypes : ['FLATRATE', 'RENT', 'BUY', 'NETWORK'])
                .map(t => (
                  <MenuItem key={t} value={t}>
                    <Typography sx={{ fontSize: 13 }}>
                      {t === 'FLATRATE' ? 'Included in subscription' : t.charAt(0) + t.slice(1).toLowerCase()}
                    </Typography>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <TextField label="Region" size="small" sx={{ minWidth: 110, ...inputSx }}
            value={rule.providerRegion ?? ''} onChange={e => set('providerRegion', e.target.value)}
            placeholder="IN" helperText="Blank = any"
            disabled={(rule.providerIds ?? []).length === 0} />
        </Box>
      ) : (
        <Typography sx={{ fontSize: 11, color: T.textFaint }}>
          No watch-provider data yet — providers are pulled from TMDB when a record is ingested or
          refreshed, so this filter appears once some titles have it.
        </Typography>
      )}

      <Divider sx={{ borderColor: S.divider }} />

      {/* The generic half. The controls above are shortcuts for common combinations; anything else
          is expressible here without a code change, because the field list comes from the
          backend's metamodel scan. */}
      <Box>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: T.textFaint,
          textTransform: 'uppercase', letterSpacing: '.08em', mb: 1 }}>
          More conditions — any field
        </Typography>
        <TagConditionRows
          conditions={rule.conditions ?? []}
          onChange={(next) => set('conditions', next)}
          filterFields={filterFields}
          refData={{ providers, genres }}
        />
      </Box>

      <Divider sx={{ borderColor: S.divider }} />

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ flex: 1, minWidth: 200, ...inputSx }}>
          <InputLabel>Rank by</InputLabel>
          <Select value={rule.scoreBy} label="Rank by"
            onChange={e => set('scoreBy', e.target.value)} MenuProps={getSelectMenuProps(T)}>
            {/* tagPriority is excluded: it IS the score this rule computes. */}
            {sortFields.filter(f => f.value !== 'tagPriority').map(f => (
              <MenuItem key={f.value} value={f.value}>
                <Typography sx={{ fontSize: 13 }}>{f.label}</Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 110, ...inputSx }}>
          <InputLabel>Order</InputLabel>
          <Select value={rule.scoreDirection} label="Order"
            onChange={e => set('scoreDirection', e.target.value)} MenuProps={getSelectMenuProps(T)}>
            <MenuItem value="DESC">DESC</MenuItem>
            <MenuItem value="ASC">ASC</MenuItem>
          </Select>
        </FormControl>
        {numField('limit', 'Max records', 'Caps the tag (500 hard max)', { min: 1, max: 500 })}
      </Box>
    </Box>
  );
}
