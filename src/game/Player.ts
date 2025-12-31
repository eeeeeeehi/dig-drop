
import { CONSTANTS, TileType } from './constants';
import { InputHandler } from './InputHandler';
import { TileMap } from './TileMap';
import { UpgradeManager } from './UpgradeManager';

export class Player {
    x: number;
    y: number;
    width: number;
    height: number;
    hp: number;
    isDead: boolean = false;
    isFever: boolean = false;
    hasBomb: boolean = false; // Kept for compatibility if needed, but using bombCount mainly
    bombCount: number = 0;
    maxBombs: number = 1;
    bombCooldown: number = 0;

    moneyCollected: number = 0;
    stats: UpgradeManager;
    maxHp: number;

    constructor(stats: UpgradeManager) {
        this.stats = stats;
        this.width = CONSTANTS.TILE_SIZE * 0.8;
        this.height = CONSTANTS.TILE_SIZE * 0.8;
        this.x = CONSTANTS.CANVAS_WIDTH / 2 - this.width / 2;
        this.y = CONSTANTS.TILE_SIZE * 2;

        // Apply HP Upgrade
        const hpLevel = this.stats.getLevel('MAX_HP');
        this.maxHp = CONSTANTS.MAX_LIFE + hpLevel;
        this.hp = this.maxHp;

        // Apply Bomb Upgrade
        const bombLevel = this.stats.getLevel('BOMB_MAX');
        this.maxBombs = 1 + bombLevel;
        if (bombLevel > 0) {
            this.bombCount = 1;
            this.hasBomb = true;
        }
    }

    update(input: InputHandler, map: TileMap, scrollY: number, scrollSpeed: number, onDig: (x: number, y: number, color: string) => void) {
        if (this.isDead) return;
        if (this.bombCooldown > 0) this.bombCooldown--;

        // ... rest of update


        // Apply Speed Upgrade
        const speedLevel = this.stats.getLevel('DRILL_SPEED');
        const speed = CONSTANTS.PLAYER_SPEED * (1 + speedLevel * 0.1); // +10% per level

        // Horizontal Movement
        if (input.isLeftPressed()) {
            this.move(-speed, 0, map, onDig);
        }
        if (input.isRightPressed()) {
            this.move(speed, 0, map, onDig);
        }

        // Magnet Logic
        const magnetLevel = this.stats.getLevel('MAGNET');
        if (magnetLevel > 0) {
            this.applyMagnet(map, scrollY, magnetLevel);
        }

        let fallSpeed = scrollSpeed;

        // Drill Drive: Pressing down increases fall speed relative to scroll
        if (input.isDownPressed()) {
            fallSpeed += 4.0; // Bonus speed downwards
        }

        this.move(0, fallSpeed, map, onDig);

        // Check death condition (Off screen top)
        if (this.y < scrollY - this.height) {
            this.handleDeath(map, scrollY);
        }
    }

    handleDeath(map: TileMap, scrollY: number) {
        if (this.isFever) return; // Invincible in fever

        if (this.hp > 1) {
            this.hp--;
            this.respawn(map, scrollY);
            console.log("Respawned! Lives left:", this.hp);
        } else {
            this.hp = 0;
            this.isDead = true;
            console.log("Game Over: Scrolled off screen");
        }
    }

    takeDamage(map: TileMap, scrollY: number) {
        if (this.isFever) return;
        this.handleDeath(map, scrollY);
    }

    respawn(map: TileMap, scrollY: number) {
        // Respawn a bit down from the top
        this.x = CONSTANTS.CANVAS_WIDTH / 2 - this.width / 2;
        this.y = scrollY + CONSTANTS.TILE_SIZE * 3; // Safe zone?

        // Clear area around spawn to prevent getting stuck in rock
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        // Clear 3x3 grid around player center
        for (let r = -1; r <= 1; r++) {
            for (let c = -1; c <= 1; c++) {
                map.dig(cx + c * CONSTANTS.TILE_SIZE, cy + r * CONSTANTS.TILE_SIZE);
            }
        }
    }

