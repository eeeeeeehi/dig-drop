
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
    PARTICLE_ROCK: '#7f8c8d',
    HARD_ROCK: '#5e6d6d', // Darker gray
    ITEM_BOMB: '#2c3e50', // Dark Gray/Black for Bomb
    ITEM_AMETHYST: '#9b59b6'   // Purple for Amethyst
  }
};

export const TileType = {
  EMPTY: 0,
  DIRT: 1,
  ROCK: 2,
  ITEM_HEAL: 3,
  ITEM_BOMB: 4,
  ITEM_AMETHYST: 5,
  HARD_ROCK: 6
} as const;

export type TileType = typeof TileType[keyof typeof TileType];

export const UPGRADES = {
  DRILL_SPEED: { baseCost: 10, factor: 1.5, maxLevel: 5, name: "Drill Speed" },
  MAX_HP: { baseCost: 50, factor: 2.0, maxLevel: 5, name: "Max HP" },
  BOMB_MAX: { baseCost: 30, factor: 1.5, maxLevel: 3, name: "Bomb Max" },
  FEVER_TIME: { baseCost: 20, factor: 1.5, maxLevel: 5, name: "Fever Time" },
  MAGNET: { baseCost: 15, factor: 2.0, maxLevel: 3, name: "Magnet" }
};
