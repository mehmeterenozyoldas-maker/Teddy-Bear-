import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useControls } from 'leva';
import { useStore } from '../store';

// FBO Ping-Pong Vertex Shader
const simVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// FBO Fur Brushing Shader
// Stores 2D tangent-space displacement in (r, g), and velocity in (b, a)
const simFragmentShader = `
uniform sampler2D positionsTexture;
uniform sampler2D normalsTexture;
uniform sampler2D stateTexture;
uniform vec3 uMousePos;
uniform vec3 uMouseDelta;
uniform float uDeltaTime;
uniform float uInteractionForce;
uniform float uInteractionRadius;
uniform int uInteractionMode;
uniform int uPointerDown;

varying vec2 vUv;

float hash(vec2 p) {
    return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x))));
}

void main() {
  vec3 wPos = texture2D(positionsTexture, vUv).xyz;
  vec3 normal = texture2D(normalsTexture, vUv).xyz;
  vec4 stateInfo = texture2D(stateTexture, vUv);
  
  vec2 disp = stateInfo.rg;
  vec2 vel = stateInfo.ba;

  float dt = min(uDeltaTime, 0.05);

  float dist = distance(wPos, uMousePos);
  vec2 force = vec2(0.0);
  
  if (dist < uInteractionRadius) {
    vec3 dir3D = wPos - uMousePos;
    float influence = smoothstep(uInteractionRadius, 0.0, dist);
    
    // Transform dir3D into tangent space using the same logic as vertex shader
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 axis = cross(up, normal);
    float angle = acos(dot(up, normal));
    mat3 rot;
    if (length(axis) < 0.0001) {
      rot = mat3(1.0);
      if (dot(up, normal) < 0.0) { 
        rot = mat3(1.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0, -1.0);
      }
    } else {
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
    
    // transpose(rot) = inverse of rotation
    mat3 invRot = mat3(
        rot[0][0], rot[1][0], rot[2][0],
        rot[0][1], rot[1][1], rot[2][1],
        rot[0][2], rot[1][2], rot[2][2]
    );
    
    vec3 localDir = invRot * dir3D;
    vec2 dir2D = normalize(vec2(localDir.x, localDir.z) + vec2(0.01)); // tangent plane direction

    if (uInteractionMode == 0) {
      force = dir2D * pow(influence, 2.0) * uInteractionForce; 
    } else if (uInteractionMode == 1) {
      vec3 localDelta = invRot * uMouseDelta;
      float speed = length(localDelta.xz);
      if (speed > 0.001) {
         force = normalize(localDelta.xz + vec2(0.001)) * speed * influence * (uInteractionForce * 150.0);
      } else {
         force = dir2D * pow(influence, 2.0) * (uInteractionForce * 0.2); 
      }
    } else if (uInteractionMode == 2) {
      vec2 perp = vec2(-dir2D.y, dir2D.x);
      force = normalize(perp) * pow(influence, 1.5) * uInteractionForce * 1.5;
    } else if (uInteractionMode == 3) {
      force = -dir2D * pow(influence, 2.0) * uInteractionForce * 2.0;
    } else if (uInteractionMode == 4) { // Pet
      vec3 localDelta = invRot * uMouseDelta;
      float speed = length(localDelta.xz);
      vec2 petDir = normalize(localDelta.xz + vec2(0.0, 1.0)); // Down is +y in local UV space usually
      if (speed > 0.001) {
         force = petDir * speed * influence * (uInteractionForce * 80.0);
      } else {
         force = vec2(0.0, 1.0) * pow(influence, 2.0) * (uInteractionForce * 0.1); 
      }
    } else if (uInteractionMode == 5) { // Poke
      if (uPointerDown == 1) {
         force = dir2D * pow(influence, 4.0) * uInteractionForce * 15.0;
      } else {
         force = dir2D * pow(influence, 4.0) * uInteractionForce * 2.0;
      }
    } else if (uInteractionMode == 6) { // Grab
      if (uPointerDown == 1) {
         force = -dir2D * pow(influence, 1.0) * uInteractionForce * 8.0;
      } else {
         force = -dir2D * pow(influence, 1.0) * uInteractionForce * 1.5;
      }
    } else if (uInteractionMode == 7) { // Tap
      if (uPointerDown == 1) {
         force = dir2D * pow(influence, 8.0) * uInteractionForce * 10.0;
      } else {
         force = vec2(0.0);
      }
    }
  }

  // Micro-wind rustling (organic movement)
  float n1 = hash(vUv + dt * 0.01) - 0.5;
  float n2 = hash(vUv * 2.0 - dt * 0.01) - 0.5;
  force += vec2(n1, n2) * 1.5;

  // Spring behavior
  float k = 10.0; 
  float c = 6.0;  

  vec2 acc = -k * disp - c * vel + force;
  
  vel += acc * dt;
  disp += vel * dt;

  // Enhance range of movement
  disp = clamp(disp, vec2(-2.5), vec2(2.5));
  vel = clamp(vel, vec2(-15.0), vec2(15.0));

  gl_FragColor = vec4(disp, vel);
}
`;

