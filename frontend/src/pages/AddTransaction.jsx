import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import * as LucideIcons from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
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
  const IconComponent = LucideIcons[name] || LucideIcons['Circle'];
  return <IconComponent {...props} />;
};

const AddTransaction = () => {
  const navigate = useNavigate();
  const { householdId, userId } = useStore();
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [type, setType] = useState('expense');
  const [date, setDate] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddWalletModal, setShowAddWalletModal] = useState(false);

  const handleAddCategoryFromModal = async ({ name, type: catType, color, icon }) => {
    try {
      const res = await fetch('http://localhost:5050/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: catType,
          color,
          icon,
          householdId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCategories([...categories, data]);
        if (data.type === type) {
          setCategoryId(data._id);
        } else {
          setType(data.type);
          setCategoryId(data._id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWalletFromModal = async ({ name, balance, color, icon }) => {
    try {
      const res = await fetch('http://localhost:5050/api/wallets', {
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
        setWalletId(data._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, walletRes] = await Promise.all([
          fetch(`http://localhost:5050/api/categories?householdId=${householdId}`),
          fetch(`http://localhost:5050/api/wallets?householdId=${householdId}&userId=${userId}`)
        ]);
        
        const catData = await catRes.json();
        const walletData = await walletRes.json();
        
        setCategories(catData);
        setWallets(walletData);
        
        if (walletData.length > 0) setWalletId(walletData[0]._id);
      } catch (err) {
        console.error(err);
      }
    };
    if (householdId) fetchData();
  }, [householdId, userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !categoryId || !walletId || !date || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:5050/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description,
          categoryId,
          walletId,
          householdId,
          userId,
          date: date.toISOString()
        })
      });
      if (res.ok) {
        navigate('/');
      } else {
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === type);

  useEffect(() => {
    if (categoryId) {
      const catExists = filteredCategories.some(c => c._id === categoryId);
      if (!catExists) setCategoryId('');
    }
  }, [type, categories]);

  if (wallets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background h-full pb-24">
        <div className="w-full max-w-md bg-card border border-border/50 rounded-3xl p-8 text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4 text-muted-foreground">
            <LucideIcons.Wallet size={32} />
          </div>
          <h2 className="mb-2 font-bold text-xl text-foreground">Brak portfela</h2>
          <p className="text-muted-foreground text-sm mb-6">Musisz najpierw stworzyć portfel (konto), aby dodawać transakcje.</p>
          <button 
            type="button"
            onClick={() => navigate('/setup')} 
            className="w-full py-3.5 px-6 bg-foreground hover:bg-foreground/90 text-background font-semibold rounded-2xl shadow transition-transform active:scale-95"
          >
            Przejdź do Ustawień
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-background pb-28">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-background pt-5 px-4 sm:px-6 pb-3 border-b border-border/40 shadow-sm flex items-center justify-between">
        <button 
          type="button" 
          onClick={() => navigate('/')} 
          className="p-2 -ml-2 rounded-full text-foreground hover:bg-muted/50 transition-colors"
          title="Powrót"
        >
          <LucideIcons.ChevronLeft size={26} />
        </button>
        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Nowa transakcja</span>
        <div className="w-8" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 px-4 sm:px-6 pt-4 max-w-lg mx-auto w-full gap-5">
        
        {/* Tabs: WYDATKI / DOCHODY (Sliding Pill) */}
        <div className="flex w-full bg-muted/60 p-1 rounded-xl relative select-none">
          <div 
            className="absolute top-1 bottom-1 left-1 bg-background shadow-sm rounded-lg transition-transform duration-300 ease-out border border-border/40"
            style={{
              width: 'calc(50% - 0.25rem)',
              transform: type === 'expense' ? 'translateX(0)' : 'translateX(100%)'
            }}
          ></div>
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`relative z-10 flex-1 py-2.5 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors ${type === 'expense' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
          >
            WYDATKI
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`relative z-10 flex-1 py-2.5 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors ${type === 'income' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
          >
            DOCHODY
          </button>
        </div>

        {/* Big Prominent Amount Display & Input */}
        <div className="bg-[#232322] dark:bg-[#1c1c1e] text-white rounded-[26px] p-5 sm:p-6 shadow-xl border border-white/5 flex flex-col items-center justify-center relative transition-all">
          <span className="text-xs sm:text-sm font-medium text-gray-400 mb-1 tracking-wider uppercase">Kwota transakcji</span>
          <div className="flex items-center justify-center w-full gap-1 my-2">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
              className="bg-transparent text-center font-extrabold text-4xl sm:text-5xl text-white tracking-tight focus:outline-none w-full max-w-[280px] placeholder:text-gray-600 appearance-none pl-6"
            />
            <span className="font-extrabold text-2xl sm:text-3xl text-white/80 shrink-0 self-end mb-1 sm:mb-1.5">zł</span>
          </div>
        </div>

        {/* Date & Wallet Selection Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Wallet Select */}
          <div className="bg-card border border-border/50 rounded-2xl p-3 px-3.5 shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">Portfel</span>
              <button
                type="button"
                onClick={() => setShowAddWalletModal(true)}
                className="text-[11px] text-foreground hover:underline font-bold flex items-center gap-1"
              >
                <LucideIcons.Plus size={12} /> Nowe konto
              </button>
            </div>
            <Select value={walletId} onValueChange={setWalletId} required>
              <SelectTrigger className="border-none shadow-none p-0 h-auto bg-transparent focus:ring-0 text-foreground font-bold text-sm sm:text-base flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  {(() => {
                    const selectedW = wallets.find(w => w._id === walletId);
                    if (selectedW) {
                      return (
                        <>
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: selectedW.color || '#3b82f6' }}>
                            <DynamicIcon name={selectedW.icon || 'CreditCard'} size={14} />
                          </div>
                          <SelectValue placeholder="Wybierz portfel" />
                        </>
                      );
                    }
                    return (
                      <>
                        <LucideIcons.Wallet className="w-4 h-4 text-foreground shrink-0" />
                        <SelectValue placeholder="Wybierz portfel" />
                      </>
                    );
                  })()}
                </div>
              </SelectTrigger>
              <SelectContent>
                {wallets.map(w => (
                  <SelectItem key={w._id} value={w._id} className="font-medium py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: w.color || '#3b82f6' }}>
                        <DynamicIcon name={w.icon || 'CreditCard'} size={14} />
                      </div>
                      <span>{w.name}</span>
                      <span className="text-muted-foreground font-normal ml-1">({w.balance.toFixed(2)} zł)</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Picker */}
          <div className="bg-card border border-border/50 rounded-2xl p-3 px-3.5 shadow-sm flex flex-col justify-center">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground mb-1 tracking-wider">Data</span>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="w-full flex items-center justify-between text-left font-bold text-sm sm:text-base text-foreground bg-transparent focus:outline-none">
                  <span className="truncate">{date ? format(date, "d MMMM yyyy", { locale: pl }) : "Wybierz datę"}</span>
                  <LucideIcons.CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-border/50 shadow-xl" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
                  initialFocus
                  captionLayout="dropdown"
                  fromYear={2000}
                  toYear={2050}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Categories Selection (Grid / Cards, NOT dots!) */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Wybierz Kategorię ({filteredCategories.length})
            </label>
            <button 
              type="button"
              onClick={() => setShowAddCategoryModal(true)}
              className="text-xs font-bold text-foreground hover:opacity-80 flex items-center gap-1.5 bg-card border border-border/60 px-3 py-1.5 rounded-xl shadow-sm transition-transform active:scale-95"
            >
              <LucideIcons.Plus size={14} className="stroke-[2.5]" />
              <span>Dodaj kategorię</span>
            </button>
          </div>
          {filteredCategories.length === 0 ? (
            <div className="bg-card border border-border/50 rounded-2xl p-6 text-center text-muted-foreground text-sm">
              Brak kategorii w sekcji {type === 'expense' ? 'Wydatki' : 'Dochody'}. Przejdź do ustawień, aby dodać kategorię.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[260px] overflow-y-auto pr-1 py-0.5">
              {filteredCategories.map(c => {
                const isSelected = categoryId === c._id;
                return (
                  <div
                    key={c._id}
                    onClick={() => setCategoryId(c._id)}
                    className={`cursor-pointer rounded-2xl p-3 border transition-all duration-200 flex items-center gap-3 select-none active:scale-[0.98] ${
                      isSelected 
                        ? 'bg-[#232322] dark:bg-[#1c1c1e] text-white border-white shadow-md ring-1 ring-white/70' 
                        : 'bg-card border-border/50 text-foreground hover:border-border/80 shadow-sm'
                    }`}
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm transition-transform"
                      style={{ backgroundColor: c.color || '#6b7280' }}
                    >
                      <DynamicIcon name={c.icon || 'Circle'} size={20} />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                      <span className="font-semibold text-xs sm:text-sm truncate">{c.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Description / Notes (NO labels/tags, NO photos/receipts!) */}
        <div className="bg-card border border-border/50 rounded-2xl p-3 px-3.5 shadow-sm">
          <span className="text-[11px] font-semibold uppercase text-muted-foreground mb-1 block tracking-wider">Opis / Notatka (Opcjonalnie)</span>
          <textarea 
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none min-h-[50px] py-1"
            placeholder="Dodaj opcjonalną notatkę do tej transakcji..." 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={!amount || !categoryId || !walletId || isSubmitting}
          className={`w-full py-4 mt-2 font-bold rounded-2xl text-base shadow-xl flex items-center justify-center gap-2 transition-all ${
            !amount || !categoryId || !walletId || isSubmitting
              ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              : 'bg-foreground hover:bg-foreground/90 text-background active:scale-[0.98]'
          }`}
        >
          <LucideIcons.CheckCircle2 size={20} className="stroke-[2.5]" />
          <span>Dodaj transakcję</span>
        </button>

      </form>

      <AddCategoryModal 
        isOpen={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        onAdd={handleAddCategoryFromModal}
        defaultType={type}
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

export default AddTransaction;
