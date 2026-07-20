import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

// Global monkey-patch of toast.error to capture exact stack trace
const originalError = toast.error;
toast.error = (...args) => {
  console.trace("toast.error called with args:", ...args);
  return originalError(...args);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
