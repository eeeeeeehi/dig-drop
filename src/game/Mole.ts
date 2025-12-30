import { CONSTANTS } from './constants';

export class Mole {
    x: number;
    y: number;
    width: number = 24;
    height: number = 24;
    vx: number;
    isDead: boolean = false;

    constructor(y: number) {
        this.y = y;
        // Random start side
        if (Math.random() < 0.5) {
            this.x = -this.width;
            this.vx = 2 + Math.random();
        } else {
            this.x = CONSTANTS.CANVAS_WIDTH;
            this.vx = -(2 + Math.random());
        }
    }

    update(scrollY: number) {
        this.x += this.vx;

        // Despawn if off screen far enough (and traveled across)
        if (this.vx > 0 && this.x > CONSTANTS.CANVAS_WIDTH + 50) this.isDead = true;
        if (this.vx < 0 && this.x < -50) this.isDead = true;

        // Also despawn if scrolled off top
        if (this.y < scrollY - 50) this.isDead = true;
    }

    render(ctx: CanvasRenderingContext2D, scrollY: number, images?: { [key: string]: HTMLImageElement }) {
        const screenY = this.y - scrollY;

        if (images && images['mole'] && images['mole'].complete && images['mole'].naturalWidth > 0) {
            ctx.save();

            // Scale up for visual impact
            const scale = 2.0; // Double Size
            const dw = this.width * scale;
            const dh = this.height * scale;
            const dx = this.x - (dw - this.width) / 2;
            const dy = screenY - (dh - this.height) / 2;

            // Flip sprite if moving left
            if (this.vx < 0) {
                ctx.translate(dx + dw, dy); // Translate to right edge of scaled box
                ctx.scale(-1, 1);
                ctx.drawImage(images['mole'], 0, 0, dw, dh);
            } else {
                ctx.drawImage(images['mole'], dx, dy, dw, dh);
            }

            ctx.restore();
        } else {
            // Fallback
            ctx.fillStyle = '#8e44ad'; // Purple mole
            ctx.strokeStyle = '#fff';
            // Draw Mole
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, screenY + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }
}
