import { createContext, useContext, useState } from 'react';

/* ============================================================
   Worker session state — Ask and Hands-free conversation state
   used to live in each page's own useState, so React Router's
   <Outlet/> destroyed it every time you switched tabs (and any
   in-flight request that resolved after you navigated away had
   nowhere to write its answer). This context lives in
   WorkerLayout, above <Outlet/>, so it survives tab switches —
   only WorkerLayout unmounting (e.g. logout) resets it.
   ============================================================ */

const AskContext = createContext(null);
const HandsFreeContext = createContext(null);

export function WorkerSessionProvider({ children }) {
  // ---- Ask tab ----
  const [askMachine, setAskMachine] = useState('');
  const [askQuestion, setAskQuestion] = useState(''); // text typed but not yet submitted
  const [askMessages, setAskMessages] = useState([]); // { role: 'worker'|'answer', text, sourcesUsed? }
  const [askBusy, setAskBusy] = useState(false);

  // ---- Hands-free tab ----
  const [hfMachine, setHfMachine] = useState('');
  const [hfBusy, setHfBusy] = useState(false); // true while a question is being answered, regardless of which tab is visible
  const [hfLastQuestion, setHfLastQuestion] = useState('');
  const [hfLastAnswer, setHfLastAnswer] = useState('');

  const askValue = {
    askMachine, setAskMachine, askQuestion, setAskQuestion,
    askMessages, setAskMessages, askBusy, setAskBusy,
  };
  const hfValue = {
    hfMachine, setHfMachine, hfBusy, setHfBusy,
    hfLastQuestion, setHfLastQuestion, hfLastAnswer, setHfLastAnswer,
  };

  return (
    <AskContext.Provider value={askValue}>
      <HandsFreeContext.Provider value={hfValue}>
        {children}
      </HandsFreeContext.Provider>
    </AskContext.Provider>
  );
}

export function useAskSession() {
  const ctx = useContext(AskContext);
  if (!ctx) throw new Error('useAskSession must be used within WorkerSessionProvider');
  return ctx;
}

export function useHandsFreeSession() {
  const ctx = useContext(HandsFreeContext);
  if (!ctx) throw new Error('useHandsFreeSession must be used within WorkerSessionProvider');
  return ctx;
}
