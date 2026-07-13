import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ALL_ICON_NAMES = Object.keys(LucideIcons).filter(name => {
  return /^[A-Z]/.test(name) && name !== 'Icon' && name !== 'LucideIcon';
});

const POLISH_TO_ENGLISH = {
  'dom': ['home', 'house', 'building'],
  'auto': ['car', 'truck', 'bus', 'bike'],
  'samochod': ['car', 'truck'],
  'samochód': ['car', 'truck'],
  'jedzenie': ['utensils', 'apple', 'pizza', 'beef', 'croissant', 'soup', 'coffee', 'beer', 'wine'],
  'zakupy': ['shopping', 'cart', 'bag', 'basket', 'store'],
  'praca': ['briefcase', 'hammer', 'wrench', 'laptop', 'monitor'],
  'sport': ['dumbbell', 'trophy', 'medal', 'activity', 'bike'],
  'zdrowie': ['heart', 'stethoscope', 'pill', 'syringe', 'cross'],
  'rozrywka': ['gamepad', 'film', 'music', 'ticket', 'tv', 'popcorn'],
  'edukacja': ['graduation', 'book', 'library', 'school', 'pencil'],
  'podroze': ['plane', 'map', 'compass', 'tent', 'bus', 'train'],
  'podróże': ['plane', 'map', 'compass', 'tent', 'bus', 'train'],
  'dzieci': ['baby', 'smile'],
  'zwierzeta': ['dog', 'cat', 'bird', 'paw'],
  'zwierzęta': ['dog', 'cat', 'bird', 'paw'],
  'rachunki': ['receipt', 'file', 'zap', 'droplet', 'flame'],
  'prad': ['zap'],
  'prąd': ['zap'],
  'woda': ['droplet'],
  'pieniadze': ['dollar', 'coins', 'wallet', 'credit', 'piggy', 'bank'],
  'pieniądze': ['dollar', 'coins', 'wallet', 'credit', 'piggy', 'bank'],
  'prezent': ['gift'],
  'kawa': ['coffee'],
  'telefon': ['phone', 'smartphone'],
  'internet': ['wifi', 'globe']
};

const DynamicIcon = ({ name, ...props }) => {
  const IconComponent = LucideIcons[name] || LucideIcons['Circle'];
  return <IconComponent {...props} />;
};

const IconPickerModal = ({ isOpen, onClose, onSelect }) => {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  
  if (!isOpen) return null;

  const lowerSearch = search.toLowerCase();
  let searchTerms = [lowerSearch];
  if (POLISH_TO_ENGLISH[lowerSearch]) {
    searchTerms = searchTerms.concat(POLISH_TO_ENGLISH[lowerSearch]);
  } else {
    Object.keys(POLISH_TO_ENGLISH).forEach(key => {
      if (key.includes(lowerSearch) || lowerSearch.includes(key)) {
        searchTerms = searchTerms.concat(POLISH_TO_ENGLISH[key]);
      }
    });
  }

  const filtered = ALL_ICON_NAMES.filter(name => {
    const lowerName = name.toLowerCase();
    return searchTerms.some(term => lowerName.includes(term));
  });

  const visibleIcons = filtered.slice(0, limit);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-5 bg-background rounded-3xl border border-border/60 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col z-[70]">
        <DialogHeader className="pb-2 border-b border-border/40">
          <DialogTitle className="text-lg font-bold text-foreground flex justify-between items-center">
            <span>Wszystkie Ikony ({filtered.length})</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col flex-1 overflow-hidden pt-3">
          <input 
            type="text" 
            placeholder="Szukaj ikony (np. praca, auto, dom)..." 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(100);
            }}
            className="w-full bg-muted/50 border border-border/60 rounded-xl px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground mb-3"
          />
          <div className="overflow-y-auto flex-1 pb-2 pr-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="grid grid-cols-5 gap-2.5">
              {visibleIcons.map(name => (
                <div
                  key={name}
                  onClick={() => {
                    onSelect(name);
                    onClose();
                  }}
                  className="flex flex-col items-center justify-center p-2.5 border border-border/40 rounded-xl cursor-pointer hover:bg-muted transition-all active:scale-95 group"
                >
                  <DynamicIcon name={name} size={22} className="text-foreground group-hover:scale-110 transition-transform shrink-0" />
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center mt-1.5 font-medium">
                    {name}
                  </span>
                </div>
              ))}
            </div>
            {visibleIcons.length < filtered.length && (
              <button
                type="button"
                onClick={() => setLimit(l => l + 100)}
                className="w-full mt-4 py-2.5 bg-muted hover:bg-muted/80 text-xs font-semibold rounded-xl transition-colors"
              >
                Pokaż więcej ({filtered.length - visibleIcons.length})
              </button>
            )}
            {visibleIcons.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Brak wyników dla &quot;{search}&quot;</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IconPickerModal;
