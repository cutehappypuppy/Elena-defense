/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Info, Languages } from 'lucide-react';
import { GameState, Rocket, Interceptor, City, Battery, Explosion, Point } from './types';

const CANV_WIDTH = 800;
const CANV_HEIGHT = 600;

const COLORS = {
  bg: '#050505',
  ground: '#222222',
  city: '#3b82f6',
  battery: '#a855f7', // Purple
  rocket: '#ef4444',
  interceptor: '#ec4899', // Pink
  explosion: ['#f59e0b', '#ef4444', '#ffffff'],
  text: '#ffffff',
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  
  // Game Objects
  const rocketsRef = useRef<Rocket[]>([]);
  const interceptorsRef = useRef<Interceptor[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const batteriesRef = useRef<Battery[]>([]);
  
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const frameIdRef = useRef<number>(0);
  const rocketsSpawnedRef = useRef<number>(0);

  const t = {
    zh: {
      title: 'Elena新星防御',
      start: '开始游戏',
      win: '恭喜！你成功保卫了地球',
      lose: '所有防御塔已被摧毁或敌方弹药耗尽',
      restart: '再玩一次',
      score: '得分',
      target: '目标',
      ammo: '弹药',
      enemy: '敌方',
      tips: '点击屏幕拦截敌方火箭。预判它们的路径！',
    },
    en: {
      title: 'Elena Nova Defense',
      start: 'Start Game',
      win: 'Victory! Earth is Safe',
      lose: 'All Batteries Destroyed or Enemy Ammo Depleted',
      restart: 'Play Again',
      score: 'Score',
      target: 'Target',
      ammo: 'Ammo',
      enemy: 'Enemy',
      tips: 'Click to intercept rockets. Predict their path!',
    }
  }[lang];

  const [tips, setTips] = useState<string>('');

  useEffect(() => {
    const fetchTips = async () => {
      const { getGameTips } = await import('./services/geminiService');
      const result = await getGameTips(lang);
      if (result) setTips(result);
    };
    fetchTips();
  }, [lang]);

  const initGame = useCallback(() => {
    setScore(0);
    rocketsRef.current = [];
    interceptorsRef.current = [];
    explosionsRef.current = [];
    
    // 6 Cities
    const cities: City[] = [];
    const cityWidth = 40;
    const spacing = (CANV_WIDTH - 200) / 7;
    for (let i = 0; i < 6; i++) {
      cities.push({
        id: i,
        x: 100 + (i + 1) * spacing,
        alive: true
      });
    }
    citiesRef.current = cities;

    // 3 Batteries - Total 50 ammo (15 + 20 + 15)
    batteriesRef.current = [
      { id: 0, x: 40, ammo: 15, maxAmmo: 15, alive: true },
      { id: 1, x: CANV_WIDTH / 2, ammo: 20, maxAmmo: 20, alive: true },
      { id: 2, x: CANV_WIDTH - 40, ammo: 15, maxAmmo: 15, alive: true },
    ];
    
    rocketsSpawnedRef.current = 0;
    setGameState('PLAYING');
  }, []);

  const spawnRocket = useCallback(() => {
    if (rocketsSpawnedRef.current >= 50) return;

    const targets = [...citiesRef.current.filter(c => c.alive), ...batteriesRef.current.filter(b => b.alive)];
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const targetPoint: Point = 'id' in target && typeof target.id === 'number' && 'x' in target 
      ? { x: target.x, y: CANV_HEIGHT - 20 } 
      : { x: Math.random() * CANV_WIDTH, y: CANV_HEIGHT - 20 };

    const rocket: Rocket = {
      id: Math.random().toString(36).substr(2, 9),
      start: { x: Math.random() * CANV_WIDTH, y: 0 },
      current: { x: Math.random() * CANV_WIDTH, y: 0 },
      target: targetPoint,
      speed: 0.2 + Math.random() * 0.2 + (score / 3000),
      color: COLORS.rocket,
    };
    rocket.current = { ...rocket.start };
    rocketsRef.current.push(rocket);
    rocketsSpawnedRef.current += 1;
  }, [score]);

  const fireInterceptor = (x: number, y: number) => {
    if (gameState !== 'PLAYING') return;

    // Find closest battery with ammo
    const availableBatteries = batteriesRef.current
      .filter(b => b.alive && b.ammo > 0)
      .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));

    if (availableBatteries.length === 0) return;

    const battery = availableBatteries[0];
    battery.ammo -= 1;

    const interceptor: Interceptor = {
      id: Math.random().toString(36).substr(2, 9),
      start: { x: battery.x, y: CANV_HEIGHT - 30 },
      current: { x: battery.x, y: CANV_HEIGHT - 30 },
      target: { x, y },
      speed: 4,
      state: 'FLYING',
      explosionRadius: 0,
      maxExplosionRadius: 40,
    };
    interceptorsRef.current.push(interceptor);
  };

  const update = (deltaTime: number) => {
    if (gameState !== 'PLAYING') return;

    // Spawn rockets
    spawnTimerRef.current += deltaTime;
    const spawnInterval = Math.max(300, 1200 - (score * 1.2));
    if (spawnTimerRef.current > spawnInterval) {
      spawnRocket();
      spawnTimerRef.current = 0;
    }

    // Update Rockets
    rocketsRef.current.forEach((r, idx) => {
      const dx = r.target.x - r.current.x;
      const dy = r.target.y - r.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 5) {
        // Hit target
        explosionsRef.current.push({
          id: 'exp-' + r.id,
          x: r.current.x,
          y: r.current.y,
          radius: 0,
          maxRadius: 30,
          life: 1,
          isHeart: false
        });
        
        // Check what it hit
        citiesRef.current.forEach(c => {
          if (c.alive && Math.abs(c.x - r.current.x) < 25) c.alive = false;
        });
        batteriesRef.current.forEach(b => {
          if (b.alive && Math.abs(b.x - r.current.x) < 25) b.alive = false;
        });

        rocketsRef.current.splice(idx, 1);
      } else {
        r.current.x += (dx / dist) * r.speed;
        r.current.y += (dy / dist) * r.speed;
      }
    });

    // Update Interceptors
    interceptorsRef.current.forEach((inter, idx) => {
      if (inter.state === 'FLYING') {
        const dx = inter.target.x - inter.current.x;
        const dy = inter.target.y - inter.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
          inter.state = 'EXPLODING';
          explosionsRef.current.push({
            id: 'exp-' + inter.id,
            x: inter.target.x,
            y: inter.target.y,
            radius: 0,
            maxRadius: inter.maxExplosionRadius,
            life: 1,
            isHeart: true
          });
          interceptorsRef.current.splice(idx, 1);
        } else {
          inter.current.x += (dx / dist) * inter.speed;
          inter.current.y += (dy / dist) * inter.speed;
        }
      }
    });

    // Update Explosions
    explosionsRef.current.forEach((exp, idx) => {
      exp.life -= 0.015;
      if (exp.life <= 0) {
        explosionsRef.current.splice(idx, 1);
      } else {
        exp.radius = exp.maxRadius * (1 - Math.pow(1 - exp.life, 2));
        
        // Check collision with rockets
        rocketsRef.current.forEach((r, rIdx) => {
          const dx = r.current.x - exp.x;
          const dy = r.current.y - exp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < exp.radius) {
            rocketsRef.current.splice(rIdx, 1);
            setScore(s => {
              const newScore = s + 20;
              if (newScore >= 1000) setGameState('WON');
              return newScore;
            });
          }
        });
      }
    });

    // Check Loss Condition
    if (batteriesRef.current.every(b => !b.alive)) {
      setGameState('LOST');
    }

    // Check if all rockets are spent and none are left on screen
    if (rocketsSpawnedRef.current >= 50 && rocketsRef.current.length === 0 && score < 1000 && gameState === 'PLAYING') {
      setGameState('LOST');
    }
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    // Draw Background Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, CANV_WIDTH, CANV_HEIGHT);
    bgGradient.addColorStop(0, '#0f172a'); // Deep blue
    bgGradient.addColorStop(1, '#4c0519'); // Deep pink/maroon
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANV_WIDTH, CANV_HEIGHT);

    // Draw Ground
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, CANV_HEIGHT - 20, CANV_WIDTH, 20);

    // Draw Cities
    citiesRef.current.forEach(c => {
      if (c.alive) {
        ctx.fillStyle = COLORS.city;
        ctx.fillRect(c.x - 15, CANV_HEIGHT - 35, 30, 15);
        ctx.fillRect(c.x - 10, CANV_HEIGHT - 45, 20, 10);
      }
    });

    // Draw Batteries
    batteriesRef.current.forEach(b => {
      if (b.alive) {
        ctx.fillStyle = COLORS.battery;
        ctx.beginPath();
        ctx.moveTo(b.x - 25, CANV_HEIGHT - 20);
        ctx.lineTo(b.x + 25, CANV_HEIGHT - 20);
        ctx.lineTo(b.x + 15, CANV_HEIGHT - 45);
        ctx.lineTo(b.x - 15, CANV_HEIGHT - 45);
        ctx.closePath();
        ctx.fill();
        
        // Ammo indicator
        ctx.fillStyle = COLORS.text;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(b.ammo.toString(), b.x, CANV_HEIGHT - 50);
      }
    });

    // Draw Rockets
    rocketsRef.current.forEach(r => {
      // Draw predictive dotted line
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(r.current.x, r.current.y);
      ctx.lineTo(r.target.x, r.target.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);

      // Draw trail
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(r.start.x, r.start.y);
      ctx.lineTo(r.current.x, r.current.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Missile Shape
      const dx = r.target.x - r.current.x;
      const dy = r.target.y - r.current.y;
      const angle = Math.atan2(dy, dx);

      ctx.save();
      ctx.translate(r.current.x, r.current.y);
      ctx.rotate(angle);
      
      // Missile Body
      ctx.fillStyle = r.color;
      ctx.fillRect(-8, -3, 12, 6);
      
      // Tip
      ctx.beginPath();
      ctx.moveTo(4, -3);
      ctx.lineTo(10, 0);
      ctx.lineTo(4, 3);
      ctx.fill();

      // Fins
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-11, -6);
      ctx.lineTo(-6, -3);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-8, 3);
      ctx.lineTo(-11, 6);
      ctx.lineTo(-6, 3);
      ctx.fill();

      ctx.restore();
    });

    // Draw Interceptors
    interceptorsRef.current.forEach(inter => {
      ctx.strokeStyle = COLORS.interceptor;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(inter.start.x, inter.start.y);
      ctx.lineTo(inter.current.x, inter.current.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Interceptor head
      ctx.fillStyle = COLORS.interceptor;
      ctx.beginPath();
      ctx.arc(inter.current.x, inter.current.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Target X
      ctx.strokeStyle = COLORS.interceptor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(inter.target.x - 4, inter.target.y - 4);
      ctx.lineTo(inter.target.x + 4, inter.target.y + 4);
      ctx.moveTo(inter.target.x + 4, inter.target.y - 4);
      ctx.lineTo(inter.target.x - 4, inter.target.y + 4);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      if (exp.isHeart) {
        ctx.fillStyle = `rgba(236, 72, 153, ${exp.life})`; // Pink
        const size = exp.radius * 1.5;
        
        ctx.save();
        ctx.translate(exp.x, exp.y - size * 0.4);
        ctx.beginPath();
        ctx.moveTo(0, size / 4);
        ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, size / 4);
        ctx.bezierCurveTo(-size / 2, size / 2, 0, size * 0.8, 0, size);
        ctx.bezierCurveTo(0, size * 0.8, size / 2, size / 2, size / 2, size / 4);
        ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, size / 4);
        ctx.fill();
        ctx.restore();
      } else {
        const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
        gradient.addColorStop(0, COLORS.explosion[2]);
        gradient.addColorStop(0.5, COLORS.explosion[1]);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.globalAlpha = exp.life;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (time: number) => {
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      update(deltaTime);
      draw(ctx);

      frameIdRef.current = requestAnimationFrame(loop);
    };

    frameIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [gameState, draw]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = CANV_WIDTH / rect.width;
    const scaleY = CANV_HEIGHT / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    fireInterceptor(x, y);
  };

  return (
    <div className="game-container flex flex-col items-center justify-center p-4" ref={containerRef}>
      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-10">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex gap-8">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-2">
              <Trophy size={12} /> {t.score}
            </div>
            <div className="text-3xl font-display font-bold text-white tabular-nums">
              {score.toString().padStart(4, '0')}
            </div>
            <div className="mt-2 w-32 bg-zinc-800 h-1 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${(score / 1000) * 100}%` }}
              />
            </div>
          </div>

          <div className="border-l border-white/10 pl-8">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-2">
              <Target size={12} /> {t.enemy}
            </div>
            <div className="text-3xl font-display font-bold text-red-500 tabular-nums">
              {(50 - rocketsSpawnedRef.current).toString().padStart(2, '0')}
            </div>
          </div>

          <div className="border-l border-white/10 pl-8">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-2">
              <Shield size={12} /> {t.ammo}
            </div>
            <div className="text-3xl font-display font-bold text-emerald-500 tabular-nums">
              {batteriesRef.current.reduce((acc, b) => acc + (b.alive ? b.ammo : 0), 0).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pointer-events-auto">
          <button 
            onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
            className="bg-black/60 backdrop-blur-md border border-white/10 p-2 rounded-full text-white hover:bg-white/10 transition-colors"
          >
            <Languages size={20} />
          </button>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="relative aspect-[4/3] w-full max-w-4xl border-2 border-zinc-800 rounded-xl overflow-hidden shadow-2xl shadow-blue-900/20">
        <canvas
          ref={canvasRef}
          width={CANV_WIDTH}
          height={CANV_HEIGHT}
          onMouseDown={handleCanvasClick}
          onTouchStart={(e) => {
            e.preventDefault();
            handleCanvasClick(e);
          }}
          className="w-full h-full cursor-crosshair"
        />

        {/* Overlays */}
        <AnimatePresence>
          {gameState !== 'PLAYING' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 text-center"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md"
              >
                <h1 className="text-5xl font-display font-bold mb-4 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
                  {gameState === 'START' ? t.title : gameState === 'WON' ? t.win : t.lose}
                </h1>
                
                <p className="text-zinc-400 mb-8 text-lg leading-relaxed">
                  {tips || t.tips}
                </p>

                <button
                  onClick={initGame}
                  className="group relative px-8 py-4 bg-blue-600 text-white rounded-full font-bold text-xl hover:bg-blue-500 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto shadow-lg shadow-blue-600/40"
                >
                  {gameState === 'START' ? <Target /> : <RotateCcw />}
                  {gameState === 'START' ? t.start : t.restart}
                </button>

                {gameState !== 'START' && (
                  <div className="mt-8 text-zinc-500 flex items-center justify-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-tighter">{t.score}</span>
                      <span className="text-2xl font-display text-white">{score}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls Info */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
        <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
            <Shield size={20} />
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Defend</div>
            <div className="text-sm text-zinc-300">{lang === 'zh' ? '保护城市免受火箭袭击' : 'Protect cities from rockets'}</div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Target size={20} />
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Aim</div>
            <div className="text-sm text-zinc-300">{lang === 'zh' ? '点击屏幕发射拦截导弹' : 'Click to fire interceptors'}</div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
            <Info size={20} />
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Strategy</div>
            <div className="text-sm text-zinc-300">{lang === 'zh' ? '预判敌方火箭的路径' : 'Predict enemy rocket paths'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
