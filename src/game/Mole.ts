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

    render(ctx: CanvasRenderingContext2D, scrollY: number) {
        const screenY = this.y - scrollY;

        ctx.fillStyle = '#8e44ad'; // Purple mole
        ctx.strokeStyle = '#fff';

        // Draw Mole
        ctx.beginPath();
        // Body (Ellipse-ish)
        ctx.ellipse(this.x + this.width / 2, screenY + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#000';
        const eyeOffset = this.vx > 0 ? 4 : -4;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 + eyeOffset, screenY + this.height / 2 - 4, 3, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2 + eyeOffset * 1.5, screenY + this.height / 2 + 2, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}
