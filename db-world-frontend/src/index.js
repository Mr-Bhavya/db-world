import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Provider } from 'react-redux';
import store from './store';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ConfirmProvider } from 'material-ui-confirm';
import { ToastInitializer, ToastProvider } from './components/Toast';

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
    </Provider >
)


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
