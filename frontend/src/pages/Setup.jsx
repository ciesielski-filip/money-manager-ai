import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { API_URL } from '../config';
import * as LucideIcons from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddCategoryModal from '../components/AddCategoryModal';
import AddWalletModal from '../components/AddWalletModal';

const PREDEFINED_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', 
  '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  '#64748b', '#78716c', '#000000'
];

const PREDEFINED_ICONS = [
  'ShoppingCart', 'Utensils', 'Car', 'Home', 'Smartphone', 'Zap', 'Coffee', 'HeartPulse',
  'Plane', 'Gift', 'GraduationCap', 'Briefcase', 'DollarSign', 'CreditCard', 'PiggyBank',
  'Monitor', 'Music', 'Smile'
];

const DynamicIcon = ({ name, ...props }) => {
  const IconComponent = LucideIcons[name] || LucideIcons.Circle;
  return <IconComponent {...props} />;
};

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const DeleteWalletDialog = ({ isOpen, onClose, wallet, allWallets, onDelete }) => {
  const [action, setAction] = useState('delete'); // 'delete' or 'move'
  const otherWallets = allWallets.filter(w => w._id !== wallet?._id);
  const [targetWalletId, setTargetWalletId] = useState(otherWallets.length > 0 ? otherWallets[0]._id : '');

  if (!wallet) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <LucideIcons.Wallet size={32} />
          </div>
          <DialogTitle className="text-xl">Usuń portfel</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Usuwasz portfel <strong className="text-foreground">{wallet.name}</strong>. Zdecyduj co zrobić z jego transakcjami.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 py-6 text-left w-full">
          <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-xl border transition-colors ${action === 'delete' ? 'bg-destructive/5 border-destructive/30' : 'bg-muted/30 border-border/50 hover:bg-muted'}`}>
            <input type="radio" name="walletAction" className="scale-125 accent-destructive" checked={action === 'delete'} onChange={() => setAction('delete')} />
            <span className="text-sm font-medium">Usuń trwale wszystkie transakcje (saldo ignorowane)</span>
          </label>
          {otherWallets.length > 0 && (
            <label className={`flex flex-col gap-2 cursor-pointer p-4 rounded-xl border transition-colors ${action === 'move' ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border/50 hover:bg-muted'}`}>
              <div className="flex items-center gap-3">
                <input type="radio" name="walletAction" className="scale-125 accent-primary" checked={action === 'move'} onChange={() => setAction('move')} />
                <span className="text-sm font-medium">Przenieś transakcje do innego portfela</span>
              </div>
              {action === 'move' && (
                <div className="pl-6 mt-2">
                  <Select value={targetWalletId} onValueChange={setTargetWalletId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Wybierz portfel" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherWallets.map(w => (
                        <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </label>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-center w-full">
          <Button variant="outline" className="flex-1" onClick={onClose}>Anuluj</Button>
          <Button variant="destructive" className="flex-1" onClick={() => onDelete(wallet._id, action, targetWalletId)}>
            Usuń portfel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeleteCategoryDialog = ({ isOpen, onClose, category, allCategories, onDelete }) => {
  const [action, setAction] = useState('delete'); // 'delete' or 'move'
  const otherCategories = allCategories.filter(c => c._id !== category?._id && c.type === category?.type);
  const [targetCategoryId, setTargetCategoryId] = useState(otherCategories.length > 0 ? otherCategories[0]._id : '');
  const [adjustBalance, setAdjustBalance] = useState(true);

  if (!category) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <LucideIcons.Tags size={32} />
          </div>
          <DialogTitle className="text-xl">Usuń kategorię</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Usuwasz kategorię <strong className="text-foreground">{category.name}</strong>. Zdecyduj co zrobić z przypisanymi transakcjami.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-6 text-left w-full">
          <label className={`flex flex-col gap-2 cursor-pointer p-4 rounded-xl border transition-colors ${action === 'delete' ? 'bg-destructive/5 border-destructive/30' : 'bg-muted/30 border-border/50 hover:bg-muted'}`}>
            <div className="flex items-center gap-3">
              <input type="radio" name="catAction" className="scale-125 accent-destructive" checked={action === 'delete'} onChange={() => setAction('delete')} />
              <span className="text-sm font-medium">Usuń trwale wszystkie transakcje z kategorii</span>
            </div>
            
            {action === 'delete' && (
              <label className="flex items-center gap-3 pl-7 mt-2 cursor-pointer opacity-90">
                <Checkbox checked={adjustBalance} onCheckedChange={setAdjustBalance} className="scale-110" />
                <span className="text-xs font-medium">Cofnij zmiany na saldach w portfelach</span>
              </label>
            )}
          </label>

          {otherCategories.length > 0 && (
            <label className={`flex flex-col gap-2 cursor-pointer p-4 rounded-xl border transition-colors ${action === 'move' ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border/50 hover:bg-muted'}`}>
              <div className="flex items-center gap-3">
                <input type="radio" name="catAction" className="scale-125 accent-primary" checked={action === 'move'} onChange={() => setAction('move')} />
                <span className="text-sm font-medium">Przenieś transakcje do innej kategorii</span>
              </div>
              {action === 'move' && (
                <div className="pl-6 mt-2">
                  <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Wybierz kategorię" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherCategories.map(c => (
                        <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </label>
          )}
        </div>

        <div className="flex gap-3 w-full mt-4 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Anuluj</Button>
          <Button variant="destructive" className="flex-1" onClick={() => onDelete(category._id, action, targetCategoryId, adjustBalance)}>
            Usuń kategorię
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ChangeBudgetDialog = ({ isOpen, onClose }) => {
  const [action, setAction] = useState('join');
  const [inviteCode, setInviteCode] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const { userId, setHousehold } = useStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (action === 'join') {
        const res = await fetch(`${API_URL}/api/household/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode, userId })
        });
        const data = await res.json();
        if (res.ok) {
          setHousehold(data._id, data.name);
          onClose();
        } else {
          setErrorMsg(data.error || 'Nie udało się dołączyć');
        }
      } else {
        const res = await fetch(`${API_URL}/api/household`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: householdName, userId })
        });
        const data = await res.json();
        if (res.ok) {
          setHousehold(data._id, data.name);
          onClose();
        } else {
          setErrorMsg('Nie udało się utworzyć budżetu');
        }
      }
    } catch (err) {
      setErrorMsg('Błąd połączenia z serwerem');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zmień budżet</DialogTitle>
          <DialogDescription>Dołącz do istniejącej grupy lub stwórz nową.</DialogDescription>
        </DialogHeader>
        
        <div className="flex mb-4 border-b border-border">
          <button 
            type="button"
            className={`flex-1 pb-2 bg-transparent cursor-pointer border-b-2 transition-colors ${action === 'join' ? 'border-foreground font-semibold' : 'border-transparent font-normal'}`}
            onClick={() => { setAction('join'); setErrorMsg(''); }}
          >
            Dołącz
          </button>
          <button 
            type="button"
            className={`flex-1 pb-2 bg-transparent cursor-pointer border-b-2 transition-colors ${action === 'create' ? 'border-foreground font-semibold' : 'border-transparent font-normal'}`}
            onClick={() => { setAction('create'); setErrorMsg(''); }}
          >
            Nowy budżet
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {action === 'join' ? (
            <div>
              <label className="block text-sm font-medium mb-2">Kod Zaproszenia</label>
              <Input 
                type="text" 
                placeholder="Wpisz 8-znakowy kod" 
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">Nazwa Nowego Budżetu</label>
              <Input 
                type="text" 
                placeholder="np. Budżet Wyjazdowy" 
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                required
              />
            </div>
          )}
          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
            <Button type="submit">{action === 'join' ? 'Dołącz' : 'Utwórz'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Setup = () => {
  const { householdId, householdName, userId, userName, logout, theme, setTheme, colorTheme, setColorTheme } = useStore();
  const [categories, setCategories] = useState([]);
  const customColors = Array.from(new Set(categories.map(c => c.color).filter(c => c && !PREDEFINED_COLORS.includes(c))));
  const [wallets, setWallets] = useState([]);
  const [householdData, setHouseholdData] = useState(null);
  
  // Category Form
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('expense');
  const [newCatColor, setNewCatColor] = useState(PREDEFINED_COLORS[0]);
  const [newCatIcon, setNewCatIcon] = useState(PREDEFINED_ICONS[0]);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);

  // Wallet Form
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);

  // Wallet Adjustment
  const [adjustingWallet, setAdjustingWallet] = useState(null);
  const [adjustBalance, setAdjustBalance] = useState('');

  // Deletion Modals
  const [walletToDelete, setWalletToDelete] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const [showChangeBudget, setShowChangeBudget] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, walletRes, houseRes] = await Promise.all([
          fetch(`${API_URL}/api/categories?householdId=${householdId}`),
          fetch(`${API_URL}/api/wallets?householdId=${householdId}&userId=${userId}`),
          fetch(`${API_URL}/api/household/${householdId}`)
        ]);
        
        setCategories(await catRes.json());
        setWallets(await walletRes.json());
        setHouseholdData(await houseRes.json());
      } catch (err) {
        console.error(err);
      }
    };
    if (householdId) fetchData();
  }, [householdId, userId]);

  const handleDeleteWallet = async (walletId, action, targetWalletId) => {
    try {
      const res = await fetch(`${API_URL}/api/wallets/${walletId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetWalletId })
      });
      if (res.ok) {
        setWallets(wallets.filter(w => w._id !== walletId));
        setWalletToDelete(null);
        const walletRes = await fetch(`${API_URL}/api/wallets?householdId=${householdId}&userId=${userId}`);
        setWallets(await walletRes.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (categoryId, action, targetCategoryId, adjustBalance) => {
    try {
      const res = await fetch(`${API_URL}/api/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetCategoryId, adjustBalance })
      });
      if (res.ok) {
        setCategories(categories.filter(c => c._id !== categoryId));
        setCategoryToDelete(null);
        if (adjustBalance || action === 'move') {
           const walletRes = await fetch(`${API_URL}/api/wallets?householdId=${householdId}&userId=${userId}`);
           setWallets(await walletRes.json());
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName) return;
    try {
      const res = await fetch(`${API_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName,
          type: newCatType,
          color: newCatColor,
          icon: newCatIcon,
          householdId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCategories([...categories, data]);
        setNewCatName('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCategoryFromModal = async ({ name, type, color, icon }) => {
    try {
      const res = await fetch(`${API_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          color,
          icon,
          householdId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCategories([...categories, data]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWalletFromModal = async ({ name, balance, color, icon }) => {
    try {
      const res = await fetch(`${API_URL}/api/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          balance,
          householdId,
          ownerId: userId,
          color,
          icon
        })
      });
      if (res.ok) {
        const data = await res.json();
        setWallets([...wallets, data]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustWallet = async (e) => {
    e.preventDefault();
    if (!adjustingWallet || adjustBalance === '') return;
    try {
      const res = await fetch(`${API_URL}/api/wallets/${adjustingWallet._id}/adjust`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newBalance: parseFloat(adjustBalance),
          userId,
          householdId
        })
      });
      if (res.ok) {
        const updatedWallet = await res.json();
        setWallets(wallets.map(w => w._id === updatedWallet._id ? updatedWallet : w));
        setAdjustingWallet(null);
        setAdjustBalance('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleShare = async (walletId) => {
    try {
      const res = await fetch(`${API_URL}/api/wallets/${walletId}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        const updatedWallet = await res.json();
        setWallets(wallets.map(w => w._id === updatedWallet._id ? updatedWallet : w));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 p-6 pb-20">
      <h2 className="mb-6 font-semibold text-xl">Ustawienia</h2>
      
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold m-0">Grupa: {householdName}</h3>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Wygląd Aplikacji</h3>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Tryb (Jasny / Ciemny)</span>
              <Button 
                variant="outline" 
                className="w-12 h-12 rounded-full p-0 flex items-center justify-center"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <LucideIcons.Moon size={24} /> : <LucideIcons.Sun size={24} />}
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Motyw Kolorystyczny</span>
              <Select value={colorTheme} onValueChange={setColorTheme}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Wybierz motyw" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Domyślny (Minimalizm)</SelectItem>
                  <SelectItem value="pink">Różowo-Fioletowy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium">Ukryj Statystyki</span>
                <span className="text-xs text-muted-foreground">Wyłącza wykresy na pulpicie i ukrywa zakładkę</span>
              </div>
              <Checkbox 
                checked={useStore.getState().hideStatistics} 
                onCheckedChange={(checked) => useStore.getState().setHideStatistics(checked)} 
                className="w-6 h-6 rounded-md"
              />
            </div>
          </div>
        </CardContent>
      </Card>



      <Card className="mb-6 border border-border/50 shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-xl font-bold text-foreground">Portfele i Konta</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Zarządzaj swojami kontami bankowymi, kartami i gotówką</p>
            </div>
            <button 
              type="button"
              onClick={() => setShowAddWalletModal(true)}
              className="px-4 py-2.5 bg-foreground hover:bg-foreground/90 text-background font-bold text-xs rounded-xl shadow transition-transform active:scale-95 flex items-center gap-2 self-start sm:self-auto shrink-0"
            >
              <LucideIcons.Plus size={16} className="stroke-[2.5]" />
              <span>Dodaj Konto / Portfel</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {wallets.map(w => {
              const ownerId = w.ownerId?._id || w.ownerId;
              const ownerName = w.ownerId?.name || 'Ktoś z grupy';
              const isOwner = ownerId === userId;
              
              return (
                <div key={w._id} className="p-3.5 bg-card border border-border/50 rounded-2xl shadow-sm hover:border-border/80 transition-all">
                  {adjustingWallet?._id === w._id ? (
                    <form onSubmit={handleAdjustWallet} className="flex gap-2">
                      <Input type="number" step="0.01" className="flex-1" value={adjustBalance} onChange={(e) => setAdjustBalance(e.target.value)} autoFocus required />
                      <Button type="submit">Zapisz</Button>
                      <Button type="button" variant="outline" onClick={() => setAdjustingWallet(null)}>Anuluj</Button>
                    </form>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: w.color || '#3b82f6' }}>
                            <DynamicIcon name={w.icon || 'CreditCard'} size={20} />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                            <span className="font-bold text-base truncate text-foreground">{w.name}</span>
                            <span className={`text-[11px] flex items-center gap-1 ${w.isShared ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                              {w.isShared ? <><LucideIcons.Users size={12}/> Współdzielony</> : <><LucideIcons.Lock size={12}/> Prywatny</>}
                              {!isOwner && <span className="ml-1 text-muted-foreground">(Właściciel: {ownerName})</span>}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-base tracking-tight text-foreground">{w.balance.toFixed(2)} zł</span>
                          {isOwner && (
                            <button onClick={() => setWalletToDelete(w)} className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10">
                              <LucideIcons.Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-end items-center gap-2 pt-2 border-t border-border/40">
                        {isOwner && (
                          <button 
                            type="button"
                            onClick={() => handleToggleShare(w._id)} 
                            className="text-xs px-2.5 py-1 rounded-lg border border-border/60 bg-muted/40 cursor-pointer hover:bg-muted font-medium transition-colors"
                          >
                            {w.isShared ? 'Ukryj przed grupą' : 'Udostępnij w Grupie'}
                          </button>
                        )}
                        <button type="button" onClick={() => { setAdjustingWallet(w); setAdjustBalance(w.balance); }} className="text-xs px-2.5 py-1 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                          <LucideIcons.Edit2 size={12} /> Zmień saldo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {wallets.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Brak kont / portfeli.</p>}
          </div>
        </CardContent>
      </Card>
      
      <Card className="border border-border/50 shadow-sm rounded-3xl overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-xl font-bold text-foreground">Kategorie</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Zarządzaj swojami kategoriami wydatków i dochodów</p>
            </div>
            <button 
              type="button"
              onClick={() => setShowAddCategoryModal(true)}
              className="px-4 py-2.5 bg-foreground hover:bg-foreground/90 text-background font-bold text-xs rounded-xl shadow transition-transform active:scale-95 flex items-center gap-2 self-start sm:self-auto shrink-0"
            >
              <LucideIcons.Plus size={16} className="stroke-[2.5]" />
              <span>Dodaj Kategorię</span>
            </button>
          </div>
          
          {/* Grouped Categories by Type */}
          <div className="flex flex-col gap-6">
            {/* Wydatki */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Wydatki ({categories.filter(c => c.type === 'expense').length})
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {categories.filter(c => c.type === 'expense').map(c => (
                  <div key={c._id} className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-2xl shadow-sm transition-all hover:border-border/80">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: c.color || '#6b7280' }}>
                        <DynamicIcon name={c.icon || 'Circle'} size={20} />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                        <span className="font-semibold text-sm truncate text-foreground">{c.name}</span>
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Wydatek</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setCategoryToDelete(c)} 
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10 shrink-0 ml-2"
                      title="Usuń kategorię"
                    >
                      <LucideIcons.Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {categories.filter(c => c.type === 'expense').length === 0 && (
                  <p className="text-xs text-muted-foreground col-span-2 py-4 pl-1">Brak kategorii wydatków.</p>
                )}
              </div>
            </div>

            {/* Dochody */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-1 border-t border-border/40 pt-4">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Dochody ({categories.filter(c => c.type === 'income').length})
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {categories.filter(c => c.type === 'income').map(c => (
                  <div key={c._id} className="flex items-center justify-between p-3 bg-card border border-border/50 rounded-2xl shadow-sm transition-all hover:border-border/80">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: c.color || '#6b7280' }}>
                        <DynamicIcon name={c.icon || 'Circle'} size={20} />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                        <span className="font-semibold text-sm truncate text-foreground">{c.name}</span>
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Przychód</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setCategoryToDelete(c)} 
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10 shrink-0 ml-2"
                      title="Usuń kategorię"
                    >
                      <LucideIcons.Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {categories.filter(c => c.type === 'income').length === 0 && (
                  <p className="text-xs text-muted-foreground col-span-2 py-4 pl-1">Brak kategorii dochodów.</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 mt-8">
        <Button variant="secondary" onClick={() => setShowChangeBudget(true)} className="w-full text-base py-6">
          Zmień grupę
        </Button>
        <Button variant="destructive" onClick={logout} className="w-full text-base py-6 font-semibold shadow-sm">
          Wyloguj się
        </Button>
      </div>

      <DeleteWalletDialog 
        isOpen={!!walletToDelete} 
        onClose={() => setWalletToDelete(null)}
        wallet={walletToDelete}
        allWallets={wallets}
        onDelete={handleDeleteWallet}
      />

      <DeleteCategoryDialog 
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        category={categoryToDelete}
        allCategories={categories}
        onDelete={handleDeleteCategory}
      />

      <ChangeBudgetDialog 
        isOpen={showChangeBudget}
        onClose={() => setShowChangeBudget(false)}
      />

      <AddCategoryModal 
        isOpen={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        onAdd={handleAddCategoryFromModal}
        categories={categories}
      />

      <AddWalletModal 
        isOpen={showAddWalletModal}
        onClose={() => setShowAddWalletModal(false)}
        onAdd={handleAddWalletFromModal}
        wallets={wallets}
      />
    </div>
  );
};

export default Setup;
