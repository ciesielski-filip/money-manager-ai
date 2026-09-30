import { useCallback, useEffect, useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import useStore from '../store';
import { API_URL } from '../config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AddWalletModal from '../components/AddWalletModal';
import AddCategoryModal from '../components/AddCategoryModal';

const money = (value) => new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const shortDate = (date) => new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: 'short',
}).format(new Date(date));

const DynamicIcon = ({ name, ...props }) => {
  const Icon = LucideIcons[name] || LucideIcons.Circle;
  return <Icon {...props} />;
};

const Header = ({ title, subtitle }) => (
  <div className="sticky top-0 z-20 border-b border-border/40 bg-background px-4 pb-4 pt-16 shadow-sm sm:px-6">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Zarządzanie</p>
      <h1 className="text-2xl font-black text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

const EditItemDialog = ({ open, onClose, item, type, title, onSave }) => {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const isWallet = type === 'wallet';

  useEffect(() => {
    setName(item?.name || '');
    setBalance(item?.balance !== undefined ? String(item.balance) : '');
    setLocalError('');
    setSaving(false);
  }, [item]);

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    const parsedBalance = isWallet ? Number(String(balance || 0).replace(',', '.')) : undefined;
    if (isWallet && !Number.isFinite(parsedBalance)) {
      setLocalError('Podaj poprawne saldo.');
      return;
    }

    try {
      setSaving(true);
      setLocalError('');
      await onSave(item, {
        name: name.trim(),
        balance: parsedBalance,
      });
    } catch (err) {
      setLocalError(err.message || 'Nie udało się zapisać zmian.');
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nazwa</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nazwa" autoFocus />
          </div>
          {isWallet && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Saldo</label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={balance}
                onChange={(event) => setBalance(event.target.value)}
                placeholder="0.00"
              />
            </div>
          )}
          {localError && <p className="text-sm text-destructive">{localError}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Anuluj</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Zapisywanie...' : 'Zapisz'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ManageLists = ({ view }) => {
  const { householdId, userId } = useStore();
  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showTransfers, setShowTransfers] = useState(false);
  const [transactions, setTransactions] = useState([]);

  const isAccounts = view === 'accounts';
  const categoryType = view === 'income-categories' ? 'income' : 'expense';

  const fetchData = useCallback(async () => {
    if (!householdId || !userId) return;
    try {
      setLoading(true);
      setError('');
      const [walletRes, categoryRes, transactionRes] = await Promise.all([
        fetch(`${API_URL}/api/wallets?householdId=${householdId}&userId=${userId}`),
        fetch(`${API_URL}/api/categories?householdId=${householdId}`),
        fetch(`${API_URL}/api/transactions?householdId=${householdId}&userId=${userId}`),
      ]);
      const walletData = await walletRes.json();
      const categoryData = await categoryRes.json();
      const transactionData = await transactionRes.json();
      if (!walletRes.ok) throw new Error(walletData?.error || 'Nie udało się pobrać kont');
      if (!categoryRes.ok) throw new Error(categoryData?.error || 'Nie udało się pobrać kategorii');
      setWallets(Array.isArray(walletData) ? walletData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setTransactions(Array.isArray(transactionData) ? transactionData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [householdId, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const visibleCategories = useMemo(
    () => categories.filter(category => category.type === categoryType),
    [categories, categoryType],
  );
  const totalBalance = useMemo(() => wallets.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0), [wallets]);
  const transfers = useMemo(() => transactions.filter(transaction => transaction.type === 'transfer' || transaction.toWalletId), [transactions]);

  const handleAddWallet = async ({ name, balance, color, icon }) => {
    const res = await fetch(`${API_URL}/api/wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, balance, color, icon, householdId, ownerId: userId }),
    });
    if (res.ok) fetchData();
  };

  const handleAddCategory = async ({ name, type, color, icon }) => {
    const res = await fetch(`${API_URL}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, color, icon, householdId }),
    });
    if (res.ok) fetchData();
  };

  const handleEditWallet = async (wallet, values) => {
    const nextBalance = Number(values.balance || 0);
    const currentBalance = Number(wallet.balance || 0);
    const nameChanged = values.name !== wallet.name;
    const shouldAdjustBalance = Number.isFinite(nextBalance) && Math.abs(nextBalance - currentBalance) >= 0.01;

    if (nameChanged) {
      const metadataRes = await fetch(`${API_URL}/api/wallets/${wallet._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: values.name }),
      });
      const metadataData = await metadataRes.json().catch(() => ({}));
      if (!metadataRes.ok) {
        throw new Error(metadataData?.error || 'Nie udało się zapisać nazwy konta.');
      }
    }

    if (shouldAdjustBalance) {
      const balanceRes = await fetch(`${API_URL}/api/wallets/${wallet._id}/adjust`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, householdId, newBalance: nextBalance }),
        });
      const balanceData = await balanceRes.json().catch(() => ({}));
      if (!balanceRes.ok) {
        throw new Error(balanceData?.error || 'Nie udało się zapisać salda konta.');
      }
    }

    setWallets(prevWallets => prevWallets.map(currentWallet => (
      currentWallet._id === wallet._id
        ? { ...currentWallet, name: values.name, balance: shouldAdjustBalance ? nextBalance : currentWallet.balance }
        : currentWallet
    )));
    setEditingItem(null);
    await fetchData();
  };

  const handleEditCategory = async (category, values) => {
    const res = await fetch(`${API_URL}/api/categories/${category._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, name: values.name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Nie udało się zapisać kategorii.');
    }
    setEditingItem(null);
    await fetchData();
  };

  const title = isAccounts ? 'Konta' : categoryType === 'expense' ? 'Kategorie wydatki' : 'Kategorie dochody';
  const subtitle = isAccounts
    ? `Suma: ${money(totalBalance)}`
    : `${visibleCategories.length} kategorii`;

  return (
    <div className="flex-1 overflow-y-auto bg-background pb-28">
      <Header title={title} subtitle={subtitle} />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-8 sm:px-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isAccounts && !showTransfers && (
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-auto flex-col gap-1 rounded-lg py-2 text-xs" onClick={() => setWalletModalOpen(true)}>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LucideIcons.Plus size={18} />
              </span>
              Nowe konto
            </Button>
            <Button type="button" variant={showTransfers ? 'default' : 'outline'} className="h-auto flex-col gap-1 rounded-lg py-2 text-xs" onClick={() => setShowTransfers(prev => !prev)}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${showTransfers ? 'bg-primary-foreground text-primary' : 'bg-muted text-foreground'}`}>
                <LucideIcons.ArrowLeftRight size={18} />
              </span>
              Przelewy
            </Button>
          </div>
        )}

        {isAccounts && showTransfers && (
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" className="-ml-2 h-9 rounded-lg px-2" onClick={() => setShowTransfers(false)}>
              <LucideIcons.ArrowLeft size={18} />
              Konta
            </Button>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Przelewy</span>
          </div>
        )}

        {!isAccounts && (
          <Button type="button" size="sm" className="h-9 self-start rounded-lg px-3 text-xs" onClick={() => setCategoryModalOpen(true)}>
            <LucideIcons.Plus size={15} /> Dodaj kategorię
          </Button>
        )}

        {loading ? (
          <div className="rounded-lg border border-border/70 bg-card p-6 text-center text-sm text-muted-foreground">Ładowanie...</div>
        ) : isAccounts && showTransfers ? (
          <div className="space-y-2">
            {transfers.map(transfer => (
              <Card key={transfer._id} className="rounded-lg border-border/70 bg-card shadow-sm">
                <CardContent className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{transfer.description || 'Przelew między kontami'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {transfer.walletId?.name || 'Konto'} → {transfer.toWalletId?.name || 'Konto'} · {shortDate(transfer.date)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-foreground">{money(transfer.amount)}</p>
                </CardContent>
              </Card>
            ))}
            {transfers.length === 0 && <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">Brak przelewów.</p>}
          </div>
        ) : isAccounts ? (
          <div className="space-y-2">
            {wallets.map(wallet => (
              <Card key={wallet._id} className="rounded-lg border-border/70 bg-card shadow-sm">
                <CardContent className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: wallet.color || '#334155' }}>
                      <DynamicIcon name={wallet.icon || 'Wallet'} size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{wallet.name}</p>
                      {wallet.isShared && <p className="text-xs text-muted-foreground">Współdzielone</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{money(wallet.balance)}</p>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem({ type: 'wallet', item: wallet })}>
                      <LucideIcons.Pencil size={15} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {wallets.length === 0 && <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">Brak kont.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleCategories.map(category => (
              <Card key={category._id} className="rounded-lg border-border/70 bg-card shadow-sm">
                <CardContent className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: category.color || '#334155' }}>
                      <DynamicIcon name={category.icon || 'Circle'} size={18} />
                    </div>
                    <p className="truncate text-sm font-semibold text-foreground">{category.name}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem({ type: 'category', item: category })}>
                    <LucideIcons.Pencil size={15} />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {visibleCategories.length === 0 && <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">Brak kategorii.</p>}
          </div>
        )}
      </main>

      <AddWalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onAdd={handleAddWallet}
        wallets={wallets}
      />
      <AddCategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onAdd={handleAddCategory}
        defaultType={categoryType}
        categories={categories}
      />
      <EditItemDialog
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem?.item}
        type={editingItem?.type}
        title={editingItem?.type === 'wallet' ? 'Edytuj konto' : 'Edytuj kategorię'}
        onSave={editingItem?.type === 'wallet' ? handleEditWallet : handleEditCategory}
      />
    </div>
  );
};

export default ManageLists;
