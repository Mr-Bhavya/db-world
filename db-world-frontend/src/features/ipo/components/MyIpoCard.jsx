import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useT } from '@shared/theme';
import Constants from '@shared/constants';
import { statusMeta, ipoTypeMeta, allotmentResultMeta } from '../utils/format';
import CompanyLogo from './CompanyLogo';
import GuidedCheckButton from './GuidedCheckButton';

/**
 * One row of the "My IPOs" list: the IPO summary (logo/name/type/status), the registrar's
 * allotment status alongside the applicant's own self-recorded result, the saved application
 * details (app no / masked PAN), a guided-check button, and a link into the full detail page.
 * The whole card navigates to the detail page on click; the guided-check link stops that
 * propagation so it always opens the registrar page in its own new tab instead.
 */
export default function MyIpoCard({ row, index = 0 }) {
  const T = useT();
  const navigate = useNavigate();
  const { application, ipo } = row;
  const meta = statusMeta(ipo.status, T);
  const typeMeta = ipoTypeMeta(ipo.ipoType, T);
  const resultMeta = allotmentResultMeta(application.allotmentResult, T);

  const savedParts = [
    application.applicationNo ? `App no ${application.applicationNo}` : null,
    application.panLast4 ? `PAN ••••${application.panLast4}` : null,
  ].filter(Boolean);

  const goToDetail = () => navigate(Constants.ipoDetailPath(ipo.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.04 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      style={{ height: '100%', width: '100%', minWidth: 0 }}
    >
      <Box
        onClick={goToDetail}
        role="button"
        tabIndex={0}
        aria-label={`View ${ipo.companyName} details`}
        onKeyDown={(e) => {
          // The guided-check link and "View IPO" button below are their own focusable,
          // keyboard-activatable elements nested inside this card — only react to a
          // keydown that lands directly on the card surface itself, so pressing
          // Enter/Space on one of those doesn't also bubble up and double-navigate.
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goToDetail();
          }
        }}
        sx={{
          bgcolor: T.glass, border: `1px solid ${T.border}`, borderLeft: `3px solid ${meta.color}`,
          borderRadius: 3, cursor: 'pointer', width: '100%', minWidth: 0, boxSizing: 'border-box',
          height: '100%', display: 'flex', flexDirection: 'column', gap: 1.1, p: 1.75, overflow: 'hidden',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:hover': { borderColor: T.teal, boxShadow: `0 8px 24px ${T.tealGlow}` },
          '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
            <CompanyLogo
              logoUrl={ipo.logoUrl}
              logoDomain={ipo.logoDomain}
              companyName={ipo.companyName}
              size={42}
              radius={2}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, lineHeight: 1.3 }} noWrap>
                {ipo.companyName}
              </Typography>
              {typeMeta && (
                <Box sx={{ display: 'inline-flex', px: 0.75, py: 0.1, borderRadius: 999, bgcolor: typeMeta.bg, mt: 0.5 }}>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: typeMeta.color }}>{typeMeta.label}</Typography>
                </Box>
              )}
            </Box>
          </Box>
          <Box sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: meta.bg, border: `1px solid ${meta.color}55`, flexShrink: 0, maxWidth: '40%' }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: meta.color }} noWrap>{meta.label}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.6, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11.5, color: T.textMuted }} noWrap>
            Allotment: {ipo.allotmentStatus ?? 'Not announced yet'}
          </Typography>
          <Box sx={{ px: 0.75, py: 0.1, borderRadius: 999, bgcolor: resultMeta.bg, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 800, color: resultMeta.color }}>{resultMeta.label}</Typography>
          </Box>
        </Box>

        {savedParts.length > 0 && (
          <Typography sx={{ fontSize: 12, color: T.textFaint }} noWrap>
            {savedParts.join(' • ')}
          </Typography>
        )}

        <Box sx={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1,
          mt: 'auto', pt: 1, borderTop: `1px solid ${T.border}`,
        }}>
          <GuidedCheckButton registrarUrl={ipo.registrarUrl} size="small" />
          <Button
            size="small"
            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={(e) => { e.stopPropagation(); goToDetail(); }}
            sx={{ color: T.teal, fontSize: 12, fontWeight: 700, flexShrink: 0 }}
          >
            View IPO
          </Button>
        </Box>
      </Box>
    </motion.div>
  );
}