    move(dx: number, dy: number, map: TileMap, onDig: (x: number, y: number, color: string) => void) {
        const newX = this.x + dx;
        const newY = this.y + dy;

        // Check collision points (4 corners)
        const corners = [
            { x: newX, y: newY },
            { x: newX + this.width, y: newY },
            { x: newX, y: newY + this.height },
            { x: newX + this.width, y: newY + this.height }
        ];

        let blocked = false;
        let digging = false;
        let touchingItem: { x: number, y: number, type: TileType } | null = null;

        for (const p of corners) {
            const tile = map.getTileAt(p.x, p.y);
            if (tile === TileType.ROCK) {
                if (this.isFever) {
                    map.dig(p.x, p.y);
                    onDig(p.x, p.y, CONSTANTS.colors.PARTICLE_ROCK);
                } else {
                    blocked = true;
                    break;
                }
            } else if (tile === TileType.HARD_ROCK) {
                if (this.isFever) {
                    map.dig(p.x, p.y);
                    onDig(p.x, p.y, CONSTANTS.colors.PARTICLE_ROCK);
                } else {
                    // Hard Rock Logic: Turn to Rock on hit
                    const r = Math.floor(p.y / CONSTANTS.TILE_SIZE);
                    const c = Math.floor(p.x / CONSTANTS.TILE_SIZE);
                    if (r >= 0 && r < map.rows.length && c >= 0 && c < map.cols) {
                        map.rows[r][c] = TileType.ROCK; // Degrade
                        onDig(p.x, p.y, CONSTANTS.colors.HARD_ROCK); // Spark effect
                    }
                    blocked = true;
                    break;
                }
            } else if (tile === TileType.DIRT) {
                digging = true;
            } else if (tile === TileType.ITEM_HEAL || tile === TileType.ITEM_BOMB || tile === TileType.ITEM_AMETHYST) {
                touchingItem = { x: p.x, y: p.y, type: tile };
            }
        }

        if (blocked) {
            // Blocked
        } else {
            if (touchingItem) {
                map.dig(touchingItem.x, touchingItem.y); // Remove item
                if (touchingItem.type === TileType.ITEM_HEAL) {
                    if (this.hp < CONSTANTS.MAX_LIFE + this.stats.getLevel('MAX_HP')) this.hp++;
                    onDig(touchingItem.x, touchingItem.y, CONSTANTS.colors.ITEM_HEAL);
                } else if (touchingItem.type === TileType.ITEM_BOMB) {
                    if (this.bombCount < this.maxBombs) {
                        this.bombCount++;
                        this.hasBomb = true;
                        onDig(touchingItem.x, touchingItem.y, CONSTANTS.colors.ITEM_BOMB);
                    }
                } else if (touchingItem.type === TileType.ITEM_AMETHYST) {
                    this.moneyCollected += 1;
                    onDig(touchingItem.x, touchingItem.y, CONSTANTS.colors.ITEM_AMETHYST);
                }
            }

            if (digging) {
                for (const p of corners) {
                    // Only dig dirt
                    if (map.getTileAt(p.x, p.y) === TileType.DIRT) {
                        map.dig(p.x, p.y);
                        onDig(p.x, p.y, CONSTANTS.colors.PARTICLE_DIRT);
                    }
                }
            }

            this.x = newX;
            this.y = newY;

            if (this.x < 0) this.x = 0;
            if (this.x + this.width > CONSTANTS.CANVAS_WIDTH) this.x = CONSTANTS.CANVAS_WIDTH - this.width;
        }
    }

    render(ctx: CanvasRenderingContext2D, scrollY: number, images?: { [key: string]: HTMLImageElement }) {
        if (this.isDead) return;

        const screenY = this.y - scrollY;

        if (images && images['drill'] && images['drill'].complete && images['drill'].naturalWidth > 0) {
            ctx.save();

            // Magnet Range Indicator
            const magnetLevel = this.stats.getLevel('MAGNET');
            if (magnetLevel > 0) {
                const radius = CONSTANTS.TILE_SIZE * (3 + magnetLevel);
                // Draw relative to screen position
                const dx = this.x + this.width / 2;
                const dy = screenY + this.height / 2;

                ctx.beginPath();
                ctx.arc(dx, dy, radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(155, 89, 182, 0.2)`; // Faint Purple
                ctx.lineWidth = 2;
                ctx.stroke();

                // Pulsing inner ring
                const pulse = (Math.sin(Date.now() / 200) + 1) / 2; // 0 to 1
                ctx.beginPath();
                ctx.arc(dx, dy, radius * (0.8 + pulse * 0.1), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(155, 89, 182, ${0.1 + pulse * 0.1})`;
                ctx.stroke();
            }

            // Draw slightly larger than hitbox for impact
            const scale = 1.8; // BIGGER!
            const dw = this.width * scale;
            const dh = this.height * scale;
            const dx = this.x - (dw - this.width) / 2;
            const dy = screenY - (dh - this.height) / 2;

            ctx.drawImage(images['drill'], dx, dy, dw, dh);

            // Fever overlay
            if (this.isFever) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
                ctx.fillRect(dx, dy, dw, dh);
            }
            ctx.restore();
        } else {
            // Fallback
            ctx.fillStyle = this.isFever ? '#f1c40f' : CONSTANTS.colors.PLAYER;
            ctx.fillRect(this.x, screenY, this.width, this.height);
        }
    }

