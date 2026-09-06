import { useState } from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useT } from '@shared/theme';
import { sectionList } from '@shared/content/siteContent';

/**
 * Six common questions, answered honestly and briefly (1-3 sentences each). The last
 * one carries the "aggregated public data, not investment advice" disclaimer — kept
 * light-touch rather than a wall of legalese, but unambiguous. The allotment question
 * mirrors (without duplicating verbatim) the numbered steps in `AllotmentGuide`, which
 * lives on each IPO's own Allotment tab — there's no single allotment-guide route to deep
 * link to from this list-page FAQ, so the answer points there instead of a specific anchor.
 */
const FAQ_ITEMS = sectionList('ipo', 'faq')
  // Shared file speaks {term, text}; this accordion has always spoken {q, a}.
  .map(({ term, text }) => ({ q: term, a: text }));

/** One collapsible Q&A row. Owns its own `useT()` per the project convention. */
function FaqItem({ item, expanded, onToggle }) {
  const T = useT();
  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      disableGutters
      elevation={0}
      sx={{
        bgcolor: T.glass,
        border: `1px solid ${expanded ? alpha(T.teal, 0.4) : T.border}`,
        borderRadius: '12px !important',
        mb: 1,
        '&:before': { display: 'none' },
        transition: 'border-color 0.2s',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon sx={{ color: expanded ? T.teal : T.textFaint }} />}
        sx={{ px: 2, py: 0.25, minHeight: 48, '& .MuiAccordionSummary-content': { my: 1 } }}
      >
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: T.textPrimary }}>
          {item.q}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
        <Typography sx={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65 }}>
          {item.a}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}

/**
 * FAQ accordion — the "FAQ" sub-tab content of the list page's compact `IpoLearn` card.
 * Only one question open at a time (`expandedIndex`, not a Set) — simpler state and
 * matches the reference pattern used by the cinema feature's season accordion. Purely
 * static content, no data dependency.
 *
 * No longer a standalone page section with its own heading/icon — `IpoLearn` supplies
 * the card chrome and the FAQ/Terms sub-tab picker around this, so this just renders the
 * accordion list itself (including the closing "not investment advice" disclaimer item).
 */
export default function IpoFaq() {
  const [expandedIndex, setExpandedIndex] = useState(null);

  return (
    <Box sx={{ maxWidth: 780 }}>
      {FAQ_ITEMS.map((item, i) => (
        <FaqItem
          key={item.q}
          item={item}
          expanded={expandedIndex === i}
          onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
        />
      ))}
    </Box>
  );
}
