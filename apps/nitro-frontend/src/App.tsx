import React from 'react';
import MatchFeed from './components/MatchFeed';
import AgeGate from './components/AgeGate';

function App() {
  return (
    <AgeGate>
      <div className="min-h-screen bg-black text-white p-4">
        <h1 className="text-center text-3xl font-black tracking-tighter mb-6">NITRO-BET</h1>
        <MatchFeed />
      </div>
    </AgeGate>
  );
}

export default App;

