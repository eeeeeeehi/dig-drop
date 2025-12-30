
export class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;

    constructor(x: number, y: number, color: string) {
        this.x = x;
        this.y = y;
        this.color = color;
        // Random velocity
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4 - 2; // Slight upward bias
        this.maxLife = 30 + Math.random() * 20;
        this.life = this.maxLife;
        this.size = 2 + Math.random() * 3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // Gravity
        this.life--;
    }

    render(ctx: CanvasRenderingContext2D, scrollY: number) {
        if (this.life <= 0) return;
        const screenY = this.y - scrollY;

        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, screenY, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}
