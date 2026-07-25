import { useState } from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import { useT } from '@shared/theme';

/**
 * The common IPO terms a first-time applicant runs into on this site, each with a 1-line
 * plain-English definition — kept terse on purpose (this is a glossary, not an encyclopedia).
 * Ordered roughly by "how likely a reader is to meet this term first" (GMP/IPO/Mainboard/SME
 * up top since they're on every card) rather than alphabetically.
 */
const GLOSSARY_TERMS = [
  { term: 'GMP', def: 'Grey Market Premium — the unofficial premium IPO shares trade at before listing; a rough gauge of listing-day demand, not guaranteed.' },
  { term: 'IPO', def: 'Initial Public Offering — the first time a company sells shares to the public and lists on a stock exchange.' },
  { term: 'Mainboard', def: 'The main NSE/BSE listing board, for larger/established companies with the full regulatory requirements.' },
  { term: 'SME', def: 'Small & Medium Enterprises — a separate listing platform (NSE Emerge / BSE SME) for smaller companies, usually with a higher minimum investment per lot.' },
  { term: 'Lot size', def: 'The minimum number of shares you can bid for — you can only apply in whole multiples of one lot.' },
  { term: 'Price band', def: 'The price range (lower to upper) within which you can bid for shares; the final price is fixed within this band.' },
  { term: 'Cut-off price', def: 'Agreeing to pay whatever final price is decided within the band, instead of naming a specific price — the usual choice for retail investors.' },
  { term: 'QIB', def: 'Qualified Institutional Buyers — the reserved category for banks, mutual funds and other large institutional investors.' },
  { term: 'NII / HNI', def: 'Non-Institutional Investors / High Net-worth Individuals — the category for applications above ₹2 lakh, below the QIB threshold.' },
  { term: 'RII (Retail)', def: 'Retail Individual Investor — the category for individual applications up to ₹2 lakh; most first-time applicants fall here.' },
  { term: 'Anchor investor', def: 'A large institutional investor allotted shares a day before the IPO opens, at a fixed price — meant to signal confidence to other investors.' },
  { term: 'Subscription (x times)', def: 'How many times over the shares on offer were applied for — e.g. "3.2x" means demand was 3.2 times the shares available.' },
  { term: 'DRHP', def: 'Draft Red Herring Prospectus — the preliminary offer document filed with SEBI before an IPO is approved.' },
  { term: 'RHP', def: 'Red Herring Prospectus — the final offer document filed just before the IPO opens, with the price band and full details.' },
  { term: 'OFS (Offer for Sale)', def: 'Existing shareholders (promoters/investors) selling their own shares in the IPO — the company itself doesn’t receive this money.' },
  { term: 'Fresh issue', def: 'Brand-new shares issued by the company in the IPO — this money goes to the company itself.' },
  { term: 'Face value', def: 'The nominal/par value of a share set by the company (e.g. ₹10), distinct from the (usually much higher) issue/market price.' },
  { term: 'PAT', def: 'Profit After Tax — a company’s net profit, used to gauge financial health in the Financials section.' },
  { term: 'Listing gain', def: 'The percentage gain (or loss) between the issue price and the price the stock actually lists at on the exchange.' },
  { term: 'Allotment', def: 'The process of assigning shares to applicants — oversubscribed IPOs allot via a lottery/proportionate process, not to everyone who applied.' },
  { term: 'Refund', def: 'The blocked application amount released back to you for shares you didn’t get allotted.' },
  { term: 'Demat', def: 'Dematerialized account — where your allotted shares are credited electronically; required to apply for any IPO.' },
  { term: 'ASBA', def: 'Applications Supported by Blocked Amount — your bank blocks (doesn’t debit) the application money until allotment is finalized.' },
  { term: 'UPI mandate', def: 'The payment-approval request sent to your UPI app when you apply — approving it blocks the funds via ASBA.' },
];

/** One collapsible term/definition row — same accordion treatment as `IpoFaq`'s `FaqItem`
 * so the two glossary-adjacent sections read as one system. Owns its own `useT()`. */
function GlossaryItem({ item, expanded, onToggle }) {
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
        sx={{ px: 2, py: 0.25, minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.85 } }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
          {item.term}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.75 }}>
        <Typography sx={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6 }}>
          {item.def}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}

/**
 * Compact, collapsible "IPO terms" glossary for the list page, placed below the FAQ so a
 * reader who's just learned the concepts (via the FAQ) has a quick term-by-term reference
 * right underneath. Two-column on larger screens (single column on mobile) to keep the whole
 * glossary scannable without an excessive scroll. Only one term open at a time, matching
 * `IpoFaq`'s accordion behavior. Purely static content, no data dependency.
 */
export default function IpoGlossary() {
  const T = useT();
  const [expandedIndex, setExpandedIndex] = useState(null);

  return (
    <Box component="section" sx={{ mt: 4, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
        <MenuBookOutlinedIcon sx={{ fontSize: 15, color: T.teal }} />
        <Typography sx={{ fontSize: 11, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
          IPO terms
        </Typography>
      </Box>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        columnGap: 2,
      }}>
        {GLOSSARY_TERMS.map((item, i) => (
          <GlossaryItem
            key={item.term}
            item={item}
            expanded={expandedIndex === i}
            onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
          />
        ))}
      </Box>
    </Box>
  );
}
