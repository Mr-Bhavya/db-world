import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Skeleton, Typography, useMediaQuery } from '@mui/material';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import { useGroups, useCreateGroup, useCreateDirect, usePersonalLedger } from './hooks/useTally';
import { splitLedgers } from './utils/tallyFormat';
import {
  TALLY_COLUMNS, TALLY_PAGE_MAX_W, TALLY_PAGE_PT, TALLY_PAGE_PX,
} from './utils/tallyLayout';
import CreateGroupDialog from './components/CreateGroupDialog';
import StartDirectDialog from './components/StartDirectDialog';
import ImportSplitwiseDialog from './components/ImportSplitwiseDialog';
import BalanceHero, { BALANCE_HERO_MIN_H } from './components/BalanceHero';
import LedgerRow, { LEDGER_ROW_MIN_H } from './components/LedgerRow';
import LedgerAvatar from './components/LedgerAvatar';
import CollapsedLedgers from './components/CollapsedLedgers';
import NewLedgerMenu from './components/NewLedgerMenu';

/**
 * The landing screen: what needs you, then everything else.
 *
 * <h2>Why this is not a grid of cards</h2>
 * It was, and with four of five ledgers settled the one that needed attention was a tile among
 * identical tiles while the overall balance was a line of subtitle text above them. Nearly every
 * ledger in a working expense app is square nearly all of the time, so a layout that gives them
 * all equal weight spends its whole screen on the answer "nothing".
 *
 * <p>So the page is ordered by <em>what it asks of you</em>: the overall balance as the subject,
 * then the ledgers with something outstanding as full-width rows, then your own spending, then
 * everything square folded behind a single line, then archived behind another. Filtering by
 * People-or-Groups is gone — that was never the question anybody opened this with.
 */
