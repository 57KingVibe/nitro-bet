export type Category = 'F1' | 'WRC' | 'GT' | 'INDY';
export type BetType = 'Race Winner' | 'Podium Finish' | 'Fastest Lap';
export interface Driver { id: string; name: string; team: string; odds: number; trend: 'up' | 'down' | 'stable'; }
export interface Bet { id: string; driverName: string; odds: number; stake: number; toWin: number; betType: BetType; isAnonymous?: boolean; }
export interface User { id: string; name: string; avatar: string; balance: number; settings: { ghostMode: boolean; kycStatus: string }; }
export interface RaceEvent { id: string; title: string; location: string; date: string; status: string; category: string; }
