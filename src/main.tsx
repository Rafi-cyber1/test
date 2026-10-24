import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { CloudBootstrap } from './components/cloud/CloudBootstrap';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <CloudBootstrap>
    <App />
  </CloudBootstrap>
);