export default function TallyPage() {
  usePageMeta('Tally', {
    description: 'Split expenses with anyone on DB World, including people without an account.',
  });

  const T = useT();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const { data: groups = [], isLoading } = useGroups();
  const createGroup = useCreateGroup();
  const createDirect = useCreateDirect();
  const personal = usePersonalLedger();

  const [creating, setCreating] = useState(false);
  const [startingDirect, setStartingDirect] = useState(false);
  const [importing, setImporting] = useState(false);

  const { personal: personalLedger, needsYou, settled, archived, net } =
    useMemo(() => splitLedgers(groups), [groups]);

  const open = (ledger) => navigate(Constants.tallyGroupPath(ledger.id));

  const openPersonal = () => {
    if (personalLedger) { open(personalLedger); return; }
    personal.mutate(undefined, {
      onSuccess: (ledger) => ledger?.id && navigate(Constants.tallyGroupPath(ledger.id)),
    });
  };

  const nothingAtAll = !isLoading && groups.every((g) => g.kind === 'PERSONAL');
  const wide = useMediaQuery((theme) => theme.breakpoints.up('md'), { noSsr: true });

  // On a desktop there are always two columns, and an empty main column beside a full sidebar
  // looks like a failed render rather than a layout. So with nothing outstanding, the ledgers
  // that are there -- settled ones, or failing those archived ones -- move into the main column,
  // open. On a phone they stay folded: there it is one column, and nothing competes with them.
  const openInMain = wide && needsYou.length === 0
    ? (settled.length > 0 ? 'settled' : archived.length > 0 ? 'archived' : null)
    : null;

  return (
    <Box sx={{
      minHeight: '100dvh', bgcolor: T.bg,
      px: TALLY_PAGE_PX,
      pt: TALLY_PAGE_PT,
      pb: { xs: 'calc(96px + env(safe-area-inset-bottom))', sm: 6 },
    }}>
      {/* The same width as a ledger, always. This page used to widen to 1060px only while
          something was outstanding and stay at 720 otherwise, and the ledger you opened from
          it was 760 or 1080 depending on its kind -- so every move between the two changed the
          width of the screen. Two columns at a shared width fixes both, and still never leaves
          a name at one edge of a desktop and its amount at the other. */}
      <Box sx={{ maxWidth: TALLY_PAGE_MAX_W, mx: 'auto', width: '100%' }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <Box
          component={motion.div}
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 2, mb: { xs: 2.5, sm: 3 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <ReceiptLongRoundedIcon sx={{ fontSize: 24, color: T.teal }} />
            <Typography component="h1" sx={{
              fontSize: { xs: 24, sm: 28 }, fontWeight: 800,
              color: T.textPrimary, letterSpacing: -0.8,
            }}>
              Tally
            </Typography>
          </Box>

          {/* Two actions, not four. Spending is a place you go; the rest all create something
              and live together behind New. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Box
              component={motion.button}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(Constants.DB_TALLY_REPORT_ROUTE)}
              aria-label="Your spending"
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.75,
                px: { xs: 1.25, sm: 2 }, py: 1, borderRadius: 2.5, cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                color: T.textPrimary, bgcolor: T.glass, border: `1px solid ${T.border}`,
                transition: 'background-color .18s ease',
                '&:hover': { bgcolor: T.glassHover },
                '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
              }}
            >
              <InsightsRoundedIcon sx={{ fontSize: 18 }} />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Spending</Box>
            </Box>

            <NewLedgerMenu
              onSplitWithSomeone={() => setStartingDirect(true)}
              onNewGroup={() => setCreating(true)}
              onImport={() => setImporting(true)}
            />
          </Box>
        </Box>

        {isLoading ? (
          <LoadingState T={T} />
        ) : (
          <>
            <BalanceHero
              net={net}
              ledgerCount={needsYou.length + settled.length}
              // A way straight there only when there is one place to go; with several
              // outstanding the list below already is the answer.
              only={needsYou.length === 1 ? needsYou[0] : null}
              onOpenOnly={() => needsYou.length === 1 && open(needsYou[0])}
            />

            {/* One column on a phone, two from md. The DOM order is the mobile order, so what
                becomes the sidebar on a desktop is simply what comes after the main list —
                no duplicated markup and no reordering to keep in sync. */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: TALLY_COLUMNS },
              gap: { xs: 0, md: 3 },
              alignItems: 'start',
            }}>
              <Box sx={{ minWidth: 0 }}>
                {nothingAtAll && <EmptyState T={T} onCreate={() => setStartingDirect(true)} />}

                {openInMain && (
                  <OpenLedgers
                    T={T}
                    ledgers={openInMain === 'settled' ? settled : archived}
                    label={openInMain === 'settled' ? 'Settled up' : 'Archived'}
                    icon={openInMain === 'settled'
                      ? <CheckCircleRoundedIcon sx={{ fontSize: 15, color: T.success }} />
                      : <Inventory2OutlinedIcon sx={{ fontSize: 15, color: T.textFaint }} />}
                    onOpen={open}
                  />
                )}

                {needsYou.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <SectionLabel
                      T={T}
                      icon={<ErrorOutlineRoundedIcon sx={{ fontSize: 15, color: T.warning }} />}
                      label={`Needs you · ${needsYou.length}`}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                      <AnimatePresence initial={false}>
                        {needsYou.map((ledger, i) => (
                          <LedgerRow
                            key={ledger.id}
                            ledger={ledger}
                            index={i}
                            onOpen={() => open(ledger)}
                          />
                        ))}
                      </AnimatePresence>
                    </Box>
                  </Box>
                )}
              </Box>

              <Box sx={{ minWidth: 0 }}>
                {/* Your own spending is always here and never has a balance, so it belongs to
                    neither list -- on a desktop it heads the sidebar. */}
                <PersonalRow
                  T={T}
                  ledger={personalLedger}
                  busy={personal.isPending}
                  onOpen={openPersonal}
                />

                {openInMain !== 'settled' && (
                  <CollapsedLedgers
                    ledgers={settled}
                    label="settled up"
                    icon={<CheckCircleRoundedIcon sx={{ fontSize: 18 }} />}
                    onOpen={open}
                  />
                )}

                {openInMain !== 'archived' && (
                  <CollapsedLedgers
                    ledgers={archived}
                    label="archived"
                    tone="muted"
                    icon={<Inventory2OutlinedIcon sx={{ fontSize: 17 }} />}
                    onOpen={open}
                  />
                )}
              </Box>
            </Box>
          </>
        )}
      </Box>

      {/* One thumb-reachable action on a phone, where the header's New menu is a stretch. */}
      <Box
        component={motion.button}
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={() => setStartingDirect(true)}
        aria-label="Split with someone"
        sx={{
          display: { xs: 'grid', sm: 'none' }, placeItems: 'center',
          position: 'fixed', right: 18, bottom: 'calc(18px + env(safe-area-inset-bottom))',
          width: 56, height: 56, borderRadius: '50%', cursor: 'pointer',
          bgcolor: T.teal, color: '#fff', border: 'none',
          boxShadow: `0 8px 24px ${T.tealGlow}`,
        }}
      >
        <AddRoundedIcon sx={{ fontSize: 26 }} />
      </Box>

      <CreateGroupDialog
        open={creating}
        onClose={() => setCreating(false)}
        busy={createGroup.isPending}
        onCreate={(body) => createGroup.mutate(body, {
          onSuccess: (group) => {
            setCreating(false);
            // Straight into it: a new group is empty, and the next thing anybody wants is to
            // put the people in it.
            if (group?.id) navigate(Constants.tallyGroupPath(group.id));
          },
        })}
      />

      <StartDirectDialog
        open={startingDirect}
        onClose={() => setStartingDirect(false)}
        busy={createDirect.isPending}
        onStart={(body) => createDirect.mutate(body, {
          onSuccess: (ledger) => {
            setStartingDirect(false);
            if (ledger?.id) navigate(Constants.tallyGroupPath(ledger.id));
          },
        })}
      />

      <ImportSplitwiseDialog
        open={importing}
        onClose={() => setImporting(false)}
        onImported={(result) => {
          if (result?.group?.id) navigate(Constants.tallyGroupPath(result.group.id));
        }}
      />
    </Box>
  );
}

