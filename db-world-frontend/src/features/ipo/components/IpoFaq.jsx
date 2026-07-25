import { useState } from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { useT } from '@shared/theme';

/**
 * Six common questions, answered honestly and briefly (1-3 sentences each). The last
 * one carries the "aggregated public data, not investment advice" disclaimer — kept
 * light-touch rather than a wall of legalese, but unambiguous. The allotment question
 * mirrors (without duplicating verbatim) the numbered steps in `AllotmentGuide`, which
 * lives on each IPO's own Allotment tab — there's no single allotment-guide route to deep
 * link to from this list-page FAQ, so the answer points there instead of a specific anchor.
 */
const FAQ_ITEMS = [
  {
    q: 'What is GMP (Grey Market Premium)?',
    a: 'GMP is the premium at which IPO shares informally trade before listing, in an unofficial "grey market". It’s a rough gauge of listing-day demand — not an official or guaranteed price.',
  },
  {
    q: 'What does "subscription" mean?',
    a: 'Subscription is how many times the shares on offer were applied for, usually split by investor category (QIB / NII / Retail). "3.2× subscribed" means demand was 3.2 times the shares available.',
  },
  {
    q: "What's the difference between Mainboard and SME IPOs?",
    a: 'Mainboard IPOs list on the main NSE/BSE boards and suit larger, established companies. SME IPOs are for smaller companies, list on the NSE Emerge / BSE SME platforms, and typically need a higher minimum investment per lot.',
  },
  {
    q: 'What is a lot size and minimum investment?',
    a: 'A lot is the minimum number of shares you can apply for — you can only bid in whole multiples of it. Minimum investment = lot size × the upper price band.',
  },
  {
    q: 'How do I check my IPO allotment?',
    a: 'Wait for the allotment date, then use "Check allotment status" on that IPO’s Allotment tab — it opens the registrar/BSE page where you enter your PAN or application number and solve a CAPTCHA. That tab also has a step-by-step guide.',
  },
  {
    q: 'Is this data official or real-time?',
    a: 'No — it’s aggregated from public sources and refreshed periodically, not a live official feed. It’s provided for information only, not investment advice — always confirm on the official registrar/exchange site before acting.',
  },
];

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
 * FAQ accordion for the list page, below `WhyUseThis`. Only one question open at a time
 * (`expandedIndex`, not a Set) — simpler state and matches the reference pattern used by
 * the cinema feature's season accordion. Purely static content, no data dependency.
 */
export default function IpoFaq() {
  const T = useT();
  const [expandedIndex, setExpandedIndex] = useState(null);

  return (
    <Box component="section" sx={{ mt: 4, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
        <HelpOutlineRoundedIcon sx={{ fontSize: 16, color: T.teal }} />
        <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
          Frequently asked questions
        </Typography>
      </Box>
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
    </Box>
  );
}
