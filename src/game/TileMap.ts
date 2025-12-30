
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
            this.generateRow();
        }
        // Clear the first few rows for player start area
        for (let r = 0; r < 5; r++) {
            this.rows[r].fill(TileType.EMPTY);
        }
    }

    generateRow() {
        const row = new Array(this.cols).fill(TileType.DIRT);
        let hasPath = false;

        // Simple generation: Randomly place rocks, ensure at least one empty spot (or soft dirt which is diggable)
        // Actually "diggable" means DIRT. "Non-diggable" is ROCK.
        // We need to ensure there's a path. For now, let's just make sure not the entire row is ROCK.

        for (let c = 0; c < this.cols; c++) {
            // 10% chance of rock initially, increasing with depth?
            // Let's keep it simple: 20% rock.
            if (Math.random() < 0.2) {
                row[c] = TileType.ROCK;
            } else {
                // Chance for heart
                if (Math.random() < 0.02) {
                    row[c] = TileType.ITEM_HEAL; // Rare health
                } else {
                    row[c] = TileType.DIRT;
                }
                hasPath = true;
            }
        }

        if (!hasPath) {
            // Force one random dirt if blocked
            const safeCol = Math.floor(Math.random() * this.cols);
            row[safeCol] = TileType.DIRT;
        }

        this.rows.push(row);
    }

    update(scrollY: number) {
        // scrollY is the total pixels scrolled downwards.
        // Calculate how many rows have scrolled off the top.
        const scrollRows = Math.floor(scrollY / CONSTANTS.TILE_SIZE);

        // Maintain buffer
        const screenRows = Math.ceil(CONSTANTS.CANVAS_HEIGHT / CONSTANTS.TILE_SIZE);
        const targetRows = scrollRows + screenRows + 2; // +2 Buffer

        while (this.rows.length < targetRows) {
            this.generateRow();
        }

        // Note: We don't necessarily delete top rows immediately to avoid index messes, 
        // or we can just access via (rowIndex - scrollRows).
        // Let's keep all rows for now? No, memory leak.
        // Better: keep `offsetY` tracking the abstract Y start of `rows[0]`.
        // Actually, simplest is: map coordinate Y = (rowIndex * TILE_SIZE).
        // If we remove rows, we must increment a `startRowIndex` counter.
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
                } else if (tile === TileType.ITEM_HEAL) {
                    if (images && images['battery'] && images['battery'].complete && images['battery'].naturalWidth > 0) {
                        const size = CONSTANTS.TILE_SIZE * 2.0; // Double Size
                        const offset = (CONSTANTS.TILE_SIZE - size) / 2;
                        // Draw battery floating in the tile
                        ctx.drawImage(images['battery'], x + offset, screenY + offset, size, size);
                    } else {
                        // Draw Heart (Fallback)
                        ctx.fillStyle = CONSTANTS.colors.ITEM_HEAL; // Green Heart
                        const cx = x + CONSTANTS.TILE_SIZE / 2;
                        const cy = screenY + CONSTANTS.TILE_SIZE / 2;
                        const size = CONSTANTS.TILE_SIZE / 1.8;

                        ctx.beginPath();
                        ctx.moveTo(cx, cy + size * 0.7);
                        ctx.bezierCurveTo(cx + size, cy, cx + size, cy - size, cx, cy - size * 0.5);
                        ctx.bezierCurveTo(cx - size, cy - size, cx - size, cy, cx, cy + size * 0.7);
                        ctx.fill();
                    }
                }
            }
        }
    }
}
