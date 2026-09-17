import { Box, Typography, Button, Skeleton } from '@mui/material';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';

/** One icon and one colour per kind of event, so the feed can be scanned rather than read. */
const LOOK = {
  GROUP_CREATED:       { Icon: GroupsRoundedIcon,        tone: 'teal' },
  GROUP_UPDATED:       { Icon: EditRoundedIcon,          tone: 'muted' },
  GROUP_ARCHIVED:      { Icon: Inventory2OutlinedIcon,   tone: 'muted' },
  GROUP_REOPENED:      { Icon: Inventory2OutlinedIcon,   tone: 'teal' },
  MEMBER_ADDED:        { Icon: PersonAddAlt1RoundedIcon, tone: 'teal' },
  MEMBER_REJOINED:     { Icon: PersonAddAlt1RoundedIcon, tone: 'teal' },
  MEMBER_UPDATED:      { Icon: EditRoundedIcon,          tone: 'muted' },
  MEMBER_REMOVED:      { Icon: PersonRemoveRoundedIcon,  tone: 'danger' },
  MEMBER_CLAIMED:      { Icon: HowToRegRoundedIcon,      tone: 'teal' },
  DELEGATION_SET:      { Icon: PaymentsRoundedIcon,      tone: 'muted' },
  DELEGATION_CLEARED:  { Icon: UndoRoundedIcon,          tone: 'muted' },
  EXPENSE_ADDED:       { Icon: ReceiptLongRoundedIcon,   tone: 'teal' },
  EXPENSE_CORRECTED:   { Icon: EditRoundedIcon,          tone: 'warn' },
  EXPENSE_REMOVED:     { Icon: DeleteOutlineRoundedIcon, tone: 'danger' },
  EXPENSE_RESTORED:    { Icon: RestoreRoundedIcon,       tone: 'teal' },
  SETTLEMENT_RECORDED: { Icon: PaymentsRoundedIcon,      tone: 'teal' },
  SETTLEMENT_REVERSED: { Icon: UndoRoundedIcon,          tone: 'warn' },
};

const when = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(date); day.setHours(0, 0, 0, 0);
  const days = Math.round((today - day) / 86_400_000);
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
};

/**
 * Everything that has happened in this group.
 *
 * <p>The sentences come from the server exactly as they were written at the time, names and
 * amounts included — renaming somebody does not re-narrate what they did last week. So this
 * component renders text rather than composing it, which is the whole point.
 */
/**
 * The shape of the timeline while it loads.
 *
 * <p>This was a centred spinner, the last one in tally standing in for content rather than for
 * an action. A spinner claims a fixed ~90px wherever the list is about to be and says nothing
 * about it, so the entries always arrived by shoving the page around. Same spine, same two
 * lines of type, so they no longer do.
 */
function HistorySkeleton({ T, rows = 4 }) {
  const base = { bgcolor: T.glassHover, borderRadius: 1 };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: rows }, (_, i) => {
        const last = i === rows - 1;
        return (
          <Box key={i} sx={{ display: 'flex', gap: 1.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <Skeleton variant="circular" width={30} height={30} sx={base} />
              {!last && <Box sx={{ flex: 1, width: '1px', bgcolor: T.border, my: 0.5 }} />}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1, pb: last ? 0 : 2 }}>
              <Typography sx={{ fontSize: 14, lineHeight: 1.4 }}>
                <Skeleton variant="text" width={`${70 - i * 6}%`} sx={base} />
              </Typography>
              <Typography sx={{ fontSize: 11.5, mt: 0.2 }}>
                <Skeleton variant="text" width="40%" sx={base} />
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Everything that has happened in this group.
 *
 * <p>Extracted out of a dialog and onto its own tab. It was reachable only through the overflow
 * menu, which is the wrong home for it twice over: a change log is something you read, not an
 * action you take, and a full audit trail inside a modal means scrolling a list in a box inside
 * a page that also scrolls.
 *
 * <p>The wording of each entry is whatever was recorded at the time -- see the server-side
 * TallyActivityEntity. Nothing here is composed from live data, deliberately, so an old entry
 * still says what it said when it was written.
 */
export default function GroupHistoryView({ entries = [], loading, onRestore, restoring }) {
  const T = useT();

  const colorFor = (tone) => ({
    teal: T.teal, warn: '#f59e0b', danger: '#ef4444', muted: T.textMuted,
  }[tone] ?? T.textMuted);

  return (
    <Box>
      {loading && <HistorySkeleton T={T} />}

      {!loading && entries.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <HistoryRoundedIcon sx={{ fontSize: 34, color: T.textMuted, mb: 1 }} />
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>
            Nothing has happened yet
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {entries.map((entry, i) => {
          const look = LOOK[entry.action] ?? { Icon: EditRoundedIcon, tone: 'muted' };
          const tint = colorFor(look.tone);
          const last = i === entries.length - 1;

          return (
            <Box
              key={entry.id}
              component={motion.div}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
              sx={{ display: 'flex', gap: 1.5 }}
            >
              {/* A spine down the left so the entries read as one sequence rather than a
                  stack of unrelated cards. */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <Box sx={{
                  width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  bgcolor: `${tint}1f`, border: `1px solid ${tint}44`,
                }}>
                  <look.Icon sx={{ fontSize: 15, color: tint }} />
                </Box>
                {!last && <Box sx={{ flex: 1, width: '1px', bgcolor: T.border, my: 0.5 }} />}
              </Box>

              <Box sx={{ minWidth: 0, flex: 1, pb: last ? 0 : 2 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, lineHeight: 1.4 }}>
                  {entry.summary}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: T.textMuted, mt: 0.2 }}>
                  {entry.actorName} · {when(entry.createdAt)}
                </Typography>

                {entry.detail && (
                  <Box sx={{
                    mt: 0.75, px: 1.25, py: 0.75, borderRadius: 2,
                    bgcolor: T.glass, border: `1px solid ${T.border}`,
                  }}>
                    {entry.detail.split('\n').map((line) => (
                      <Typography key={line} sx={{
                        fontSize: 11.5, color: T.textMuted, lineHeight: 1.6,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {line}
                      </Typography>
                    ))}
                  </Box>
                )}

                {entry.canRestore && (
                  <Button
                    size="small"
                    onClick={() => onRestore(entry)}
                    disabled={restoring}
                    startIcon={<RestoreRoundedIcon sx={{ fontSize: 15 }} />}
                    sx={{
                      mt: 0.75, textTransform: 'none', fontSize: 12.5, fontWeight: 700,
                      borderRadius: 2, px: 1.25, color: T.teal, bgcolor: T.tealBg,
                      '&:hover': { bgcolor: T.tealBgHover },
                    }}
                  >
                    Put it back
                  </Button>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {!loading && entries.length > 0 && (
        <Typography sx={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.55 }}>
          Putting an expense back adds it again as a new entry — the removal stays in the
          history, so this list always shows what actually happened.
        </Typography>
      )}
    </Box>
  );
}
