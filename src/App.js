import React, { createContext, useState, useEffect } from "react";
import './App.css';
import NavBar from './components/Navbar/NavBar';
import Dashboard from './components/HomePage/Dashboard';
import { Route, Routes } from 'react-router-dom';
import MentalFitnessGamesDashboard from './components/HomePage/MentalFitnessGames/MentalFitnessGamesDashboard';
import WordScramble from './components/HomePage/MentalFitnessGames/WordScrable';
import Displaygames from './components/HomePage/MentalFitnessGames/Displaygames';
import MemoryCardGame from './components/HomePage/MentalFitnessGames/MemoryCardGame';
import QuickMathBlitz from './components/HomePage/MentalFitnessGames/QuickMathBlitz';
import SequenceTap from './components/HomePage/MentalFitnessGames/SequenceTap';
import MenalExerciseDashboard from './components/HomePage/MentalExercise.js/MentalExerciseDashboard';
import SleepRelaxationWidget from './components/HomePage/Sleep_and_Relaxation/SleepRelaxationWidget';
import AdvancedMoodTracker from './components/HomePage/Mood_Tracker/AdvancedMoodTracker';
import AICbtChat from './components/HomePage/AI_Chat_Bot/AICbtChat';
import DailyMotivationAffirmations from './components/HomePage/DailyMotivation/DailyMotivationAffirmations';
import StressHabitTracker from './components/HomePage/StressHabitTracker/StressHabitTracker';
import ReportPage from './components/HomePage/ReportPage/ReportPage';

export const AppDataContext = createContext({});

const LOCAL_KEYS = {
  MOOD: "app_mood_data",
  SLEEP: "app_sleep_data",
  STRESS: "app_stress_data",
};

function App() {
  const [moodEntries, setMoodEntries] = useState(() => {
    const raw = localStorage.getItem(LOCAL_KEYS.MOOD);
    return raw ? JSON.parse(raw) : [];
  });

  const [sleepData, setSleepData] = useState(() => {
    const raw = localStorage.getItem(LOCAL_KEYS.SLEEP);
    return raw ? JSON.parse(raw) : [];
  });

  const [stressData, setStressData] = useState(() => {
    const raw = localStorage.getItem(LOCAL_KEYS.STRESS);
    return raw ? JSON.parse(raw) : {};
  });

  // Persist on change
  useEffect(() => {
    localStorage.setItem(LOCAL_KEYS.MOOD, JSON.stringify(moodEntries));
  }, [moodEntries]);

  useEffect(() => {
    localStorage.setItem(LOCAL_KEYS.SLEEP, JSON.stringify(sleepData));
  }, [sleepData]);

  useEffect(() => {
    localStorage.setItem(LOCAL_KEYS.STRESS, JSON.stringify(stressData));
  }, [stressData]);

  return (
    <AppDataContext.Provider
      value={{
        moodEntries,
        setMoodEntries,
        sleepData,
        setSleepData,
        stressData,
        setStressData,
      }}
    >
      <div className="App">
        <NavBar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          {/* Games Section */}
          <Route path="/Games" element={<MentalFitnessGamesDashboard />} />
          <Route path="Display" element={<Displaygames />}>
            <Route path="Word-Scramble" element={<WordScramble />} />
            <Route path="Memory-Card-Game" element={<MemoryCardGame />} />
            <Route path="Quick-Maths-Blitz" element={<QuickMathBlitz />} />
            <Route path="Sequence-Taps" element={<SequenceTap />} />
          </Route>
          {/* Exercise Section */}
          <Route path='/Exercise' element={<MenalExerciseDashboard />} />
          {/* Sleep and Relaxation Section */}
          <Route path='/Sleep&Relaxation' element={<SleepRelaxationWidget />} />
          {/* Mood Tracker */}
          <Route path='/mood_tracker' element={<AdvancedMoodTracker />} />
          {/* AI Chat Bot */}
          <Route path='/mood_refresher' element={<AICbtChat />} />
          {/* Daily Motivation */}
          <Route path='/daily_motivation' element={<DailyMotivationAffirmations />} />
          {/* Stress Habit Tracker */}
          <Route path='/stress_tracker' element={<StressHabitTracker />} />
          {/* Report Page */}
          <Route path='/report' element={<ReportPage />} />
        </Routes>
      </div>
    </AppDataContext.Provider>
  );
}

export default App;