    useBomb(map: TileMap, onDig: (x: number, y: number, color: string) => void) {
        if (this.bombCount <= 0) return;
        if (this.bombCooldown > 0) return; // Cooldown check

        this.bombCount--;
        if (this.bombCount === 0) this.hasBomb = false;

        this.bombCooldown = 30; // 0.5s cooldown

        // Clear rocks in radius
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const radius = CONSTANTS.TILE_SIZE * 5; // 5 tiles radius

        // Iterate tiles in radius
        const startCol = Math.floor((cx - radius) / CONSTANTS.TILE_SIZE);
        const endCol = Math.ceil((cx + radius) / CONSTANTS.TILE_SIZE);
        const startRow = Math.floor((cy - radius) / CONSTANTS.TILE_SIZE);
        const endRow = Math.ceil((cy + radius) / CONSTANTS.TILE_SIZE);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const x = c * CONSTANTS.TILE_SIZE;
                const y = r * CONSTANTS.TILE_SIZE;

                // Distance check
                const dx = x + CONSTANTS.TILE_SIZE / 2 - cx;
                const dy = y + CONSTANTS.TILE_SIZE / 2 - cy;
                if (dx * dx + dy * dy < radius * radius) {
                    const tile = map.getTileAt(x, y);
                    if (tile === TileType.ROCK || tile === TileType.DIRT || tile === TileType.HARD_ROCK) {
                        map.dig(x, y);
                        onDig(x, y, CONSTANTS.colors.CORE_MAGMA); // Explosion particles
                    }
                }
            }
        }
    }

    applyMagnet(map: TileMap, scrollY: number, level: number) {
        const radius = CONSTANTS.TILE_SIZE * (3 + level);
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        const startCol = Math.floor((cx - radius) / CONSTANTS.TILE_SIZE);
        const endCol = Math.ceil((cx + radius) / CONSTANTS.TILE_SIZE);
        const startRow = Math.floor((cy - radius) / CONSTANTS.TILE_SIZE);
        const endRow = Math.ceil((cy + radius) / CONSTANTS.TILE_SIZE);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                if (r < 0 || r >= map.rows.length || c < 0 || c >= map.cols) continue;
                const tile = map.rows[r][c];
                if (tile === TileType.ITEM_HEAL || tile === TileType.ITEM_BOMB || tile === TileType.ITEM_AMETHYST) {
                    const tx = c * CONSTANTS.TILE_SIZE;
                    const ty = r * CONSTANTS.TILE_SIZE;

                    const dx = tx + CONSTANTS.TILE_SIZE / 2 - cx;
                    const dy = ty + CONSTANTS.TILE_SIZE / 2 - cy;
                    if (dx * dx + dy * dy < radius * radius) {

                        if (dx * dx + dy * dy < (CONSTANTS.TILE_SIZE * 2) * (CONSTANTS.TILE_SIZE * 2)) {
                            // Collect!
                            map.dig(tx, ty);
                            if (tile === TileType.ITEM_HEAL) {
                                if (this.hp < CONSTANTS.MAX_LIFE + this.stats.getLevel('MAX_HP')) this.hp++;
                            } else if (tile === TileType.ITEM_BOMB) {
                                if (this.bombCount < this.maxBombs) {
                                    this.bombCount++;
                                    this.hasBomb = true;
                                }
                            } else if (tile === TileType.ITEM_AMETHYST) {
                                this.moneyCollected += 1;
                            }
                        }
                    }
                }
            }
        }
    }
}
