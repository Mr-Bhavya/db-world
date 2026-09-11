import React from 'react';
import { Box, Button } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';

import Constants from '@shared/constants';
import { useT } from '@shared/theme/ThemeContext';
import LegalPage from './LegalPage';
import { CONTACT_EMAIL } from './PrivacyPolicy';

/**
 * Contact page.
 *
 * Deliberately a mailto rather than a form: a form needs a submit endpoint, spam
 * handling and somewhere to put the messages, none of which exists — and AdSense only
 * requires a working way to reach the site owner, which this is.
 */
export default function Contact() {
  const T = useT();

  return (
    <LegalPage title="Contact" updated="26 August 2026">
      <p>
        DB World is run by one person. The fastest way to reach me is email — I read
        everything, though replies may take a few days.
      </p>

      {/* Short label on the button, address as selectable text beside it.
          Three reasons this is not one button reading "support@db-world.in":
          the address is too long to fit a narrow phone without wrapping or
          clipping; you cannot select text inside a button, and copying the
          address is the second thing people want after clicking it; and the
          label stays legible whatever the address is changed to. */}
      <Box sx={{
        my: 3,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
      }}>
        <Button
          component="a"
          href={`mailto:${CONTACT_EMAIL}`}
          variant="contained"
          startIcon={<MailOutlineIcon />}
          sx={{
            flexShrink: 0,
            fontWeight: 800, borderRadius: 2, px: 3, py: 1.25,
            textTransform: 'none', fontSize: '1rem',
            // NOT T.teal. White on #0d9488 measures 3.74:1, under the 4.5:1
            // WCAG AA floor for body text; #0f766e gets it to 5.47:1 and the
            // darker hover to 7.58:1. Set explicitly because overriding bgcolor
            // on a contained Button leaves the label colour behind.
            color: '#ffffff',
            bgcolor: T.tealHover,
            '&:hover': { bgcolor: '#115e59' },
          }}
        >
          Email us
        </Button>

        <Box
          component="a"
          href={`mailto:${CONTACT_EMAIL}`}
          sx={{
            userSelect: 'text',
            fontSize: { xs: '0.9rem', sm: '0.95rem' },
            fontWeight: 600,
            color: T.text,
            textDecoration: 'none',
            wordBreak: 'break-all',
            borderBottom: `1px dashed ${T.border}`,
            '&:hover': { borderBottomColor: T.teal },
          }}
        >
          {CONTACT_EMAIL}
        </Box>
      </Box>

      <h2>What to include</h2>
      <ul>
        <li><strong>A bug</strong> — what you did, what happened, what you expected, and
          whether it was the website or the Android app.</li>
        <li><strong>An account problem</strong> — the email address on the account. Never
          send your password; nobody here will ask for it.</li>
        <li><strong>A copyright concern</strong> — enough detail to identify the specific
          material and your relationship to the rights in it.</li>
        <li><strong>A privacy request</strong> — say whether you want a copy of your data
          or its deletion, and send it from the account&rsquo;s own email address.</li>
      </ul>

      <h2>Also useful</h2>
      <p>
        <a href={Constants.DB_PRIVACY_ROUTE}>Privacy Policy</a> — what is collected and why.<br />
        <a href={Constants.DB_TERMS_ROUTE}>Terms of Service</a> — the rules for using the service.
      </p>
    </LegalPage>
  );
}
