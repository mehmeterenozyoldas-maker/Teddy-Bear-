import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Coffee, Moon, Settings2, Unplug, Zap, Heart, Flame } from 'lucide-react';

export default function CalibrationDashboard() {
  const [isOpen, setIsOpen] = useState(false);
  const headRotation = useStore((s) => s.headRotation);
  const armRotations = useStore((s) => s.armRotations);
  const legRotations = useStore((s) => s.legRotations);
  const calibrationAngles = useStore((s) => s.calibrationAngles);
  const setCalibrationAngles = useStore((s) => s.setCalibrationAngles);
  
  const mood = useStore((s) => s.mood);
  const setMood = useStore((s) => s.setMood);

  const ambientLight = useStore((s) => s.ambientLight);
  const userDistance = useStore((s) => s.userDistance);
  const nightThreshold = useStore((s) => s.nightModeLightThreshold);
  const setNightThreshold = useStore((s) => s.setNightModeLightThreshold);
  const proxMax = useStore((s) => s.proximityMaxDistance);
  const setProxMax = useStore((s) => s.setProximityMaxDistance);
  
  const faceTrackingActive = useStore((s) => s.faceTrackingActive);
  const setFaceTrackingActive = useStore((s) => s.setFaceTrackingActive);
  const ambientColor = useStore((s) => s.ambientColor);
  const handTrackingActive = useStore((s) => s.handTrackingActive);

  // Helper to convert radians to intuitive servo degrees for UI mapping
  const toDeg = (rad: number) => Math.floor((rad * 180) / Math.PI);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-[1000] bg-zinc-900/80 text-white p-3 rounded-full hover:bg-zinc-800 backdrop-blur-sm border border-zinc-700 shadow-xl transition-all"
      >
        <Settings2 size={24} />
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 z-[1000] w-96 max-h-[90vh] overflow-y-auto custom-scrollbar max-w-[calc(100vw-2rem)] bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 rounded-2xl shadow-2xl p-5 text-zinc-200 flex flex-col gap-6 font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings2 size={20} className="text-amber-400" />
          HMI Dashboard
        </h2>
        <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
          <Unplug size={20} />
        </button>
      </div>

      {/* TUI Simulator (Tokens) */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium tracking-wide text-zinc-400 uppercase">Tangible Token Simulator</h3>
        <div className="grid grid-cols-5 gap-2">
           <button 
             onClick={() => setMood('neutral')}
             className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${mood === 'neutral' ? 'bg-zinc-800 border-zinc-500 shadow-inner' : 'bg-black/20 border-zinc-800 hover:bg-zinc-800/50'}`}
           >
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">N</div>
              <span className="text-[10px] font-semibold">Neutral</span>
           </button>
           <button 
             onClick={() => setMood('hyper')}
             className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${mood === 'hyper' ? 'bg-amber-900/30 border-amber-500 shadow-inner text-amber-400' : 'bg-black/20 border-zinc-800 hover:bg-zinc-800/50'}`}
           >
              <div className="w-8 h-8 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center"><Coffee size={16} /></div>
              <span className="text-[10px] font-semibold">Coffee</span>
           </button>
           <button 
             onClick={() => setMood('sleepy')}
             className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${mood === 'sleepy' ? 'bg-indigo-900/30 border-indigo-500 shadow-inner text-indigo-400' : 'bg-black/20 border-zinc-800 hover:bg-zinc-800/50'}`}
           >
              <div className="w-8 h-8 rounded-full bg-indigo-500 text-indigo-950 flex items-center justify-center"><Moon size={16} /></div>
              <span className="text-[10px] font-semibold">Moon</span>
           </button>
           <button 
             onClick={() => setMood('loving')}
             className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${mood === 'loving' ? 'bg-pink-900/30 border-pink-500 shadow-inner text-pink-400' : 'bg-black/20 border-zinc-800 hover:bg-zinc-800/50'}`}
           >
              <div className="w-8 h-8 rounded-full bg-pink-500 text-pink-950 flex items-center justify-center"><Heart size={16} /></div>
              <span className="text-[10px] font-semibold">Heart</span>
           </button>
           <button 
             onClick={() => setMood('angry')}
             className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${mood === 'angry' ? 'bg-red-900/30 border-red-500 shadow-inner text-red-400' : 'bg-black/20 border-zinc-800 hover:bg-zinc-800/50'}`}
           >
              <div className="w-8 h-8 rounded-full bg-red-500 text-red-950 flex items-center justify-center"><Flame size={16} /></div>
              <span className="text-[10px] font-semibold">Spicy</span>
           </button>
        </div>
      </div>

      {/* Servo Calibration Wireframe UI */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium tracking-wide text-zinc-400 uppercase flex items-center justify-between">
          <span>Servo Offsets</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCalibrationAngles({ x: 0, y: 0, z: 0, armL: 0, armR: 0, legL: 0, legR: 0 })}
              className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 hover:bg-zinc-700 transition"
            >
              Reset
            </button>
            <span className="text-xs font-normal opacity-50 bg-black/50 px-2 py-0.5 rounded text-green-400 flex items-center gap-1"><Zap size={10}/> Live Calibration</span>
          </div>
        </h3>
        
        <div className="bg-black/40 rounded-xl p-4 border border-zinc-800 font-mono text-xs">
          
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
             {/* Head */}
             <div className="col-span-2 space-y-1">
               <div className="flex justify-between items-center">
                 <span className="text-zinc-500">HEAD PAN (YAW)</span>
                 <span className="text-amber-400">{toDeg(headRotation.y + calibrationAngles.y)}°</span>
               </div>
               <input type="range" min={-90} max={90} value={toDeg(calibrationAngles.y)} onChange={(e) => setCalibrationAngles({y: (Number(e.target.value) * Math.PI) / 180})} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
             </div>
             
             <div className="col-span-2 space-y-1">
               <div className="flex justify-between items-center">
                 <span className="text-zinc-500">HEAD TILT (PITCH)</span>
                 <span className="text-amber-400">{toDeg(headRotation.x + calibrationAngles.x)}°</span>
               </div>
               <input type="range" min={-90} max={90} value={toDeg(calibrationAngles.x)} onChange={(e) => setCalibrationAngles({x: (Number(e.target.value) * Math.PI) / 180})} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
             </div>

             {/* Arms */}
             <div className="space-y-1">
               <div className="flex justify-between items-center">
                 <span className="text-zinc-500">L ARM</span>
                 <span className="text-amber-400">{toDeg(armRotations.left + calibrationAngles.armL)}°</span>
               </div>
               <input type="range" min={-90} max={90} value={toDeg(calibrationAngles.armL)} onChange={(e) => setCalibrationAngles({armL: (Number(e.target.value) * Math.PI) / 180})} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
             </div>

             <div className="space-y-1">
               <div className="flex justify-between items-center">
                 <span className="text-zinc-500">R ARM</span>
                 <span className="text-amber-400">{toDeg(armRotations.right + calibrationAngles.armR)}°</span>
               </div>
               <input type="range" min={-90} max={90} value={toDeg(calibrationAngles.armR)} onChange={(e) => setCalibrationAngles({armR: (Number(e.target.value) * Math.PI) / 180})} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
             </div>
             
             {/* Legs */}
             {/* Legs could go here, but omitted for simplicity unless needed */}
          </div>
          
        </div>
        <p className="text-[10px] text-zinc-500 leading-tight">
          Adjusting these offsets applies an immediate rotational delta to the digital twin to synchronize it with physical servos.
        </p>
      </div>

      {/* Environmental Calibration */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium tracking-wide text-zinc-400 uppercase">Environmental Calibration</h3>
        <div className="bg-black/40 rounded-xl p-4 border border-zinc-800 font-mono text-xs">
          <div className="flex flex-col gap-y-4">
             {/* Light Mode */}
             <div className="space-y-1">
               <div className="flex justify-between items-center">
                 <span className="text-zinc-500">NIGHT MODE THRESHOLD</span>
                 <span className="text-amber-400">{ambientLight} / {nightThreshold}</span>
               </div>
               <input type="range" min={0} max={1023} value={nightThreshold} onChange={(e) => setNightThreshold(Number(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
               <p className="text-[9px] text-zinc-600 mt-1">If current light ({ambientLight}) drops below {nightThreshold}, bear gets sleepy.</p>
             </div>

             {/* Distance */}
             <div className="space-y-1 mt-2">
               <div className="flex justify-between items-center">
                 <span className="text-zinc-500">PROXIMITY RADIUS (cm)</span>
                 <span className="text-amber-400">{userDistance} / {proxMax}</span>
               </div>
               <input type="range" min={10} max={200} value={proxMax} onChange={(e) => setProxMax(Number(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
               <p className="text-[9px] text-zinc-600 mt-1">If distance ({userDistance}cm) is less than {proxMax}cm, bear reacts to proximity.</p>
             </div>

             {/* WebCam Sensors */}
             <div className="pt-2 mt-2 border-t border-zinc-800/50 space-y-2">
                 <div className="flex justify-between items-center">
                   <span className="text-zinc-500">WEBCAM AI TRACKING</span>
                   <button 
                     onClick={() => setFaceTrackingActive(!faceTrackingActive)}
                     className={`px-3 py-1 rounded text-[10px] font-bold transition-colors ${faceTrackingActive ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                   >
                     {faceTrackingActive ? 'ON' : 'OFF'}
                   </button>
                 </div>
             </div>

             {faceTrackingActive && (
               <div className="pt-2 mt-2 border-t border-zinc-800/50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">WEBCAM EXTRACTED COLOR</span>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400">{ambientColor}</span>
                      <div className="w-4 h-4 rounded-full border border-zinc-600" style={{ backgroundColor: ambientColor }} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">HAND WAVING DETECTED</span>
                    <span className={handTrackingActive ? "text-green-400 font-bold" : "text-zinc-600"}>
                      {handTrackingActive ? "YES" : "NO"}
                    </span>
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>

    </div>
  );
}
