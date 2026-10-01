import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Home, PlusCircle, Settings, Target, ClipboardList, Menu, X, Wallet, Tags, BarChart3, UserCircle, LogOut } from 'lucide-react';
import useStore from './store';
import { API_URL } from './config';
import './index.css';

import Dashboard from './pages/Dashboard';
import AddTransaction from './pages/AddTransaction';
import Statistics from './pages/Statistics';
import Goals from './pages/Goals';
import Budget from './pages/Budget';
import ManageLists from './pages/ManageLists';
import Setup from './pages/Setup';
import LoginSetup from './pages/LoginSetup';

const ProtectedRoute = ({ children }) => {
  const { userId, householdId } = useStore();
  if (!userId || !householdId) {
    return <LoginSetup />;
  }
  return children;
};

const money = (value) => new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const SideMenu = ({ open, onClose }) => {
  const { householdId, userId, userName, profileImage, logout } = useStore();
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!open || !householdId || !userId) return;
      try {
        const res = await fetch(`${API_URL}/api/wallets?householdId=${householdId}&userId=${userId}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setTotalBalance(data.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0));
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchBalance();
  }, [open, householdId, userId]);

  const items = [
    { to: '/', label: 'Strona główna', icon: Home },
    { to: '/accounts', label: 'Konta', icon: Wallet },
    { to: '/budget', label: 'Budżet', icon: ClipboardList },
    { to: '/stats', label: 'Wykresy', icon: BarChart3 },
    { to: '/categories/expense', label: 'Kategorie wydatki', icon: Tags },
    { to: '/categories/income', label: 'Kategorie dochody', icon: Tags },
    { to: '/goals', label: 'Cele', icon: Target },
    { to: '/setup', label: 'Ustawienia', icon: Settings },
  ];

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside className={`fixed bottom-0 left-[max(0px,calc((100vw-640px)/2))] top-0 z-[80] w-[82%] max-w-[440px] border-r border-border bg-card text-foreground shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-border px-5 pb-5 pt-10">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-foreground">
              {profileImage ? (
                <img src={profileImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserCircle size={28} />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{userName || 'Użytkownik'}</p>
              <p className="text-sm text-muted-foreground">Saldo: {money(totalBalance)}</p>
            </div>
          </div>
          <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} title="Zamknij">
            <X size={22} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-4 py-6">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) => `flex items-center gap-4 rounded-lg px-4 py-3 text-base transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <Icon size={24} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => { logout(); onClose(); }}
          className="absolute bottom-6 left-4 right-4 flex items-center gap-4 rounded-lg px-4 py-3 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut size={24} />
          <span>Wyloguj</span>
        </button>
      </aside>
    </>
  );
};

function App() {
  const { userId, householdId, theme, colorTheme } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dashboardCategoryDetailOpen, setDashboardCategoryDetailOpen] = useState(false);

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

  useEffect(() => {
    const handleDashboardCategoryDetail = (event) => {
      setDashboardCategoryDetailOpen(Boolean(event.detail));
    };

    window.addEventListener('dashboard-category-detail', handleDashboardCategoryDetail);
    return () => {
      window.removeEventListener('dashboard-category-detail', handleDashboardCategoryDetail);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/add" element={<ProtectedRoute><AddTransaction /></ProtectedRoute>} />
        <Route path="/budget" element={<ProtectedRoute><Budget /></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
        <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
        <Route path="/accounts" element={<ProtectedRoute><ManageLists view="accounts" /></ProtectedRoute>} />
        <Route path="/categories/expense" element={<ProtectedRoute><ManageLists view="expense-categories" /></ProtectedRoute>} />
        <Route path="/categories/income" element={<ProtectedRoute><ManageLists view="income-categories" /></ProtectedRoute>} />
        <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
      </Routes>
      
      {userId && householdId && (
        <>
        {!dashboardCategoryDetailOpen && (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="fixed left-[max(1rem,calc((100vw-640px)/2+1rem))] top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/95 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted"
            title="Menu"
          >
            <Menu size={22} />
          </button>
        )}
        <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

        <nav className="fixed bottom-0 w-full max-w-[640px] bg-background border-t border-border flex justify-around pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto">
          <NavLink to="/" className={({ isActive }) => `flex h-11 w-11 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`} title="Dashboard">
            <Home size={23} />
          </NavLink>
          <NavLink to="/add" className={({ isActive }) => `flex h-11 w-11 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`} title="Dodaj">
            <PlusCircle size={25} />
          </NavLink>
          <NavLink to="/budget" className={({ isActive }) => `flex h-11 w-11 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`} title="Budżet">
            <ClipboardList size={23} />
          </NavLink>
          <NavLink to="/goals" className={({ isActive }) => `flex h-11 w-11 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`} title="Cele">
            <Target size={23} />
          </NavLink>
        </nav>
        </>
      )}
    </Router>
  );
}

export default App;
