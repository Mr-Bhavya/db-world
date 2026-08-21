import {
  Box, Typography, TextField, MenuItem, Select, FormControl, InputLabel,
  IconButton, Tooltip,
} from '@mui/material';
import AddIcon    from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useT, getSelectMenuProps } from '@shared/theme';
import { adminSurface } from '@features/admin/adminUi';
import { adminInputSx } from './tagsUtils';

/**
 * The generic half of a tag rule: rows of field / comparison / value.
 *
 * Everything here is driven by `filterFields` from the rail-metadata endpoint, which the backend
 * discovers from the JPA metamodel. So a new column on a record becomes filterable with no change
 * to this file — that was the whole point, since the previous builder's criteria were hand-written
 * and any genuinely new dimension needed a backend edit.
 *
 * The admin never writes a query. Each row is: pick a field, pick a comparison the backend says is
 * legal for that field's type, then enter a value in a control that matches the type.
 */

/** Operators that need no value at all — the comparison says everything. */
const VALUELESS = new Set(['hasAny', 'hasNone', 'isSet', 'isUnset']);

/** Operators that take a list rather than one value. */
const MULTI = new Set(['in', 'notIn']);

const BLANK_CONDITION = { field: '', operator: '', value: '', values: [] };

/** Options for a REFERENCE field — genres and providers come from different metadata lists. */
function referenceOptions(fieldValue, { providers, genres }) {
  if (fieldValue === 'provider') return providers.map(p => ({ value: p.id, label: p.name }));
  if (fieldValue === 'genre')    return genres.map(g => ({ value: g.id, label: g.name }));
  return [];
}

function ConditionRow({ row, index, fields, refData, onChange, onRemove }) {
  const T = useT();
  const S = adminSurface(T);
  const inputSx = adminInputSx(T, S);

  const def = fields.find(f => f.value === row.field);
  const set = (patch) => onChange(index, { ...row, ...patch });

  // Changing the field invalidates the operator and value — a "contains" carried over onto a number
  // column would be silently dropped by the backend, which looks like the row did nothing.
  const onFieldChange = (value) => {
    const next = fields.find(f => f.value === value);
    set({
      field: value,
      operator: next?.operators?.[0]?.value ?? '',
      value: '',
      values: [],
    });
  };

  const needsValue = def && row.operator && !VALUELESS.has(row.operator);
  const isMulti    = MULTI.has(row.operator);
  const refOptions = def?.type === 'REFERENCE' ? referenceOptions(def.value, refData) : [];
  const enumOptions = def?.type === 'ENUM' ? (def.options ?? []) : [];
  const pickable   = refOptions.length ? refOptions : enumOptions;

  /** Numbers, days and dates all want a numeric-ish control; text wants free text. */
  const valueControl = () => {
    if (!needsValue) return null;

    if (pickable.length) {
      return (
        <FormControl size="small" sx={{ flex: 2, minWidth: 180, ...inputSx }}>
          <InputLabel>Value</InputLabel>
          <Select
            multiple={isMulti}
            value={isMulti ? (row.values ?? []) : (row.value ?? '')}
            label="Value"
            onChange={e => set(isMulti ? { values: e.target.value } : { value: e.target.value })}
            MenuProps={getSelectMenuProps(T)}
            renderValue={(v) => (Array.isArray(v) ? v : [v])
              .map(x => pickable.find(o => String(o.value) === String(x))?.label ?? x)
              .join(', ')}>
            {pickable.map(o => (
              <MenuItem key={o.value} value={o.value}>
                <Typography sx={{ fontSize: 13 }}>{o.label}</Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    if (isMulti) {
      // Free-text multi-value: comma-separated is far less fiddly than a chip editor for the rare
      // case of "originalLanguage is any of hi, ta, te".
      return (
        <TextField label="Values" size="small" sx={{ flex: 2, minWidth: 180, ...inputSx }}
          value={(row.values ?? []).join(', ')}
          onChange={e => set({ values: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
          placeholder="hi, ta, te" helperText="Comma-separated" />
      );
    }

    const dayOp = row.operator === 'withinLastDays' || row.operator === 'withinNextDays';
    const numeric = dayOp || def.type === 'NUMBER';

    if (def.type === 'BOOLEAN') {
      return (
        <FormControl size="small" sx={{ flex: 2, minWidth: 180, ...inputSx }}>
          <InputLabel>Value</InputLabel>
          <Select value={row.value ?? ''} label="Value"
            onChange={e => set({ value: e.target.value })} MenuProps={getSelectMenuProps(T)}>
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </Select>
        </FormControl>
      );
    }

    return (
      <TextField
        label={dayOp ? 'Days' : 'Value'}
        size="small"
        type={numeric ? 'number' : 'text'}
        sx={{ flex: 2, minWidth: 180, ...inputSx }}
        value={row.value ?? ''}
        onChange={e => set({ value: e.target.value })}
        inputProps={numeric ? { min: 0 } : undefined}
        placeholder={def.type === 'DATE_STRING' && !dayOp ? '2024-01-15' : undefined}
        helperText={dayOp ? 'Number of days' : undefined}
      />
    );
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <FormControl size="small" sx={{ flex: 2, minWidth: 180, ...inputSx }}>
        <InputLabel>Field</InputLabel>
        <Select value={row.field ?? ''} label="Field"
          onChange={e => onFieldChange(e.target.value)} MenuProps={getSelectMenuProps(T)}>
          {fields.map(f => (
            <MenuItem key={f.value} value={f.value}>
              <Typography sx={{ fontSize: 13 }}>{f.label}</Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ flex: 2, minWidth: 170, ...inputSx }} disabled={!def}>
        <InputLabel>Comparison</InputLabel>
        <Select value={row.operator ?? ''} label="Comparison"
          onChange={e => set({ operator: e.target.value, value: '', values: [] })}
          MenuProps={getSelectMenuProps(T)}>
          {(def?.operators ?? []).map(o => (
            <MenuItem key={o.value} value={o.value}>
              <Typography sx={{ fontSize: 13 }}>{o.label}</Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {valueControl()}

      <Tooltip title="Remove condition">
        <IconButton size="small" onClick={() => onRemove(index)}
          sx={{ mt: 0.5, color: T.textFaint, '&:hover': { color: T.error, bgcolor: `${T.error}18` } }}>
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default function TagConditionRows({ conditions = [], onChange, filterFields = [], refData }) {
  const T = useT();

  const update = (i, row) => onChange(conditions.map((c, idx) => (idx === i ? row : c)));
  const remove = (i)      => onChange(conditions.filter((_, idx) => idx !== i));
  const add    = ()       => onChange([...conditions, { ...BLANK_CONDITION }]);

  if (filterFields.length === 0) {
    return (
      <Typography sx={{ fontSize: 11, color: T.textFaint }}>
        Loading available fields…
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {conditions.map((row, i) => (
        <ConditionRow key={i} row={row} index={i} fields={filterFields} refData={refData}
          onChange={update} onRemove={remove} />
      ))}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Add condition">
          <IconButton size="small" onClick={add}
            sx={{ color: T.teal, border: `1px dashed ${T.teal}66`, borderRadius: 1,
              '&:hover': { bgcolor: `${T.teal}14` } }}>
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: 11, color: T.textFaint }}>
          {conditions.length === 0
            ? 'Add a condition — any field on a record, no code needed'
            : 'All conditions must match (AND)'}
        </Typography>
      </Box>
    </Box>
  );
}

export { BLANK_CONDITION };
