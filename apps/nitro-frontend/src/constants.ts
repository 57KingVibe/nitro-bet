import { Driver, RaceEvent, User } from './types';
export const CATEGORIES = [ { id: 'F1', icon: '🏎️' }, { id: 'WRC', icon: '🏁' }, { id: 'GT', icon: '🚗' }, { id: 'INDY', icon: '🔥' } ];
export const MOCK_USER: User = { id: '1', name: 'KingVibe57', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=kingvibe', balance: 50000, settings: { ghostMode: false, kycStatus: 'verified' } };
export const MOCK_DRIVERS: Driver[] = [
  { id: '1', name: 'Max Verstappen', team: 'Red Bull Racing', odds: 1.45, trend: 'stable' },
  { id: '2', name: 'Lando Norris', team: 'McLaren', odds: 3.10, trend: 'up' },
  { id: '3', name: 'Lewis Hamilton', team: 'Mercedes', odds: 5.75, trend: 'down' }
];
export const MOCK_RACES: RaceEvent[] = [
  { id: '1', title: 'Monaco GP', location: 'Monte Carlo', date: 'MAY 24', status: 'Upcoming', category: 'F1' }
];
