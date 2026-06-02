import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { 
  Cpu, Sliders, Terminal, Sun, Moon, Wifi, WifiOff, Zap, 
  Trash2, Play, Sparkles, Activity, ShieldAlert, Layers,
  Smile, Eye, Volume2, Plus, ArrowRight
} from 'lucide-react';

export default function PhysicalSandbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [customCommand, setCustomCommand] = useState('');
  const [simulatedVibration, setSimulatedVibration] = useState(0);

  // Webcam Landmark simulation state
  const [isFaceSim, setIsFaceSim] = useState(false);
  const [blinkL, setBlinkL] = useState(0);
  const [blinkR, setBlinkR] = useState(0);
  const [smileL, setSmileL] = useState(0);
  const [smileR, setSmileR] = useState(0);
  const [mouthOpenVal, setMouthOpenVal] = useState(0);
  const [browUpVal, setBrowUpVal] = useState(0);
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);

  // Custom Interactive Sequential Editor Steps
  const [customSteps, setCustomSteps] = useState([
    { frequency: 600, duration: 150 },
    { frequency: 900, duration: 150 },
    { frequency: 1200, duration: 300 }
  ]);

  const setFaceSimulated = useStore((s) => s.setFaceSimulated);
  const setBlendshapes = useStore((s) => s.setBlendshapes);
  const setHeadRotation = useStore((s) => s.setHeadRotation);
  const setActiveMelody = useStore((s) => s.setActiveMelody);
  const sendSerialData = useStore((s) => s.sendSerialData);

  // Sync simulator sliders to global store
  useEffect(() => {
    setFaceSimulated(isFaceSim);
    if (isFaceSim) {
      setBlendshapes({
        eyeBlinkLeft: blinkL,
        eyeBlinkRight: blinkR,
        mouthSmileLeft: smileL,
        mouthSmileRight: smileR,
        mouthOpen: mouthOpenVal,
        browInnerUp: browUpVal,
        browOuterUpLeft: browUpVal * 0.5,
        browOuterUpRight: browUpVal * 0.5,
      });
      setHeadRotation({ x: rotX, y: rotY, z: 0 });
    }
  }, [isFaceSim, blinkL, blinkR, smileL, smileR, mouthOpenVal, browUpVal, rotX, rotY, setFaceSimulated, setBlendshapes, setHeadRotation]);

  // Audio synther for Custom Seq playback trigger
  const playStepTone = (freq: number, durMs: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.type = 'triangle';
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + durMs / 1000);
    } catch (e) {
      console.error(e);
    }
  };

  const playCustomMelodySequence = async () => {
    for (const s of customSteps) {
      if (s.frequency > 0) {
        playStepTone(s.frequency, s.duration);
      }
      if (s.duration > 0) {
        await sendSerialData(`V${s.duration}\n`);
      }
      await new Promise(r => setTimeout(r, s.duration + 100));
    }
  };

  const ambientLight = useStore((s) => s.ambientLight);
  const userDistance = useStore((s) => s.userDistance);
  const isHardwareTouched = useStore((s) => s.isHardwareTouched);
  const mood = useStore((s) => s.mood);
  const serialStatus = useStore((s) => s.serialStatus);
  const serialLogs = useStore((s) => s.serialLogs);
  const qualityMode = useStore((s) => s.qualityMode);

  const setAmbientLight = useStore((s) => s.setAmbientLight);
  const setUserDistance = useStore((s) => s.setUserDistance);
  const setIsHardwareTouched = useStore((s) => s.setIsHardwareTouched);
  const setMood = useStore((s) => s.setMood);
  const addSerialLog = useStore((s) => s.addSerialLog);
  const clearSerialLogs = useStore((s) => s.clearSerialLogs);
  const setQualityMode = useStore((s) => s.setQualityMode);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [serialLogs]);

  // Read outgoing haptic commands to animate the virtual vibrator
  useEffect(() => {
    if (serialLogs.length === 0) return;
    const latestLog = serialLogs[serialLogs.length - 1];
    if (latestLog.dir === 'TX' && latestLog.text.startsWith('V')) {
      const vVal = parseInt(latestLog.text.substring(1), 10);
      if (!isNaN(vVal)) {
        setSimulatedVibration(vVal);
        // Slowly decay the vibration visualization
        const timer = setTimeout(() => {
          setSimulatedVibration(0);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [serialLogs]);

  const dispatchRX = (trimmed: string) => {
    addSerialLog('RX', trimmed);
    
    if (trimmed.startsWith('TUI:')) {
      const newMood = trimmed.substring(4).toLowerCase();
      if (['neutral', 'hyper', 'sleepy', 'loving', 'angry'].includes(newMood)) {
        setMood(newMood as any);
      }
    } else if (trimmed.startsWith('ENV:')) {
      const parts = trimmed.substring(4).split(',');
      if (parts.length === 2) {
        const l = parseInt(parts[0], 10);
        const d = parseInt(parts[1], 10);
        if (!isNaN(l)) setAmbientLight(l);
        if (!isNaN(d)) setUserDistance(d);

        const threshold = useStore.getState().nightModeLightThreshold;
        if (!isNaN(l) && l < threshold) { 
          setMood('sleepy');
        } else if (useStore.getState().mood === 'sleepy' && !isNaN(l) && l > threshold + 100) {
          setMood('neutral');
        }
      }
    } else if (trimmed.startsWith('TOUCH:')) {
      const touched = trimmed.substring(6) === '1';
      setIsHardwareTouched(touched);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCommand.trim()) return;
    dispatchRX(customCommand.trim().toUpperCase());
    setCustomCommand('');
  };

  const simulateRFIDScan = (tokenID: string, title: string) => {
    dispatchRX(`TUI:${tokenID}`);
    // Simulate serial acknowledgement packet
    setTimeout(() => {
      addSerialLog('RX', `ACK: LOADED_TOKEN_${tokenID}`);
    }, 150);
  };

  return (
    <>
      {/* Floating Toggle Icon */}
      {!isOpen && (
        <button
          id="sandbox-toggle-btn"
          onClick={() => setIsOpen(true)}
          className="fixed top-4 right-4 z-[1001] bg-zinc-900/80 text-white hover:bg-indigo-600 border border-zinc-700/80 backdrop-blur-sm p-3 rounded-full shadow-xl transition-all duration-300 flex items-center gap-2 font-medium group"
        >
          <div className={`p-0 rounded-full text-white transition-colors`}>
            <Cpu size={24} className={isOpen ? 'animate-pulse' : ''} />
          </div>
        </button>
      )}

      {/* Sidebar Sandbox */}
      <div
        id="sandbox-sidebar"
        className={`fixed top-0 right-0 h-screen w-88 bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800/90 shadow-2xl text-zinc-100 z-[1000] flex flex-col transition-all duration-300 overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="text-indigo-400" size={20} />
            <div>
              <h2 className="font-semibold text-sm tracking-wide text-zinc-200 uppercase">Hardware Sandbox</h2>
              <p className="text-[10px] text-zinc-400">Physical & Biometric Simulation Suite</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-1 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>

        {/* Scrollable Panel Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 select-none scrollbar-thin scrollbar-thumb-zinc-800">
          
          {/* Section: Device Status */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider">Device Connection</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1.5 ${
                serialStatus === 'connected' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : serialStatus === 'handshaking'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                  : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
              }`}>
                {serialStatus === 'connected' ? (
                  <>
                    <Wifi size={10} /> Active Hardware
                  </>
                ) : serialStatus === 'handshaking' ? (
                  <>
                    <Zap size={10} /> Handshaking
                  </>
                ) : (
                  <>
                    <WifiOff size={10} /> Emulated State
                  </>
                )}
              </span>
            </div>
            
            {serialStatus !== 'connected' && (
              <div className="flex items-start gap-2 bg-indigo-505/10 bg-zinc-900 border border-indigo-500/20 p-2.5 rounded-lg text-[11px] text-indigo-300">
                <ShieldAlert size={14} className="shrink-0 text-indigo-400 mt-0.5" />
                <span>
                  No hardware connected. Touch sensor, LDR light, and distance loops are falling back to high-fidelity virtual emulation.
                </span>
              </div>
            )}
          </div>

          {/* Section: Low-end Performance profiling (Phase 5) */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center gap-2">
              <Layers size={12} className="text-zinc-400" />
              Quality & Performance (Phase 5)
            </label>
            <div className="grid grid-cols-3 gap-1 bg-zinc-900 border border-zinc-800/80 p-1 rounded-lg">
              <button
                onClick={() => setQualityMode('cinematic')}
                className={`py-1.5 text-[10px] rounded-md transition-all font-medium ${
                  qualityMode === 'cinematic' 
                    ? 'bg-indigo-600 text-white font-semibold' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
                }`}
              >
                Cinematic
              </button>
              <button
                onClick={() => setQualityMode('standard')}
                className={`py-1.5 text-[10px] rounded-md transition-all font-medium ${
                  qualityMode === 'standard' 
                    ? 'bg-indigo-600 text-white font-semibold' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setQualityMode('powersave')}
                className={`py-1.5 text-[10px] rounded-md transition-all font-medium ${
                  qualityMode === 'powersave' 
                    ? 'bg-indigo-600 text-white font-semibold' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
                }`}
              >
                Mobile / Saver
              </button>
            </div>
            <p className="text-[9px] text-zinc-400 px-1 leading-relaxed">
              {qualityMode === 'powersave' && '🔋 Lowered shell count to 6. Saves up to 60% GP cycles. Perfect for low-end machines.'}
              {qualityMode === 'standard' && '⚡ Moderate shell depth of 12. Ideal for consistent 60 FPS rendering.'}
              {qualityMode === 'cinematic' && '🎬 Ultra-plush 18-shell volumetric rendering. Generates dense volumetric fur layers.'}
            </p>
          </div>

          {/* Section: Interactive Sensor Sliders */}
          <div className="space-y-3.5 bg-zinc-900/30 p-3.1 rounded-xl border border-zinc-800">
            <span className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center gap-1.5">
              <Sliders size={12} className="text-indigo-400" />
              Sensor Signals Override
            </span>

            {/* Light LDR */}
            <div className="space-y-1.5 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 flex items-center gap-1">
                  {ambientLight < 200 ? <Moon size={12} className="text-indigo-400" /> : <Sun size={12} className="text-amber-400 animate-spin-slow" />}
                  Ambient Light (LDR)
                </span>
                <span className="text-zinc-400 font-mono text-[11px] bg-zinc-950 px-1.5 py-0.5 rounded">{ambientLight} / 1023</span>
              </div>
              <input 
                type="range"
                min="0"
                max="1023"
                value={ambientLight}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  dispatchRX(`ENV:${val},${userDistance}`);
                }}
                className="w-full accent-indigo-500 h-1 rounded-lg cursor-pointer bg-zinc-800"
              />
              <div className="flex justify-between text-[8px] text-zinc-500 font-mono">
                <span>0 (DARKNESS)</span>
                <span>200 (THRESHOLD)</span>
                <span>1023 (BRIGHT)</span>
              </div>
            </div>

            {/* Proximity Distance */}
            <div className="space-y-1.5 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 flex items-center gap-1">
                  <Activity size={12} className="text-indigo-400" />
                  User Distance (Ultrasonic)
                </span>
                <span className="text-zinc-400 font-mono text-[11px] bg-zinc-950 px-1.5 py-0.5 rounded">{userDistance} cm</span>
              </div>
              <input 
                type="range"
                min="5"
                max="200"
                value={userDistance}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  dispatchRX(`ENV:${ambientLight},${val}`);
                }}
                className="w-full accent-indigo-500 h-1 rounded-lg cursor-pointer bg-zinc-800"
              />
              <div className="flex justify-between text-[8px] text-zinc-500 font-mono w-full">
                <span>5 cm (IN DESK)</span>
                <span>80 cm (FOCUS ALIGN)</span>
                <span>200 cm (FAR AWAY)</span>
              </div>
            </div>

            {/* Tactile Touch Sensor TTP223 Simulation */}
            <div className="space-y-1 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60">
              <label className="text-xs text-zinc-300 flex items-center gap-1">
                <Sparkles size={12} className="text-indigo-400" />
                Capacitive Touch Pin 
              </label>
              <button
                onMouseDown={() => dispatchRX('TOUCH:1')}
                onMouseUp={() => dispatchRX('TOUCH:0')}
                onMouseLeave={() => { if (isHardwareTouched) dispatchRX('TOUCH:0'); }}
                onTouchStart={(e) => { e.preventDefault(); dispatchRX('TOUCH:1'); }}
                onTouchEnd={(e) => { e.preventDefault(); dispatchRX('TOUCH:0'); }}
                className={`w-full py-2.5 rounded-lg text-xs font-semibold cursor-pointer active:scale-98 select-none transition-all border ${
                  isHardwareTouched 
                    ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-500/20' 
                    : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-300'
                }`}
              >
                {isHardwareTouched ? 'TOUCHING ACTUATOR PIN...' : 'HOLD TO TOUCH COMPANION'}
              </button>
              <p className="text-[9px] text-zinc-500 text-center select-none pt-1">
                Pin triggers a responsive chord synthesized in the audio engine!
              </p>
            </div>
          </div>

          {/* Section: Simulated Face Landmarks (Phase 6, Task 3) */}
          <div className="space-y-3 bg-zinc-900/30 p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center gap-1.5">
                <Smile size={12} className="text-indigo-400" />
                Face Landmark Simulation
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isFaceSim} 
                  onChange={(e) => setIsFaceSim(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-zinc-350 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-1.5 text-[10px] font-medium text-zinc-400">{isFaceSim ? 'Active' : 'Muted'}</span>
              </label>
            </div>

            {isFaceSim ? (
              <div className="space-y-2.5 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/50">
                {/* Blink slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span className="flex items-center gap-1"><Eye size={10} /> Blink Tracks (L/R)</span>
                    <span className="font-mono text-[9px]">{blinkL.toFixed(2)} | {blinkR.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-1">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05"
                      value={blinkL} 
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setBlinkL(v);
                        setBlinkR(v); // sync left and right eyelids for speed
                      }}
                      className="w-full accent-indigo-500 h-1 rounded bg-zinc-800"
                    />
                  </div>
                </div>

                {/* Smile slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span className="flex items-center gap-1"><Smile size={10} /> Smile Tracks (L/R)</span>
                    <span className="font-mono text-[9px]">{smileL.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={smileL} 
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setSmileL(v);
                      setSmileR(v);
                    }}
                    className="w-full accent-indigo-500 h-1 rounded bg-zinc-800"
                  />
                </div>

                {/* Mouth Open */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Mouth Open (JawOpen)</span>
                    <span className="font-mono text-[9px]">{mouthOpenVal.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={mouthOpenVal} 
                    onChange={(e) => setMouthOpenVal(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-zinc-800"
                  />
                </div>

                {/* Brow Lift */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Brow Inner/Outer Lift</span>
                    <span className="font-mono text-[9px]">{browUpVal.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={browUpVal} 
                    onChange={(e) => setBrowUpVal(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-zinc-800"
                  />
                </div>

                {/* Face rotation tilt: rotX */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Face Tilt (X-Axis Rotation)</span>
                    <span className="font-mono text-[9px]">{(rotX * 180 / Math.PI).toFixed(1)}°</span>
                  </div>
                  <input 
                    type="range" 
                    min="-0.5" 
                    max="0.5" 
                    step="0.01"
                    value={rotX} 
                    onChange={(e) => setRotX(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-zinc-800"
                  />
                </div>

                {/* Face rotation pan: rotY */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Face Pan (Y-Axis Rotation)</span>
                    <span className="font-mono text-[9px]">{(rotY * 180 / Math.PI).toFixed(1)}°</span>
                  </div>
                  <input 
                    type="range" 
                    min="-0.6" 
                    max="0.6" 
                    step="0.01"
                    value={rotY} 
                    onChange={(e) => setRotY(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded bg-zinc-800"
                  />
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-500 italic text-center py-2 select-text">
                Enable sim to bypass hardware or Mediapipe webcam and directly slide biometric triggers.
              </p>
            )}
          </div>

          {/* Section: Composed Vibro-Melody Soundscapes (Phase 6, Task 2) */}
          <div className="space-y-3 bg-zinc-900/30 p-3 rounded-xl border border-zinc-800">
            <span className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center gap-1.5">
              <Volume2 size={12} className="text-indigo-400" />
              Composed Vibro-Melodies
            </span>

            {/* Premade triggers */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { name: '🪄 Sparkle Chime', id: 'sparkle', desc: 'Arpeggios + flickers' },
                { name: '💓 Heart Thump', id: 'heartbeat', desc: 'Low bass + heartbeat' },
                { name: '🚨 Alert Jolt', id: 'jolt', desc: 'Chiptune + alarm vibe' },
                { name: '🍃 Calm Breeze', id: 'breeze', desc: 'Slow sweep + soft buzz' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveMelody(m.id)}
                  className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700/80 p-2 rounded-lg text-left text-[11px] font-semibold flex flex-col transition-all cursor-pointer group active:scale-98"
                >
                  <span className="text-zinc-200 flex items-center gap-1">
                    {m.name}
                  </span>
                  <span className="text-[8px] text-zinc-500 group-hover:text-zinc-400 font-normal mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>

            {/* Interactive Composer Editor */}
            <div className="bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-850 space-y-2">
              <span className="text-[10px] font-semibold text-indigo-400 flex items-center gap-1">
                Custom Vibro-Melody Composer
              </span>
              
              <div className="space-y-2">
                {customSteps.map((step, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-zinc-900/60 p-1.5 rounded border border-zinc-855">
                    <span className="text-[9px] font-mono font-bold text-zinc-500 shrink-0">S{idx + 1}</span>
                    
                    {/* Freq edit */}
                    <div className="flex-1 space-y-0.5">
                      <div className="flex justify-between text-[8px] text-zinc-450 font-mono">
                        <span>Freq</span>
                        <span>{step.frequency} Hz</span>
                      </div>
                      <input 
                        type="range"
                        min="80"
                        max="2000"
                        step="10"
                        value={step.frequency}
                        onChange={(e) => {
                          const newSteps = [...customSteps];
                          newSteps[idx].frequency = parseInt(e.target.value, 10);
                          setCustomSteps(newSteps);
                        }}
                        className="w-full accent-indigo-500 h-1 bg-zinc-850"
                      />
                    </div>

                    {/* Duty/Duration edit */}
                    <div className="flex-1 space-y-0.5">
                      <div className="flex justify-between text-[8px] text-zinc-450 font-mono">
                        <span>Pulse</span>
                        <span>{step.duration} ms</span>
                      </div>
                      <input 
                        type="range"
                        min="20"
                        max="500"
                        step="10"
                        value={step.duration}
                        onChange={(e) => {
                          const newSteps = [...customSteps];
                          newSteps[idx].duration = parseInt(e.target.value, 10);
                          setCustomSteps(newSteps);
                        }}
                        className="w-full accent-indigo-500 h-1 bg-zinc-855 animate-pulse"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={playCustomMelodySequence}
                className="w-full py-1.5 bg-linear-to-r from-indigo-700 to-indigo-600 hover:from-indigo-600 hover:to-indigo-500 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 shadow-md cursor-pointer select-none transition-all active:scale-98"
              >
                <Play size={10} className="fill-white" />
                Play & Transmit Sequence
              </button>
            </div>
          </div>

          {/* Section: RFID Token Slat Stream Simulation */}
          <div className="space-y-2 bg-zinc-900/30 p-3 rounded-xl border border-zinc-800">
            <span className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center gap-1.5">
              <Layers size={12} className="text-indigo-400" />
              Simulated RFID Tokens Insertion
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'NEUTRAL', color: 'border-zinc-700 hover:bg-zinc-800 text-zinc-300', icon: '⚪' },
                { id: 'SLEEPY', color: 'border-blue-800/50 hover:bg-blue-900/20 text-blue-300', icon: '💤' },
                { id: 'HYPER', color: 'border-amber-700/50 hover:bg-amber-900/20 text-amber-300', icon: '⚡' },
                { id: 'LOVING', color: 'border-rose-850 hover:bg-rose-900/20 text-rose-300', icon: '💖' },
                { id: 'ANGRY', color: 'border-red-800/50 hover:bg-red-900/20 text-red-400', icon: '😡' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => simulateRFIDScan(t.id, t.id)}
                  className={`border border-solid p-2 rounded-lg text-left text-[11px] font-medium transition-all hover:scale-[1.02] flex items-center gap-1.5 ${t.color}`}
                >
                  <span className="text-xs">{t.icon}</span>
                  <span>{t.id}</span>
                </button>
              ))}
            </div>
            <p className="text-[8px] text-zinc-500 text-center pt-1">
              Simulates inserting tangible token plates into the hardware docking tray.
            </p>
          </div>

          {/* Section: Coin Vibration Haptic Visualizer */}
          {simulatedVibration > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 space-y-1 animate-pulse select-none">
              <div className="flex justify-between text-xs text-rose-400 font-semibold items-center">
                <span className="flex items-center gap-1">
                  <Activity size={12} className="animate-spin" />
                  HAPTIC FEEDBACK WAVE ACTIVE
                </span>
                <span className="font-mono">{simulatedVibration} mA</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded overflow-hidden mt-1 flex items-center">
                <div 
                  className="bg-rose-500 h-full rounded transition-all duration-300" 
                  style={{ width: `${(simulatedVibration / 255) * 100}%` }}
                />
              </div>
              <p className="text-[8px] text-rose-500/80">
                Simulated coin vibrator motor is firing at duty cycle {simulatedVibration} !
              </p>
            </div>
          )}

          {/* Section: Live Serial Traffic Log (Sub-terminal Console) */}
          <div className="space-y-1.5 flex flex-col">
            <div className="flex justify-between items-center bg-zinc-950/40 p-1">
              <label className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider flex items-center gap-1.5">
                <Terminal size={12} className="text-indigo-400" />
                Live Serial Packet Stream
              </label>
              <button 
                onClick={clearSerialLogs}
                title="Clear logger"
                className="text-zinc-500 hover:text-zinc-300 p-1"
              >
                <Trash2 size={11} />
              </button>
            </div>

            {/* Mock TX/RX logs block */}
            <div className="h-44 bg-zinc-900/90 border border-zinc-800 rounded-lg p-2 font-mono text-[9px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {serialLogs.length === 0 ? (
                <div className="text-zinc-600 italic text-center pt-16">Waiting for serial transactions...</div>
              ) : (
                serialLogs.map((log) => (
                  <div key={log.id} className="flex gap-1">
                    <span className="text-zinc-500 font-normal shrink-0">[{log.timestamp}]</span>
                    {log.dir === 'TX' ? (
                      <span className="text-indigo-400 shrink-0 font-bold">[TX]</span>
                    ) : (
                      <span className="text-emerald-400 shrink-0 font-bold">[RX]</span>
                    )}
                    <span className={log.dir === 'TX' ? 'text-zinc-300' : 'text-emerald-300'}>
                      {log.text}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Manual command terminal injection */}
            <form onSubmit={handleCustomSubmit} className="flex gap-1 select-text">
              <input
                type="text"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="Send RX Packet (e.g., TUI:HYPER)"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-[10px] font-mono focus:outline-hidden focus:border-indigo-500 text-zinc-100"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Play size={10} />
                Inject
              </button>
            </form>
          </div>

        </div>
        
        {/* Footer info line */}
        <div className="p-3 border-t border-zinc-900 bg-zinc-950 text-[10px] text-zinc-500 text-center select-none font-sans flex items-center justify-center gap-1.5">
          <Wifi size={10} className="text-zinc-600 animate-pulse" />
          <span>Real-time Sandbox Proxied Environment</span>
        </div>
      </div>
    </>
  );
}
