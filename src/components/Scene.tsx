import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, DepthOfField } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import OrganicMesh from './OrganicMesh';
import { useStore } from '../store';

export default function Scene() {
  const storeAmbientLight = useStore(state => state.ambientLight);
  const nightThreshold = useStore(state => state.nightModeLightThreshold);
  const isNightMode = storeAmbientLight < nightThreshold;

  return (
    <>
      <color attach="background" args={[isNightMode ? '#0a0d14' : '#2a2322']} />
      
      {/* Studio lighting for soft plush bear */}
      <ambientLight intensity={isNightMode ? 0.1 : 0.4} color={isNightMode ? '#8aa5ce' : '#fff1e6'} />
      
      {/* Soft warm key light */}
      <directionalLight position={[4, 5, 4]} intensity={isNightMode ? 0.3 : 1.5} color={isNightMode ? '#465063' : '#ffd8c2'} castShadow />
      
      {/* Cool soft fill light to match the environment */}
      <directionalLight position={[-4, 2, 4]} intensity={isNightMode ? 0.1 : 0.8} color="#d4e1ff" />
      
      {/* Strong rim light for the fuzzy edges */}
      <spotLight position={[0, 6, -6]} intensity={isNightMode ? 0.5 : 3.0} angle={Math.PI / 3} penumbra={1} color={isNightMode ? '#8aa5ce' : '#ffebcc'} />

      <Environment preset={isNightMode ? "night" : "apartment"} />

      <OrganicMesh />

      <OrbitControls makeDefault autoRotate autoRotateSpeed={0.1} enablePan={false} enableZoom={true} minDistance={1.5} maxDistance={8} />

      <EffectComposer>
        <DepthOfField
          focusDistance={0.5}
          focalLength={0.1}
          bokehScale={2}
          height={480}
        />
        <Bloom 
          intensity={0.4} 
          luminanceThreshold={0.8} 
          luminanceSmoothing={0.9} 
          mipmapBlur 
        />
        <N8AO
          aoRadius={0.1}
          intensity={4}
          color="#1a100c"
        />
      </EffectComposer>
    </>
  );
}
