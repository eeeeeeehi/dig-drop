
export class InputHandler {
    keys: { [key: string]: boolean } = {};

    constructor() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    isLeftPressed(): boolean {
        return this.keys['ArrowLeft'] || this.keys['KeyA'];
    }

    isRightPressed(): boolean {
        return this.keys['ArrowRight'] || this.keys['KeyD'];
    }

    isDownPressed(): boolean {
        return this.keys['ArrowDown'] || this.keys['KeyS'];
    }

    isZeroPressed(): boolean {
        return this.keys['Digit0'] || this.keys['Numpad0'];
    }
}
