
import { UPGRADES } from './constants';

export type UpgradeType = keyof typeof UPGRADES;

export class UpgradeManager {
    money: number = 0;
    levels: { [key in UpgradeType]: number } = {
        DRILL_SPEED: 0,
        MAX_HP: 0,
        BOMB_MAX: 0,
        FEVER_TIME: 0,
        MAGNET: 0
    };

    constructor() {
        this.load();
    }

    load() {
        const stored = localStorage.getItem('dig_save_v1');
        if (stored) {
            const data = JSON.parse(stored);
            this.money = data.money || 0;
            if (data.levels) {
                // Merge carefully
                for (const k of Object.keys(this.levels)) {
                    const key = k as UpgradeType;
                    if (data.levels[key] !== undefined) {
                        this.levels[key] = data.levels[key];
                    }
                }
            }
        }
    }

    save() {
        const data = {
            money: this.money,
            levels: this.levels
        };
        localStorage.setItem('dig_save_v1', JSON.stringify(data));
    }

    addMoney(amount: number) {
        this.money += amount;
        this.save();
    }

    getCost(type: UpgradeType): number {
        const config = UPGRADES[type];
        const level = this.levels[type];
        if (level >= config.maxLevel) return Infinity;
        // Cost formula: Base * (Factor ^ Level)
        return Math.floor(config.baseCost * Math.pow(config.factor, level));
    }

    canBuy(type: UpgradeType): boolean {
        return this.money >= this.getCost(type) && this.levels[type] < UPGRADES[type].maxLevel;
    }

    buy(type: UpgradeType): boolean {
        if (this.canBuy(type)) {
            this.money -= this.getCost(type);
            this.levels[type]++;
            this.save();
            return true;
        }
        return false;
    }

    getLevel(type: UpgradeType): number {
        return this.levels[type];
    }
}
