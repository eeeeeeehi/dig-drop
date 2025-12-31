
import { CONSTANTS, TileType } from './constants';

export class TileMap {
    rows: TileType[][] = [];
    offsetY: number = 0; // Global scroll offset
    cols: number;

    constructor() {
        this.cols = Math.ceil(CONSTANTS.CANVAS_WIDTH / CONSTANTS.TILE_SIZE);
        // Initial generation: fill screen + buffer
        const rowsNeeded = Math.ceil(CONSTANTS.CANVAS_HEIGHT / CONSTANTS.TILE_SIZE) + 5;
        for (let i = 0; i < rowsNeeded; i++) {
            this.generateRow(0);
        }
        // Clear the first few rows for player start area
        for (let r = 0; r < 5; r++) {
            this.rows[r].fill(TileType.EMPTY);
        }
    }

    generateRow(depth: number) {
        const row = new Array(this.cols).fill(TileType.DIRT);
        let hasPath = false;

        // Biome Config
        let rockChance = 0.2;
        let oreChance = 0.1;

        if (depth > 300) {
            // CORE
            rockChance = 0.3;
            oreChance = 0.2;
        } else if (depth > 100) {
            // CAVERN
            rockChance = 0.25;
        }

        for (let c = 0; c < this.cols; c++) {
            if (Math.random() < rockChance) {
                // Rock or Ore
                if (Math.random() < oreChance) {
                    row[c] = TileType.ITEM_AMETHYST;
                } else {
                    row[c] = TileType.ROCK;
                }
            } else {
                // Chance for heart/bomb
                if (Math.random() < 0.02) {
                    if (Math.random() < 0.2) {
                        row[c] = TileType.ITEM_BOMB;
                    } else {
                        row[c] = TileType.ITEM_HEAL;
                    }
                } else {
                    row[c] = TileType.DIRT;
                }
                hasPath = true;
            }
        }

        if (!hasPath) {
            const safeCol = Math.floor(Math.random() * this.cols);
            row[safeCol] = TileType.DIRT;
        }

        this.rows.push(row);
    }

    update(scrollY: number) {
        const scrollRows = Math.floor(scrollY / CONSTANTS.TILE_SIZE);
        const depth = Math.floor(scrollY / CONSTANTS.TILE_SIZE); // Current generation depth

        const screenRows = Math.ceil(CONSTANTS.CANVAS_HEIGHT / CONSTANTS.TILE_SIZE);
        const targetRows = scrollRows + screenRows + 2;

        while (this.rows.length < targetRows) {
            // We need to know the depth of the row being generated
            // rows.length is the index of the next row
            this.generateRow(this.rows.length);
        }
    }

    // Get tile at global coordinates
    getTileAt(x: number, y: number): TileType {
        const col = Math.floor(x / CONSTANTS.TILE_SIZE);
        const row = Math.floor(y / CONSTANTS.TILE_SIZE);

        if (col < 0 || col >= this.cols) return TileType.ROCK; // Walls are rocks
        if (row < 0) return TileType.EMPTY; // Sky
        if (row >= this.rows.length) return TileType.ROCK; // Bottom is solid until generated

        return this.rows[row][col];
    }

    dig(x: number, y: number): boolean {
        const col = Math.floor(x / CONSTANTS.TILE_SIZE);
        const row = Math.floor(y / CONSTANTS.TILE_SIZE);

        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows.length) return false;

