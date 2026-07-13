import React, { useState } from 'react';
import useStore from '../store';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LoginSetup = () => {
  const [isJoin, setIsJoin] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [inviteCode, setInviteCode] = useState('');
  const [householdName, setHouseholdName] = useState('');
  
  const { userId, householdId, setUser, setHousehold } = useStore();

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const endpoint = isLoginMode ? '/api/user/login' : '/api/user/register';
    
    try {
      const res = await fetch(`http://localhost:5050${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        setUser(data._id, data.name);
        if (data.householdId) {
          setHousehold(data.householdId, data.householdName);
        }
      } else {
        setErrorMsg(data.error || 'Wystąpił błąd');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Błąd połączenia z serwerem');
    }
  };

  const handleCreateHousehold = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5050/api/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: householdName, userId })
      });
      const data = await res.json();
      if (res.ok) {
        setHousehold(data._id, data.name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinHousehold = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5050/api/household/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, userId })
      });
      const data = await res.json();
      if (res.ok) {
        setHousehold(data._id, data.name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Krok 1: Brak użytkownika -> Logowanie / Rejestracja
  if (!userId || !householdId) {
    return (
      <div className="flex-1 flex flex-col justify-center min-h-screen pb-8 p-6">
        <h1 className="text-center mb-8 text-3xl font-bold">Money Manager</h1>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex mb-6 border-b border-border">
              <button 
                type="button"
                className={`flex-1 pb-2 bg-transparent cursor-pointer border-b-2 transition-colors ${isLoginMode ? 'border-foreground font-semibold' : 'border-transparent font-normal'}`}
                onClick={() => { setIsLoginMode(true); setErrorMsg(''); }}
              >
                Zaloguj się
              </button>
              <button 
                type="button"
                className={`flex-1 pb-2 bg-transparent cursor-pointer border-b-2 transition-colors ${!isLoginMode ? 'border-foreground font-semibold' : 'border-transparent font-normal'}`}
                onClick={() => { setIsLoginMode(false); setErrorMsg(''); }}
              >
                Utwórz konto
              </button>
            </div>

            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nazwa użytkownika</label>
                <Input 
                  type="text" 
                  placeholder="np. Filip" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Hasło</label>
                <Input 
                  type="password" 
                  placeholder="Wpisz hasło" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {errorMsg && <p className="text-sm text-destructive text-center">{errorMsg}</p>}
              <Button type="submit" className="w-full mt-2">
                {isLoginMode ? 'Zaloguj się' : 'Zarejestruj się'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default LoginSetup;
