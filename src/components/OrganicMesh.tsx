import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import HairSystem from './HairSystem';
import { createNoise3D } from 'simplex-noise';
import { useControls, button } from 'leva';
import { useStore } from '../store';

// Lower instance count to improve performance while still looking full
const INSTANCE_COUNT = 200000;

function FurryPart({ geometry, rootColor, tipColor, thickness, length }: any) {
  const [samplerData, setSamplerData] = useState<{ 
    positionsTexture: THREE.DataTexture, 
    normalsTexture: THREE.DataTexture 
  } | null>(null);

  const mousePositionRef = useRef(new THREE.Vector3(-999, -999, -999));

  useEffect(() => {
    const tempMesh = new THREE.Mesh(geometry);
    const sampler = new MeshSurfaceSampler(tempMesh).build();
    
    // Scale down instance count per part based on surface area
    const actualCount = Math.floor(INSTANCE_COUNT * (geometry.boundingSphere?.radius || 1) * 0.5);
    const width = Math.ceil(Math.sqrt(actualCount));
    const height = width;
    const finalCount = width * height;
    
    const posData = new Float32Array(finalCount * 4);
    const normData = new Float32Array(finalCount * 4);
    
    const samplePos = new THREE.Vector3();
    const sampleNorm = new THREE.Vector3();
    
    for (let i = 0; i < finalCount; i++) {
        sampler.sample(samplePos, sampleNorm);
        
        posData[i * 4 + 0] = samplePos.x;
        posData[i * 4 + 1] = samplePos.y;
        posData[i * 4 + 2] = samplePos.z;
        posData[i * 4 + 3] = 1.0;
        
        normData[i * 4 + 0] = sampleNorm.x;
        normData[i * 4 + 1] = sampleNorm.y;
        normData[i * 4 + 2] = sampleNorm.z;
        normData[i * 4 + 3] = 1.0;
    }
    
    const positionsTexture = new THREE.DataTexture(posData, width, height, THREE.RGBAFormat, THREE.FloatType);
    positionsTexture.needsUpdate = true;
    
    const normalsTexture = new THREE.DataTexture(normData, width, height, THREE.RGBAFormat, THREE.FloatType);
    normalsTexture.needsUpdate = true;
    
    setSamplerData({ positionsTexture, normalsTexture });
  }, [geometry]);

  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <group>
      <mesh 
        ref={meshRef}
        geometry={geometry}
        onPointerMove={(e) => {
          const localPoint = e.point.clone();
          if (meshRef.current) {
            meshRef.current.worldToLocal(localPoint);
          }
          mousePositionRef.current.copy(localPoint);
        }}
        onPointerDown={(e) => {
           useStore.getState().setIsPointerDown(true);
        }}
        onPointerUp={(e) => {
           useStore.getState().setIsPointerDown(false);
        }}
        onPointerOut={() => {
          mousePositionRef.current.set(-999, -999, -999);
          useStore.getState().setIsPointerDown(false);
        }}
      >
        <meshPhysicalMaterial 
          color={tipColor}
          roughness={1.0}
          metalness={0.0}
        />
      </mesh>
      
      {samplerData && (
        <HairSystem 
          positionsTexture={samplerData.positionsTexture} 
          normalsTexture={samplerData.normalsTexture} 
          mousePositionRef={mousePositionRef}
          count={samplerData.positionsTexture.image.width * samplerData.positionsTexture.image.height}
          size={samplerData.positionsTexture.image.width}
          rootColor={rootColor}
          tipColor={tipColor}
          thickness={thickness}
          length={length}
        />
      )}
    </group>
  );
}

