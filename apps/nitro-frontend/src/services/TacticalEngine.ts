export const generateDynamicMarkets = (drivers: any[], raceLap: number) => {
  // Logic: Only offer Interval markets for drivers currently in the top 10
  // and Joker Protocol for drivers with high tire degradation patterns.
  return drivers.slice(0, 10).map(driver => ({
    ...driver,
    markets: {
      interval: {
        label: `Pace Spike: Laps ${raceLap}-${raceLap + 7}`,
        odds: (Math.random() * 4 + 2).toFixed(2),
      },
      joker: {
        label: "Joker Protocol: Optimized Pit",
        odds: (Math.random() * 5 + 3).toFixed(2),
      }
    }
  }));
};
