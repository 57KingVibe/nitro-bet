const engine = require('@nitro/logic');

async function marathonFinish() {
    console.log("\n🏆 NITRObet: 100% BACKEND COMPLETE");
    
    // 1. Place a new bet on Driver #1
    const odds = await engine.calculateLiveOdds(1);
    const betId = await engine.saveBet('KingVibe57', 100, odds, 1);
    console.log(`Step 1: New Bet #${betId} placed on Verstappen at ${odds}x`);

    // 2. Place a losing bet on Driver #44
    const betId2 = await engine.saveBet('KingVibe57', 50, 5.0, 44);
    console.log(`Step 2: New Bet #${betId2} placed on Hamilton at 5.0x`);

    console.log("\n📡 Triggering Auto-Settler (Connecting to OpenF1)...");
    await engine.autoSettleAll();

    console.log("\n🏁 PROJECT ARCHITECTURE COMPLETE.");
    console.log("----------------------------\n");
}

marathonFinish();
