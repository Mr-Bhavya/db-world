import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notify } from '@shared/notify';
import { motion } from 'framer-motion';
import {
  Box, Button, Container, Divider, IconButton,
  InputAdornment, Slider, TextField, Typography,
} from '@mui/material';
import { Visibility, VisibilityOff, ContentCopy, ArrowBack, VpnKey } from '@mui/icons-material';
import { useT, getGlowProps, getFieldSx } from '@shared/theme';
import Constants from '@shared/constants';
import usePageMeta from '@shared/hooks/usePageMeta';
import CommonServices from '@shared/services/CommonServices';

function generateSecurePassword(length) {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const digits  = '0123456789';
  const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  const all     = upper + lower + digits + symbols;

  const rand = (charset) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return charset[arr[0] % charset.length];
  };

  const pwd = [rand(upper), rand(lower), rand(digits), rand(symbols)];
  for (let i = pwd.length; i < length; i++) pwd.push(rand(all));

  for (let i = pwd.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join('');
}

const GeneratePassword = () => {
  usePageMeta('Password Generator');

  const T = useT();
  const GLOW = getGlowProps(T);
  const FIELD = getFieldSx(T);
  const navigate = useNavigate();

  const [generated, setGenerated] = useState('');
  const [length, setLength]       = useState(16);
  const [showPwd, setShowPwd]     = useState(false);
  const [copied, setCopied]       = useState(false);

  const handleSlider = (_, val) => setLength(val);
  const handleInput  = (e) => {
    const v = Math.min(Math.max(parseInt(e.target.value) || 8, 8), 64);
    setLength(v);
  };

  const handleGenerate = () => setGenerated(generateSecurePassword(length));

  const handleCopy = async () => {
    const result = await CommonServices.handleCopy(generated);
    if (result.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      notify.error('Copy failed — try manually');
    }
  };

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: '100vh', color: T.textPrimary, pt: { xs: '56px', md: '64px' } }}>
      <motion.div {...GLOW} />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, py: { xs: 4, md: 6 } }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <Box sx={{ mb: 3 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate(Constants.DB_PASSWORD_MANAGER_ROUTE)}
              sx={{ color: T.textMuted, fontWeight: 500, '&:hover': { color: T.teal, bgcolor: 'transparent' } }}
            >
              Password Manager
            </Button>
          </Box>

          <Box sx={{ p: { xs: 3, md: 4 }, bgcolor: T.glass, border: `1px solid ${T.glassBorder}`, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: 1.5,
                bgcolor: T.tealBg, border: `1px solid ${T.tealBg}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <VpnKey sx={{ fontSize: 20, color: T.teal }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: T.textPrimary }}>
                  Password Generator
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>
                  Cryptographically secure · 8–64 characters
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: T.glassBorder, mb: 3 }} />

            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: '0.875rem', color: T.textMuted, mb: 1.5 }}>
                Length:{' '}
                <Box component="span" sx={{ color: T.teal, fontWeight: 700 }}>{length}</Box>
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Slider
                  value={length}
                  onChange={handleSlider}
                  min={8}
                  max={64}
                  sx={{
                    flexGrow: 1, color: T.teal,
                    '& .MuiSlider-rail': { bgcolor: T.glassBorder },
                  }}
                />
                <TextField
                  size="small"
                  type="number"
                  value={length}
                  onChange={handleInput}
                  inputProps={{ min: 8, max: 64 }}
                  sx={{ width: 76, ...FIELD }}
                />
              </Box>
            </Box>

            <Button
              fullWidth
              variant="contained"
              onClick={handleGenerate}
              sx={{
                bgcolor: T.teal, color: '#fff', fontWeight: 700,
                py: 1.25, borderRadius: 2,
                '&:hover': { bgcolor: '#0f766e' },
              }}
            >
              Generate Password
            </Button>

            {generated && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Divider sx={{ borderColor: T.glassBorder, my: 3 }} />
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: T.textMuted, mb: 1.5 }}>
                  Generated Password
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <TextField
                    type={showPwd ? 'text' : 'password'}
                    value={generated}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPwd(!showPwd)}
                            size="small"
                            sx={{ color: T.teal }}
                          >
                            {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ flexGrow: 1, minWidth: 0, ...FIELD }}
                  />
                  <Button
                    variant={copied ? 'contained' : 'outlined'}
                    startIcon={<ContentCopy sx={{ fontSize: 16 }} />}
                    onClick={handleCopy}
                    sx={copied ? {
                      bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981',
                      border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600,
                      borderRadius: 2, whiteSpace: 'nowrap',
                    } : {
                      borderColor: T.teal, color: T.teal, fontWeight: 600,
                      borderRadius: 2, whiteSpace: 'nowrap',
                      '&:hover': { bgcolor: T.tealBg, borderColor: T.teal },
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </Box>
              </motion.div>
            )}
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default GeneratePassword;