interface HairSystemProps {
  positionsTexture: THREE.DataTexture;
  normalsTexture: THREE.DataTexture;
  mousePositionRef: React.MutableRefObject<THREE.Vector3>;
  count: number;
  size: number;
  rootColor: string;
  tipColor: string;
  thickness: number;
  length: number;
}

interface InteractionControls {
  interactionForce: number;
  interactionRadius: number;
  interactionMode: string;
}

export default function HairSystem({ positionsTexture, normalsTexture, mousePositionRef, count, size, rootColor, tipColor, thickness, length }: HairSystemProps) {
  const setInteractionMode = useStore(s => s.setInteractionMode);
  const setInteractionActivity = useStore(s => s.setInteractionActivity);

  const { interactionForce, interactionRadius, interactionMode } = useControls('Interaction', {
    interactionMode: { 
       options: ['Push', 'Stroke', 'Tickle', 'Pinch', 'Pet', 'Poke', 'Grab', 'Tap'],
       onChange: (v) => setInteractionMode(v)
    },
    interactionForce: { value: 2.0, min: 0.1, max: 10.0 },
    interactionRadius: { value: 0.5, min: 0.1, max: 2.0 }
  }) as InteractionControls;

  const modeToNum: Record<string, number> = {
    'Push': 0,
    'Stroke': 1,
    'Tickle': 2,
    'Pinch': 3,
    'Pet': 4,
    'Poke': 5,
    'Grab': 6,
    'Tap': 7
  };

  const { gl } = useThree();

  const [targetA, targetB] = useMemo(() => {
    const format = THREE.RGBAFormat;
    const type = THREE.FloatType;
    const rt = new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format,
      type,
    });
    return [rt, rt.clone()];
  }, [size]);

  const simMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: simVertexShader,
      fragmentShader: simFragmentShader,
      uniforms: {
        positionsTexture: { value: positionsTexture },
        normalsTexture: { value: normalsTexture },
        stateTexture: { value: null },
        uMousePos: { value: new THREE.Vector3() },
        uMouseDelta: { value: new THREE.Vector3() },
        uDeltaTime: { value: 0 },
        uInteractionForce: { value: interactionForce },
        uInteractionRadius: { value: interactionRadius },
        uInteractionMode: { value: 0 },
        uPointerDown: { value: 0 },
      },
    });
  }, [positionsTexture, normalsTexture]);

  const simScene = useMemo(() => {
    const sc = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    sc.add(mesh);
    return { scene: sc, camera, mesh };
  }, [simMaterial]);

  const hairMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
        uniforms: {
        positionsTexture: { value: positionsTexture },
        normalsTexture: { value: normalsTexture },
        stateTexture: { value: null },
        uTime: { value: 0 },
        uRootColor: { value: new THREE.Color(rootColor) },
        uTipColor: { value: new THREE.Color(tipColor) },
        uThickness: { value: thickness },
        uLength: { value: length }
      },
      vertexShader: `
        uniform sampler2D positionsTexture;
        uniform sampler2D normalsTexture;
        uniform sampler2D stateTexture;
        uniform float uTime;
        uniform float uThickness;
        uniform float uLength;
        
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vBaseNormal;
        
        // Pseudo-random noise for length mapping and clumping
        float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

        void main() {
          vUv = uv;
          float i = float(gl_InstanceID);
          float size = ${size.toFixed(1)};
          float u = fract(i / size);
          float v = floor(i / size) / size;
          vec2 texUv = vec2(u, v);
          
          vec3 wPos = texture2D(positionsTexture, texUv).xyz;
          vec3 normal = texture2D(normalsTexture, texUv).xyz;
          // Rotate the normal using the modelMatrix's rotation (normalMatrix)
          vBaseNormal = normalize(normalMatrix * normal);
          
          vec2 disp = texture2D(stateTexture, texUv).rg;
          
          vec3 p = position;
          
          // Organic Vellus Hair (Peach Fuzz) Geometry
          float curve = uv.y; // 0 at root, 1 at tip
          
          // Taper to tip and randomize thickness slightly
          float t = uThickness + hash(texUv) * (uThickness * 0.5);
          p.x *= t * (1.0 - curve * 0.9); 
          p.z *= t * (1.0 - curve * 0.9);
          
          // Fuzz length variation
          float lengthMod = uLength + hash(texUv * 2.0) * (uLength * 0.4);
          p.y *= lengthMod; 
          
          // 1. Calculate Rotation to orient hair root locally
          vec3 up = vec3(0.0, 1.0, 0.0);
          vec3 axis = cross(up, normal);
          float angle = acos(dot(up, normal));
          
          mat3 rot;
          if (length(axis) < 0.0001) {
            rot = mat3(1.0);
            if (dot(up, normal) < 0.0) { 
              rot = mat3(1.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0, -1.0);
            }
          } else {
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
          
          // 2. Add local tangent-space displacement (from mouse interaction and wind)
          vec2 clumpOffset = vec2(
             0.02 + sin(wPos.x * 5.0) * 0.01,
             0.02 + cos(wPos.x * 5.0) * 0.01
          );
          
          vec2 localDisp = disp + clumpOffset;
          
          // Apply local bending before rotation (along X and Z of the untransformed hair)
          p.x += localDisp.x * (curve * curve);
          p.z += localDisp.y * (curve * curve);
          
          // Rotate hair to face along the normal
          p = rot * p;

          // 3. Add World-Space Bending Attributes (Gravity & Global Wind)
          vec3 worldBend = vec3(0.0);
          
          // Stronger, realistic gravity (droops down on Y)
          // The hair is soft, so tip sags heavily
          vec3 gravity = vec3(0.0, -2.5, 0.0) * uLength; 
          worldBend += gravity;
          
          // Add some wind/frizz in world space
          float frizz = hash(texUv * 5.0) * 0.1 * curve;
          worldBend.x += sin(curve * 15.0 + uTime * 2.0) * frizz;
          worldBend.y += sin(curve * 20.0 + uTime * 2.1) * frizz * 0.5;
          worldBend.z += cos(curve * 15.0 + uTime * 1.9) * frizz;

          // Apply parabolic world bending (tips bend more)
          p += worldBend * (curve * curve);
          
          vec3 localPos = p + wPos;
          
          // Apply model transformation (rotation/translation from React Three Fiber group)
          vec4 worldPosition = modelMatrix * vec4(localPos, 1.0);
          vWorldPosition = worldPosition.xyz;
          
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vBaseNormal;
        uniform float uTime;
        uniform vec3 uRootColor;
        uniform vec3 uTipColor;

        void main() {
          float curve = vUv.y;
          
          // Interpolate softly over the length of the strand (smooth quadratic blending)
          vec3 color = mix(uRootColor, uTipColor, curve * curve * (3.0 - 2.0 * curve));

          // Key Light (warm)
          vec3 keyLightDir = normalize(vec3(4.0, 5.0, 4.0));
          vec3 keyColor = vec3(1.0, 0.85, 0.76); 
          float diffuse = max(dot(vBaseNormal, keyLightDir), 0.0);
          color += uTipColor * keyColor * diffuse * 0.5 * curve;

          // Fill Light (cool)
          vec3 fillLightDir = normalize(vec3(-4.0, 2.0, 4.0));
          vec3 fillColor = vec3(0.83, 0.88, 1.0); 
          float fillDiffuse = max(dot(vBaseNormal, fillLightDir), 0.0);
          color += uRootColor * fillColor * fillDiffuse * 0.3;

          // Cinematic Subsurface Rim / Backlight
          // We compute the view vector and check if light is shining through the hair from behind
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 rimLightDir = normalize(vec3(0.0, 6.0, -6.0)); 
          
          // Backlight contribution (light coming from opposite to normal)
          float backlight = max(dot(-vBaseNormal, rimLightDir), 0.0); 
          // Fresnel rim (view perpendicular to normal)
          float viewDot = max(dot(viewDir, vBaseNormal), 0.0);
          float rim = pow(1.0 - viewDot, 3.0);
          vec3 rimColor = vec3(1.0, 0.92, 0.8);
          
          // Vellus hair explodes with light when backlit
          color += rimColor * backlight * rim * 2.0 * curve;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide
    });
  }, [positionsTexture, normalsTexture, size]);

  const hairGeometry = useMemo(() => {
    // Increased horizontal segments for smoother curving fur strands
    const geo = new THREE.CylinderGeometry(1.0, 1.0, 1, 5, 12);
    geo.translate(0, 0.5, 0); 
    return geo;
  }, []);

  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const currentTarget = useRef(targetA);
  const prevTarget = useRef(targetB);

  const prevMousePos = useRef(new THREE.Vector3(-999, -999, -999));
  const activityRef = useRef<number>(0);

  useFrame((state, delta) => {
    simMaterial.uniforms.stateTexture.value = prevTarget.current.texture;
    
    const mousePos = mousePositionRef.current;
    let currentSpeed = 0;
    if (mousePos.x !== -999) { // Avoid jumping when mouse enters
        if (prevMousePos.current.x === -999) {
           prevMousePos.current.copy(mousePos);
        }
        const velocity = new THREE.Vector3().subVectors(mousePos, prevMousePos.current).divideScalar(delta || 0.016);
        currentSpeed = velocity.length();
        simMaterial.uniforms.uMouseDelta.value.copy(velocity);
    } else {
        simMaterial.uniforms.uMouseDelta.value.set(0, 0, 0);
    }
    prevMousePos.current.copy(mousePos);

    // Track activity (decay over time and add speed)
    activityRef.current = Math.max(0, activityRef.current - delta * 2.0); // decay
    if (useStore.getState().isPointerDown) {
       activityRef.current = Math.min(1.0, activityRef.current + delta * 5.0);
    } else if (currentSpeed > 0) {
       activityRef.current = Math.min(1.0, activityRef.current + currentSpeed * delta * 0.5);
    }
    // Only update store occasionally to avoid React re-renders every frame if possible
    // Wait, zustand is fast, it's ok, but maybe only once every few frames? 
    // Organic mesh might not be re-rendering but subscribing!
    
    useStore.getState().setInteractionActivity(activityRef.current);

    simMaterial.uniforms.uMousePos.value.copy(mousePos);
    simMaterial.uniforms.uDeltaTime.value = delta;
    simMaterial.uniforms.uInteractionForce.value = interactionForce;
    simMaterial.uniforms.uInteractionRadius.value = interactionRadius;
    simMaterial.uniforms.uInteractionMode.value = modeToNum[interactionMode] || 0;
    simMaterial.uniforms.uPointerDown.value = useStore.getState().isPointerDown ? 1 : 0;
    
    gl.setRenderTarget(currentTarget.current);
    gl.render(simScene.scene, simScene.camera);
    gl.setRenderTarget(null);

    hairMaterial.uniforms.stateTexture.value = currentTarget.current.texture;
    hairMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    hairMaterial.uniforms.uRootColor.value.set(rootColor);
    hairMaterial.uniforms.uTipColor.value.set(tipColor);
    hairMaterial.uniforms.uThickness.value = thickness;
    hairMaterial.uniforms.uLength.value = length;
    
    const temp = currentTarget.current;
    currentTarget.current = prevTarget.current;
    prevTarget.current = temp;
  });

  return (
    <instancedMesh ref={instancedRef} args={[hairGeometry, hairMaterial, count]} frustumCulled={false} />
  );
}
