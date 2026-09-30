# Money Manager AI – Kompletny Opis i Dokumentacja Aplikacji

**Money Manager AI** to nowoczesna, wieloplatformowa aplikacja webowa (PWA / Mobile-First) do kompleksowego zarządzania finansami osobistymi, budżetem gospodarstwa domowego, celami oszczędnościowymi oraz fizycznymi aktywami (złotem inwestycyjnym).

Aplikacja łączy intuicyjny, minimalistyczny interfejs z zaawansowaną analityką finansową, automatycznym przeliczaniem kursów metali szlachetnych z NBP oraz obsługą wielu użytkowników w ramach jednego budżetu domowego.

---

## 📑 Spis Treści
1. [Główne Możliwości i Przeznaczenie](#1-główne-możliwości-i-przeznaczenie)
2. [Moduły Aplikacji i Dostępne Opcje](#2-moduły-aplikacji-i-dostępne-opcje)
   - [A. Dashboard (Pulpit Główny)](#a-dashboard-pulpit-główny)
   - [B. Dodawanie Transakcji](#b-dodawanie-transakcji)
   - [C. Portfele i Konta (Wallets)](#c-portfele-i-konta-wallets)
   - [D. Moduł Celów i Skarbonek (Goals)](#d-moduł-celów-i-skarbonek-goals)
   - [E. Fizyczne Złoto i Wycena Rynkowa (Gold Investments)](#e-fizyczne-złoto-i-wycena-rynkowa-gold-investments)
   - [F. Statystyki i Analityka Wykresów](#f-statystyki-i-analityka-wykresów)
   - [G. Ustawienia, Domownicy i Motywy](#g-ustawienia-domownicy-i-motywy)
3. [Architektura Technologiczna](#3-architektura-technologiczna)
4. [Bezpieczeństwo i Zasady Finansowe](#4-bezpieczeństwo-i-zasady-finansowe)

---

## 1. Główne Możliwości i Przeznaczenie

- **Budżet Osobisty i Wspólny (Gospodarstwo Domowe)** – prowadź finanse sam lub współdziel budżet z partnerem/rodziną za pomocą unikalnego kodu zaproszenia.
- **Wieloportfelowość** – ewidencja dowolnej liczby kont bankowych, kart, gotówki, kont oszczędnościowych i walutowych.
- **Kalkulator Oszczędnościowy** – dynamiczne wyliczanie, ile musisz odkładać miesięcznie/tygodniowo, aby osiągnąć wyznaczony cel przed terminem.
- **Śledzenie Fizycznego Złota w Czasie Rzeczywistym** – automatyczne pobieranie kursu z API Narodowego Banku Polskiego (NBP) z kalkulacją realnej ceny sprzedaży u dilera i w skupie.
- **Wygoda na Smartfonie (Mobile-First)** – gesty swipe do edycji/usuwania transakcji, duża klawiatura kwot, dolny pasek nawigacyjny, motyw ciemny i różowy.

---

## 2. Moduły Aplikacji i Dostępne Opcje

### A. Dashboard (Pulpit Główny)
Pulpit główny stanowi centrum dowodzenia Twoimi finansami:
- **Podsumowanie Salda**:
  - Wybór widoku: suma wszystkich kont lub filtr na konkretny portfel.
  - Wyświetlanie aktualnego stanu posiadania w PLN.
- **Przełącznik Typów Transakcji (Sliding Pill)**:
  - `WYDATKI` – analiza struktury kosztów.
  - `DOCHODY` – analiza źródeł wpływów.
- **Filtry Czasowe (Podróż w Czasie)**:
  - Zakresy: `Dzień`, `Tydzień`, `Miesiąc`, `Rok`, `Własny okres`.
  - Strzałki nawigacyjne do przechodzenia do poprzednich lub przyszłych okresów.
  - Precyzyjny kalendarz wyboru własnego przedziału dat.
- **Interaktywny Wykres Kołowy (Doughnut Chart)**:
  - Dynamiczny wykres kołowy prezentujący procentowy udział kategorii w budżecie.
  - Kliknięcie w kartę podsumowania zwija wykres do minimalistycznego paska postępu (oszczędność miejsca na ekranie telefonu).
- **Szczegółowy Widok Kategorii**:
  - Kliknięcie w dowolną kategorię otwiera dedykowany widok z:
    - Sumą wydatków/dochodów w tej kategorii.
    - Wyszukiwarką transakcji po opisie, portfelu lub kwocie.
    - Sortowaniem (od najnowszych, od największej kwoty, od najmniejszej kwoty).
    - Historią transakcji pogrupowaną dniami.
    - **Eksportem do pliku CSV** jednym kliknięciem.
- **Lista Ostatnich Transakcji (Swipeable List)**:
  - Grupowanie transakcji według dni.
  - Przesunięcie palcem w lewo/prawo (gest swipe) pozwala natychmiast edytować lub usunąć wpis.

---

### B. Dodawanie Transakcji
Dedykowany formularz do błyskawicznego rejestrowania operacji finansowych:
- **3 Tryby Operacji**:
  1. **Wydatek** – rejestracja kosztu (obniża saldo wybranego portfela).
  2. **Przychód** – rejestracja wpływu (zwiększa saldo portfela).
  3. **Przelew między kontami** – transfer środków z jednego konta na drugie bez wpływu na bilans ogólny.
- **Wygodne Wprowadzanie Kwoty**:
  - Wyraźne, duże pole kwoty z automatycznym formatowaniem groszy.
- **Układ Pionowy (Portfel i Data)**:
  - Wybór portfela źródłowego (oraz docelowego przy przelewie).
  - Wybór daty z kalendarza (domyślnie data bieżąca).
  - Możliwość dodania nowego konta bezpośrednio z poziomu tego formularza bez opuszczania widoku.
- **Kafelkowa Siatka Kategorii**:
  - Przejrzyste ikony i kolory ułatwiające kategoryzację jednym dotknięciem.
  - Przycisk szybkiego utworzenia nowej kategorii z poziomu formularza.
- **Opcjonalny Opis**:
  - Pole tekstowe na dodatkowe notatki (np. numer faktury, nazwa sklepu).

---

### C. Portfele i Konta (Wallets)
Elastyczne zarządzanie strukturą kont finansowych:
- **Wielokontowość**: obsługa kont bankowych, kart kredytowych, gotówki, lokat, oszczędności.
- **Personalizacja Wizualna**:
  - Wybór dowolnego koloru z palety.
  - Przypisanie ikony z biblioteki Lucide (np. portfel, karta, gotówka, skarbonka, budynek banku).
- **Współdzielenie w Domu (`isShared`)**:
  - Oznacz portfel jako prywatny (widzisz go tylko Ty) lub współdzielony (widzą go i mogą z niego korzystać pozostali domownicy).
- **Ręczna Korekta Salda**:
  - Jeśli rzeczywisty stan konta różni się od aplikacji, możesz wpisać aktualną kwotę. Aplikacja automatycznie wyliczy różnicę i doda transparentną transakcję korekty (`Korekta Salda`).
- **Bezpieczne Usuwanie Portfela**:
  - W przypadku usuwania konta aplikacja pyta:
    - Czy trwale usunąć przypisane do niego transakcje, czy
    - Przenieść wszystkie transakcje i saldo do innego wybranego konta.

---

### D. Moduł Celów i Skarbonek (Goals)
Wirtualne skarbonki umożliwiające realizację planów finansowych:
- **Parametry Celu**:
  - Nazwa celu (np. *Wakacje w Grecji*, *Wkład własny na mieszkanie*, *Nowy laptop*).
  - Kwota docelowa (Target Amount).
  - Data końcowa (Deadline) z obsługą planowania na lata w przód.
  - Wybór dedykowanej ikony i koloru.
  - Status: *W trakcie*, *Osiągnięty 🎉*, *Anulowany*.
- **Inteligentny Kalkulator Celu (Smart Advisor)**:
  - Automatycznie oblicza czas pozostały do deadline'u (w miesiącach i dniach).
  - Dynamicznie podaje rekomendowaną kwotę do odłożenia: **ile miesięcznie oraz ile tygodniowo**, aby zdążyć na czas.
  - Pasek postępu od 0% do 100% z płynną animacją.
- **Zasilanie Skarbonki (Wpłać)**:
  - Przelej środki z dowolnego portfela na cel.
  - Saldo portfela źródłowego maleje, stan skarbonki rośnie.
  - Zapisywana jest dedykowana transakcja `Wpłata na cel`.
- **Wypłata z Celu (Wypłać)**:
  - W razie potrzeby lub po realizacji celu środki można natychmiast przelać z powrotem na dowolne konto.
- **Historia Przelewów Bezpośrednio w Celu**:
  - Karta celu wyświetla **3 ostatnie operacje** (wpłaty na zielono, wypłaty na czerwono, nazwa portfela, data).
  - Przycisk **„Zobacz więcej”** otwiera okno dialogowe z pełnym podsumowaniem celu oraz kompletną historią wszystkich transferów.
- **Bezpieczne Usuwanie Celu z Ochroną Środków**:
  - Jeśli usuwasz cel, w którym znajdują się zgromadzone pieniądze, aplikacja wymusi wybór portfela, na który odłożona kwota zostanie zwrócona.

---

### E. Fizyczne Złoto i Wycena Rynkowa (Gold Investments)
Zaawansowany moduł do ewidencji i wyceny złota inwestycyjnego (sztabek i monet bulionowych):
- **Automatyczny Kurs Złota z API NBP**:
  - Codzienne, bezpłatne pobieranie oficjalnego kursu 1 grama czystego kruszcu (próba 999.9) z Narodowego Banku Polskiego.
  - Wbudowany cache serwerowy zapobiegający przeciążaniu zapytań.
- **Ewidencja Posiadanych Sztabek i Monet**:
  - Wprowadzanie pozycji w gramach (g) lub uncjach trojańskich (oz).
  - Szybkie presety wagowe: `1g`, `2.5g`, `5g`, `10g`, `20g`, `1 oz (31.10g)`, `50g`, `100g`.
  - Opcjonalne zapisywanie ceny zakupu (w PLN) oraz daty zakupu dla monitorowania zysku/straty.
  - Opcjonalne powiązanie pozycji złota z celem oszczędnościowym.
- **Szacunkowa Wycena Sprzedaży (Realistyczny Odkup)**:
  - W szczegółach moduł podaje 3 poziomy wyceny:
    1. **Wartość rynkowa SPOT NBP (100%)** – teoretyczna wartość kruszcu na rynku.
    2. **Odkup u dilera (95% – 97% SPOT)** – realna cena, jaką otrzymasz w mennicach i u profesjonalnych dilerów (np. Tavex, Mennica Polska) za złoto w nienaruszonym opakowaniu (CertiPack).
    3. **Cena w skupie / lombardzie (88% – 90% SPOT)** – wycena złota w przypadku szybkiej sprzedaży lub uszkodzonego opakowania.
- **Kalkulacja Zysku**:
  - Porównanie aktualnej wartości rynkowej z łącznym kosztem zakupu (zysk/strata w PLN i procentach).

---

### F. Statystyki i Analityka Wykresów
Zaawansowana analiza kondycji finansowej:
- **Wykres Kołowy (Doughnut)** – pełna struktura podziału wydatków na poszczególne kategorie.
- **Wykres Słupkowy (Bar Chart)** – bezpośrednie porównanie sumy przychodów z sumą wydatków.
- **Rozeta (Polar Area Chart)** – radialny rozkład proporcji wydatków.
- **Szczegółowa Lista Kategorii** – zestawienie kwotowe wszystkich kategorii z przypisanymi kolorami i ikonami.
- Możliwość ukrycia całej zakładki statystyk w ustawieniach (jeśli preferujesz czystszy interfejs).

---

### G. Ustawienia, Domownicy i Motywy
- **Gospodarstwo Domowe (Household)**:
  - Nazwa budżetu domowego.
  - Unikalny 8-znakowy kod zaproszenia (`inviteCode`) z przyciskiem szybkiego kopiowania do schowka.
  - Lista wszystkich zarejestrowanych członków budżetu.
- **Zarządzanie Kategoriami**:
  - Tworzenie własnych kategorii dochodów i wydatków.
  - Wybór ikony i koloru.
  - Bezpieczne usuwanie kategorii (z opcją przeniesienia transakcji do innej kategorii).
- **Zarządzanie Portfelami**:
  - Konfiguracja istniejących kont, zmiana nazw, ikon i statusu współdzielenia.
- **Personalizacja Wyglądu**:
  - Przełącznik: **Ciemny motyw (Dark Mode)** / **Jasny motyw (Light Mode)**.
  - Motyw kolorystyczny: **Domyślny** / **Różowy (`theme-pink`)**.
  - Opcja włączenia/wyłączenia zakładki statystyk w dolnym menu.
- **Bezpieczne Wylogowanie**:
  - Czyszczenie stanu sesji na urządzeniu.

---

## 3. Architektura Technologiczna

| Warstwa | Technologia | Opis |
|---|---|---|
| **Frontend Framework** | React 19 + Vite 5 | Nowoczesny, ultraszybki rendering i HMR |
| **Styling & UI** | Tailwind CSS + Radix UI | Elastyczny design system z komponentami dostępnościowymi (shadcn) |
| **Ikony** | Lucide React | Spójny zestaw ponad 20 ikon do portfeli, kategorii i celów |
| **Wykresy** | Chart.js + react-chartjs-2 | Reaktywne wykresy kołowe, słupkowe i polarne |
| **Zarządzanie Stanem** | Zustand (z `persist`) | Lekki stan aplikacji z synchronizacją z `localStorage` |
| **Obsługa Dat** | date-fns (locale: `pl`) | Formatowanie i arytmetyka kalendarzowa w języku polskim |
| **Backend** | Node.js + Express 5 | Skalowalny serwer REST API przystosowany do Serverless |
| **Baza Danych** | MongoDB + Mongoose 8 | Dokumentowa baza danych z walidacją schematów |
| **Bezpieczeństwo** | bcryptjs | Solenie i bezpieczne haszowanie haseł użytkowników |
| **Zewnętrzne API** | NBP Web API | Oficjalny kurs złota bez limitów i bez kluczy API |
| **Deployment** | Vercel | Konfiguracja serverless mono-repo (`vercel.json`) |

---

## 4. Bezpieczeństwo i Zasady Finansowe

1. **Integralność Salda**: Każda dodana, zmodyfikowana lub usunięta transakcja precyzyjnie koryguje salda powiązanych portfeli.
2. **Ochrona przed Ujemnymi Przelewami**: Formularze weryfikują dostępność środków przed realizacją przelewu na cel lub inne konto.
3. **Prywatność Portfeli i Celów**: Domownicy widzą tylko portfele i cele oznaczone flagą `isShared: true` lub należące do nich samych.
4. **Brak Kasowania Danych „W Próżnię”**: Przy usuwaniu portfela, kategorii lub celu z saldem, aplikacja zawsze daje użytkownikowi wybór: czy chce przenieść transakcje/środki na inny element, zapobiegając przypadkowej utracie historii.
