import { createRoot } from 'react-dom/client';

import './styles/global.css';
import App from './App.tsx';
import { kioskBrowserTitle } from './features/kiosk/kioskBrowserTitle';

document.title = kioskBrowserTitle(document.title);

createRoot(document.getElementById('root')!).render(
  <App />
);
