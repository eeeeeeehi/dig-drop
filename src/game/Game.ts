
import { CONSTANTS, UPGRADES } from './constants';
import { InputHandler } from './InputHandler';
import { Player } from './Player';
import { TileMap } from './TileMap';
import { Particle } from './Particle';
import { Mole } from './Mole';
import { UpgradeManager, type UpgradeType } from './UpgradeManager';

export const GameState = {
    PLAYING: 0,
    GAME_OVER: 1,
    SHOP: 2
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

export class Game {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    input: InputHandler;
    upgradeManager: UpgradeManager;
    player: Player;
    map: TileMap;

    particles: Particle[] = [];
    moles: Mole[] = [];

    scrollY: number = 0;
    score: number = 0; // Current depth
    scrollSpeed: number = CONSTANTS.INITIAL_SCROLL_SPEED;
    highScores: number[] = [];

    state: GameState = GameState.PLAYING;
    shopSelection: number = 0;
    iframe: number = 0;

    // Fever Mode
    isFever: boolean = false;
    feverTimer: number = 0;
    lastFeverDepth: number = 0;

    // UI State
    showControls: boolean = true;
    lastZeroState: boolean = false;

    // Assets
    images: { [key: string]: HTMLImageElement } = {};

    // Effects
    damageFlashTimer: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
        this.canvas.width = CONSTANTS.CANVAS_WIDTH;
        this.canvas.height = CONSTANTS.CANVAS_HEIGHT;

        this.loadImages();

        this.input = new InputHandler();
        this.upgradeManager = new UpgradeManager();
        this.player = new Player(this.upgradeManager);
        this.map = new TileMap();

        this.loadHighScores();

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    loadImages() {
        const assets = ['dirt', 'rock', 'drill', 'mole', 'battery', 'heart'];
        assets.forEach(name => {
            const img = new Image();
            img.src = `/assets/${name}.png`;
            img.onload = () => {
                console.log(`Loaded: ${name}`);
                if (name === 'drill' || name === 'heart' || name === 'battery' || name === 'mole') {
                    // Force background removal (Black BG assets)
                    this.images[name] = this.removeBackground(img);
                } else {
                    // Mole is already clean transparent, keep as is
                    this.images[name] = img;
                }
            };
            img.onerror = (e) => console.error(`Failed to load: ${name}`, e);
            this.images[name] = img;
        });
    }

    removeBackground(img: HTMLImageElement): HTMLImageElement {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Assume topleft pixel is the background color
        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];
        const bgA = data[3];

        // Tolerance (Lowered for pixel art to avoid eating dark colors)
        const tol = 30;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // If close to background color, make transparent
            if (Math.abs(r - bgR) < tol && Math.abs(g - bgG) < tol && Math.abs(b - bgB) < tol) {
                data[i + 3] = 0; // Alpha 0
            }
        }

        ctx.putImageData(imageData, 0, 0);
        const newImg = new Image();
        newImg.src = canvas.toDataURL();
        return newImg;
    }

    loadHighScores() {
        const stored = localStorage.getItem('dig_highscores');
        if (stored) {
            this.highScores = JSON.parse(stored);
        }
    }

    saveHighScore(score: number) {
        this.highScores.push(score);
        this.highScores.sort((a, b) => b - a);
        this.highScores = this.highScores.slice(0, 1000); // Store top 1000 for ranking
        localStorage.setItem('dig_highscores', JSON.stringify(this.highScores));
    }

    update() {
        if (this.state === GameState.GAME_OVER) return;

        const startHp = this.player.hp;

        this.iframe++;

        if (this.state === GameState.GAME_OVER) {
            if (this.input.isSpacePressed()) {
                // Restart
                window.location.reload();
            }
            if (this.input.keys['KeyS']) {
                this.state = GameState.SHOP;
                this.shopSelection = 0;
            }
            return;
        }

        if (this.state === GameState.SHOP) {
            this.updateShop();
            return;
        }

        if (this.state !== GameState.PLAYING) return;

        // Toggle Controls
        const zeroPressed = this.input.isZeroPressed();
        if (zeroPressed && !this.lastZeroState) {
            this.showControls = !this.showControls;
        }
        this.lastZeroState = zeroPressed;

        // Score based on depth
        const depth = Math.floor(this.scrollY / CONSTANTS.TILE_SIZE);
        if (depth > this.score) this.score = depth;

        // Adaptive Speed: Increases with depth
        let currentSpeed = CONSTANTS.INITIAL_SCROLL_SPEED + (depth * 0.005);

        // Bomb Input
        if (this.input.isSpacePressed()) {
            this.player.useBomb(this.map, (x, y, color) => {
                this.spawnParticles(x, y, color);
            });
        }

        // Boost Mechanic (Down Key)
        if (this.input.isDownPressed()) {
            currentSpeed *= 2.0;
        }

        this.scrollSpeed = currentSpeed;
        this.scrollY += this.scrollSpeed;

        // Fever Logic
        if (this.isFever) {
            this.feverTimer--;
            if (this.feverTimer <= 0) {
                this.isFever = false;
                this.player.isFever = false; // Sync player state
            }
        } else {
            // Trigger every 100m
            if (this.score > 0 && this.score % 100 === 0 && this.score > this.lastFeverDepth) {
                this.startFever();
            }
        }

        // Moles Spawning
        if (Math.random() < 0.005 + (this.score * 0.00001)) {
            this.moles.push(new Mole(this.scrollY + CONSTANTS.CANVAS_HEIGHT - 50));
        }

        this.map.update(this.scrollY);

        this.player.update(this.input, this.map, this.scrollY, this.scrollSpeed, (x, y, color) => {
            this.spawnParticles(x, y, color);
        });

        // Update Moles
        for (let i = this.moles.length - 1; i >= 0; i--) {
            const m = this.moles[i];
            m.update(this.scrollY);
            if (m.isDead) {
                this.moles.splice(i, 1);
                continue;
            }
            // Collision with Player
            if (!this.player.isFever && this.checkCollision(this.player, m)) {
                this.player.takeDamage(this.map, this.scrollY);
                m.isDead = true;
                this.moles.splice(i, 1);
            } else if (this.player.isFever && this.checkCollision(this.player, m)) {
                // Fever kills moles
                this.spawnParticles(m.x + m.width / 2, m.y + m.height / 2, CONSTANTS.colors.MOLE);
                m.isDead = true;
                this.moles.splice(i, 1);
            }
        }

        // Global Damage Flash Trigger
        if (this.player.hp < startHp) {
            this.damageFlashTimer = 15;
        }

        if (this.damageFlashTimer > 0) this.damageFlashTimer--;

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        if (this.player.isDead) {
            this.state = GameState.GAME_OVER;
            this.saveHighScore(this.score);
            this.upgradeManager.addMoney(this.player.moneyCollected);
        }
    }

    updateShop() {
        if (this.input.isDownPressed() && this.iframe % 8 === 0) this.shopSelection++;
        if (this.input.isUpPressed() && this.iframe % 8 === 0) this.shopSelection--;

        const keys = Object.keys(UPGRADES) as UpgradeType[];
        if (this.shopSelection < 0) this.shopSelection = keys.length - 1;
        if (this.shopSelection >= keys.length) this.shopSelection = 0;

        // Buy
        if (this.input.isSpacePressed() && this.iframe % 15 === 0) {
            const key = keys[this.shopSelection];
            if (this.upgradeManager.buy(key)) {
                // Bought!
            }
        }

        // Exit
        if (this.input.keys['Escape']) {
            this.state = GameState.GAME_OVER;
        }
    }

    render() {
        if (this.state === GameState.PLAYING) {
            this.renderGame();
        } else if (this.state === GameState.GAME_OVER) {
            this.renderGame(); // Draw game behind overlay
            this.renderGameOver();
        } else if (this.state === GameState.SHOP) {
            this.renderShop();
        }
    }

    renderGame() {
        // Draw Dynamic Background
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);

        // Calculate gradient factor based on depth 
        const maxDepth = 1000;
        const progress = Math.min(this.score / maxDepth, 1.0);

        if (progress < 0.5) {
            const p = progress * 2;
            grad.addColorStop(0, CONSTANTS.colors.SKY_TOP);
            grad.addColorStop(1, this.interpolateColor(CONSTANTS.colors.SKY_BOTTOM, CONSTANTS.colors.EARTH_START, p));
        } else {
            const p = (progress - 0.5) * 2;
            grad.addColorStop(0, this.interpolateColor(CONSTANTS.colors.EARTH_START, CONSTANTS.colors.EARTH_CORE, p));
            grad.addColorStop(1, this.interpolateColor(CONSTANTS.colors.EARTH_CORE, CONSTANTS.colors.CORE_MAGMA, p));
        }

        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.map.render(this.ctx, this.scrollY, this.images);

        // Moles
        this.moles.forEach(m => m.render(this.ctx, this.scrollY, this.images));

        // Particles
        this.particles.forEach(p => p.render(this.ctx, this.scrollY));

        this.player.render(this.ctx, this.scrollY, this.images);

        // Fever UI
        if (this.isFever) {
            this.ctx.fillStyle = `rgba(241, 196, 15, ${Math.abs(Math.sin(Date.now() / 100)) * 0.3 + 0.1})`; // Flashing Yellow overlay
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.fillStyle = "#fff";
            this.ctx.font = "bold 40px monospace";
            this.ctx.textAlign = "center";
            this.ctx.fillText("FEVER!!", this.canvas.width / 2, 100);
            this.ctx.textAlign = "left"; // Reset
        }

        // Damage Flash Overlay
        if (this.damageFlashTimer > 0) {
            // Lighter red, more alarming but less muddy
            this.ctx.fillStyle = `rgba(255, 0, 0, ${this.damageFlashTimer / 15 * 0.3})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // UI
        this.ctx.fillStyle = CONSTANTS.colors.TEXT;
        this.ctx.font = "20px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`Depth: ${this.score}m`, 10, 30);
        this.ctx.fillStyle = CONSTANTS.colors.ITEM_AMETHYST; // Purple
        this.ctx.fillText(`Amethyst: ${this.player.moneyCollected}`, 10, 50);

        if (this.showControls) {
            this.ctx.font = "16px monospace";
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            this.ctx.fillText("移動: 矢印 / WASD", 10, 80);
            this.ctx.fillText("加速: 下 / S", 10, 100);
            this.ctx.fillText("操作説明切替: 0", 10, 120);
        }

        // HP (Hearts)
        const hpLevel = this.upgradeManager.getLevel('MAX_HP');
        const maxHp = CONSTANTS.MAX_LIFE + hpLevel;

        const size = 60; // Bigger!
        const padding = -20; // Tighter
        const totalWidth = (maxHp * size) + ((maxHp - 1) * padding);
        const startX = this.canvas.width - totalWidth - 10;

        for (let i = 0; i < maxHp; i++) {
            const cx = startX + i * (size + padding) + size / 2;
            const cy = 50;

            if (i < this.player.hp) {
                // Active Heart
                if (this.images && this.images['heart'] && this.images['heart'].complete && this.images['heart'].naturalWidth > 0) {
                    this.ctx.drawImage(this.images['heart'], cx - size / 2, cy - size / 2, size, size);
                } else {
                    // Fallback
                    this.ctx.fillStyle = "#e74c3c"; // Red
                    this.ctx.beginPath();
                    this.ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            } else {
                // Empty Slot (Faint Red Heart)
                if (this.images && this.images['heart'] && this.images['heart'].complete && this.images['heart'].naturalWidth > 0) {
                    this.ctx.save();
                    this.ctx.globalAlpha = 0.2; // Very faint
                    this.ctx.drawImage(this.images['heart'], cx - size / 2, cy - size / 2, size, size);
                    this.ctx.restore();
                } else {
                    // Fallback
                    this.ctx.globalAlpha = 0.2;
                    this.ctx.fillStyle = "#e74c3c";
                    this.ctx.beginPath();
                    this.ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.globalAlpha = 1.0;
                }
            }
        }

        // Bomb UI - Detailed
        if (this.player.hasBomb) {
            const size = 30;
            const bx = this.canvas.width - 40;
            // Move below hearts: Hearts are at y=40, size=60 -> bottom ~70.
            const by = 130;

            // Body
            const grd = this.ctx.createRadialGradient(bx - size / 3, by - size / 3, size / 10, bx, by, size);
            grd.addColorStop(0, "#555");
            grd.addColorStop(1, "#111");
            this.ctx.fillStyle = grd;
            this.ctx.beginPath();
            this.ctx.arc(bx, by, size / 2, 0, Math.PI * 2);
            this.ctx.fill();

            // Fuse
            this.ctx.strokeStyle = "#c0392b";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(bx, by - size / 2);
            this.ctx.quadraticCurveTo(bx + size / 4, by - size * 0.8, bx + size / 2, by - size / 2);
            this.ctx.stroke();

            // Spark
            if (Math.floor(Date.now() / 100) % 2 === 0) {
                this.ctx.fillStyle = "#f1c40f";
                this.ctx.beginPath();
                this.ctx.arc(bx + size / 2, by - size / 2, 3, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.font = "12px monospace";
            this.ctx.fillStyle = "#fff";
            this.ctx.textAlign = "center";
            this.ctx.fillText(`BOMB x${this.player.bombCount}`, bx, by + size * 0.8);
        }

        // Fever Gauge
        if (this.isFever) {
            const barWidth = 200;
            const barHeight = 20;
            const bx = this.canvas.width / 2 - barWidth / 2;
            const by = 130;

            // Max time calculation (need to store max)
            const feverLevel = this.upgradeManager.getLevel('FEVER_TIME');
            const maxTime = 300 + (feverLevel * 60);
            const ratio = this.feverTimer / maxTime;

            this.ctx.fillStyle = "rgba(0,0,0,0.5)";
            this.ctx.fillRect(bx, by, barWidth, barHeight);

            this.ctx.fillStyle = "#f1c40f";
            this.ctx.fillRect(bx + 2, by + 2, (barWidth - 4) * ratio, barHeight - 4);

            this.ctx.strokeStyle = "#fff";
            this.ctx.strokeRect(bx, by, barWidth, barHeight);
        }
    }

    renderGameOver() {
        // Red Tint for Death
        this.ctx.fillStyle = "rgba(100, 0, 0, 0.5)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "#e74c3c";
        this.ctx.font = "40px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("GAME OVER", this.canvas.width / 2, 80);

        this.ctx.fillStyle = "#fff";
        this.ctx.font = "20px monospace";
        this.ctx.fillText(`Final Depth: ${this.score}m`, this.canvas.width / 2, 120);

        // Find Rank
        const rank = this.highScores.indexOf(this.score) + 1;
        this.ctx.fillStyle = "#f1c40f";
        this.ctx.fillText(`Your Rank: ${rank}`, this.canvas.width / 2, 145);

        this.ctx.fillStyle = CONSTANTS.colors.ITEM_AMETHYST;
        this.ctx.fillText(`Found: ${this.player.moneyCollected} Amethysts`, this.canvas.width / 2, 160);
        this.ctx.fillText(`Total: ${this.upgradeManager.money}`, this.canvas.width / 2, 190);

        this.ctx.fillStyle = "#f1c40f";
        this.ctx.fillText("--- High Scores ---", this.canvas.width / 2, 250);

        const top5 = this.highScores.slice(0, 5);
        top5.forEach((s, i) => {
            if (s === this.score) {
                this.ctx.fillStyle = "#e74c3c";
                this.ctx.font = "bold 22px monospace";
            } else {
                this.ctx.fillStyle = "#ecf0f1";
                this.ctx.font = "20px monospace";
            }
            this.ctx.fillText(`${i + 1}. ${s}m`, this.canvas.width / 2, 280 + i * 30);
        });

        this.ctx.fillStyle = "#ecf0f1";
        this.ctx.font = "20px monospace";
        this.ctx.fillText("Press Space to Restart", this.canvas.width / 2, 450);
        this.ctx.fillStyle = "#3498db";
        this.ctx.fillText("Press S for Shop", this.canvas.width / 2, 480);
    }

    renderShop() {
        this.ctx.fillStyle = "#2c3e50";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = "#f1c40f";
        this.ctx.font = "30px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("SHOP", this.canvas.width / 2, 50);

        this.ctx.fillStyle = "#fff";
        this.ctx.font = "20px monospace";
        this.ctx.fillText(`Amethyst: ${this.upgradeManager.money}`, this.canvas.width / 2, 90);

        const keys = Object.keys(UPGRADES) as UpgradeType[];
        const startY = 140;

        keys.forEach((key, i) => {
            const config = UPGRADES[key];
            const level = this.upgradeManager.getLevel(key);
            const cost = this.upgradeManager.getCost(key);
            const isSelected = i === this.shopSelection;
            const y = startY + i * 70;

            if (isSelected) {
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
                this.ctx.fillRect(20, y - 40, this.canvas.width - 40, 60);
                this.ctx.fillStyle = "#e74c3c"; // Highlight
            } else {
                this.ctx.fillStyle = "#fff";
            }

            this.ctx.textAlign = "left";
            this.ctx.font = "20px monospace";
            this.ctx.fillText(config.name, 40, y);

            // Level dots
            for (let l = 0; l < config.maxLevel; l++) {
                if (l < level) this.ctx.fillStyle = "#f1c40f";
                else this.ctx.fillStyle = "#7f8c8d";
                this.ctx.fillRect(200 + l * 20, y - 15, 15, 15);
            }

            // Cost
            this.ctx.textAlign = "right";
            this.ctx.fillStyle = isSelected ? "#e74c3c" : "#fff";
            if (level >= config.maxLevel) {
                this.ctx.fillText("MAX", this.canvas.width - 40, y);
            } else {
                if (this.upgradeManager.money >= cost) this.ctx.fillStyle = "#2ecc71"; // Can buy
                else this.ctx.fillStyle = "#e74c3c"; // Too expensive
                this.ctx.fillText(`$${cost}`, this.canvas.width - 40, y);
            }
        });

        this.ctx.fillStyle = "#95a5a6";
        this.ctx.font = "16px monospace";
        this.ctx.textAlign = "center";
        this.ctx.fillText("UP/DOWN: Select | SPACE: Buy | ESC: Back", this.canvas.width / 2, 580);
    }

    loop() {
        this.update();
        this.render();
        requestAnimationFrame(this.loop);
    }

    startFever() {
        this.isFever = true;
        const feverLevel = this.upgradeManager.getLevel('FEVER_TIME');
        this.feverTimer = 300 + (feverLevel * 60); // 5s base + 1s per level
        this.lastFeverDepth = this.score;
        this.player.isFever = true;
    }

    spawnParticles(x: number, y: number, color: string) {
        for (let i = 0; i < 5; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    checkCollision(p: Player, m: Mole): boolean {
        return (
            p.x < m.x + m.width &&
            p.x + p.width > m.x &&
            p.y < m.y + m.height &&
            p.y + p.height > m.y
        );
    }

    private interpolateColor(c1: string, c2: string, factor: number): string {
        const hex = (c: string) => {
            const num = parseInt(c.slice(1), 16);
            return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
        };
        const toHex = (r: number, g: number, b: number) => {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        };

        const rgb1 = hex(c1);
        const rgb2 = hex(c2);

        const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
        const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
        const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);

        return toHex(r, g, b);
    }
}