        // Allow removing ANY tile (including rocks) if logic calls for it
        // The calling logic (Player.ts) decides IF it can be dug (e.g. isFever)
        // This function just performs the removal.
        // Actually, let's keep it safe. If we want to remove ROCK, we should explicitly allow it or just use this generic removal.
        // Given Player.ts calls this only when allowed:
        if (this.rows[row][col] !== TileType.EMPTY) {
            this.rows[row][col] = TileType.EMPTY;
            return true;
        }
        return false;
    }

    render(ctx: CanvasRenderingContext2D, scrollY: number, images?: { [key: string]: HTMLImageElement }) {
        const startRow = Math.floor(scrollY / CONSTANTS.TILE_SIZE);
        const endRow = startRow + Math.ceil(CONSTANTS.CANVAS_HEIGHT / CONSTANTS.TILE_SIZE) + 1;

        for (let row = startRow; row < endRow; row++) {
            if (row < 0 || row >= this.rows.length) continue;

            for (let col = 0; col < this.cols; col++) {
                const tile = this.rows[row][col];
                if (tile === TileType.EMPTY) continue;

                const x = col * CONSTANTS.TILE_SIZE;
                const y = row * CONSTANTS.TILE_SIZE;
                const screenY = y - scrollY;

                if (tile === TileType.DIRT) {
                    if (images && images['dirt'] && images['dirt'].complete && images['dirt'].naturalWidth > 0) {
                        ctx.drawImage(images['dirt'], x, screenY, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);
                    } else {
                        ctx.fillStyle = CONSTANTS.colors.DIRT;
                        ctx.fillRect(x, screenY, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);
                    }
                } else if (tile === TileType.ROCK) {
                    if (images && images['rock'] && images['rock'].complete && images['rock'].naturalWidth > 0) {
                        ctx.drawImage(images['rock'], x, screenY, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);
                    } else {
                        ctx.fillStyle = CONSTANTS.colors.ROCK;
                        ctx.fillRect(x, screenY, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);
                    }
                } else if (tile === TileType.HARD_ROCK) {
                    // Hard Rock Visual
                    ctx.fillStyle = CONSTANTS.colors.HARD_ROCK;
                    ctx.fillRect(x, screenY, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);

                    // Cross hatch
                    ctx.strokeStyle = "#4a5a5a";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, screenY);
                    ctx.lineTo(x + CONSTANTS.TILE_SIZE, screenY + CONSTANTS.TILE_SIZE);
                    ctx.moveTo(x + CONSTANTS.TILE_SIZE, screenY);
                    ctx.lineTo(x, screenY + CONSTANTS.TILE_SIZE);
                    ctx.stroke();

                    // Border
                    ctx.strokeStyle = "#2c3e50";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, screenY, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);

                } else if (tile === TileType.ITEM_HEAL) {
                    if (images && images['heart'] && images['heart'].complete && images['heart'].naturalWidth > 0) {
                        const size = CONSTANTS.TILE_SIZE;
                        const offset = (CONSTANTS.TILE_SIZE - size) / 2;
                        ctx.drawImage(images['heart'], x + offset, screenY + offset, size, size);
                    } else {
                        // Fallback (Green Heart)
                        ctx.fillStyle = CONSTANTS.colors.ITEM_HEAL;
                        const cx = x + CONSTANTS.TILE_SIZE / 2;
                        const cy = screenY + CONSTANTS.TILE_SIZE / 2;
                        const size = CONSTANTS.TILE_SIZE / 1.8;

                        ctx.beginPath();
                        ctx.moveTo(cx, cy + size * 0.7);
                        ctx.bezierCurveTo(cx + size, cy, cx + size, cy - size, cx, cy - size * 0.5);
                        ctx.bezierCurveTo(cx - size, cy - size, cx - size, cy, cx, cy + size * 0.7);
                        ctx.fill();
                    }
                } else if (tile === TileType.ITEM_BOMB) {
                    // Draw Bomb - Detailed
                    const cx = x + CONSTANTS.TILE_SIZE / 2;
                    const cy = screenY + CONSTANTS.TILE_SIZE / 2;
                    const size = CONSTANTS.TILE_SIZE / 2.2;

                    // Body with gradient
                    const grd = ctx.createRadialGradient(cx - size / 3, cy - size / 3, size / 10, cx, cy, size);
                    grd.addColorStop(0, "#555");
                    grd.addColorStop(1, "#111");
                    ctx.fillStyle = grd;

                    ctx.beginPath();
                    ctx.arc(cx, cy + 2, size, 0, Math.PI * 2);
                    ctx.fill();

                    // Cap/Fuse Holder at top
                    ctx.fillStyle = "#333";
                    ctx.fillRect(cx - size / 2, cy - size - 2, size, 4);

                    // Fuse
                    ctx.strokeStyle = "#c0392b";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - size - 2);
                    ctx.quadraticCurveTo(cx + size / 2, cy - size * 1.5, cx + size / 1.5, cy - size * 0.8);
                    ctx.stroke();

                    // Spark
                    if (Math.floor(Date.now() / 100) % 2 === 0) {
                        ctx.fillStyle = "#f1c40f";
                        ctx.beginPath();
                        ctx.arc(cx + size / 1.5, cy - size * 0.8, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // Danger Mark (skull-ish or X)
                    ctx.strokeStyle = "#333"; // darker shine
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(cx - 3, cy - 3);
                    ctx.lineTo(cx - 6, cy - 8);
                    ctx.stroke();

                } else if (tile === TileType.ITEM_AMETHYST) {
                    // Draw Amethyst (Crystal Cluster)
                    const cx = x + CONSTANTS.TILE_SIZE / 2;
                    const cy = screenY + CONSTANTS.TILE_SIZE / 2;
                    const size = CONSTANTS.TILE_SIZE / 2.5;

                    ctx.fillStyle = CONSTANTS.colors.ITEM_AMETHYST;

                    // Main Crystal (Hex format)
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - size);
                    ctx.lineTo(cx + size * 0.8, cy - size * 0.4);
                    ctx.lineTo(cx + size * 0.8, cy + size * 0.4);
                    ctx.lineTo(cx, cy + size);
                    ctx.lineTo(cx - size * 0.8, cy + size * 0.4);
                    ctx.lineTo(cx - size * 0.8, cy - size * 0.4);
                    ctx.closePath();
                    ctx.fill();

                    // Shine / Facets
                    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - size);
                    ctx.lineTo(cx + size * 0.4, cy - size * 0.4);
                    ctx.lineTo(cx, cy);
                    ctx.lineTo(cx - size * 0.4, cy - size * 0.4);
                    ctx.fill();
                }
            }
        }
    }
}

