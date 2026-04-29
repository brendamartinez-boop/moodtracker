'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Cloud, Bell, Settings, Sparkles, Trash2, Info, Loader2, LogOut, User as UserIcon, Wifi, WifiOff } from 'lucide-react';
import { auth, db, googleProvider, isFirebaseConfigured, onAuthStateChanged, signInWithPopup, signOut, doc, setDoc, getDoc, Timestamp, type User } from '@/lib/firebase';

// --- Types ---
type MoodId = 'increible' | 'bien' | 'normal' | 'mal' | 'horrible';
type EnergyId = 'baja' | 'media' | 'alta';

interface DailyEntry {
  mood: MoodId | null;
  reflection: string;
  energy: EnergyId | null;
  word: string;
  timestamp: number;
}

// --- Constants ---
const MOODS: { id: MoodId; emoji: string; label: string; color: string; bg: string; border: string; shadow: string }[] = [
  { id: 'increible', emoji: '😄', label: 'Increíble', color: 'text-[#69f6b8]', bg: 'bg-[#69f6b8]/20', border: 'border-[#69f6b8]/50', shadow: 'shadow-[0_0_20px_rgba(105,246,184,0.3)]' },
  { id: 'bien', emoji: '😊', label: 'Bien', color: 'text-emerald-400', bg: 'bg-emerald-400/20', border: 'border-emerald-400/50', shadow: 'shadow-[0_0_20px_rgba(52,211,153,0.3)]' },
  { id: 'normal', emoji: '😐', label: 'Normal', color: 'text-zinc-400', bg: 'bg-zinc-400/20', border: 'border-zinc-400/50', shadow: 'shadow-[0_0_20px_rgba(161,161,170,0.3)]' },
  { id: 'mal', emoji: '😞', label: 'Mal', color: 'text-[#f8a010]', bg: 'bg-[#f8a010]/20', border: 'border-[#f8a010]/50', shadow: 'shadow-[0_0_20px_rgba(248,160,16,0.3)]' },
  { id: 'horrible', emoji: '😢', label: 'Horrible', color: 'text-[#ff716a]', bg: 'bg-[#ff716a]/20', border: 'border-[#ff716a]/50', shadow: 'shadow-[0_0_20px_rgba(255,113,106,0.3)]' },
];

const ENERGIES: { id: EnergyId; label: string }[] = [
  { id: 'baja', label: 'Baja' },
  { id: 'media', label: 'Media' },
  { id: 'alta', label: 'Alta' },
];

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// --- Helpers ---
const formatDateKey = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
};

