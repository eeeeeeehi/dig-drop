
import { CONSTANTS } from './constants';
import { InputHandler } from './InputHandler';
import { Player } from './Player';
import { TileMap } from './TileMap';
import { Particle } from './Particle';
import { Mole } from './Mole';

export class Game {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    input: InputHandler;
    player: Player;
    map: TileMap;

    particles: Particle[] = [];
    moles: Mole[] = [];

    scrollY: number = 0;
    score: number = 0; // Current depth
    gameRunning: boolean = true;
    scrollSpeed: number = CONSTANTS.INITIAL_SCROLL_SPEED;
    highScores: number[] = [];

    // Fever Mode
    isFever: boolean = false;
    feverTimer: number = 0;
    lastFeverDepth: number = 0;

    // UI State

    // UI State
    showControls: boolean = true;
    lastZeroState: boolean = false;

    // Assets
    images: { [key: string]: HTMLImageElement } = {};

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.ctx.imageSmoothingEnabled = false; // Keep pixel art crisp
        this.canvas.width = CONSTANTS.CANVAS_WIDTH;
        this.canvas.height = CONSTANTS.CANVAS_HEIGHT;

        this.loadImages();

        this.input = new InputHandler();
        this.player = new Player();
        this.map = new TileMap();

        this.loadHighScores();

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    loadImages() {
        const assets = ['dirt', 'rock', 'drill', 'mole', 'battery'];
        assets.forEach(name => {
            const img = new Image();
            img.src = `/assets/${name}.png`;
            img.onload = () => {
                console.log(`Loaded: ${name}`);
                if (name === 'drill' || name === 'mole' || name === 'battery') {
                    // Forcibly remove background for sprites
                    this.images[name] = this.removeBackground(img);
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

        // Tolerance
        const tol = 100; // Aggressive tolerance to remove "transparent square" artifacts

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
        this.highScores = this.highScores.slice(0, 5);
        localStorage.setItem('dig_highscores', JSON.stringify(this.highScores));
    }

    update() {
        if (!this.gameRunning) {
            if (this.input.isLeftPressed() || this.input.isRightPressed()) {
                // Restart
                window.location.reload();
            }
            return;
        }

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
                m.isDead = true; // Mole dies on impact?
                this.moles.splice(i, 1);
            } else if (this.player.isFever && this.checkCollision(this.player, m)) {
                // Fever kills moles
                this.spawnParticles(m.x + m.width / 2, m.y + m.height / 2, CONSTANTS.colors.MOLE);
                m.isDead = true;
                this.moles.splice(i, 1);
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        if (this.player.isDead) {
            this.gameRunning = false;
            this.saveHighScore(this.score);
        }
    }

    render() {
        // Draw Dynamic Background
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);

        // Calculate gradient factor based on depth (e.g. 0 to 5000m)
        // Let's assume 1000m is "deep" enough for full change
        const maxDepth = 1000;
        const progress = Math.min(this.score / maxDepth, 1.0);

        if (progress < 0.5) {
            // Blue to Brown
            const p = progress * 2;
            grad.addColorStop(0, CONSTANTS.colors.SKY_TOP);
            grad.addColorStop(1, this.interpolateColor(CONSTANTS.colors.SKY_BOTTOM, CONSTANTS.colors.EARTH_START, p));
        } else {
            // Brown to Red/Magma
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

        if (this.gameRunning) {
            this.player.render(this.ctx, this.scrollY, this.images);
        }

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

        // UI
        this.ctx.fillStyle = CONSTANTS.colors.TEXT;
        this.ctx.font = "20px monospace";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`Depth: ${this.score}m`, 10, 30);

        if (this.showControls) {
            this.ctx.font = "16px monospace";
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            this.ctx.fillText("移動: 矢印 / WASD", 10, 60);
            this.ctx.fillText("加速: 下 / S", 10, 80);
            this.ctx.fillText("操作説明切替: 0", 10, 100);
        }

        // HP (Batteries) - Drawn at top-right
        const hpStartX = this.canvas.width - 20 - (this.player.hp * 25);
        for (let i = 0; i < this.player.hp; i++) {
            const cx = hpStartX + i * 25;
            const cy = 30; // Center Y            
            if (this.images && this.images['battery'] && this.images['battery'].complete && this.images['battery'].naturalWidth > 0) {
                const size = 40; // Massive UI Icon
                this.ctx.drawImage(this.images['battery'], cx - size / 2, cy - size / 2, size, size);
            } else {
                // Fallback Heart
                this.ctx.fillStyle = CONSTANTS.colors.ITEM_HEAL; // Green Heart
                const size = 12; // Bigger HP Hearts (was 8)
                this.ctx.beginPath();
                this.ctx.moveTo(cx, cy + size * 0.7);
                this.ctx.bezierCurveTo(cx + size, cy, cx + size, cy - size, cx, cy - size * 0.5);
                this.ctx.bezierCurveTo(cx - size, cy - size, cx - size, cy, cx, cy + size * 0.7);
                this.ctx.fill();
            }
        }

        // Redraw HP in cleaner spot (Top Right)
        this.ctx.clearRect(0, 0, 0, 0); // Dummy clear (logic fix below)

        if (!this.gameRunning) {
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.fillStyle = "#e74c3c";
            this.ctx.font = "40px monospace";
            this.ctx.textAlign = "center";
            this.ctx.fillText("GAME OVER", this.canvas.width / 2, 100);

            this.ctx.fillStyle = "#fff";
            this.ctx.font = "20px monospace";
            this.ctx.fillText(`Final Depth: ${this.score}m`, this.canvas.width / 2, 150);

            this.ctx.fillStyle = "#f1c40f";
            this.ctx.fillText("--- High Scores ---", this.canvas.width / 2, 230);
            this.highScores.forEach((s, i) => {
                if (s === this.score) {
                    this.ctx.fillStyle = "#e74c3c"; // Highlight current score
                    this.ctx.font = "bold 22px monospace";
                } else {
                    this.ctx.fillStyle = "#ecf0f1";
                    this.ctx.font = "20px monospace";
                }
                this.ctx.fillText(`${i + 1}. ${s}m`, this.canvas.width / 2, 270 + i * 30);
            });

            this.ctx.fillStyle = "#ecf0f1";
            this.ctx.font = "20px monospace";
            this.ctx.fillText("Press keys to restart", this.canvas.width / 2, 450);
        }
    }

    loop() {
        this.update();
        this.render();
        requestAnimationFrame(this.loop);
    }

    startFever() {
        this.isFever = true;
        this.feverTimer = 300; // 5 seconds at 60fps
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

    // Helper to blend hex colors
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
