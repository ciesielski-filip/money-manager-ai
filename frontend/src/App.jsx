import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Home, PlusCircle, PieChart, Settings } from 'lucide-react';
import useStore from './store';
import './index.css';

import Dashboard from './pages/Dashboard';
import AddTransaction from './pages/AddTransaction';
import Statistics from './pages/Statistics';
import Setup from './pages/Setup';
import LoginSetup from './pages/LoginSetup';

const ProtectedRoute = ({ children }) => {
  const { userId, householdId } = useStore();
  if (!userId || !householdId) {
    return <LoginSetup />;
  }
  return children;
};

function App() {
  const { userId, householdId, theme, colorTheme } = useStore();

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Clear existing theme classes
    root.classList.remove('dark', 'theme-pink');
    
    if (theme === 'dark') {
      root.classList.add('dark');
    }
    
    if (colorTheme && colorTheme !== 'default') {
      root.classList.add(`theme-${colorTheme}`);
    }
  }, [theme, colorTheme]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/add" element={<ProtectedRoute><AddTransaction /></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
        <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
      </Routes>
      
      {userId && householdId && (
        <nav className="fixed bottom-0 w-full max-w-[640px] bg-background border-t border-border flex justify-around py-3 z-50 mx-auto">
          <NavLink to="/" className={({ isActive }) => `flex flex-col items-center text-xs gap-1 transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Home size={24} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/add" className={({ isActive }) => `flex flex-col items-center text-xs gap-1 transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <PlusCircle size={24} />
            <span>Dodaj</span>
          </NavLink>
          {!useStore.getState().hideStatistics && (
            <NavLink to="/stats" className={({ isActive }) => `flex flex-col items-center text-xs gap-1 transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <PieChart size={24} />
              <span>Statystyki</span>
            </NavLink>
          )}
          <NavLink to="/setup" className={({ isActive }) => `flex flex-col items-center text-xs gap-1 transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Settings size={24} />
            <span>Ustawienia</span>
          </NavLink>
        </nav>
      )}
    </Router>
  );
}

export default App;
