
export type Category = 'F1' | 'WRC' | 'GT' | 'INDY';
export type BetType = 'Race Winner' | 'Podium Finish' | 'Fastest Lap';
export type TransactionType = 'deposit' | 'withdrawal' | 'send' | 'receive' | 'redeem';
export type StakeStatus = 'active' | 'won' | 'lost' | 'cashed_out';
export type KYCStatus = 'unverified' | 'pending' | 'verified';

export interface Driver {
  id: string;
  name: string;
  team: string;
  odds: number;
  lastOdds: number;
  img: string;
  trend: 'up' | 'down' | 'stable';
}

export interface Bet {
  id: string;
  driverName: string;
  odds: number;
  stake: number;
  toWin: number;
  timestamp: number;
  trend: 'up' | 'down' | 'stable';
  trendHistory?: ('up' | 'down' | 'stable')[];
  betType: BetType;
  isAnonymous?: boolean;
}

export interface UserStake extends Bet {
  status: StakeStatus;
  resultAmount?: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  timestamp: number;
  description: string;
  isEncrypted?: boolean;
}

export interface UserSettings {
  ghostMode: boolean;
  twoFactorAuth: boolean;
  biometricLock: boolean;
  kycStatus: KYCStatus;
}

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  balance: number;
  stakes: UserStake[];
  history: Transaction[];
  settings: UserSettings;
}

export interface RaceEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  status: 'Live' | 'Upcoming' | 'Finished';
  category: Category;
}

export interface RaceResult {
  id: string;
  title: string;
  category: Category;
  date: string;
  winner: string;
  team: string;
  podium: string[];
}
