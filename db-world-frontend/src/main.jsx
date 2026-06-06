import React from 'react';
import { createRoot } from 'react-dom/client';
import '@styles/global.css';
import App from '@app/App';
import reportWebVitals from './reportWebVitals';
import { Provider } from 'react-redux';
import store from '@app/store';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ConfirmProvider } from 'material-ui-confirm';
import { ToastInitializer, ToastProvider } from '@shared/components/ui/Toast';
import { installChunkReloadHandler } from '@shared/utils/chunkReload';

// Recover automatically when a lazy chunk 404s after a new deploy.
installChunkReloadHandler();

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
    <Provider store={store}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <ConfirmProvider>
                <ToastProvider>
                    <ToastInitializer />
                    <App />
                </ToastProvider>
            </ConfirmProvider>
        </LocalizationProvider>
    </Provider>
)

reportWebVitals();
