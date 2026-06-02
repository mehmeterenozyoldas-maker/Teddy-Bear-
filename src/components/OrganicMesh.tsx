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
const INSTANCE_COUNT = 150000;

const shellVertexShader = `
  uniform float uShellIndex;
  uniform float uTotalShells;
  uniform float uLength;
  uniform float uTime;
  uniform sampler2D stateTexture;
  uniform bool uHasState;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vHeight;
  varying float vInteraction;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    float height = uShellIndex / uTotalShells;
    vHeight = height;

    vec2 disp = vec2(0.0);
    vec2 vel = vec2(0.0);
    if (uHasState) {
      vec4 stateInfo = texture2D(stateTexture, uv);
      disp = stateInfo.rg;
      vel = stateInfo.ba;
    }
    
    vInteraction = smoothstep(0.4, 4.0, length(vel));

    vec3 p = position;
    
    // Approximate local tangent space
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 axis = cross(up, normal);
    float angle = acos(dot(up, normal));
    mat3 rot = mat3(1.0);
    if (length(axis) > 0.0001) {
      axis = normalize(axis);
      float s = sin(angle);
      float c = cos(angle);
      float oc = 1.0 - c;
      rot = mat3(
        oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
        oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
        oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
      );
    }

    vec3 offset = vec3(0.0);
    offset.x += disp.x * (height * height) * uLength * 1.5;
    offset.z += disp.y * (height * height) * uLength * 1.5;
    
    // Ambient flutter
    float breeze = sin(uTime * 1.8 + position.x * 2.5 + position.y * 3.1) * 0.012 * height;
    offset.x += breeze;

    p = p + rot * offset + normal * height * uLength;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const shellFragmentShader = `
  uniform vec3 uRootColor;
  uniform vec3 uTipColor;
  uniform float uShellIndex;
  uniform float uTotalShells;
  uniform float uFurlDensity;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vHeight;
  varying float vInteraction;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    float density = noise(vUv * uFurlDensity);
    
    float threshold = smoothstep(0.02, 0.95, vHeight);
    if (vHeight > 0.0 && density < threshold) {
      discard;
    }

    vec3 baseColor = mix(uRootColor, uTipColor, vHeight);
    vec3 glow = vec3(1.0, 0.92, 0.72);
    vec3 color = mix(baseColor, baseColor + glow * vHeight * 1.4, vInteraction * 0.65);

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPosition);

    vec3 L_key = normalize(vec3(4.0, 5.0, 4.0));
    float diff_key = max(dot(N, L_key), 0.0);
    
    vec3 L_fill = normalize(vec3(-4.0, 2.0, 4.0));
    float diff_fill = max(dot(N, L_fill), 0.0);

    float viewDot = max(dot(V, N), 0.0);
    float rim = pow(1.0 - viewDot, 4.0);
    vec3 rimColor = vec3(1.0, 0.96, 0.88);

    float ao = mix(0.12, 1.0, vHeight);

    vec3 litColor = color * (vec3(0.12) + vec3(0.8) * diff_key + vec3(0.25) * diff_fill) * ao;
    
    float rimBoost = mix(1.0, 2.5, vInteraction);
    litColor += rimColor * rim * 1.3 * vHeight * rimBoost;

    gl_FragColor = vec4(litColor, 1.0);
  }
