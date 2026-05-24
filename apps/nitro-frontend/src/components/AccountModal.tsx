import React from 'react';
export default ({ onClose }: { onClose: () => void }) => <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><div className="bg-slate-900 p-6 rounded-xl border border-slate-800 w-80"><button onClick={onClose} className="text-red-500 font-black text-xs mb-4">CLOSE X</button><h2 className="font-racing text-xl">TERMINAL CONFIG</h2></div></div>;
