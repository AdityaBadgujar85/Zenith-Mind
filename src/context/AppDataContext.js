// src/contexts/GoogleFitProvider.jsx
import React, { createContext, useState } from "react";

export const GoogleFitContext = createContext();

export function GoogleFitProvider({ children }) {
  const [sleepData, setSleepData] = useState([]);

  return (
    <GoogleFitContext.Provider value={{ sleepData, setSleepData }}>
      {children}
    </GoogleFitContext.Provider>
  );
}
