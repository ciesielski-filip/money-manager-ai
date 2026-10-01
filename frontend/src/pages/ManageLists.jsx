import { useCallback, useEffect, useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import useStore from '../store';
import { API_URL } from '../config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AddWalletModal from '../components/AddWalletModal';
import AddCategoryModal from '../components/AddCategoryModal';
import {
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
  Type,
} from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';

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
  <div className="sticky top-0 z-20 border-b border-border/40 bg-background px-4 pb-4 pt-14 shadow-sm sm:px-6">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Zarządzanie</p>
      <h1 className="text-2xl font-black text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

const EditItemDialog = ({ open, onClose, item, type, title, onSave }) => {
  const [name, setName] = useState(item?.name || '');
  const [balance, setBalance] = useState(item?.balance !== undefined ? String(item.balance) : '');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const isWallet = type === 'wallet';

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

const DeleteWalletDialog = ({ open, onClose, wallet, wallets, transactionCount, onDelete }) => {
  const targetWallets = wallets.filter(candidate => candidate._id !== wallet?._id);
  const [action, setAction] = useState(targetWallets.length > 0 ? 'move' : 'delete');
  const [targetWalletId, setTargetWalletId] = useState(targetWallets[0]?._id || '');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  if (!wallet) return null;

  const submit = async () => {
    if (action === 'move' && !targetWalletId) {
      setLocalError('Wybierz konto, na które mają trafić transakcje.');
      return;
    }
    try {
      setSaving(true);
      setLocalError('');
      await onDelete(wallet, { action, targetWalletId });
    } catch (error) {
      setLocalError(error.message || 'Nie udało się usunąć konta.');
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <LucideIcons.Trash2 size={26} />
          </div>
          <DialogTitle>Usunąć konto „{wallet.name}”?</DialogTitle>
          <DialogDescription>
            Konto ma {transactionCount} {transactionCount === 1 ? 'powiązaną operację' : 'powiązanych operacji'}. Wybierz, co zrobić z historią.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {targetWallets.length > 0 && (
            <button
              type="button"
              onClick={() => setAction('move')}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${action === 'move' ? 'border-foreground bg-muted/60' : 'border-border bg-background'}`}
            >
              <span className="flex items-center gap-3">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${action === 'move' ? 'border-foreground' : 'border-muted-foreground'}`}>
                  {action === 'move' && <span className="h-2.5 w-2.5 rounded-full bg-foreground" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">Zachowaj transakcje</span>
                  <span className="block text-xs text-muted-foreground">Przenieś historię i saldo na inne konto.</span>
                </span>
              </span>
              {action === 'move' && (
                <div className="mt-3 pl-8" onClick={event => event.stopPropagation()}>
                  <Select value={targetWalletId} onValueChange={setTargetWalletId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Wybierz konto docelowe" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetWallets.map(candidate => (
                        <SelectItem key={candidate._id} value={candidate._id}>{candidate.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setAction('delete')}
            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${action === 'delete' ? 'border-destructive bg-destructive/10' : 'border-border bg-background'}`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${action === 'delete' ? 'border-destructive' : 'border-muted-foreground'}`}>
              {action === 'delete' && <span className="h-2.5 w-2.5 rounded-full bg-destructive" />}
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">Usuń konto i transakcje</span>
              <span className="block text-xs text-muted-foreground">Historia powiązana z tym kontem zostanie trwale usunięta.</span>
            </span>
          </button>
        </div>

        {localError && <p className="text-sm text-destructive">{localError}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Anuluj</Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={saving}>
            {saving ? 'Usuwanie...' : 'Usuń konto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeleteCategoryDialog = ({ open, onClose, category, categories, onDelete }) => {
  const targetCategories = categories.filter(candidate => candidate._id !== category?._id && candidate.type === category?.type);
  const [targetCategoryId, setTargetCategoryId] = useState(targetCategories[0]?._id || '');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  if (!category) return null;

  const submit = async () => {
    if (targetCategories.length > 0 && !targetCategoryId) {
      setLocalError('Wybierz kategorię docelową.');
      return;
    }
    try {
      setSaving(true);
      setLocalError('');
      await onDelete(category, {
        action: targetCategories.length > 0 ? 'move' : 'delete',
        targetCategoryId,
      });
    } catch (error) {
      setLocalError(error.message || 'Nie udało się usunąć kategorii.');
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <LucideIcons.Tags size={26} />
          </div>
          <DialogTitle>Usunąć kategorię „{category.name}”?</DialogTitle>
          <DialogDescription>
            Powiązane transakcje i pozycje planu budżetowego zostaną przeniesione do wybranej kategorii tego samego typu.
          </DialogDescription>
        </DialogHeader>

        {targetCategories.length > 0 ? (
          <div className="space-y-2 py-2">
            <label className="text-xs font-medium text-muted-foreground">Przenieś do kategorii</label>
            <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz kategorię docelową" />
              </SelectTrigger>
              <SelectContent>
                {targetCategories.map(candidate => (
                  <SelectItem key={candidate._id} value={candidate._id}>{candidate.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            Nie ma innej kategorii tego typu. Jeśli kategoria zawiera transakcje, najpierw utwórz kategorię docelową.
          </div>
        )}

        {localError && <p className="text-sm text-destructive">{localError}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Anuluj</Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={saving || targetCategories.length === 0}>
            {saving ? 'Przenoszenie...' : 'Przenieś i usuń'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeleteSwipeAction = ({ onClick }) => (
  <TrailingActions>
    <SwipeAction onClick={onClick}>
      <div className="flex h-full min-w-[92px] items-center justify-end pl-2">
        <div className="flex h-full min-w-[84px] flex-col items-center justify-center gap-1 rounded-r-lg bg-destructive px-4 text-destructive-foreground">
          <LucideIcons.Trash2 size={19} />
          <span className="text-[11px] font-bold">Usuń</span>
        </div>
      </div>
    </SwipeAction>
  </TrailingActions>
);

const ManageLists = ({ view }) => {
  const { householdId, userId } = useStore();
  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [walletToDelete, setWalletToDelete] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
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
    const frame = window.requestAnimationFrame(() => fetchData());
    return () => window.cancelAnimationFrame(frame);
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

  const handleDeleteWallet = async (wallet, { action, targetWalletId }) => {
    const res = await fetch(`${API_URL}/api/wallets/${wallet._id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, targetWalletId, householdId, userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Nie udało się usunąć konta.');
    setWalletToDelete(null);
    await fetchData();
  };

  const handleDeleteCategory = async (category, { action, targetCategoryId }) => {
    const res = await fetch(`${API_URL}/api/categories/${category._id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        targetCategoryId,
        adjustBalance: false,
        householdId,
        userId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Nie udało się usunąć kategorii.');
    setCategoryToDelete(null);
    await fetchData();
  };

  const walletTransactionCount = walletToDelete
    ? transactions.filter(transaction => (
      String(transaction.walletId?._id || transaction.walletId) === String(walletToDelete._id)
      || String(transaction.toWalletId?._id || transaction.toWalletId) === String(walletToDelete._id)
    )).length
    : 0;

  const title = isAccounts ? 'Konta' : categoryType === 'expense' ? 'Kategorie wydatki' : 'Kategorie dochody';
  const subtitle = isAccounts
    ? `Suma: ${money(totalBalance)}`
    : `${visibleCategories.length} kategorii`;

  return (
    <div className="flex-1 overflow-y-auto bg-background pb-28">
      <Header title={title} subtitle={subtitle} />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4 sm:px-6">
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
          <div className="flex items-center justify-between gap-3">
            <Button type="button" size="sm" className="h-9 rounded-lg px-3 text-xs" onClick={() => setCategoryModalOpen(true)}>
              <LucideIcons.Plus size={15} /> Dodaj kategorię
            </Button>
            <span className="text-[11px] text-muted-foreground">Przesuń w lewo, aby usunąć</span>
          </div>
        )}

        {isAccounts && !showTransfers && wallets.length > 0 && (
          <p className="text-right text-[11px] text-muted-foreground">Przesuń konto w lewo, aby je usunąć</p>
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
          <div>
            <SwipeableList type={Type.IOS} threshold={0.25}>
            {wallets.map(wallet => (
              <SwipeableListItem
                key={wallet._id}
                className="mb-2 rounded-lg"
                trailingActions={String(wallet.ownerId?._id || wallet.ownerId) === String(userId)
                  ? <DeleteSwipeAction onClick={() => setWalletToDelete(wallet)} />
                  : undefined}
              >
                <Card className="w-full rounded-lg border-border/70 bg-card shadow-sm">
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
              </SwipeableListItem>
            ))}
            </SwipeableList>
            {wallets.length === 0 && <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">Brak kont.</p>}
          </div>
        ) : (
          <div>
            <SwipeableList type={Type.IOS} threshold={0.25}>
            {visibleCategories.map(category => (
              <SwipeableListItem
                key={category._id}
                className="mb-2 rounded-lg"
                trailingActions={<DeleteSwipeAction onClick={() => setCategoryToDelete(category)} />}
              >
                <Card className="w-full rounded-lg border-border/70 bg-card shadow-sm">
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
              </SwipeableListItem>
            ))}
            </SwipeableList>
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
        key={editingItem?.item?._id || 'edit-item'}
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem?.item}
        type={editingItem?.type}
        title={editingItem?.type === 'wallet' ? 'Edytuj konto' : 'Edytuj kategorię'}
        onSave={editingItem?.type === 'wallet' ? handleEditWallet : handleEditCategory}
      />
      <DeleteWalletDialog
        key={walletToDelete?._id || 'wallet-delete'}
        open={Boolean(walletToDelete)}
        onClose={() => setWalletToDelete(null)}
        wallet={walletToDelete}
        wallets={wallets}
        transactionCount={walletTransactionCount}
        onDelete={handleDeleteWallet}
      />
      <DeleteCategoryDialog
        key={categoryToDelete?._id || 'category-delete'}
        open={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
        category={categoryToDelete}
        categories={categories}
        onDelete={handleDeleteCategory}
      />
    </div>
  );
};

export default ManageLists;