/* ============================== pieces ============================== */

function SectionLabel({ T, icon, label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
      {icon}
      <Typography sx={{
        fontSize: 11.5, fontWeight: 800, letterSpacing: 0.7,
        textTransform: 'uppercase', color: T.textFaint,
      }}>
        {label}
      </Typography>
    </Box>
  );
}

/**
 * Your own spending.
 *
 * <p>Before it exists this is the invitation to start one, and afterwards the way in — the same
 * component either way, so the row does not move on the page the moment it is tapped.
 */
function PersonalRow({ T, ledger, busy, onOpen }) {
  const started = Boolean(ledger);

  return (
    <Box
      component={motion.button}
      type="button"
      whileTap={{ scale: 0.995 }}
      onClick={busy ? undefined : onOpen}
      aria-label={started ? 'Open your own spending' : 'Start tracking your own spending'}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, width: '100%',
        px: 1.75, py: 1.5, mb: 2.5, borderRadius: 3.5,
        textAlign: 'left', fontFamily: 'inherit',
        cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
        bgcolor: T.tealBg,
        border: `1px ${started ? 'solid' : 'dashed'} ${T.glassBorder}`,
        transition: 'background-color .18s ease, border-color .18s ease',
        '&:hover': { bgcolor: T.tealBgHover, borderColor: T.glassBorderHover },
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
      }}
    >
      <LedgerAvatar ledger={ledger ?? { kind: 'PERSONAL' }} size="sm" />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontSize: 14.5, fontWeight: 700, color: T.textPrimary }}>
          {started ? ledger.name : 'Track your own spending'}
        </Typography>
        <Typography noWrap sx={{ fontSize: 12, color: T.textFaint, mt: 0.1 }}>
          {started
            ? 'Just for you — nothing shared, nobody to settle with'
            : 'Keep your own expenses here alongside the shared ones'}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Ledgers listed open in the main column — the desktop's answer to "nothing needs you".
 *
 * <p>The same rows {@link CollapsedLedgers} shows once expanded, under the same kind of label as
 * "Needs you", so the main column always starts the same way whatever is in it.
 */
function OpenLedgers({ T, ledgers, label, icon, onOpen }) {
  return (
    <Box sx={{ mb: 3 }}>
      <SectionLabel T={T} icon={icon} label={`${label} · ${ledgers.length}`} />
      <Box sx={{
        borderRadius: 3, overflow: 'hidden', border: `1px solid ${T.border}`,
        '& > *:not(:last-child)': { borderBottom: `1px solid ${T.border}` },
      }}>
        {ledgers.map((ledger, i) => (
          <LedgerRow
            key={ledger.id}
            ledger={ledger}
            index={i}
            variant="compact"
            onOpen={() => onOpen(ledger)}
          />
        ))}
      </Box>
    </Box>
  );
}

