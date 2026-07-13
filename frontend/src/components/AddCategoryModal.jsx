import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import IconPickerModal from './IconPickerModal';

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

const AddCategoryModal = ({ isOpen, onClose, onAdd, defaultType = 'expense', categories = [] }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType);
  const [color, setColor] = useState(PREDEFINED_COLORS[0]);
  const [icon, setIcon] = useState(PREDEFINED_ICONS[0]);
  const [showIconModal, setShowIconModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
    }
  }, [isOpen, defaultType]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name) return;
    onAdd({ name, type, color, icon });
    setName('');
    onClose();
  };

  const customColors = Array.from(new Set([
    ...((categories || []).map(c => c.color).filter(c => c && !PREDEFINED_COLORS.includes(c))),
    ...(color && !PREDEFINED_COLORS.includes(color) ? [color] : [])
  ]));

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg p-6 bg-background rounded-3xl border border-border/60 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold text-foreground">Nowa kategoria</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Stwórz własną kategorię z wybraną ikoną i kolorem. Natychmiast pojawi się na Twoich listach.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Tabs: WYDATKI / DOCHODY */}
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
                className={`relative z-10 flex-1 py-2 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors ${type === 'expense' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
              >
                WYDATKI
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`relative z-10 flex-1 py-2 text-center text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors ${type === 'income' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
              >
                DOCHODY
              </button>
            </div>

            {/* Category Name Input */}
            <div className="bg-card border border-border/50 rounded-2xl p-3 px-3.5 shadow-sm">
              <span className="text-[11px] font-semibold uppercase text-muted-foreground mb-1 block tracking-wider">Nazwa kategorii</span>
              <input 
                type="text" 
                placeholder="Np. Zakupy spożywcze, Wynagrodzenie..." 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required
                autoFocus
                className="w-full bg-transparent font-bold text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none py-1"
              />
            </div>

            {/* Icon Selection */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block px-1">Wybierz ikonę</span>
              <div className="flex flex-wrap gap-2 items-center max-h-[160px] overflow-y-auto pr-1">
                {PREDEFINED_ICONS.map(iconName => {
                  const isSelected = icon === iconName;
                  return (
                    <div 
                      key={iconName}
                      onClick={() => setIcon(iconName)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
                        isSelected 
                          ? 'bg-[#232322] dark:bg-white text-white dark:text-black border border-white dark:border-white shadow-md ring-1 ring-white/70 dark:ring-white/70' 
                          : 'bg-card border border-border/50 text-foreground hover:border-border/80 shadow-sm'
                      }`}
                    >
                      <DynamicIcon name={iconName} size={18} />
                    </div>
                  );
                })}

                {!PREDEFINED_ICONS.includes(icon) && (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#232322] dark:bg-white text-white dark:text-black border border-white shadow-md">
                    <DynamicIcon name={icon} size={18} />
                  </div>
                )}

                <button 
                  type="button"
                  onClick={() => setShowIconModal(true)}
                  className="px-3.5 h-10 border border-dashed border-border/60 rounded-xl cursor-pointer bg-card text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-muted/60 transition-colors shadow-sm"
                >
                  <LucideIcons.Plus size={15} /> Więcej
                </button>
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block px-1">Wybierz kolor</span>
              <div className="flex flex-wrap gap-2.5 items-center">
                {PREDEFINED_COLORS.map(cColor => {
                  const isSelected = color === cColor;
                  return (
                    <div 
                      key={cColor}
                      onClick={() => setColor(cColor)}
                      className={`w-8 h-8 rounded-xl cursor-pointer shadow-sm transition-transform hover:scale-110 active:scale-95 flex items-center justify-center ${
                        isSelected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
                      }`}
                      style={{ backgroundColor: cColor }}
                    >
                      {isSelected && <LucideIcons.Check size={14} className="text-white stroke-[3] drop-shadow" />}
                    </div>
                  );
                })}

                {!PREDEFINED_COLORS.includes(color) && !customColors.includes(color) && (
                  <div 
                    className="w-8 h-8 rounded-xl shadow-sm ring-2 ring-foreground ring-offset-2 ring-offset-background flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    <LucideIcons.Check size={14} className="text-white stroke-[3] drop-shadow" />
                  </div>
                )}

                <label 
                  className="w-8 h-8 rounded-xl cursor-pointer shadow-sm flex items-center justify-center transition-transform hover:scale-110 active:scale-95 relative overflow-hidden border border-border/60"
                  style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
                  title="Niestandardowy kolor"
                >
                  <LucideIcons.Plus size={15} color="#fff" style={{ mixBlendMode: 'difference' }} />
                  <input 
                    type="color" 
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="opacity-0 w-0 h-0 absolute cursor-pointer"
                  />
                </label>
              </div>

              {customColors.length > 0 && (
                <div className="mt-3.5 pt-2.5 border-t border-border/40">
                  <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-2 block tracking-wider">Twoje własne kolory</span>
                  <div className="flex flex-wrap gap-2 items-center">
                    {customColors.map(cColor => {
                      const isSelected = color === cColor;
                      return (
                        <div 
                          key={cColor}
                          onClick={() => setColor(cColor)}
                          className={`w-8 h-8 rounded-xl cursor-pointer shadow-sm flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${
                            isSelected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
                          }`}
                          style={{ backgroundColor: cColor }}
                        >
                          {isSelected && <LucideIcons.Check size={14} className="text-white stroke-[3] drop-shadow" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="w-full py-3.5 mt-2 font-bold rounded-2xl text-base shadow-xl flex items-center justify-center gap-2 bg-foreground hover:bg-foreground/90 text-background transition-transform active:scale-[0.98]"
            >
              <LucideIcons.CheckCircle2 size={18} className="stroke-[2.5]" />
              <span>Zapisz kategorię</span>
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <IconPickerModal 
        isOpen={showIconModal} 
        onClose={() => setShowIconModal(false)} 
        onSelect={(iconName) => setIcon(iconName)} 
      />
    </>
  );
};

export default AddCategoryModal;
