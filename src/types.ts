export type GameState = 'START' | 'PLAYING' | 'WON' | 'LOST';

export interface Point {
  x: number;
  y: number;
}

export interface Rocket {
  id: string;
  start: Point;
  current: Point;
  target: Point;
  speed: number;
  color: string;
}

export interface Interceptor {
  id: string;
  start: Point;
  current: Point;
  target: Point;
  speed: number;
  state: 'FLYING' | 'EXPLODING';
  explosionRadius: number;
  maxExplosionRadius: number;
}

export interface City {
  id: number;
  x: number;
  alive: boolean;
}

export interface Battery {
  id: number;
  x: number;
  ammo: number;
  maxAmmo: number;
  alive: boolean;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number; // 0 to 1
  isHeart?: boolean;
}
