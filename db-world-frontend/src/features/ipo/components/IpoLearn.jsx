import { useMemo, useState } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, TextField, InputAdornment } from '@mui/material';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useT } from '@shared/theme';
import IpoFaq from './IpoFaq';
import { GLOSSARY_TERMS } from './IpoGlossary';

/** One term/definition tile in the dense Terms grid — a small bordered card (term in
 * teal, 1-line definition below) rather than an accordion, so the full list reads as a
 * scannable reference grid instead of a long stack of expand/collapse rows. Owns its own
 * `useT()` per the project convention. */
function TermCard({ term, def }) {
  const T = useT();
  return (
    <Box sx={{ p: 1.1, borderRadius: 2, bgcolor: T.glassHover, border: `1px solid ${T.border}`, minWidth: 0 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, color: T.teal, mb: 0.25 }}>
        {term}
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.5 }}>
        {def}
      </Typography>
    </Box>
  );
}

/**
 * Searchable, dense "IPO terms" grid — the `IpoLearn` card's Terms sub-tab. Live-filters
 * `GLOSSARY_TERMS` (matching the term OR its definition, case-insensitive) as the user
 * types, so the ~24-term glossary only ever needs a compact multi-column grid on screen
 * rather than the page-length cost of a fully expanded accordion list. An empty search
 * shows every term.
 */
function TermsPanel() {
  const T = useT();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOSSARY_TERMS;
    return GLOSSARY_TERMS.filter(
      ({ term, def }) => term.toLowerCase().includes(q) || def.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        placeholder="Search terms…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon sx={{ fontSize: 16, color: T.textFaint }} />
            </InputAdornment>
          ),
        }}
        sx={{
          mb: 1.5,
          '& .MuiInputBase-input': { color: T.textPrimary, fontSize: 12.5 },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.borderHover },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.teal },
        }}
      />
      {filtered.length === 0 ? (
        <Typography sx={{ fontSize: 12.5, color: T.textFaint, textAlign: 'center', py: 2 }}>
          No terms match “{query}”.
        </Typography>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))' },
          gap: 1.25,
        }}>
          {filtered.map((item) => (
            <TermCard key={item.term} term={item.term} def={item.def} />
          ))}
        </Box>
      )}
    </Box>
  );
}

const SUB_TABS = [
  { value: 'faq', label: 'FAQ', Icon: HelpOutlineRoundedIcon },
  { value: 'terms', label: 'Terms', Icon: MenuBookOutlinedIcon },
];

/**
 * Compact combined "Learn IPOs" card — replaces the list page's two separate, permanently
 * expanded FAQ + Glossary sections with one card that has FAQ | Terms inner sub-tabs
 * (default FAQ). A first-time visitor still gets both references, just one at a time
 * behind a lightweight toggle, instead of the page paying the full scroll-length cost of
 * both sections at once.
 *
 * FAQ sub-tab reuses `IpoFaq`'s accordion as-is (including its disclaimer item). Terms
 * sub-tab is the new searchable dense grid (`TermsPanel`) over the same `GLOSSARY_TERMS`
 * data the old standalone `IpoGlossary` section used — not another accordion list, since
 * that didn't scale well once it needed to sit behind a search box.
 */
export default function IpoLearn() {
  const T = useT();
  const [subTab, setSubTab] = useState('faq');

  return (
    <Box component="section" sx={{
      mt: 4, mb: 2, p: { xs: 1.5, sm: 2.25 }, borderRadius: 3,
      bgcolor: T.glass, border: `1px solid ${T.border}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <SchoolOutlinedIcon sx={{ fontSize: 16, color: T.teal }} />
          <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
            Learn IPOs
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={subTab}
          exclusive
          size="small"
          onChange={(_e, v) => v && setSubTab(v)}
          aria-label="Learn IPOs section"
          sx={{
            '& .MuiToggleButton-root': {
              fontSize: 11.5, fontWeight: 700, color: T.textMuted, border: `1px solid ${T.border}`,
              px: 1.25, py: 0.4, textTransform: 'none',
            },
            '& .Mui-selected': { color: `${T.teal} !important`, bgcolor: `${T.tealBg} !important`, borderColor: `${T.teal} !important` },
          }}
        >
          {SUB_TABS.map(({ value, label, Icon }) => (
            <ToggleButton key={value} value={value}>
              <Icon sx={{ fontSize: 15, mr: 0.5 }} />
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {subTab === 'faq' ? <IpoFaq /> : <TermsPanel />}
    </Box>
  );
}
