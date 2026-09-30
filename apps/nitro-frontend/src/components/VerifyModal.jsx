import React, { useState } from 'react';

export default function VerifyModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [hash, setHash] = useState('');

  return (
    <div className="w-full max-w-lg mx-auto my-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-2 bg-slate-800 text-slate-300 font-bold rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors"
      >
        {isOpen ? 'Close Verifier' : '🔍 Verify Provably Fair Bet'}
      </button>

      {isOpen && (
        <div className="mt-4 p-6 bg-slate-900 rounded-xl border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-2">Cryptographic Proof</h3>
          <p className="text-sm text-slate-400 mb-4">
            Enter your server seed and client nonce to verify the HMAC-SHA256 outcome.
          </p>
          
          <input 
            type="text" 
            placeholder="Server Seed Hash"
            className="w-full mb-3 p-3 bg-black border border-slate-800 rounded text-white focus:border-green-500 outline-none"
          />
          <input 
            type="text" 
            placeholder="Client Seed + Nonce"
            className="w-full mb-4 p-3 bg-black border border-slate-800 rounded text-white focus:border-green-500 outline-none"
          />
          
          <button 
            onClick={() => setHash('0xVerified... (Simulated)')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-lg transition-colors"
          >
            VERIFY OUTCOME
          </button>

          {hash && (
            <div className="mt-4 p-3 bg-green-900/30 border border-green-500 rounded text-green-400 text-center font-mono text-sm">
              Match Validated: {hash}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

