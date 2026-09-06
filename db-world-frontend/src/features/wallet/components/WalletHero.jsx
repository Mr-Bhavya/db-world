import { Box, Typography, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderCopyOutlinedIcon from '@mui/icons-material/FolderCopyOutlined';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import LinkIcon from '@mui/icons-material/Link';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useT } from '@shared/theme';

/**
 * One tile in the summary strip. Clickable when it filters to something — a count of expiring
 * documents that you can't act on is trivia; one that takes you to them is a to-do list.
 */
function StatTile({ icon: Icon, label, value, color, active, onClick }) {
  const T = useT();
  const tone = color ?? T.textPrimary;
  const interactive = !!onClick;
  return (
    <Box
      {...(interactive ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      } } : {})}
      sx={{
        // Two per row on a phone, one row from `sm`. Four across 390px gave each tile ~85px, and
        // the labels clipped to "DOCU...", "EXPI...", "EXPI..." and "SHAR..." - with Expired and
        // Expiring both truncating to the same six characters, side by side.
        flex: { xs: '1 1 calc(50% - 4px)', sm: '1 1 0' },
        minWidth: 0,
        px: { xs: 1.25, sm: 1.5 }, py: { xs: 1, sm: 1.25 },
        borderRadius: 2.5,
        border: `1px solid ${active ? `${tone}66` : T.border}`,
        bgcolor: active ? `${tone}14` : T.glass,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
        ...(interactive && { '&:hover': { borderColor: `${tone}66`, bgcolor: `${tone}14` } }),
        '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Icon sx={{ fontSize: 14, color: color ?? T.textMuted, flexShrink: 0 }} />
        <Typography sx={{
          fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: 0.5, fontWeight: 700, lineHeight: 1.4,
        }} noWrap>
          {label}
        </Typography>
      </Box>
      <Typography sx={{
        fontSize: { xs: 20, sm: 22 }, fontWeight: 800, color: tone, lineHeight: 1.2, mt: 0.15,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Wallet header: what is in here, what needs attention, and the way to add more.
 *
 * The page used to open on a title, a one-line subtitle and a button — nothing that told you
 * anything about your own wallet. Expiry and sharing are the two states a document store exists to
 * keep on top of, so they lead, and each count is a filter rather than a fact you then have to go
 * hunting for.
 *
 * Tiles for states that don't apply are dropped rather than shown as zeroes: a wallet with nothing
 * expiring shouldn't spend a third of its header saying so.
 */
export default function WalletHero({ stats, status, onStatusChange, onAdd }) {
  const T = useT();

  const tiles = [
    {
      key: 'total',
      icon: FolderCopyOutlinedIcon,
      label: 'Documents',
      value: stats.total,
      onClick: status ? () => onStatusChange('') : undefined,
      active: !status,
    },
    stats.expired > 0 && {
      key: 'expired',
      icon: EventBusyRoundedIcon,
      label: 'Expired',
      value: stats.expired,
      color: T.error,
      onClick: () => onStatusChange(status === 'expired' ? '' : 'expired'),
      active: status === 'expired',
    },
    stats.expiring > 0 && {
      key: 'expiring',
      icon: ScheduleRoundedIcon,
      label: 'Expiring',
      value: stats.expiring,
      color: T.warning,
      onClick: () => onStatusChange(status === 'expiring' ? '' : 'expiring'),
      active: status === 'expiring',
    },
    stats.shared > 0 && {
      key: 'shared',
      icon: LinkIcon,
      label: 'Shared',
      value: stats.shared,
      color: T.warning,
      onClick: () => onStatusChange(status === 'shared' ? '' : 'shared'),
      active: status === 'shared',
    },
  ].filter(Boolean);

  return (
    <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 1.5, flexWrap: 'wrap', mb: 1.75,
      }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 800, letterSpacing: -0.4, color: T.textPrimary }}>
            Document Wallet
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.35 }}>
            <ShieldOutlinedIcon sx={{ fontSize: 14, color: T.teal, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12.5, color: T.textMuted }}>
              Encrypted at rest. Only you can open these.
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          sx={{
            width: { xs: '100%', sm: 'auto' }, flexShrink: 0, textTransform: 'none', fontWeight: 700,
            bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover },
          }}
        >
          Add document
        </Button>
      </Box>

      {stats.total > 0 && (
        // A wrapping flex row rather than a grid: the tile count varies from one to four with the
        // wallet's own state, and `1 1 0` shares whatever row it lands on evenly at any count.
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {tiles.map((t) => (
            <StatTile
              key={t.key}
              icon={t.icon}
              label={t.label}
              value={t.value}
              color={t.color}
              active={t.active}
              onClick={t.onClick}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
