import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export default function AudioManager() {
  const mood = useStore((s) => s.mood);
  const isHardwareTouched = useStore((s) => s.isHardwareTouched);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Resume or start AudioContext upon user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioCtxRef.current) {
         audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
         audioCtxRef.current.resume();
      }
      // Clean up event listeners after first init
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    
    window.addEventListener('click', initAudio);
    window.addEventListener('touchstart', initAudio);
    window.addEventListener('keydown', initAudio);
    
    return () => {
       window.removeEventListener('click', initAudio);
       window.removeEventListener('touchstart', initAudio);
       window.removeEventListener('keydown', initAudio);
    };
  }, []);

  const playSynthesizer = (type: OscillatorType, freqs: number[], duration: number, volume: number = 0.5) => {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended') return;
      const ctx = audioCtxRef.current;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(freqs[0], ctx.currentTime);
      if (freqs.length > 1) {
          osc.frequency.exponentialRampToValueAtTime(freqs[1], ctx.currentTime + duration);
      }
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + duration * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
  };

  // Play sound when touched
  useEffect(() => {
     if (!audioCtxRef.current) return;
     if (isHardwareTouched) {
         playSynthesizer('sine', [800, 1200], 0.3, 0.2);
     }
  }, [isHardwareTouched]);

  // Play sound on mood change
  useEffect(() => {
     if (!audioCtxRef.current) return;
     switch(mood) {
         case 'angry':
            playSynthesizer('sawtooth', [150, 50], 0.6, 0.4);
            break;
         case 'loving':
            playSynthesizer('sine', [400, 600], 0.5, 0.3);
            setTimeout(() => playSynthesizer('sine', [600, 800], 0.5, 0.3), 200);
            break;
         case 'sleepy':
            playSynthesizer('sine', [300, 200], 1.2, 0.2);
            break;
         case 'hyper':
            playSynthesizer('square', [600, 1000], 0.1, 0.1);
            setTimeout(() => playSynthesizer('square', [800, 1200], 0.2, 0.1), 100);
            setTimeout(() => playSynthesizer('square', [1000, 1400], 0.1, 0.1), 250);
            break;
         case 'neutral':
            playSynthesizer('sine', [400, 400], 0.2, 0.1);
            break;
     }
  }, [mood]);

  const activeMelody = useStore((s) => s.activeMelody);
  const setActiveMelody = useStore((s) => s.setActiveMelody);
  const sendSerialData = useStore((s) => s.sendSerialData);

  useEffect(() => {
    if (!activeMelody) return;
    
    const playSeq = async () => {
      const type = activeMelody;
      if (type === 'sparkle') {
        playSynthesizer('sine', [800, 800], 0.08, 0.2);
        await sendSerialData('V60\n');
        await new Promise(r => setTimeout(r, 100));
        
        playSynthesizer('sine', [1000, 1000], 0.08, 0.2);
        await sendSerialData('V60\n');
        await new Promise(r => setTimeout(r, 100));
        
        playSynthesizer('sine', [1300, 1300], 0.15, 0.25);
        await sendSerialData('V120\n');
      } else if (type === 'heartbeat') {
        playSynthesizer('triangle', [100, 100], 0.15, 0.4);
        await sendSerialData('V120\n');
        await new Promise(r => setTimeout(r, 220));
        
        playSynthesizer('triangle', [90, 90], 0.15, 0.4);
        await sendSerialData('V120\n');
      } else if (type === 'jolt') {
        playSynthesizer('sawtooth', [1500, 1500], 0.05, 0.3);
        await sendSerialData('V40\n');
        await new Promise(r => setTimeout(r, 70));
        
        playSynthesizer('sawtooth', [1500, 1500], 0.05, 0.3);
        await sendSerialData('V40\n');
        await new Promise(r => setTimeout(r, 70));
        
        playSynthesizer('sawtooth', [1500, 1500], 0.05, 0.3);
        await sendSerialData('V40\n');
        await new Promise(r => setTimeout(r, 70));
        
        playSynthesizer('sawtooth', [600, 300], 0.25, 0.35);
        await sendSerialData('V250\n');
      } else if (type === 'breeze') {
        playSynthesizer('sine', [350, 700], 0.6, 0.25);
        await sendSerialData('V500\n');
      }
      
      // Auto-reset active melody state in store
      setActiveMelody(null);
    };
    
    playSeq();
  }, [activeMelody, sendSerialData, setActiveMelody]);

  return null;
}
