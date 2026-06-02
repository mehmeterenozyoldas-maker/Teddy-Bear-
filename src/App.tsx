/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas } from '@react-three/fiber';
import Scene from './components/Scene';
import FaceTracker from './components/FaceTracker';
import ArduinoConnection from './components/ArduinoConnection';
import CalibrationDashboard from './components/CalibrationDashboard';
import AudioManager from './components/AudioManager';
import TangibleTray from './components/TangibleTray';
import PhysicalSandbox from './components/PhysicalSandbox';
import { useStore } from './store';
import { Leva } from 'leva';

export default function App() {
  return (
    <div className="w-full h-screen bg-black overflow-hidden relative font-sans select-none">
      {/* ThreeJS R3F Canvas context rendering */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>
      
      {/* Core Diagnostic & Physical System Modules */}
      <FaceTracker />
      <ArduinoConnection />
      <CalibrationDashboard />
      <AudioManager />
      <TangibleTray />
      
      {/* High-Fidelity Hardware & Environmental Sandbox Panel */}
      <PhysicalSandbox />
      <Leva hidden />
    </div>
  );
}
