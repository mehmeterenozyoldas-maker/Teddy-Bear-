import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';

const createTextTexture = (text: string, color: string, fontSize: number = 80) => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Slight shadow for depth
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

export default function Particles() {
  const mood = useStore((s) => s.mood);
  const groupRef = useRef<THREE.Group>(null);
  
  // Create textures for each mood
  const textureSleepy = useMemo(() => createTextTexture('Z', '#8bb4fa', 80), []);
  const textureLoving = useMemo(() => createTextTexture('❤', '#ff87a9', 60), []);
  const textureAngry = useMemo(() => createTextTexture('💢', '#f5564c', 60), []);
  const textureHyper = useMemo(() => createTextTexture('⚡', '#f9e2af', 60), []);

  const currentTexture = useMemo(() => {
    switch(mood) {
      case 'sleepy': return textureSleepy;
      case 'loving': return textureLoving;
      case 'angry': return textureAngry;
      case 'hyper': return textureHyper;
      default: return null; // No particles for neutral
    }
  }, [mood, textureSleepy, textureLoving, textureAngry, textureHyper]);

  const sprites = useRef<THREE.Sprite[]>([]);

  useEffect(() => {
    if (!groupRef.current) return;
    
    // Clear old sprites safely
    const children = [...groupRef.current.children];
    children.forEach(child => groupRef.current!.remove(child));
    sprites.current = [];
    
    if (!currentTexture) return;

    for(let i = 0; i < 15; i++) {
        const mat = new THREE.SpriteMaterial({ 
          map: currentTexture, 
          transparent: true, 
          opacity: 0,
          depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        
        sprite.position.set(
            (Math.random() - 0.5) * 2,
            Math.random() * 1.5 + 1.5,
            (Math.random() - 0.5) * 2
        );
        
        sprite.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                Math.random() * 0.8 + 0.4,
                (Math.random() - 0.5) * 0.5
            ),
            life: Math.random() * 2, // stagger start times
            maxLife: 1.5 + Math.random() * 1.5,
            scaleBase: Math.random() * 0.3 + 0.2
        };

        groupRef.current.add(sprite);
        sprites.current.push(sprite);
    }
  }, [currentTexture]);

  useFrame((state, delta) => {
    if (!groupRef.current || !currentTexture) return;
    
    sprites.current.forEach((sprite) => {
      const data = sprite.userData;
      data.life += delta;
      
      if (data.life > data.maxLife) {
        data.life = 0;
        sprite.position.set(
            (Math.random() - 0.5) * 1.5,
            1.5 + Math.random() * 0.5,
            (Math.random() - 0.5) * 1.5
        );
      }
      
      sprite.position.addScaledVector(data.velocity, delta);
      
      // Wobble X and Z
      sprite.position.x += Math.sin(state.clock.elapsedTime * 3 + data.maxLife) * delta * 0.5;
      sprite.position.z += Math.cos(state.clock.elapsedTime * 2 + data.life) * delta * 0.5;

      // Fade in and fade out
      const progress = data.life / data.maxLife;
      sprite.material.opacity = Math.sin(progress * Math.PI); 
      
      // Scale up over time
      const scale = data.scaleBase + progress * 0.2;
      sprite.scale.set(scale, scale, scale);
    });
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} />
  );
}
