
import './style.css'
import { Game } from './game/Game'

const canvas = document.createElement('canvas');
canvas.id = 'app';
document.body.appendChild(canvas);

new Game(canvas);
