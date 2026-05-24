export const generateTacticalMarkets = (drivers: any[]) => {
  return drivers.map(driver => ({
    driverId: driver.id,
    driverName: driver.name,
    // Dynamic odds based on current trend (using our existing Driver interface)
    intervalOdds: driver.trend === 'up' ? 2.50 : 4.80,
    jokerOdds: 6.20,
    // Markets only trigger if driver is in the top 10
  })).filter((_, i) => i < 10);
};
