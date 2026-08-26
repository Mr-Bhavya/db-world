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

      <Box sx={{ my: 3 }}>
        <Button
          component="a"
          href={`mailto:${CONTACT_EMAIL}`}
          variant="contained"
          startIcon={<MailOutlineIcon />}
          sx={{
            fontWeight: 800, borderRadius: 2, px: 3, py: 1.25,
            textTransform: 'none', fontSize: '1rem',
            bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover },
          }}
        >
          {CONTACT_EMAIL}
        </Button>
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
