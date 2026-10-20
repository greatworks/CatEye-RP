import { DialogProvider } from './components/Dialogs';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installEmbeddedFonts } from './runtime/embedded-fonts';
import './style.css';
installEmbeddedFonts(document);
createRoot(document.getElementById('root')!).render(<React.StrictMode><DialogProvider><App /></DialogProvider></React.StrictMode>);
