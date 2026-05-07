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
import { useStore } from './store';
import { Leva } from 'leva';

export default function App() {
  return (
    <div className="w-full h-screen bg-black">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <Scene />
      </Canvas>
      <FaceTracker />
      <ArduinoConnection />
      <CalibrationDashboard />
      <AudioManager />
      <div className="fixed top-4 right-4 z-[1000] pointer-events-auto">
      </div>
    </div>
  );
}
