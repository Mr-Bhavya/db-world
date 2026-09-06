import { useEffect, useState } from 'react';
import { Box, Typography, Button, LinearProgress } from '@mui/material';
import DocumentScannerOutlinedIcon from '@mui/icons-material/DocumentScannerOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useT } from '@shared/theme';
import { canExtractNumber, extractDocumentNumber } from '../utils/documentNumber';
import { isScannable, recogniseImageText, releaseOcr } from '../utils/ocr';

/**
 * "Scan number" — reads the document number off the chosen image and offers it for confirmation.
 *
 * It NEVER writes the number by itself. OCR on a photograph of a laminated card is genuinely
 * unreliable, and a wrong number filled in silently is worse than an empty field, because the
 * reader has no reason to doubt it. So the result is presented as a suggestion with the extracted
 * value shown in full, and only lands in the form when it is accepted.
 *
 * It also only appears when it can actually help: the type must have a number format we recognise
 * (`canExtractNumber`) and the file must be an image or a PDF. For a rent agreement there is no
 * button at all, rather than one that always fails.
 *
 * Everything runs on-device — see `ocr.js`.
 */
export default function ScanNumberPanel({ file, typeCode, onAccept }) {
  const T = useT();
  const [state, setState] = useState('idle'); // idle | scanning | found | none | error
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState(null);

  // A new file or a different type invalidates whatever the last scan concluded.
  useEffect(() => { setState('idle'); setCandidate(null); }, [file, typeCode]);

  // The engine holds several megabytes of wasm; don't keep that alive after the dialog goes.
  useEffect(() => () => { releaseOcr(); }, []);

  if (!canExtractNumber(typeCode) || !isScannable(file)) return null;

  const scan = async () => {
    setState('scanning');
    setProgress(0);
    try {
      const text = await recogniseImageText(file, (pct, status) => {
        setProgress(pct);
        setPhase(status === 'recognizing text' ? 'Reading the document' : 'Preparing the scanner');
      });
      const found = extractDocumentNumber(text, typeCode);
      setCandidate(found);
      setState(found ? 'found' : 'none');
    } catch (e) {
      // Surface the reason when there is one — a timeout says something actionable ("keep the tab
      // in the foreground"), which a flat "could not start" would throw away.
      setError(e?.message ?? null);
      setState('error');
    }
  };

  const shell = {
    mt: 1, p: 1.25, borderRadius: 2,
    border: `1px solid ${T.border}`, bgcolor: T.glass,
  };

  if (state === 'scanning') {
    return (
      <Box sx={shell}>
        <Typography sx={{ fontSize: 12.5, color: T.textMuted, mb: 0.75 }}>
          {phase || 'Preparing the scanner'}… {progress}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ borderRadius: 999, bgcolor: T.glassHover, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }}
        />
        <Typography sx={{ fontSize: 11, color: T.textFaint, mt: 0.75, lineHeight: 1.5 }}>
          Reading happens on this device — the image is not uploaded to do it.
        </Typography>
      </Box>
    );
  }

  if (state === 'found') {
    return (
      <Box sx={{ ...shell, borderColor: `${T.teal}66`, bgcolor: T.tealBg }}>
        <Typography sx={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
          Found a number — check it
        </Typography>
        <Typography sx={{
          fontSize: 17, fontWeight: 800, color: T.textPrimary, mt: 0.35, letterSpacing: 0.5,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}>
          {candidate}
        </Typography>
        <Typography sx={{ fontSize: 11, color: T.textMuted, mt: 0.5, lineHeight: 1.5 }}>
          Compare it against the document before you use it.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button
            size="small" variant="contained" startIcon={<CheckRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => { onAccept(candidate); setState('idle'); }}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover } }}
          >
            Use this
          </Button>
          <Button
            size="small" startIcon={<CloseRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => setState('idle')}
            sx={{ textTransform: 'none', fontWeight: 700, color: T.textMuted }}
          >
            Discard
          </Button>
        </Box>
      </Box>
    );
  }

  if (state === 'none' || state === 'error') {
    return (
      <Box sx={shell}>
        <Typography sx={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.55 }}>
          {state === 'error'
            ? (error ?? 'The scanner could not start. Type the number in instead.')
            : 'No number this scan could be sure of. A flatter, brighter photo often works — or just type it in.'}
        </Typography>
        <Button
          size="small" onClick={scan}
          sx={{ mt: 0.5, textTransform: 'none', fontWeight: 700, color: T.teal, px: 0 }}
        >
          Try again
        </Button>
      </Box>
    );
  }

  return (
    <Button
      size="small"
      startIcon={<DocumentScannerOutlinedIcon sx={{ fontSize: 18 }} />}
      onClick={scan}
      sx={{
        mt: 1, textTransform: 'none', fontWeight: 700, fontSize: 12.5,
        color: T.teal, justifyContent: 'flex-start', px: 0,
      }}
    >
      Scan the number from this file
    </Button>
  );
}