export default function OrganicMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthGroupRef = useRef<THREE.Group>(null);
  const lowerJawRef = useRef<THREE.Group>(null);
  const innerMouthRef = useRef<THREE.Mesh>(null);
  const leftBrowRef = useRef<THREE.Mesh>(null);
  const rightBrowRef = useRef<THREE.Mesh>(null);
  const lowerLipRef = useRef<THREE.Mesh>(null);

  const innerMouthBasePos = useRef<Float32Array | null>(null);
  const lowerLipBasePos = useRef<Float32Array | null>(null);
  const prevSmileL = useRef(0);
  const prevSmileR = useRef(0);
  const prevMouthOpen = useRef(0);

  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);

  const headRotation = useStore(state => state.headRotation);
  const faceTrackingActive = useStore(state => state.faceTrackingActive);
  const blendshapes = useStore(state => state.blendshapes);

  // Smoothly interpolate the group rotation towards headRotation and animate facial features
  useFrame((state, delta) => {
    const storeState = useStore.getState();
    const isFaceActive = storeState.faceTrackingActive;
    const activity = storeState.interactionActivity;
    const mode = storeState.interactionMode;
    const armRotations = storeState.armRotations;
    const legRotations = storeState.legRotations;
    const calibration = storeState.calibrationAngles;
    const mood = storeState.mood;
    const userDistance = storeState.userDistance;

    // Adjust interpolation speed and base facial behavior based on mood
    const baseSpeed = mood === 'hyper' ? 12 : mood === 'sleepy' ? 2 : mood === 'angry' ? 8 : 5;
    
    if (armLRef.current) {
        armLRef.current.rotation.x = THREE.MathUtils.lerp(armLRef.current.rotation.x, 0.2, delta * baseSpeed);
        armLRef.current.rotation.z = THREE.MathUtils.lerp(armLRef.current.rotation.z, (-Math.PI / 3.5) + armRotations.left + calibration.armL, delta * baseSpeed);
    }
    if (armRRef.current) {
        armRRef.current.rotation.x = THREE.MathUtils.lerp(armRRef.current.rotation.x, 0.2, delta * baseSpeed);
        armRRef.current.rotation.z = THREE.MathUtils.lerp(armRRef.current.rotation.z, (Math.PI / 3.5) + armRotations.right + calibration.armR, delta * baseSpeed);
    }
    if (legLRef.current) {
        legLRef.current.rotation.x = THREE.MathUtils.lerp(legLRef.current.rotation.x, 0.2 + legRotations.left + calibration.legL, delta * baseSpeed);
    }
    if (legRRef.current) {
        legRRef.current.rotation.x = THREE.MathUtils.lerp(legRRef.current.rotation.x, 0.2 + legRotations.right + calibration.legR, delta * baseSpeed);
    }
    
    // Calculate synthetic blendshapes from interaction
    let synthSmile = 0;
    let synthOpen = 0;
    let synthBrowUp = 0;
    let synthBlink = 0;
    let headNod = 0;
    let headShake = 0;
    let interactionNod = 0;
    let interactionShake = 0;

    // Expand eyes based on proximity (UltraSonic or camera tracking proxy if we used face size)
    // Distance < proxMax means expanding. mapping proxMax..10 to 0..0.8
    let proximityWideEyes = 0;
    const proxMax = storeState.proximityMaxDistance;
    if (userDistance < proxMax) {
      proximityWideEyes = Math.max(0, Math.min(1.0, (proxMax - userDistance) / (proxMax * 0.8)));
      synthBrowUp += proximityWideEyes * 0.8; 
      // If very close, maybe smile or open mouth slightly
      if (userDistance < proxMax * 0.4) synthOpen += 0.3;
    }

    // Base mood offsets
    if (mood === 'sleepy') {
       synthBlink = 0.8; // heavy eyelids
       synthSmile = -0.2;
       synthBrowUp = -0.5;
       headNod = Math.sin(state.clock.elapsedTime) * 0.1 - 0.2; // drooping head
    } else if (mood === 'hyper') {
       synthOpen += 0.5;
       synthSmile = 0.8;
       synthBrowUp += 0.8;
       headShake = Math.sin(state.clock.elapsedTime * 10) * 0.1; // twitching
       synthBlink = Math.sin(state.clock.elapsedTime * 20) > 0.95 ? 1 : 0; // fast erratic blinking
    } else if (mood === 'loving') {
       synthSmile = 0.9;
       synthBrowUp += 0.4;
       synthBlink = 0.3; // soft eyes
       headNod = Math.sin(state.clock.elapsedTime * 2) * 0.05 + 0.1; // subtle upward gaze / affection
    } else if (mood === 'angry') {
       synthSmile = -0.8; // frown
       synthBrowUp -= 0.8; // scowl
       synthOpen += 0.2; // teeth bared
       headNod -= 0.15; // head lowered, aggressive posture
       synthBlink = 0; // wide staring
    }

    if (activity > 0) {
       if (mode === 'Tickle') {
         synthSmile += activity * 1.5;
         synthOpen += activity * 0.8;
         synthBrowUp += activity * 0.8;
         interactionShake += Math.sin(state.clock.elapsedTime * 15) * activity * 0.1;
       } else if (mode === 'Push') {
         synthSmile -= activity * 0.5; // slight frown
         synthBrowUp += activity * 0.5;
         interactionNod -= activity * 0.2;
         synthOpen += activity * 0.2;
       } else if (mode === 'Stroke') {
         synthSmile += activity * 0.8; // happy
         synthBlink += activity * 0.6; // squinting in pleasure
         synthBrowUp -= activity * 0.3; // relaxed brows
         interactionNod += activity * 0.15;
       } else if (mode === 'Pinch') {
         synthSmile -= activity; // Ouch
         synthOpen += activity; // Gasps
         synthBrowUp += activity * 1.2;
         synthBlink += activity * 0.5; // wincing
       } else if (mode === 'Pet') {
         synthSmile += activity * 1.2;
         synthBlink += activity * 0.8;
         synthBrowUp -= activity * 0.5;
         interactionNod += activity * 0.2;
       } else if (mode === 'Poke') {
         synthSmile -= activity * 0.3;
         synthOpen += activity * 0.5; // Surprised
         synthBrowUp += activity * 0.8;
         interactionShake += Math.sin(state.clock.elapsedTime * 20) * activity * 0.1;
       } else if (mode === 'Grab') {
         synthSmile -= activity * 0.8;
         synthOpen += activity * 0.4;
         synthBrowUp += activity * 1.0;
         synthBlink += activity * 0.4;
       } else if (mode === 'Tap') {
         synthBlink += activity * 0.9;
         synthOpen += activity * 0.1;
         interactionNod -= activity * 0.1;
       }
    }

    headNod += interactionNod;
    headShake += interactionShake;

    // Clamp expressions
    synthSmile = Math.max(-1, Math.min(1, synthSmile));
    synthBlink = Math.max(0, Math.min(1, synthBlink));
    synthOpen = Math.max(0, Math.min(1, synthOpen));

    if (groupRef.current) {
       const targetRotX = (isFaceActive ? storeState.headRotation.x : headNod) + calibration.x;
       const targetRotY = (isFaceActive ? storeState.headRotation.y : headShake) + calibration.y;
       const targetRotZ = (isFaceActive ? storeState.headRotation.z : (headShake * 0.5)) + calibration.z;

       groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, delta * baseSpeed);
       groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, delta * baseSpeed);
       groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, delta * baseSpeed);
       
       // Expose display rotation and servo rotation to the store for Arduino to read
       useStore.setState({
         displayRotation: {
           x: groupRef.current.rotation.x,
           y: groupRef.current.rotation.y,
           z: groupRef.current.rotation.z
         },
         servoRotation: {
           // Tilt servo (pin 10) mimics left arm movement
           x: THREE.MathUtils.lerp(storeState.servoRotation.x, armRotations.left, delta * 5),
           // Pan servo (pin 9) mimics right arm movement
           y: THREE.MathUtils.lerp(storeState.servoRotation.y, armRotations.right, delta * 5),
           z: 0
         }
       });
       
       const blinkL = isFaceActive ? storeState.blendshapes.eyeBlinkLeft : synthBlink;
       const blinkR = isFaceActive ? storeState.blendshapes.eyeBlinkRight : synthBlink;
       const smileL = isFaceActive ? storeState.blendshapes.mouthSmileLeft : synthSmile;
       const smileR = isFaceActive ? storeState.blendshapes.mouthSmileRight : synthSmile;
       const browUpL = isFaceActive ? (storeState.blendshapes.browInnerUp + storeState.blendshapes.browOuterUpLeft) : synthBrowUp;
       const browUpR = isFaceActive ? (storeState.blendshapes.browInnerUp + storeState.blendshapes.browOuterUpRight) : synthBrowUp;
       const mouthOpenVal = isFaceActive ? storeState.blendshapes.mouthOpen : synthOpen;

       // Base eye scale is boosted by proximityWideEyes
       const targetEyeScaleBase = 1.0 + (proximityWideEyes * 0.4);

       // Blink animation
       if (leftEyeRef.current) {
         const targetScaleY = targetEyeScaleBase - Math.min(blinkL * 1.5, 0.95);
         leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, targetScaleY, delta * 15);
         leftEyeRef.current.scale.x = THREE.MathUtils.lerp(leftEyeRef.current.scale.x, targetEyeScaleBase, delta * 15);
         leftEyeRef.current.scale.z = THREE.MathUtils.lerp(leftEyeRef.current.scale.z, targetEyeScaleBase, delta * 15);
       }
       if (rightEyeRef.current) {
         const targetScaleY = targetEyeScaleBase - Math.min(blinkR * 1.5, 0.95);
         rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, targetScaleY, delta * 15);
         rightEyeRef.current.scale.x = THREE.MathUtils.lerp(rightEyeRef.current.scale.x, targetEyeScaleBase, delta * 15);
         rightEyeRef.current.scale.z = THREE.MathUtils.lerp(rightEyeRef.current.scale.z, targetEyeScaleBase, delta * 15);
       }

       // Eyebrow animations
       if (leftBrowRef.current) {
         const lift = browUpL * 0.15;
         const rotate = isFaceActive ? (storeState.blendshapes.browInnerUp - storeState.blendshapes.browOuterUpLeft) * 0.4 : (synthBrowUp * 0.2);
         leftBrowRef.current.position.y = THREE.MathUtils.lerp(leftBrowRef.current.position.y, 0.90 + lift, delta * 15);
         leftBrowRef.current.rotation.z = THREE.MathUtils.lerp(leftBrowRef.current.rotation.z, -rotate, delta * 15);
       }
       if (rightBrowRef.current) {
         const lift = browUpR * 0.15;
         const rotate = isFaceActive ? (storeState.blendshapes.browInnerUp - storeState.blendshapes.browOuterUpRight) * 0.4 : (-synthBrowUp * 0.2);
         rightBrowRef.current.position.y = THREE.MathUtils.lerp(rightBrowRef.current.position.y, 0.90 + lift, delta * 15);
         rightBrowRef.current.rotation.z = THREE.MathUtils.lerp(rightBrowRef.current.rotation.z, rotate, delta * 15);
       }

       // Smile & Jaw Open animation by manipulating vertices
       const smoothedSmileL = THREE.MathUtils.lerp(prevSmileL.current || 0, smileL, delta * 15);
       const smoothedSmileR = THREE.MathUtils.lerp(prevSmileR.current || 0, smileR, delta * 15);
       const smoothedMouthOpen = THREE.MathUtils.lerp(prevMouthOpen.current || 0, mouthOpenVal, delta * 15);
       
       prevSmileL.current = smoothedSmileL;
       prevSmileR.current = smoothedSmileR;
       prevMouthOpen.current = smoothedMouthOpen;

       if (lowerJawRef.current) {
         // Jaw still translates down slightly
         lowerJawRef.current.position.y = -smoothedMouthOpen * 0.12;
       }

       // Helper to morph the vertices
       const morphMouth = (meshRef: THREE.Object3D | null, basePosRef: { current: Float32Array | null }, radius: number) => {
         if (!meshRef || !(meshRef as THREE.Mesh).geometry) return;
         const geometry = (meshRef as THREE.Mesh).geometry as THREE.BufferGeometry;
         
         // Capture base positions on first run
         if (!basePosRef.current && geometry.attributes.position) {
           basePosRef.current = new Float32Array(geometry.attributes.position.array);
         }
         
         if (basePosRef.current) {
           const positions = geometry.attributes.position;
           const base = basePosRef.current;
           for (let i = 0; i < positions.count; i++) {
              const ix = i * 3;
              const iy = i * 3 + 1;
              const iz = i * 3 + 2;
              let x = base[ix];
              let y = base[iy];
              let z = base[iz];
              
              const sideSmile = x > 0 ? smoothedSmileL : smoothedSmileR;

              // Apply smile curvature
              if (sideSmile !== 0) {
                  const xDist = Math.max(0, Math.min(1, Math.abs(x) / radius)); 
                  y += xDist * sideSmile * 0.05; 
                  x += Math.sign(x) * xDist * sideSmile * 0.02;
              }
              
              // Apply jaw open
              if (smoothedMouthOpen > 0) {
                  const xDist = Math.max(0, Math.min(1, Math.abs(x) / radius));
                  const centerInfluence = 1.0 - Math.pow(xDist, 2);
                  if (y < 0) {
                    y -= centerInfluence * smoothedMouthOpen * 0.06;
                  }
                  y -= centerInfluence * smoothedMouthOpen * 0.02;
              }

              positions.array[ix] = x;
              positions.array[iy] = y;
              positions.array[iz] = z;
           }
           positions.needsUpdate = true;
           geometry.computeVertexNormals();
         }
       };

       morphMouth(innerMouthRef.current, innerMouthBasePos, 0.13);
       morphMouth(lowerLipRef.current, lowerLipBasePos, 0.12);
    }
  });

  const geometries = useMemo(() => {
    // Build a procedural teddy bear/animal shape
    const mainGeos: THREE.BufferGeometry[] = [];

    // Body (Upper)
    const body = new THREE.SphereGeometry(1.05, 64, 64);
    body.scale(1.15, 0.95, 1.05);
    body.translate(0, -0.3, 0);
    mainGeos.push(body);

    // Body (Lower / Tummy)
    const tummy = new THREE.SphereGeometry(1.2, 64, 64);
    tummy.scale(1.1, 0.9, 1.15);
    tummy.translate(0, -0.9, 0.1);
    mainGeos.push(tummy);

    // Head
    const head = new THREE.SphereGeometry(0.95, 64, 64);
    head.scale(1.15, 1.0, 1.05);
    head.translate(0, 0.8, 0.2);
    mainGeos.push(head);

    // Snout
    const snout = new THREE.SphereGeometry(0.4, 32, 32);
    snout.scale(1.4, 0.9, 0.8);
    snout.translate(0, 0.65, 1.05);
    mainGeos.push(snout);

    // Ears
    const earGeo = new THREE.SphereGeometry(0.35, 32, 32);
    earGeo.scale(1, 1, 0.5);
    
    const earL = earGeo.clone();
    earL.translate(-0.8, 1.5, 0.2);
    earL.rotateZ(0.4);
    mainGeos.push(earL);

    const earR = earGeo.clone();
    earR.translate(0.8, 1.5, 0.2);
    earR.rotateZ(-0.4);
    mainGeos.push(earR);

    // Tail
    const tail = new THREE.SphereGeometry(0.3, 32, 32);
    tail.translate(0, -1.0, -1.0);
    mainGeos.push(tail);

    const processGeo = (geo: THREE.BufferGeometry) => {
      const posAttribute = geo.getAttribute('position');
      const normAttribute = geo.getAttribute('normal');
      const v = new THREE.Vector3();
      const norm = new THREE.Vector3();
      const noise3D = createNoise3D();
      
      for (let i = 0; i < posAttribute.count; i++) {
         v.fromBufferAttribute(posAttribute, i);
         norm.fromBufferAttribute(normAttribute, i);
         
         // Major shapes (wrinkles / mounds)
         const n1 = noise3D(v.x * 1.5, v.y * 1.5, v.z * 1.5) * 0.005;
         
         v.addScaledVector(norm, n1);
         posAttribute.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      return geo;
    };

    const mainGeo = processGeo(BufferGeometryUtils.mergeGeometries(mainGeos));

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.35, 0.6, 32, 32);
    armGeo.translate(0, -0.4, 0); // Pivot at top
    const armLGeo = processGeo(armGeo.clone());
    const armRGeo = processGeo(armGeo.clone());

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.45, 0.5, 32, 32);
    legGeo.translate(0, -0.3, 0); // Pivot at top
    const legLGeo = processGeo(legGeo.clone());
    const legRGeo = processGeo(legGeo.clone());

    return { mainGeo, armLGeo, armRGeo, legLGeo, legRGeo };
  }, []);

  const storeAmbientColor = useStore(state => state.ambientColor);

  const { rootColor: baseRootColor, tipColor: baseTipColor, thickness, length } = useControls('Appearance', {
    rootColor: '#5c3523',
    tipColor: '#d6a378',
    thickness: { value: 0.004, min: 0.0005, max: 0.02 },
    length: { value: 0.06, min: 0.02, max: 0.4 }
  });

  const [rootColor, setRootColor] = useState(baseRootColor);
  const [tipColor, setTipColor] = useState(baseTipColor);

  useEffect(() => {
    // Tint the base colors with the ambient color from webcam
    if (storeAmbientColor && storeAmbientColor !== '#ffffff') {
      const ambient = new THREE.Color(storeAmbientColor);
      
      const newRoot = new THREE.Color(baseRootColor);
      newRoot.lerp(ambient, 0.4); // 40% ambient influence
      setRootColor('#' + newRoot.getHexString());

      const newTip = new THREE.Color(baseTipColor);
      newTip.lerp(ambient, 0.6); // 60% ambient influence
      setTipColor('#' + newTip.getHexString());
    } else {
      setRootColor(baseRootColor);
      setTipColor(baseTipColor);
    }
  }, [storeAmbientColor, baseRootColor, baseTipColor]);

  return (
    <group position={[0, -0.2, 0]} ref={groupRef}>
      <FurryPart 
          geometry={geometries.mainGeo} 
          rootColor={rootColor} 
          tipColor={tipColor} 
          thickness={thickness} 
          length={length} 
      />

      <group ref={armLRef} position={[-1.3, -0.05, 0.4]} rotation={[0.2, 0, -Math.PI / 3.5]}>
        <FurryPart 
            geometry={geometries.armLGeo} 
            rootColor={rootColor} 
            tipColor={tipColor} 
            thickness={thickness} 
            length={length} 
        />
      </group>

      <group ref={armRRef} position={[1.3, -0.05, 0.4]} rotation={[0.2, 0, Math.PI / 3.5]}>
        <FurryPart 
            geometry={geometries.armRGeo} 
            rootColor={rootColor} 
            tipColor={tipColor} 
            thickness={thickness} 
            length={length} 
        />
      </group>

      <group ref={legLRef} position={[-0.55, -1.8, 0.6]} rotation={[0.2, 0, 0.1]}>
        <FurryPart 
            geometry={geometries.legLGeo} 
            rootColor={rootColor} 
            tipColor={tipColor} 
            thickness={thickness} 
            length={length} 
        />
      </group>

      <group ref={legRRef} position={[0.55, -1.8, 0.6]} rotation={[0.2, 0, -0.1]}>
        <FurryPart 
            geometry={geometries.legRGeo} 
            rootColor={rootColor} 
            tipColor={tipColor} 
            thickness={thickness} 
            length={length} 
        />
      </group>

      {/* Face Details - Placed without fur so they stand out */}
      <group>
        {/* Left Eye */}
        <mesh ref={leftEyeRef} position={[-0.48, 0.75, 1.20]}>
          <sphereGeometry args={[0.12, 32, 32]} />
          <meshStandardMaterial color="#050505" roughness={0.05} metalness={0.9} />
        </mesh>
        
        {/* Left Brow */}
        <mesh ref={leftBrowRef} position={[-0.45, 0.90, 1.15]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.15, 0.04, 0.05]} />
          <meshStandardMaterial color="#3b2014" roughness={0.9} />
        </mesh>

        {/* Right Eye */}
        <mesh ref={rightEyeRef} position={[0.48, 0.75, 1.20]}>
          <sphereGeometry args={[0.12, 32, 32]} />
          <meshStandardMaterial color="#050505" roughness={0.05} metalness={0.9} />
        </mesh>

        {/* Right Brow */}
        <mesh ref={rightBrowRef} position={[0.45, 0.90, 1.15]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.15, 0.04, 0.05]} />
          <meshStandardMaterial color="#3b2014" roughness={0.9} />
        </mesh>

        {/* Nose Group */}
        <group position={[0, 0.75, 1.36]}>
          <mesh scale={[1.4, 0.8, 1]}>
            <sphereGeometry args={[0.15, 32, 32]} />
            <meshPhysicalMaterial color="#080808" roughness={0.3} metalness={0.1} clearcoat={1.0} clearcoatRoughness={0.1} />
          </mesh>
          <mesh position={[0, 0.05, 0.12]} scale={[0.8, 0.4, 0.5]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshPhysicalMaterial color="#222222" roughness={0.2} metalness={0.1} clearcoat={1.0} clearcoatRoughness={0.1} />
          </mesh>
          {/* Snout cleft line */}
          <mesh position={[0, -0.11, 0.05]} scale={[0.02, 0.1, 0.05]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#050505" roughness={0.9} />
          </mesh>
        </group>

        {/* Mouth Group */}
        <group ref={mouthGroupRef} position={[0, 0.56, 1.30]}>
          {/* Inner dark mouth */}
          <mesh ref={innerMouthRef} position={[0, 0.02, -0.05]} scale={[1.1, 0.05, 0.3]}>
            <sphereGeometry args={[0.13, 32, 16]} />
            <meshStandardMaterial color="#050201" roughness={1.0} />
          </mesh>
          
          {/* Upper Teeth */}
          <group position={[0, 0.04, 0.06]}>
            <mesh position={[-0.03, 0, 0]} scale={[1, 1.5, 1]} rotation={[0.2, 0, 0.1]}>
              <boxGeometry args={[0.04, 0.04, 0.04]} />
              <meshStandardMaterial color="#fcfcfc" roughness={0.3} metalness={0.1} />
            </mesh>
            <mesh position={[0.03, 0, 0]} scale={[1, 1.5, 1]} rotation={[0.2, 0, -0.1]}>
              <boxGeometry args={[0.04, 0.04, 0.04]} />
              <meshStandardMaterial color="#fcfcfc" roughness={0.3} metalness={0.1} />
            </mesh>
          </group>

          {/* Lower Jaw Group */}
          <group ref={lowerJawRef}>
            {/* Lower Lip / Jaw outline */}
            <mesh ref={lowerLipRef} position={[0, -0.05, 0.04]} scale={[1.1, 0.3, 0.6]}>
              <sphereGeometry args={[0.12, 32, 16]} />
              <meshStandardMaterial color="#1a1514" roughness={0.9} />
            </mesh>

            {/* Tongue */}
            <mesh position={[0, -0.03, 0.03]} scale={[0.8, 0.2, 0.9]} rotation={[0.5, 0, 0]}>
              <sphereGeometry args={[0.09, 32, 16]} />
              <meshPhysicalMaterial color="#d95b65" roughness={0.4} clearcoat={0.3} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