export default function MoodDayApp() {
  // --- State ---
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<Record<string, DailyEntry>>({});
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form State
  const [mood, setMood] = useState<MoodId | null>(null);
  const [reflection, setReflection] = useState('');
  const [energy, setEnergy] = useState<EnergyId | null>(null);
  const [word, setWord] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // --- Handlers ---
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadFromFirestore = useCallback(async (userId: string) => {
    if (!isFirebaseConfigured || !db) return;
    setIsSyncing(true);
    try {
      const docRef = doc(db, 'usuarios', userId, 'config', 'data');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const cloudEntries = docSnap.data().entries || {};
        setEntries(prev => {
          const merged = { ...prev, ...cloudEntries };
          localStorage.setItem('moodday_entries', JSON.stringify(merged));
          return merged;
        });
      }
    } catch (e) {
      console.error("Error loading from Firestore", e);
      showToast("Error al sincronizar con la nube");
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const syncToFirestore = useCallback(async (userId: string, currentEntries: Record<string, DailyEntry>) => {
    if (!isFirebaseConfigured || !db) return;
    try {
      const docRef = doc(db, 'usuarios', userId, 'config', 'data');
      await setDoc(docRef, { entries: currentEntries, lastUpdate: Timestamp.now() }, { merge: true });
    } catch (e) {
      console.error("Error syncing to Firestore", e);
    }
  }, []);

  // --- Effects ---
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('moodday_entries');
    if (saved) {
      try {
        setEntries(JSON.parse(saved));
      } catch (e) {
        console.error("Error parsing local storage", e);
      }
    }

    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          loadFromFirestore(currentUser.uid);
          showToast(`Hola, ${currentUser.displayName?.split(' ')[0]}`);
        }
      });
      return () => unsubscribe();
    }
  }, [loadFromFirestore]);

  // Load entry when selected date changes
  useEffect(() => {
    if (!mounted) return;
    const key = formatDateKey(selectedDate);
    const entry = entries[key];
    if (entry) {
      setMood(entry.mood);
      setReflection(entry.reflection || '');
      setEnergy(entry.energy);
      setWord(entry.word || '');
    } else {
      setMood(null);
      setReflection('');
      setEnergy(null);
      setWord('');
    }
  }, [selectedDate, entries, mounted]);

  // --- Actions ---
  const handleLogin = async () => {
    if (!isFirebaseConfigured) {
      showToast("Configura Firebase en 'Secrets' para activar la nube");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Login error", e);
      showToast("Error al iniciar sesión");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast("Sesión cerrada");
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  const handleDelete = () => {
    const key = formatDateKey(selectedDate);
    if (!entries[key]) return;

    const newEntries = { ...entries };
    delete newEntries[key];

    setEntries(newEntries);
    localStorage.setItem('moodday_entries', JSON.stringify(newEntries));

    if (user) syncToFirestore(user.uid, newEntries);

    setMood(null);
    setReflection('');
    setEnergy(null);
    setWord('');

    showToast('Entrada eliminada');
  };

  const handleSave = () => {
    if (!mood) return;

    setIsSaving(true);

    const key = formatDateKey(selectedDate);
    const newEntries = {
      ...entries,
      [key]: {
        mood,
        reflection,
        energy,
        word,
        timestamp: Date.now()
      }
    };

    setTimeout(async () => {
      setEntries(newEntries);
      localStorage.setItem('moodday_entries', JSON.stringify(newEntries));

      if (user) await syncToFirestore(user.uid, newEntries);

      setIsSaving(false);
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 2000);
    }, 1500);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // --- Calendar Logic ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blankDays = Array.from({ length: startingDay }, (_, i) => i);

  const calculateStreak = () => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      if (entries[formatDateKey(d)]) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col overflow-hidden bg-[#0e0e0e]">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-50 bg-[#262626] border border-white/10 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl"
          >
            <Info className="w-4 h-4 text-[#69f6b8]" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#69f6b8]/5 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#f8a010]/5 blur-[120px]"></div>
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#0e0e0e]/70 backdrop-blur-xl border-b border-white/5">
        <div className="flex justify-between items-center px-6 md:px-12 py-4 max-w-[1600px] mx-auto">
          <div className="text-2xl font-serif italic text-[#69f6b8] font-bold tracking-tight">MoodDay</div>

          <nav className="hidden md:flex items-center space-x-8 font-serif font-bold tracking-tight">
            <button className="text-[#69f6b8] border-b-2 border-[#69f6b8] pb-1">Journal</button>
            <button onClick={() => showToast('Próximamente')} className="text-zinc-500 hover:text-[#69f6b8] transition-colors duration-300">Insights</button>
            <button onClick={() => showToast('Próximamente')} className="text-zinc-500 hover:text-[#69f6b8] transition-colors duration-300">Community</button>
          </nav>

          <div className="flex items-center space-x-4 md:space-x-6">
            {!user ? (
              <button
                onClick={handleLogin}
                className="bg-[#20201f] text-white px-4 md:px-6 py-2 rounded-full border border-white/10 hover:bg-[#2a2a29] transition-all flex items-center gap-2"
              >
                <Cloud className="w-4 h-4 text-[#69f6b8]" />
                <span className="text-sm font-medium hidden md:block">Login con Google</span>
                <span className="text-sm font-medium md:hidden text-zinc-400"><Cloud className="w-4 h-4" /></span>
              </button>
            ) : (
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-xs font-bold text-white max-w-[100px] truncate">{user.displayName}</span>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-[#69f6b8] font-mono leading-none">
                    <Wifi className="w-2.5 h-2.5" />
                    EN NUBE
                  </div>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-[#69f6b8]" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center border border-white/10">
                    <UserIcon className="w-4 h-4 text-zinc-400" />
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-full bg-[#1a1a1a] border border-white/10 hover:bg-[#262626] text-zinc-400 hover:text-white transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="fixed top-[72px] left-0 w-full z-40 px-4 md:px-12 py-3 pointer-events-none">
        <div className="max-w-[1600px] mx-auto flex flex-col items-center md:items-end gap-2">
          {!user ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#1a1a1a]/80 border border-white/5 backdrop-blur-md rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm pointer-events-auto"
            >
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse"></span>
                Modo Local
              </div>
              <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
              <button onClick={handleLogin} className="text-[10px] text-[#69f6b8] hover:underline uppercase tracking-wider font-bold">Activar Nube</button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#69f6b8]/10 border border-[#69f6b8]/20 backdrop-blur-md rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm pointer-events-auto"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-3 h-3 text-[#69f6b8] animate-spin" />
                  <span className="text-[10px] text-[#69f6b8] font-bold uppercase tracking-wider">Sincronizando...</span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#69f6b8] font-bold uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#69f6b8] shadow-[0_0_8px_rgba(105,246,184,0.5)]"></span>
                    Sincronizado
                  </div>
                </>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row pt-[140px] h-screen relative z-10 max-w-[1600px] mx-auto w-full">

        {/* Left Column: Calendar */}
        <section className="w-full md:w-[40%] lg:w-[35%] p-6 md:p-12 custom-scrollbar overflow-y-auto pb-32 md:pb-12">
          <div className="max-w-md mx-auto">

            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-10">
              <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight capitalize">
                {MONTHS[month]} <span className="text-zinc-600 font-normal">{year}</span>
              </h2>
              <div className="flex space-x-2">
                <button onClick={prevMonth} className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-zinc-400 hover:bg-[#262626] hover:text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextMonth} className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-zinc-400 hover:bg-[#262626] hover:text-white transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-2 text-center mb-4">
              {DAYS.map(day => (
                <span key={day} className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-500">{day}</span>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 md:gap-3">
              {blankDays.map(b => <div key={`blank-${b}`} className="aspect-square" />)}

              {calendarDays.map(day => {
                const date = new Date(year, month, day);
                const key = formatDateKey(date);
                const entry = entries[key];
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, new Date());

                let bgClass = "bg-[#1a1a1a] hover:bg-[#262626] text-zinc-400";
                let borderClass = "border border-transparent";
                let emojiIndicator = null;

                if (entry && entry.mood) {
                  const moodConfig = MOODS.find(m => m.id === entry.mood);
                  if (moodConfig) {
                    bgClass = moodConfig.bg;
                    borderClass = `border ${moodConfig.border}`;
                    emojiIndicator = <span className="absolute top-1 right-1 text-[10px] opacity-80">{moodConfig.emoji}</span>;
                  }
                }

                if (isSelected) {
                  borderClass = "border-2 border-white";
                  if (!entry) bgClass = "bg-[#262626] text-white";
                } else if (isToday && !entry) {
                  borderClass = "border border-zinc-600";
                }

                return (
                  <motion.button
                    key={day}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedDate(date)}
                    className={`relative aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-colors ${bgClass} ${borderClass}`}
                  >
                    {emojiIndicator}
                    <span className={entry ? "font-bold text-white" : ""}>{day}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Monthly Summary */}
            <div className="mt-12 p-6 rounded-3xl bg-[#131313] border border-white/5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <h3 className="font-serif italic text-xl mb-3 text-white relative z-10">Resumen Mensual</h3>
              <p className="text-sm text-zinc-400 leading-relaxed relative z-10">
                Has registrado un 67 <span className="text-white font-bold">{calculateStreak()} días</span> seguidos.
                Sigue así para mantener un registro saludable de tus emociones.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Entry Form */}
        <section className="w-full md:w-[60%] lg:w-[65%] bg-[#131313] md:rounded-tl-[3rem] border-t md:border-t-0 md:border-l border-white/5 p-6 md:p-16 lg:p-24 custom-scrollbar overflow-y-auto shadow-[-20px_0_50px_rgba(0,0,0,0.5)] relative z-20">
          <div className="max-w-2xl mx-auto space-y-10 md:space-y-12 pb-24">

            {/* Form Header */}
            <div>
              <motion.h1
                key={selectedDate.toISOString()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-serif text-4xl md:text-5xl font-bold mb-4"
              >
                {isSameDay(selectedDate, new Date()) ? '¿Cómo te sientes hoy?' : `Reflexión del ${selectedDate.getDate()}`}
              </motion.h1>
              <p className="text-zinc-400 text-lg">Tómate un momento para conectar con tu interior.</p>
            </div>

            {/* 1. Mood Selector */}
            <div className="space-y-5">
              <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Estado de Ánimo</label>
              <div className="grid grid-cols-3 md:flex md:flex-wrap gap-3 md:gap-4">
                {MOODS.map((m) => {
                  const isSelected = mood === m.id;
                  return (
                    <motion.button
                      key={m.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setMood(m.id)}
                      className={`flex flex-col items-center justify-center gap-2 md:gap-3 p-4 md:p-6 rounded-3xl transition-all duration-300 border ${isSelected
                          ? `${m.bg} ${m.border} ${m.shadow}`
                          : 'bg-[#1a1a1a] border-white/5 hover:border-white/20'
                        }`}
                    >
                      <span className={`text-3xl md:text-4xl transition-transform duration-300 ${isSelected ? 'scale-110 drop-shadow-lg' : 'grayscale-[0.5] opacity-70'}`}>
                        {m.emoji}
                      </span>
                      <span className={`text-xs md:text-sm font-medium transition-colors ${isSelected ? 'text-white font-bold' : 'text-zinc-500'}`}>
                        {m.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* 2. Reflection Textarea */}
            <div className="space-y-5">
              <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Reflexión</label>
              <div className="relative group">
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  className="w-full h-40 md:h-48 bg-[#1a1a1a] p-6 md:p-8 rounded-[2rem] border border-white/5 focus:border-[#69f6b8]/50 focus:ring-1 focus:ring-[#69f6b8]/50 text-lg md:text-xl text-white placeholder:text-zinc-600 resize-none transition-all outline-none"
                  maxLength={150}
                  placeholder="¿Qué ha pasado hoy?"
                />
                <span className={`absolute bottom-6 right-8 text-xs font-mono transition-colors ${reflection.length >= 150 ? 'text-[#ff716a]' : 'text-zinc-600'}`}>
                  {reflection.length} / 150
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12">
              {/* 3. Energy Selector */}
              <div className="space-y-5">
                <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Energía Vital</label>
                <div className="flex bg-[#1a1a1a] rounded-full p-1.5 border border-white/5 relative">
                  {ENERGIES.map((e) => {
                    const isSelected = energy === e.id;
                    return (
                      <button
                        key={e.id}
                        onClick={() => setEnergy(e.id)}
                        className={`flex-1 py-3 px-2 md:px-6 rounded-full text-xs md:text-sm font-bold transition-all relative z-10 ${isSelected ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="energy-bg"
                            className="absolute inset-0 bg-[#262626] rounded-full shadow-sm border border-white/10 -z-10"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        {e.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Word of the Day */}
              <div className="space-y-5">
                <label className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Una palabra para hoy</label>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  className="w-full bg-[#1a1a1a] px-6 md:px-8 py-4 rounded-full border border-white/5 focus:border-[#69f6b8]/50 focus:ring-1 focus:ring-[#69f6b8]/50 text-white placeholder:text-zinc-600 outline-none transition-all"
                  maxLength={30}
                  placeholder="Calma..."
                />
              </div>
            </div>

            {/* 5. Save Button */}
            <div className="pt-8 flex gap-4">
              {entries[formatDateKey(selectedDate)] && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDelete}
                  className="px-6 py-5 md:py-6 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-all bg-[#1a1a1a] text-[#ff716a] hover:bg-[#2a1616] border border-[#ff716a]/20"
                  title="Eliminar registro"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="hidden md:inline">Eliminar</span>
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={!mood || isSaving}
                className={`flex-1 py-5 md:py-6 rounded-full font-bold text-lg flex items-center justify-center gap-3 transition-all relative overflow-hidden ${!mood
                    ? 'bg-[#1a1a1a] text-zinc-500 cursor-not-allowed border border-white/5'
                    : isSaving
                      ? 'bg-gradient-to-r from-[#69f6b8] to-[#58e7ab] text-[#00452d] opacity-80 cursor-wait'
                      : 'bg-gradient-to-r from-[#69f6b8] to-[#58e7ab] text-[#00452d] shadow-[0_10px_30px_rgba(105,246,184,0.2)] hover:shadow-[0_15px_40px_rgba(105,246,184,0.4)]'
                  }`}
              >
                <AnimatePresence mode="wait">
                  {isSaving ? (
                    <motion.div
                      key="saving"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2"
                    >
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Guardando...
                    </motion.div>
                  ) : showSavedFeedback ? (
                    <motion.div
                      key="saved"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="w-5 h-5" />
                      ¡Guardado!
                    </motion.div>
                  ) : (
                    <motion.div
                      key="default"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="w-5 h-5" />
                      Guardar Entrada
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}
