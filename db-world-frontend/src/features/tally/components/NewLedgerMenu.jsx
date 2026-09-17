import { useState } from 'react';
import { Box, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';

/**
 * The three ways to start a ledger, behind one button.
 *
 * <p>These used to be three buttons in the header beside a fourth for the spending report —
 * four competing calls to action on a screen whose actual job is showing you where you stand.
 * All three of these create something, so they belong together; the report is navigation and
 * stays out on its own.
 *
 * <p>Ordered by how often they are reached for, not by importance: splitting with one person
 * needs no name invented and nothing set up, so it goes first. Importing is once per group at
 * most and goes last, under a divider, because it is a different kind of act.
 */
export default function NewLedgerMenu({ onSplitWithSomeone, onNewGroup, onImport }) {
  const T = useT();
  const [anchor, setAnchor] = useState(null);

  const pick = (action) => () => { setAnchor(null); action(); };

  const items = [
    {
      icon: <PersonAddAlt1RoundedIcon sx={{ fontSize: 18 }} />,
      label: 'Split with someone',
      hint: 'One person, no group to set up',
      onClick: pick(onSplitWithSomeone),
    },
    {
      icon: <GroupsRoundedIcon sx={{ fontSize: 18 }} />,
      label: 'New group',
      hint: 'A trip, a flat, a family',
      onClick: pick(onNewGroup),
    },
    {
      icon: <FileUploadRoundedIcon sx={{ fontSize: 18 }} />,
      label: 'Import from Splitwise',
      hint: 'Bring an existing group across',
      onClick: pick(onImport),
      divide: true,
    },
  ];

  return (
    <>
      <Box
        component={motion.button}
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          px: 2, py: 1, borderRadius: 2.5, cursor: 'pointer',
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
          bgcolor: T.teal, color: '#fff', border: 'none',
          transition: 'background-color .18s ease',
          '&:hover': { bgcolor: T.tealHover },
          '&:focus-visible': { outline: `2px solid ${T.teal}`, outlineOffset: 2 },
        }}
      >
        <AddRoundedIcon sx={{ fontSize: 18 }} />
        New
        <ExpandMoreRoundedIcon sx={{ fontSize: 17, opacity: 0.85 }} />
      </Box>

      <Menu
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75, minWidth: 252, borderRadius: 3,
              bgcolor: T.bg, backgroundImage: 'none',
              border: `1px solid ${T.glassBorder}`,
            },
          },
        }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.label}
            onClick={item.onClick}
            sx={{
              py: 1.1, alignItems: 'flex-start',
              borderTop: item.divide ? `1px solid ${T.border}` : 'none',
              mt: item.divide ? 0.5 : 0,
              pt: item.divide ? 1.35 : 1.1,
            }}
          >
            <ListItemIcon sx={{ minWidth: 30, color: T.teal, mt: 0.2 }}>
              {item.icon}
            </ListItemIcon>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: 12, color: T.textFaint }}>
                {item.hint}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
