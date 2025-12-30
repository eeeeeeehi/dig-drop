
export const CONSTANTS = {
  CANVAS_WIDTH: 480,
  CANVAS_HEIGHT: 640,
  TILE_SIZE: 32,
  FPS: 60,
  INITIAL_SCROLL_SPEED: 1.0,
  PLAYER_SPEED: 4,
  GRAVITY: 0,
  MAX_LIFE: 3,
  colors: {
    BACKGROUND: '#2c3e50',
    PLAYER: '#e74c3c',
    DIRT: '#d35400',
    ROCK: '#7f8c8d',
    EMPTY: '#2c3e50',
    TEXT: '#ecf0f1',
    ITEM_HEAL: '#2ecc71',
    // Gradient stops
    SKY_TOP: '#2980b9',
    SKY_BOTTOM: '#2c3e50',
    EARTH_START: '#5d4037', // Brown
    EARTH_CORE: '#c0392b',  // Red
    CORE_MAGMA: '#f1c40f',  // Yellow/Magma
    MOLE: '#8e44ad',
    PARTICLE_DIRT: '#d35400',
    PARTICLE_ROCK: '#7f8c8d'
  }
};

export const TileType = {
  EMPTY: 0,
  DIRT: 1,
  ROCK: 2,
  ITEM_HEAL: 3
} as const;

export type TileType = typeof TileType[keyof typeof TileType];
