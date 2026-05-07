import { create } from 'zustand';

interface AppState {
  headRotation: { x: number; y: number; z: number };
  displayRotation: { x: number; y: number; z: number };
  servoRotation: { x: number; y: number; z: number };
  setHeadRotation: (rotation: { x: number; y: number; z: number }) => void;
  setDisplayRotation: (rotation: { x: number; y: number; z: number }) => void;
  armRotations: { left: number; right: number };
  setArmRotations: (rot: { left: number; right: number }) => void;
  legRotations: { left: number; right: number };
  setLegRotations: (rot: { left: number; right: number }) => void;
  faceTrackingActive: boolean;
  setFaceTrackingActive: (active: boolean) => void;
  blendshapes: {
    eyeBlinkLeft: number;
    eyeBlinkRight: number;
    mouthSmileLeft: number;
    mouthSmileRight: number;
    mouthOpen: number;
    browInnerUp: number;
    browOuterUpLeft: number;
    browOuterUpRight: number;
  };
  setBlendshapes: (shapes: { 
    eyeBlinkLeft: number; 
    eyeBlinkRight: number; 
    mouthSmileLeft: number;
    mouthSmileRight: number;
    mouthOpen: number;
    browInnerUp: number;
    browOuterUpLeft: number;
    browOuterUpRight: number;
  }) => void;
  
  // TUI and Hardware Config 
  mood: 'neutral' | 'hyper' | 'sleepy' | 'loving' | 'angry';
  setMood: (mood: 'neutral' | 'hyper' | 'sleepy' | 'loving' | 'angry') => void;
  calibrationAngles: { x: number; y: number; z: number; armL: number; armR: number; legL: number; legR: number };
  setCalibrationAngles: (angles: Partial<{ x: number; y: number; z: number; armL: number; armR: number; legL: number; legR: number }>) => void;

  // Environmental Data
  ambientLight: number;
  setAmbientLight: (light: number) => void;
  nightModeLightThreshold: number;
  setNightModeLightThreshold: (threshold: number) => void;
  userDistance: number;
  setUserDistance: (distance: number) => void;
  proximityMaxDistance: number;
  setProximityMaxDistance: (distance: number) => void;
  ambientColor: string;
  setAmbientColor: (color: string) => void;
  handTrackingActive: boolean;
  setHandTrackingActive: (active: boolean) => void;

  // Interaction State
  interactionMode: string;
  setInteractionMode: (mode: string) => void;
  interactionActivity: number;
  setInteractionActivity: (activity: number) => void;
  isPointerDown: boolean;
  setIsPointerDown: (down: boolean) => void;
  
  // Tracking State
  armTrackingActive: boolean;
  setArmTrackingActive: (active: boolean) => void;
  
  // Serial Connection
  serialPort: SerialPort | null;
  serialWriter: WritableStreamDefaultWriter | null;
  lastSerialSend?: number;
  connectSerial: () => Promise<void>;
  sendSerialData: (data: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  headRotation: { x: 0, y: 0, z: 0 },
  displayRotation: { x: 0, y: 0, z: 0 },
  servoRotation: { x: 0, y: 0, z: 0 },
  armRotations: { left: 0, right: 0 },
  setArmRotations: (rot) => set({ armRotations: rot }),
  legRotations: { left: 0, right: 0 },
  setLegRotations: (rot) => set({ legRotations: rot }),
  setHeadRotation: (rotation) => {
    set({ headRotation: rotation });
  },
  setDisplayRotation: (rotation) => set({ displayRotation: rotation }),
  faceTrackingActive: false,
  setFaceTrackingActive: (active) => set({ faceTrackingActive: active }),
  blendshapes: { 
    eyeBlinkLeft: 0, 
    eyeBlinkRight: 0, 
    mouthSmileLeft: 0,
    mouthSmileRight: 0,
    mouthOpen: 0,
    browInnerUp: 0,
    browOuterUpLeft: 0,
    browOuterUpRight: 0
  },
  setBlendshapes: (shapes) => set({ blendshapes: shapes }),

  // TUI and Hardware Config
  mood: 'neutral',
  setMood: (mood) => set({ mood }),
  calibrationAngles: { x: 0, y: 0, z: 0, armL: 0, armR: 0, legL: 0, legR: 0 },
  setCalibrationAngles: (angles) => set((state) => ({ calibrationAngles: { ...state.calibrationAngles, ...angles } })),

  ambientLight: 100,
  setAmbientLight: (light) => set({ ambientLight: light }),
  nightModeLightThreshold: 200,
  setNightModeLightThreshold: (threshold) => set({ nightModeLightThreshold: threshold }),
  userDistance: 100,
  setUserDistance: (distance) => set({ userDistance: distance }),
  proximityMaxDistance: 80,
  setProximityMaxDistance: (distance) => set({ proximityMaxDistance: distance }),
  ambientColor: '#ffffff',
  setAmbientColor: (color) => set({ ambientColor: color }),
  handTrackingActive: false,
  setHandTrackingActive: (active) => set({ handTrackingActive: active }),

  // Interaction State
  interactionMode: 'Push',
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  interactionActivity: 0,
  setInteractionActivity: (activity) => set({ interactionActivity: activity }),
  isPointerDown: false,
  setIsPointerDown: (down) => set({ isPointerDown: down }),

  armTrackingActive: false,
  setArmTrackingActive: (active) => set({ armTrackingActive: active }),

  serialPort: null,
  serialWriter: null,
  connectSerial: async () => {
    try {
      if (!('serial' in navigator)) {
        alert('Web Serial API is not supported in this browser. Please use Chrome or Edge Desktop.');
        return;
      }
      
      const port = await navigator.serial.requestPort();
      
      try {
        await port.open({ baudRate: 9600 });
      } catch (openError: any) {
        console.error('Failed to open serial port:', openError);
        alert(`Failed to open serial port. Please make sure the port is not in use by another application (like the Arduino IDE Serial Monitor).\n\nDetails: ${openError.message}`);
        return;
      }
      
      // Setup Writer
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();
      
      set({ serialPort: port, serialWriter: writer });
      console.log('Serial port connected!');

      // Setup Reader
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();

      // Read loop
      (async () => {
        let buffer = '';
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              buffer += value;
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep the incomplete line in buffer
              
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('TUI:')) {
                  const newMood = trimmed.substring(4).toLowerCase();
                  if (['neutral', 'hyper', 'sleepy', 'loving', 'angry'].includes(newMood)) {
                    set({ mood: newMood as any });
                    console.log('TUI Command received, setting mood to:', newMood);
                  }
                } else if (trimmed.startsWith('ENV:')) {
                  const parts = trimmed.substring(4).split(',');
                  if (parts.length === 2) {
                    const l = parseInt(parts[0], 10);
                    const d = parseInt(parts[1], 10);
                    if (!isNaN(l)) set({ ambientLight: l });
                    if (!isNaN(d)) set({ userDistance: d });

                    // Auto switch mood based on light
                    const threshold = get().nightModeLightThreshold;
                    if (!isNaN(l) && l < threshold) { 
                      set({ mood: 'sleepy' });
                    } else if (get().mood === 'sleepy' && !isNaN(l) && l > threshold + 100) {
                      set({ mood: 'neutral' });
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Read loop error:", error);
        } finally {
          reader.releaseLock();
        }
      })();

    } catch (e) {
      console.error('Failed to connect to serial port:', e);
    }
  },
  sendSerialData: async (data: string) => {
    const { serialWriter } = get();
    if (serialWriter) {
      try {
        await serialWriter.write(data);
      } catch (e) {
        console.error('Error writing to serial:', e);
      }
    }
  }
}));
