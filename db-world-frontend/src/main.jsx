import React from 'react';
import { createRoot } from 'react-dom/client';
import '@styles/global.css';
import App from '@app/App';
import reportWebVitals from './reportWebVitals';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ConfirmProvider } from 'material-ui-confirm';
import { installChunkReloadHandler } from '@shared/utils/chunkReload';

// Recover automatically when a lazy chunk 404s after a new deploy.
installChunkReloadHandler();

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
    <LocalizationProvider dateAdapter={AdapterDateFns}>
        <ConfirmProvider>
            <App />
        </ConfirmProvider>
    </LocalizationProvider>
)

reportWebVitals();