/**
 * The page's shape while the ledgers load.
 *
 * <p>Both heights come from the components being stood in for rather than from numbers typed
 * here. The hand-written ones had drifted — 104px against a hero that rests at 111 on a phone
 * and 126 from `sm` up, and 72px against a 74px row — so the whole list stepped down a few
 * pixels per item the moment the data arrived.
 *
 * <p>Laid out in the page's own two columns. It used to be one full-width column with nothing
 * where the sidebar goes, so on a desktop the rows arrived at half the width they were drawn at
 * and the sidebar appeared from nowhere beside them. The text bars sit inside the Typography
 * they stand in for, so each is exactly one line box of the real font.
 */
function LoadingState({ T }) {
  const bar = { bgcolor: T.glassHover, borderRadius: 1 };
  return (
    <Box>
      <Skeleton variant="rounded"
        sx={{ height: BALANCE_HERO_MIN_H, bgcolor: T.glass, borderRadius: 3.5, mb: 3 }} />

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: TALLY_COLUMNS },
        gap: { xs: 0, md: 3 },
        alignItems: 'start',
      }}>
        <Box sx={{ minWidth: 0, mb: 3 }}>
          {/* The section label, which the rows sit under. */}
          <Typography sx={{ fontSize: 11.5, mb: 1.25 }}>
            <Skeleton variant="text" width={110} sx={bar} />
          </Typography>
          {/* A flex column with the same gap the real list uses, rather than a margin per item:
              `mb` also put 10px under the last one, which the list does not have. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {[0, 1].map((i) => (
              <Skeleton key={i} variant="rounded"
                sx={{ height: LEDGER_ROW_MIN_H, bgcolor: T.glass, borderRadius: '0 14px 14px 0' }} />
            ))}
          </Box>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          {/* Your own spending: same padding, avatar and two lines as PersonalRow. */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, px: 1.75, py: 1.5, mb: 2.5,
            borderRadius: 3.5, bgcolor: T.glass, border: `1px solid ${T.border}`,
          }}>
            <Skeleton variant="rounded" width={32} height={32} sx={{ ...bar, borderRadius: 2, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14.5 }}><Skeleton variant="text" width="45%" sx={bar} /></Typography>
              <Typography sx={{ fontSize: 12, mt: 0.1 }}><Skeleton variant="text" width="75%" sx={bar} /></Typography>
            </Box>
          </Box>

          {/* The folded "N settled up" line. */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.25,
            borderRadius: 3, border: `1px solid ${T.border}`,
          }}>
            <Skeleton variant="circular" width={18} height={18} sx={{ ...bar, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14 }}><Skeleton variant="text" width="35%" sx={bar} /></Typography>
              <Typography sx={{ fontSize: 12.5, mt: 0.1 }}><Skeleton variant="text" width="60%" sx={bar} /></Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function EmptyState({ T, onCreate }) {
  return (
    <Box sx={{
      textAlign: 'center', py: 6, px: 3, mb: 2.5, borderRadius: 3.5,
      bgcolor: T.glass, border: `1px dashed ${T.glassBorder}`,
    }}>
      <ReceiptLongRoundedIcon sx={{ fontSize: 34, color: T.teal, mb: 1 }} />
      <Typography sx={{ fontSize: 16, fontWeight: 800, color: T.textPrimary, mb: 0.5 }}>
        Split your first expense
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: T.textMuted, mb: 2.5, maxWidth: 380, mx: 'auto' }}>
        Keep a running total with one person, or set up a group for a trip or a flat. They do not
        need an account.
      </Typography>
      <Box
        component={motion.button}
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={onCreate}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.75,
          px: 2.25, py: 1, borderRadius: 2.5, cursor: 'pointer',
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
          bgcolor: T.teal, color: '#fff', border: 'none',
          '&:hover': { bgcolor: T.tealHover },
        }}
      >
        <AddRoundedIcon sx={{ fontSize: 18 }} />
        Split with someone
      </Box>
    </Box>
  );
}