`;

function FurryPart({ geometry, rootColor, tipColor, thickness, length, partName, furMode, shellCount, furlDensity }: any) {
  const [samplerData, setSamplerData] = useState<{ 
    positionsTexture: THREE.DataTexture, 
    normalsTexture: THREE.DataTexture 
  } | null>(null);

  const mousePositionRef = useRef(new THREE.Vector3(-999, -999, -999));
  const stateTextureRef = useRef<THREE.Texture | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const tempMesh = new THREE.Mesh(geometry);
    const sampler = new MeshSurfaceSampler(tempMesh).build();
    
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

  // Construct concentric shell materials
  const shells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < shellCount; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: shellVertexShader,
        fragmentShader: shellFragmentShader,
        uniforms: {
          uShellIndex: { value: i },
          uTotalShells: { value: shellCount },
          uLength: { value: length },
          uTime: { value: 0 },
          stateTexture: { value: null },
          uHasState: { value: false },
          uRootColor: { value: new THREE.Color(rootColor) },
          uTipColor: { value: new THREE.Color(tipColor) },
          uFurlDensity: { value: furlDensity }
        },
        depthWrite: i === 0,
        depthTest: true
      });
      arr.push(mat);
    }
    return arr;
  }, [shellCount, rootColor, tipColor, length, furlDensity]);

  // Handle continuous simulation variables
  useFrame((state) => {
    if (furMode === 'Volumetric Shells (Plush)') {
      const tex = stateTextureRef.current;
      shells.forEach((mat) => {
        mat.uniforms.uTime.value = state.clock.elapsedTime;
        mat.uniforms.uRootColor.value.set(rootColor);
        mat.uniforms.uTipColor.value.set(tipColor);
        mat.uniforms.uLength.value = length;
        mat.uniforms.uFurlDensity.value = furlDensity;
        if (tex) {
          mat.uniforms.stateTexture.value = tex;
          mat.uniforms.uHasState.value = true;
        } else {
          mat.uniforms.uHasState.value = false;
        }
      });
    }
  });

  return (
    <group>
      {/* Base skin rendering or Concentric Volumetric layers */}
      {furMode === 'Instanced Strands (Fuzzy)' ? (
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
             useStore.getState().setActiveInteractivePart(partName);
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
      ) : (
        // Concentric shell meshes
        shells.map((mat, idx) => (
          <mesh 
            key={idx} 
            geometry={geometry} 
            material={mat}
            onPointerMove={(e) => {
              const localPoint = e.point.clone();
              if (meshRef.current) {
                meshRef.current.worldToLocal(localPoint);
              }
              mousePositionRef.current.copy(localPoint);
            }}
            onPointerDown={(e) => {
               useStore.getState().setIsPointerDown(true);
               useStore.getState().setActiveInteractivePart(partName);
            }}
            onPointerUp={(e) => {
               useStore.getState().setIsPointerDown(false);
            }}
            onPointerOut={() => {
              mousePositionRef.current.set(-999, -999, -999);
              useStore.getState().setIsPointerDown(false);
            }}
          />
        ))
      )}
      
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
          stateTextureRef={stateTextureRef}
          visible={furMode === 'Instanced Strands (Fuzzy)'}
        />
      )}
    </group>
  );
}

export default function OrganicMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);
  const leftEyeScaleRef = useRef<THREE.Group>(null);
  const rightEyeScaleRef = useRef<THREE.Group>(null);
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

  const breathPhaseRef = useRef(0);
  const breathRateRef = useRef(1.5);

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
    const isFaceActive = storeState.faceTrackingActive || storeState.faceSimulated;
    const activity = storeState.interactionActivity;
    const mode = storeState.interactionMode;
    const armRotations = storeState.armRotations;
    const legRotations = storeState.legRotations;
    const calibration = storeState.calibrationAngles;
    const mood = storeState.mood;
    const userDistance = storeState.userDistance;

    // Adjust interpolation speed and base facial behavior based on mood
    const baseSpeed = mood === 'hyper' ? 12 : mood === 'sleepy' ? 2 : mood === 'angry' ? 8 : 5;
    
    // Determine if user is idle (face not tracked, or far away and no activity)
    const proxMax = storeState.proximityMaxDistance;
    const isFar = userDistance > proxMax * 0.7;
    const isIdle = (!isFaceActive || isFar) && activity < 0.1;

    // Accumulate breathing phase continuously based on mood and activity
    const targetBreathRate = mood === 'sleepy' ? (isIdle ? 1.0 : 1.5) : (mood === 'hyper' ? (isIdle ? 3.0 : 6.0) : (isIdle ? 1.5 : 3.0));
    breathRateRef.current = THREE.MathUtils.lerp(breathRateRef.current, targetBreathRate, delta * 3.0);
    breathPhaseRef.current += delta * breathRateRef.current;
    
    // Phase 1 - Basic Input Interpolation Clamps (ensures lerping is bounded within [0, 1] to eliminate twitching under frame stutter)
    const alphaBase = Math.min(1.0, delta * baseSpeed);
    const alphaFast = Math.min(1.0, delta * 15);
    const alphaSlow = Math.min(1.0, delta * 5);
    
    let ambientArmL = 0;
    let ambientArmR = 0;
    let ambientLegL = 0;
    let ambientLegR = 0;
    let ambientNod = 0;
    let ambientShake = 0;
    let ambientRoll = 0;
    let ambientBlink = 0;
    
    if (isIdle) {
         const t = state.clock.elapsedTime;
         const p = breathPhaseRef.current;

         // Subtle, asynchronous relaxed breathing movements in limbs and head
         ambientArmL += Math.sin(p * 0.8) * 0.04;
         ambientArmR += Math.sin(p * 0.9 + 1.0) * 0.04;
         ambientLegL += Math.sin(p * 0.7 + 2.0) * 0.02;
         ambientLegR += Math.sin(p * 1.1 + 3.0) * 0.02;
         ambientNod += Math.sin(p * 0.5) * 0.03;
         ambientShake += Math.cos(p * 0.6) * 0.02;
         ambientRoll += Math.sin(p * 0.4 + 1.5) * 0.025;

         // Occasional stretch mechanics
         const stretchCycle = Math.sin(t * 0.3) * Math.sin(t * 0.5) * Math.sin(t * 1.3);
         if (stretchCycle > 0.3) {
             const stretchAmount = (stretchCycle - 0.3) * 1.5;
             ambientArmL = stretchAmount * 0.5;
             ambientArmR = -stretchAmount * 0.5;
             ambientLegL = stretchAmount * 0.2;
             ambientLegR = -stretchAmount * 0.2;
             ambientNod -= stretchAmount * 0.15; 
             ambientShake += Math.sin(t * 2) * stretchAmount * 0.3;
         } else {
             // Look around mechanics
             const lookCycle = Math.cos(t * 0.4) * Math.cos(t * 0.8);
             if (lookCycle > 0.4) {
                 const lookAmount = (lookCycle - 0.4) * 2.0;
                 ambientShake += Math.sin(t * 1.1) * lookAmount * 0.8;
                 ambientNod += Math.cos(t * 1.3) * lookAmount * 0.4;
                 if (Math.sin(t * 5) > 0.8) ambientBlink = 1;
             }
         }
    }
    
    if (armLRef.current) {
        armLRef.current.rotation.x = THREE.MathUtils.lerp(armLRef.current.rotation.x, 0.2 + ambientArmL, alphaBase);
        armLRef.current.rotation.z = THREE.MathUtils.lerp(armLRef.current.rotation.z, (-Math.PI / 3.5) + armRotations.left + calibration.armL + ambientArmL, alphaBase);
    }
    if (armRRef.current) {
        armRRef.current.rotation.x = THREE.MathUtils.lerp(armRRef.current.rotation.x, 0.2 + ambientArmR, alphaBase);
        armRRef.current.rotation.z = THREE.MathUtils.lerp(armRRef.current.rotation.z, (Math.PI / 3.5) + armRotations.right + calibration.armR - ambientArmR, alphaBase);
    }
    if (legLRef.current) {
        legLRef.current.rotation.x = THREE.MathUtils.lerp(legLRef.current.rotation.x, 0.2 + legRotations.left + calibration.legL + ambientLegL, alphaBase);
    }
    if (legRRef.current) {
        legRRef.current.rotation.x = THREE.MathUtils.lerp(legRRef.current.rotation.x, 0.2 + legRotations.right + calibration.legR + ambientLegR, alphaBase);
    }
    
    // Calculate synthetic blendshapes from interaction
    let synthSmile = 0;
    let synthOpen = 0;
    let synthBrowUp = 0;
    let synthBlink = ambientBlink;
    let headNod = 0;
    let headShake = 0;
    let interactionNod = 0;
    let interactionShake = 0;

    // Expand eyes based on proximity (UltraSonic or camera tracking proxy if we used face size)
    // Distance < proxMax means expanding. mapping proxMax..10 to 0..0.8
    let proximityWideEyes = 0;
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

    const isDown = storeState.isPointerDown;
    const part = storeState.activeInteractivePart;
    if (isDown) {
      if (part === 'cheek') {
         synthSmile -= 0.6; // Ouch squeeze smile
         synthBlink += 0.8; // squeeze eyes shut
         headNod += Math.sin(state.clock.elapsedTime * 8) * 0.1; // head shake
         interactionShake += Math.sin(state.clock.elapsedTime * 6.0) * 0.15; // responsive side tilt
      } else if (part === 'stomach') {
         synthSmile += 1.2; // giggly happy face
         synthOpen += 0.7; // open mouth to laugh!
         synthBrowUp += 0.6; // happy high eyebrows
         // We will add scale jitter and limbs jitter
         ambientArmL += Math.sin(state.clock.elapsedTime * 40.0) * 0.12;
         ambientArmR += Math.cos(state.clock.elapsedTime * 40.0) * 0.12;
         ambientNod += Math.sin(state.clock.elapsedTime * 35.0) * 0.08;
      }
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
       // When far away, blend out face tracking influence and inject ambient motions
       const blendFactor = isFar ? 0.3 : 1.0;

       // Speculative Phase 6 - Joint Attention: Pointer Tracking Gaze
       const mouseX = state.pointer.x * 0.5; // Up to 30 deg horizontal
       const mouseY = state.pointer.y * 0.3; // Up to 17 deg vertical
       const isMouseActive = Math.abs(state.pointer.x) > 0.01 || Math.abs(state.pointer.y) > 0.01;

       // If face tracking is active (webcam or simulated slider), use headRotation;
       // otherwise, if the mouse is hovering / active over screen, point head to the cursor!
       const lookRotX = isFaceActive ? storeState.headRotation.x * blendFactor : (isMouseActive ? mouseY : 0);
       const lookRotY = isFaceActive ? storeState.headRotation.y * blendFactor : (isMouseActive ? -mouseX : 0);
       const lookRotZ = isFaceActive ? storeState.headRotation.z * blendFactor : 0;

       const targetRotX = lookRotX + headNod + ambientNod + calibration.x;
       const targetRotY = lookRotY + headShake + ambientShake + calibration.y;
       const targetRotZ = lookRotZ + (headShake * 0.5) + (ambientShake * 0.5) + ambientRoll + calibration.z;

       groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, alphaBase);
       groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, alphaBase);
       groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, alphaBase);
       
       // Expose display rotation and servo rotation to the store for Arduino to read
       // In Phase 6, we correctly bind physical Pan/Tilt servo angles to actual digital head positions!
       useStore.setState({
         displayRotation: {
           x: groupRef.current.rotation.x,
           y: groupRef.current.rotation.y,
           z: groupRef.current.rotation.z
         },
         servoRotation: {
           x: groupRef.current.rotation.x, // Vertical tilt mapping
           y: groupRef.current.rotation.y, // Horizontal pan mapping
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

        // Breathe mechanics
        let targetScaleY = 1.0;
        let targetScaleZ = 1.0;
        let targetScaleX = 1.0;

        if (isIdle) {
            // Nuanced, relaxed breathing when idle
            const tempPhase = breathPhaseRef.current;
            targetScaleY = 1.0 + Math.sin(tempPhase) * 0.03 + Math.sin(tempPhase * 0.5) * 0.01;
            targetScaleZ = 1.0 + Math.sin(tempPhase + 1.2) * 0.015;
            targetScaleX = 1.0 + Math.sin(tempPhase + 2.5) * 0.01;
        } else {
            // Standard/Active breathing
            const tempPhase = breathPhaseRef.current;
            targetScaleY = 1.0 + Math.sin(tempPhase) * (mood === 'sleepy' ? 0.03 : 0.015);
            targetScaleZ = 1.0 + Math.sin(tempPhase + 1.0) * 0.015;
            targetScaleX = 1.0 + Math.sin(tempPhase + 2.0) * 0.01;
        }

        groupRef.current.scale.y = THREE.MathUtils.lerp(groupRef.current.scale.y, targetScaleY, alphaSlow);
        groupRef.current.scale.z = THREE.MathUtils.lerp(groupRef.current.scale.z, targetScaleZ, alphaSlow);
        groupRef.current.scale.x = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScaleX, alphaSlow);

       // Blink animation
       if (leftEyeScaleRef.current) {
         const targetScaleY = targetEyeScaleBase - Math.min(blinkL * 1.5, 0.95);
         leftEyeScaleRef.current.scale.y = THREE.MathUtils.lerp(leftEyeScaleRef.current.scale.y, targetScaleY, alphaFast);
         leftEyeScaleRef.current.scale.x = THREE.MathUtils.lerp(leftEyeScaleRef.current.scale.x, targetEyeScaleBase, alphaFast);
         leftEyeScaleRef.current.scale.z = THREE.MathUtils.lerp(leftEyeScaleRef.current.scale.z, targetEyeScaleBase, alphaFast);
       }
       if (rightEyeScaleRef.current) {
         const targetScaleY = targetEyeScaleBase - Math.min(blinkR * 1.5, 0.95);
         rightEyeScaleRef.current.scale.y = THREE.MathUtils.lerp(rightEyeScaleRef.current.scale.y, targetScaleY, alphaFast);
         rightEyeScaleRef.current.scale.x = THREE.MathUtils.lerp(rightEyeScaleRef.current.scale.x, targetEyeScaleBase, alphaFast);
         rightEyeScaleRef.current.scale.z = THREE.MathUtils.lerp(rightEyeScaleRef.current.scale.z, targetEyeScaleBase, alphaFast);
       }

       // Look-At IK for eyes
       const eyeTarget = new THREE.Vector3();
       if (isFaceActive) {
         // Follow User Face (Derived from headRotation)
         eyeTarget.set(storeState.headRotation.y * -15, storeState.headRotation.x * 15, 10);
       } else {
         // Speculative Phase 6 - Eyes follow screen pointer
         const mouseX = state.pointer.x * 15;
         const mouseY = state.pointer.y * 10;
         
         const lookTime = state.clock.elapsedTime * 0.5;
         let ambientLookX = Math.sin(lookTime * 2.1) * 3;
         let ambientLookY = Math.cos(lookTime * 1.5) * 2;
         
         if (mood === 'sleepy') {
             ambientLookY -= 3.0;
         } else if (mood === 'hyper') {
             ambientLookX += Math.sin(state.clock.elapsedTime * 24.5) * 1.2;
             ambientLookY += Math.cos(state.clock.elapsedTime * 28.2) * 1.2;
         } else if (mood === 'angry') {
             ambientLookX += Math.sin(state.clock.elapsedTime * 18.0) * 0.7;
             ambientLookY += Math.cos(state.clock.elapsedTime * 21.4) * 0.5;
         }
         
         // Smooth blend pointer focus vs ambient wander
         const isMouseActive = Math.abs(state.pointer.x) > 0.01 || Math.abs(state.pointer.y) > 0.01;
         const lookX = isMouseActive ? THREE.MathUtils.lerp(ambientLookX, mouseX, 0.85) : ambientLookX;
         const lookY = isMouseActive ? THREE.MathUtils.lerp(ambientLookY, mouseY, 0.85) : ambientLookY;
         
         eyeTarget.set(lookX, lookY, 10);
       }
       
       // Convert dummy target to world pos, assuming bear is at origin.
       // Group rotates, but eyeballs are inside the rotating group, so lookAt needs a world position!
       const worldEyeTarget = groupRef.current.localToWorld(eyeTarget.clone());
       if (leftEyeRef.current) leftEyeRef.current.lookAt(worldEyeTarget);
       if (rightEyeRef.current) rightEyeRef.current.lookAt(worldEyeTarget);

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
       const smoothedSmileL = THREE.MathUtils.lerp(prevSmileL.current || 0, smileL, alphaFast);
       const smoothedSmileR = THREE.MathUtils.lerp(prevSmileR.current || 0, smileR, alphaFast);
       const smoothedMouthOpen = THREE.MathUtils.lerp(prevMouthOpen.current || 0, mouthOpenVal, alphaFast);
       
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
    const armGeo = new THREE.CapsuleGeometry(0.42, 0.4, 32, 32);
    armGeo.translate(0, -0.3, 0); // Pivot at top
    const armLGeo = processGeo(armGeo.clone());
    const armRGeo = processGeo(armGeo.clone());

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.52, 0.3, 32, 32);
    legGeo.translate(0, -0.25, 0); // Pivot at top
    const legLGeo = processGeo(legGeo.clone());
    const legRGeo = processGeo(legGeo.clone());

    return { mainGeo, armLGeo, armRGeo, legLGeo, legRGeo };
  }, []);

  const storeAmbientColor = useStore(state => state.ambientColor);
  const qualityMode = useStore(state => state.qualityMode);

  const { furRenderingMode, shellCount, furlDensity, rootColor: baseRootColor, tipColor: baseTipColor, thickness, length } = useControls('Appearance', {
    furRenderingMode: {
      options: ['Volumetric Shells (Plush)', 'Instanced Strands (Fuzzy)'],
      value: 'Volumetric Shells (Plush)'
    },
    shellCount: { value: 18, min: 6, max: 32, step: 1 },
    furlDensity: { value: 200.0, min: 40.0, max: 300.0, step: 10 },
    rootColor: '#5c3523',
    tipColor: '#d6a378',
    thickness: { value: 0.004, min: 0.0005, max: 0.02 },
    length: { value: 0.06, min: 0.02, max: 0.4 }
  });

  const activeShellCount = useMemo(() => {
    if (qualityMode === 'powersave') return 6;
    if (qualityMode === 'standard') return 12;
    return shellCount;
  }, [qualityMode, shellCount]);

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
          partName="body"
          furMode={furRenderingMode}
          shellCount={activeShellCount}
          furlDensity={furlDensity}
      />

      <group ref={armLRef} position={[-1.2, -0.05, 0.4]} rotation={[0.2, 0, -Math.PI / 3.5]}>
        <FurryPart 
            geometry={geometries.armLGeo} 
            rootColor={rootColor} 
            tipColor={tipColor} 
            thickness={thickness} 
            length={length} 
            partName="left_arm"
            furMode={furRenderingMode}
            shellCount={activeShellCount}
            furlDensity={furlDensity}
        />
      </group>

      <group ref={armRRef} position={[1.2, -0.05, 0.4]} rotation={[0.2, 0, Math.PI / 3.5]}>
        <FurryPart 
            geometry={geometries.armRGeo} 
            rootColor={rootColor} 
            tipColor={tipColor} 
            thickness={thickness} 
            length={length} 
            partName="right_arm"
            furMode={furRenderingMode}
            shellCount={activeShellCount}
            furlDensity={furlDensity}
        />
      </group>

      <group ref={legLRef} position={[-0.55, -1.6, 0.6]} rotation={[0.2, 0, 0.1]}>
        <FurryPart 
            geometry={geometries.legLGeo} 
            rootColor={rootColor} 
            tipColor={tipColor} 
            thickness={thickness} 
            length={length} 
            partName="left_leg"
            furMode={furRenderingMode}
            shellCount={activeShellCount}
            furlDensity={furlDensity}
        />
      </group>

      <group ref={legRRef} position={[0.55, -1.6, 0.6]} rotation={[0.2, 0, -0.1]}>
        <FurryPart 
            geometry={geometries.legRGeo} 
            rootColor={rootColor} 
            tipColor={tipColor} 
            thickness={thickness} 
            length={length} 
            partName="right_leg"
            furMode={furRenderingMode}
            shellCount={activeShellCount}
            furlDensity={furlDensity}
        />
      </group>

      {/* Face Details - Placed without fur so they stand out */}
      <group>
        {/* Left Eye */}
        <group ref={leftEyeScaleRef} position={[-0.48, 0.75, 1.15]}>
          <group ref={leftEyeRef}>
            <mesh>
              <sphereGeometry args={[0.13, 32, 32]} />
              <meshStandardMaterial color="#f0f0f0" roughness={0.1} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <sphereGeometry args={[0.08, 32, 32]} />
              <meshStandardMaterial color="#3b1f14" roughness={0.1} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.12]}>
              <sphereGeometry args={[0.05, 32, 32]} />
              <meshStandardMaterial color="#050505" roughness={0.0} metalness={0.9} />
            </mesh>
          </group>
        </group>
        
        {/* Left Brow */}
        <mesh ref={leftBrowRef} position={[-0.45, 0.90, 1.15]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.15, 0.04, 0.05]} />
          <meshStandardMaterial color="#3b2014" roughness={0.9} />
        </mesh>

        {/* Right Eye */}
        <group ref={rightEyeScaleRef} position={[0.48, 0.75, 1.15]}>
          <group ref={rightEyeRef}>
            <mesh>
              <sphereGeometry args={[0.13, 32, 32]} />
              <meshStandardMaterial color="#f0f0f0" roughness={0.1} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <sphereGeometry args={[0.08, 32, 32]} />
              <meshStandardMaterial color="#3b1f14" roughness={0.1} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.12]}>
              <sphereGeometry args={[0.05, 32, 32]} />
              <meshStandardMaterial color="#050505" roughness={0.0} metalness={0.9} />
            </mesh>
          </group>
        </group>

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

      {/* Interactive Raycasting Hotspots with Pulsing Visual Guides */}
      {((window as any)._showInteractiveHotspots !== false) && (
        <group>
          {/* Left Cheek Pinch Hotspot */}
          <mesh 
            position={[-0.60, 0.45, 1.25]}
            onPointerDown={(e) => {
              e.stopPropagation();
              useStore.getState().setIsPointerDown(true);
              useStore.getState().setActiveInteractivePart('cheek');
              useStore.getState().setInteractionMode('Pinch');
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              useStore.getState().setIsPointerDown(false);
            }}
          >
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshBasicMaterial 
              color="#818cf8" 
              wireframe 
              transparent 
              opacity={0.35 + Math.sin(Date.now() / 220) * 0.15} 
            />
          </mesh>

          {/* Right Cheek Pinch Hotspot */}
          <mesh 
            position={[0.60, 0.45, 1.25]}
            onPointerDown={(e) => {
              e.stopPropagation();
              useStore.getState().setIsPointerDown(true);
              useStore.getState().setActiveInteractivePart('cheek');
              useStore.getState().setInteractionMode('Pinch');
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              useStore.getState().setIsPointerDown(false);
            }}
          >
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshBasicMaterial 
              color="#818cf8" 
              wireframe 
              transparent 
              opacity={0.35 + Math.sin(Date.now() / 220) * 0.15} 
            />
          </mesh>

          {/* Stomach Tickle Hotspot */}
          <mesh 
            position={[0, -0.75, 1.22]}
            onPointerDown={(e) => {
              e.stopPropagation();
              useStore.getState().setIsPointerDown(true);
              useStore.getState().setActiveInteractivePart('stomach');
              useStore.getState().setInteractionMode('Tickle');
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              useStore.getState().setIsPointerDown(false);
            }}
          >
            <sphereGeometry args={[0.32, 16, 16]} />
            <meshBasicMaterial 
              color="#f43f5e" 
              wireframe 
              transparent 
              opacity={0.35 + Math.sin(Date.now() / 220) * 0.15} 
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
