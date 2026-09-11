import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { CheckCircleRounded, ErrorOutlineRounded } from '@mui/icons-material';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import { useT } from '@shared/theme';
import AuthPageShell from './AuthPageShell';
import { confirmEmail } from './api/recoveryApi';

/**
 * `/verify-email` — redeems the link from the confirmation email.
 *
 * Runs on mount rather than behind a button: the visitor already expressed intent by clicking
 * the link in their inbox, and asking them to click a second one adds a step without adding
 * proof. The token is single-use, so the guard below matters — React's StrictMode double-mounts
 * in development, and a second call would spend a token that had just succeeded and report
 * failure for a verification that actually worked.
 */
export default function VerifyEmail() {
  usePageMeta('Confirm your email', { description: 'Confirm your DB World email address.' });

  const T = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState('working'); // working | done | failed
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setStatus('failed');
      setMessage('This link is missing its token. Open the link from your email again.');
      return;
    }

    confirmEmail(token)
      .then(() => setStatus('done'))
      .catch((err) => {
        setStatus('failed');
        setMessage(err?.response?.data?.message
          || 'This link has expired or has already been used.');
      });
  }, [token]);

  const icon = {
    working: <CircularProgress sx={{ color: T.teal }} />,
    done: <CheckCircleRounded sx={{ fontSize: 48, color: T.teal }} />,
    failed: <ErrorOutlineRounded sx={{ fontSize: 48, color: T.error }} />,
  }[status];

  const heading = {
    working: 'Confirming your email…',
    done: 'Email confirmed',
    failed: 'That link did not work',
  }[status];

  const body = {
    working: 'One moment.',
    done: 'Your address is verified. You can now connect Google to this account, and you '
        + 'will not be asked for your password to do it.',
    failed: message,
  }[status];

  return (
    <AuthPageShell>
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ mb: 1.5 }}>{icon}</Box>

        <Typography component="h1" sx={{ fontSize: '1.3rem', fontWeight: 900, color: T.textPrimary }}>
          {heading}
        </Typography>
        <Typography sx={{ fontSize: '0.88rem', color: T.textMuted, mt: 1, lineHeight: 1.6 }}>
          {body}
        </Typography>

        {status !== 'working' && (
          <Button
            fullWidth
            variant={status === 'done' ? 'contained' : 'text'}
            onClick={() => navigate(status === 'done'
              ? Constants.DB_WORLD_HOME_ROUTE
              : Constants.LOGIN_ROUTE)}
            sx={{
              mt: 3, minHeight: 46, borderRadius: 2, textTransform: 'none', fontWeight: 800,
              ...(status === 'done'
                ? { bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }
                : { color: T.textMuted }),
            }}
          >
            {status === 'done' ? 'Continue to DB World' : 'Back to sign in'}
          </Button>
        )}

        {status === 'failed' && (
          <Typography sx={{ fontSize: '0.78rem', color: T.textFaint, mt: 1.5, lineHeight: 1.6 }}>
            Sign in and use “Resend confirmation” to get a fresh link.
          </Typography>
        )}
      </Box>
    </AuthPageShell>
  );
}
