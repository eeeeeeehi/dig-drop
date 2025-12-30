
import { CONSTANTS, TileType } from './constants';
import { InputHandler } from './InputHandler';
import { TileMap } from './TileMap';

export class Player {
    x: number;
    y: number;
    width: number;
    height: number;
    hp: number;
    isDead: boolean = false;
    isFever: boolean = false;

    constructor() {
        this.width = CONSTANTS.TILE_SIZE * 0.8;
        this.height = CONSTANTS.TILE_SIZE * 0.8;
        this.x = CONSTANTS.CANVAS_WIDTH / 2 - this.width / 2;
        this.y = CONSTANTS.TILE_SIZE * 2; // Start a bit down
        this.hp = CONSTANTS.MAX_LIFE;
    }

    update(input: InputHandler, map: TileMap, scrollY: number, scrollSpeed: number, onDig: (x: number, y: number, color: string) => void) {
        if (this.isDead) return;

        // Horizontal Movement
        if (input.isLeftPressed()) {
            this.move(-CONSTANTS.PLAYER_SPEED, 0, map, onDig);
        }
        if (input.isRightPressed()) {
            this.move(CONSTANTS.PLAYER_SPEED, 0, map, onDig);
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
                    // Break rock in fever
                    map.dig(p.x, p.y);
                    onDig(p.x, p.y, CONSTANTS.colors.PARTICLE_ROCK);
                } else {
                    blocked = true;
                    break;
                }
            } else if (tile === TileType.DIRT) {
                digging = true;
            } else if (tile === TileType.ITEM_HEAL) {
                touchingItem = { x: p.x, y: p.y, type: tile };
            }
        }

        if (blocked) {
            // Blocked
        } else {
            if (touchingItem) {
                map.dig(touchingItem.x, touchingItem.y); // Remove item
                if (touchingItem.type === TileType.ITEM_HEAL) {
                    if (this.hp < CONSTANTS.MAX_LIFE) this.hp++;
                    onDig(touchingItem.x, touchingItem.y, CONSTANTS.colors.ITEM_HEAL);
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
            // Draw slightly larger than hitbox for impact
            const scale = 1.4;
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
}
