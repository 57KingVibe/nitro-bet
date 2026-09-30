import React from 'react';
import MatchFeed from './components/MatchFeed';
import AgeGate from './components/AgeGate';
import TierSwitcher from './components/TierSwitcher';
import VerifyModal from './components/VerifyModal';

function App() {
  return (
    <AgeGate>
      <div className="min-h-screen bg-black text-white p-4">
        <h1 className="text-center text-3xl font-black tracking-tighter mb-6">NITRO-BET</h1>
        <TierSwitcher />
        <VerifyModal />
        <MatchFeed />
      </div>
    </AgeGate>
  );
}

export default App;

