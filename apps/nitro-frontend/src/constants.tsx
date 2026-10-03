
import React from 'react';
import { Driver, RaceEvent, RaceResult, User } from './types';

export const MOCK_USER: User = {
  id: 'u1',
  name: 'Alex "Nitro" Rossi',
  username: '@rossi_f1',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  balance: 2840.50,
  settings: {
    ghostMode: false,
    twoFactorAuth: true,
    biometricLock: false,
    kycStatus: 'unverified'
  },
  stakes: [
    {
      id: 's1',
      driverName: 'Max Verstappen',
      odds: 1.45,
      stake: 500,
      toWin: 725,
      timestamp: Date.now() - 3600000,
      trend: 'stable',
      betType: 'Race Winner',
      status: 'active',
      isAnonymous: false
    },
    {
      id: 's2',
      driverName: 'Charles Leclerc',
      odds: 5.50,
      stake: 100,
      toWin: 550,
      timestamp: Date.now() - 86400000,
      trend: 'up',
      betType: 'Fastest Lap',
      status: 'won',
      resultAmount: 550,
      isAnonymous: true
    }
  ],
  history: [
    { id: 't1', type: 'deposit', amount: 1000, timestamp: Date.now() - 172800000, description: 'Wallet Top-up', isEncrypted: true },
    { id: 't2', type: 'withdrawal', amount: 200, timestamp: Date.now() - 259200000, description: 'Bank Transfer', isEncrypted: true },
    { id: 't3', type: 'receive', amount: 50, timestamp: Date.now() - 432000000, description: 'Referral Bonus', isEncrypted: false }
  ]
};

export const MOCK_DRIVERS: Driver[] = [
  { id: '1', name: 'Max Verstappen', team: 'Red Bull Racing', odds: 1.45, lastOdds: 1.42, trend: 'up', img: 'https://picsum.photos/seed/vst/200/200' },
  { id: '2', name: 'Lando Norris', team: 'McLaren', odds: 3.20, lastOdds: 3.50, trend: 'down', img: 'https://picsum.photos/seed/nor/200/200' },
  { id: '3', name: 'Charles Leclerc', team: 'Ferrari', odds: 5.50, lastOdds: 5.50, trend: 'stable', img: 'https://picsum.photos/seed/lec/200/200' },
  { id: '4', name: 'Lewis Hamilton', team: 'Mercedes', odds: 12.0, lastOdds: 11.5, trend: 'up', img: 'https://picsum.photos/seed/ham/200/200' },
  { id: '5', name: 'Oscar Piastri', team: 'McLaren', odds: 8.0, lastOdds: 8.2, trend: 'down', img: 'https://picsum.photos/seed/pia/200/200' },
];

export const MOCK_RACES: RaceEvent[] = [
  { id: 'r1', title: 'Japanese Grand Prix', location: 'Suzuka', date: 'LIVE', status: 'Live', category: 'F1' },
  { id: 'r2', title: 'Rally Italia Sardegna', location: 'Sardinia', date: 'TOMORROW', status: 'Upcoming', category: 'WRC' },
  { id: 'r3', title: 'Le Mans 24h', location: 'Circuit de la Sarthe', date: 'JUN 15', status: 'Upcoming', category: 'GT' },
];

export const MOCK_RESULTS: RaceResult[] = [
  { 
    id: 'res1', 
    title: 'Monaco Grand Prix', 
    category: 'F1', 
    date: 'MAY 26', 
    winner: 'Charles Leclerc', 
    team: 'Ferrari', 
    podium: ['Charles Leclerc', 'Oscar Piastri', 'Carlos Sainz'] 
  },
  { 
    id: 'res2', 
    title: 'Rally de Portugal', 
    category: 'WRC', 
    date: 'MAY 12', 
    winner: 'Sébastien Ogier', 
    team: 'Toyota Gazoo', 
    podium: ['Sébastien Ogier', 'Ott Tänak', 'Thierry Neuville'] 
  },
  { 
    id: 'res3', 
    title: 'Indianapolis 500', 
    category: 'INDY', 
    date: 'MAY 26', 
    winner: 'Josef Newgarden', 
    team: 'Team Penske', 
    podium: ['Josef Newgarden', 'Pato O\'Ward', 'Scott Dixon'] 
  },
];

export const CATEGORIES = [
  { id: 'F1', name: 'Formula 1', icon: '🏎️' },
  { id: 'WRC', name: 'Rally WRC', icon: '🏁' },
  { id: 'GT', name: 'GT World', icon: '🚗' },
  { id: 'INDY', name: 'IndyCar', icon: '⚡' },
];
