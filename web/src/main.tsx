import { createRoot } from 'react-dom/client'
import './index.scss'
import '@mantine/core/styles.css';
import App from './App.tsx'
import { MantineProvider } from '@mantine/core';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={{
    fontFamily: 'SFPro'
  }}>
    <App />
  </MantineProvider>,
)
