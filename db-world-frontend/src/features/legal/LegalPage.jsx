import React, { useEffect } from 'react';
import { Box, Container, Divider, Typography } from '@mui/material';

import { useT } from '@shared/theme/ThemeContext';

/**
 * Shared shell for the legal / informational pages (privacy, terms, contact).
 *
 * These exist for two audiences at once. Visitors read them; the AdSense reviewer
 * checks they exist, are reachable without an account, and are linked from the site
 * chrome. Both want plain prose on a plain background, so this deliberately skips the
 * glass surfaces the rest of the app uses — a reviewer should not have to work out
 * whether an animated panel is content.
 */
export default function LegalPage({ title, updated, children }) {
  const T = useT();

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} — DB World`;
    return () => { document.title = previous; };
  }, [title]);

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: T.bg,
      pt: { xs: 'calc(56px + 24px)', md: 'calc(64px + 32px)' },
      pb: 8,
    }}>
      <Container maxWidth="md" sx={{ px: { xs: 2.5, sm: 3 } }}>
        <Typography component="h1" sx={{
          fontWeight: 800,
          fontSize: { xs: '1.75rem', md: '2.25rem' },
          color: T.text,
          letterSpacing: '-0.02em',
        }}>
          {title}
        </Typography>

        {updated && (
          <Typography sx={{ mt: 1, fontSize: '0.85rem', color: T.textFaint }}>
            Last updated {updated}
          </Typography>
        )}

        <Divider sx={{ my: 3, borderColor: T.border }} />

        <Box sx={{
          color: T.textMuted,
          fontSize: '0.95rem',
          lineHeight: 1.75,
          '& h2': {
            color: T.text,
            fontSize: '1.15rem',
            fontWeight: 700,
            margin: '2rem 0 0.75rem',
          },
          '& p': { margin: '0 0 1rem' },
          '& ul': { margin: '0 0 1rem', paddingLeft: '1.25rem' },
          '& li': { margin: '0 0 0.5rem' },
          '& a': { color: T.teal, textDecoration: 'none' },
          '& a:hover': { textDecoration: 'underline' },
          '& strong': { color: T.text, fontWeight: 700 },
        }}>
          {children}
        </Box>
      </Container>
    </Box>
  );
}
