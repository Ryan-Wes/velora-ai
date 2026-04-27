import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import TransactionsPage from './pages/TransactionsPage.jsx'
import AuthPage from './pages/AuthPage.jsx'

import './styles/reset.css'
import './styles/shared.css'
import './styles/main-page.css'
import './styles/transactions-page.css'
import './styles/responsive.css'



createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)