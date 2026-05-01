import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Check from '@mui/icons-material/Check';
import { QUALITY_META, HDR_META, CODEC_META } from './constants';
import CommonServices from '@shared/services/CommonServices';

export const QBadge = ({ quality }) => {
  const meta = QUALITY_META[quality] || QUALITY_META['Unknown'];
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.4,
      px: 1, py: 0.2, borderRadius: 1,
      bgcolor: meta.color, color: '#fff',
      fontSize: '0.7rem', fontWeight: 800, lineHeight: 1.6, letterSpacing: '0.03em',
      flexShrink: 0,
    }}>
      {meta.label}
    </Box>
  );
};

export const HdrBadge = ({ tag }) => {
  const meta = HDR_META[tag];
  if (!meta) return null;
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center',
      px: 0.9, py: 0.2, borderRadius: 1,
      bgcolor: alpha(meta.color, 0.18), color: meta.color,
      border: `1px solid ${alpha(meta.color, 0.4)}`,
      fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.6, flexShrink: 0,
    }}>
      {meta.label}
    </Box>
  );
};

export const CodecBadge = ({ codec }) => {
  const meta = CODEC_META[codec] || { color: '#6b7280' };
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center',
      px: 0.9, py: 0.2, borderRadius: 1,
      bgcolor: alpha(meta.color, 0.15), color: meta.color,
      border: `1px solid ${alpha(meta.color, 0.35)}`,
      fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.6, flexShrink: 0,
    }}>
      {codec}
    </Box>
  );
};

export const CopyIconButton = ({ url, label }) => {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    const res = await CommonServices.handleCopy(url);
    if (res.success) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  return (
    <Tooltip title={copied ? 'Copied!' : label}>
      <span>
        <IconButton
          size="small"
          onClick={handle}
          disabled={!url}
          sx={{
            border: `1px solid ${copied ? '#4caf50' : 'rgba(255,255,255,0.2)'}`,
            borderRadius: 1.5, p: 0.7,
            color: copied ? '#4caf50' : 'text.secondary',
          }}
        >
          {copied ? <Check sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
        </IconButton>
      </span>
    </Tooltip>
  );
};
