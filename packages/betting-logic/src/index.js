const axios = require('axios');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

class NitroEngine {
    constructor() {
        this.forgeKey = process.env.FORGELAYER_API_KEY;
        const dbPath = path.resolve(__dirname, '../../nitro.db');
        this.db = new DatabaseSync(dbPath);
        
        // Dropping and recreating for absolute certainty
        this.db.exec("DROP TABLE IF EXISTS bets;");
        this.db.exec(`
            CREATE TABLE bets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT,
                amount REAL,
                odds REAL,
                status TEXT,
                driverNum INTEGER
            );
        `);
    }

    async saveBet(userId, amount, odds, driverNum) {
        const insert = this.db.prepare("INSERT INTO bets (userId, amount, odds, status, driverNum) VALUES (?, ?, ?, 'PENDING', ?)");
        const result = insert.run(userId, amount, odds, driverNum);
        return result.lastInsertRowid;
    }

    async autoSettleAll() {
        const pendingBets = this.db.prepare("SELECT * FROM bets WHERE status = 'PENDING'").all();
        for (const bet of pendingBets) {
            const status = (bet.driverNum === 1) ? 'WON' : 'LOST';
            const update = this.db.prepare("UPDATE bets SET status = ? WHERE id = ?");
            update.run(status, bet.id);
            console.log(`✅ Bet #${bet.id} settled: ${status}`);
        }
    }

    async calculateLiveOdds(driverNum) { return (Math.random() * 2 + 1).toFixed(2); }
    async createBetInvoice() { return { hosted_url: "https://forgelayer.com/demo" }; }
}

module.exports = new NitroEngine();
