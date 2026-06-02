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
  faceSimulated: boolean;
  setFaceSimulated: (simulated: boolean) => void;
  activeMelody: string | null;
  setActiveMelody: (melody: string | null) => void;
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
  
  isHardwareTouched: boolean;
  setIsHardwareTouched: (touched: boolean) => void;
  ledColor: { r: number, g: number, b: number };
  setLedColor: (color: { r: number, g: number, b: number }) => void;
  
  // Tracking State
  armTrackingActive: boolean;
  setArmTrackingActive: (active: boolean) => void;
  activeInteractivePart: string | null;
  setActiveInteractivePart: (part: string | null) => void;
  
  // Serial Connection
  serialStatus: 'disconnected' | 'connecting' | 'handshaking' | 'connected' | 'error';
  serialPort: SerialPort | null;
  serialWriter: WritableStreamDefaultWriter | null;
  lastSerialSend?: number;
  connectSerial: () => Promise<void>;
  sendSerialData: (data: string) => Promise<void>;

  // Emulation Sandbox & Quality Profile (Phase 5)
  serialLogs: Array<{ id: string; timestamp: string; dir: 'TX' | 'RX'; text: string }>;
  addSerialLog: (dir: 'TX' | 'RX', text: string) => void;
  clearSerialLogs: () => void;
  qualityMode: 'cinematic' | 'standard' | 'powersave';
  setQualityMode: (mode: 'cinematic' | 'standard' | 'powersave') => void;
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
  faceSimulated: false,
  setFaceSimulated: (simulated) => set({ faceSimulated: simulated }),
  activeMelody: null,
  setActiveMelody: (melody) => set({ activeMelody: melody }),
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

  isHardwareTouched: false,
  setIsHardwareTouched: (touched) => set({ isHardwareTouched: touched }),
  ledColor: { r: 0, g: 0, b: 0 },
  setLedColor: (color) => set({ ledColor: color }),

  armTrackingActive: false,
  setArmTrackingActive: (active) => set({ armTrackingActive: active }),
  activeInteractivePart: null,
  setActiveInteractivePart: (part) => set({ activeInteractivePart: part }),

  serialStatus: 'disconnected',
  serialPort: null,
  serialWriter: null,
  serialLogs: [],
  addSerialLog: (dir, text) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      serialLogs: [...state.serialLogs, { id, timestamp, dir, text }].slice(-60)
    }));
  },
  clearSerialLogs: () => set({ serialLogs: [] }),
  qualityMode: 'cinematic',
  setQualityMode: (mode) => set({ qualityMode: mode }),

  connectSerial: async () => {
    try {
      if (!('serial' in navigator)) {
        alert('Web Serial API is not supported in this browser. Please use Chrome or Edge Desktop.');
        return;
      }
      
      set({ serialStatus: 'connecting' });
      get().addSerialLog('TX', 'Connecting to Web Serial port...');
      const port = await navigator.serial.requestPort();
      
      try {
        await port.open({ baudRate: 9600 });
      } catch (openError: any) {
        console.error('Failed to open serial port:', openError);
        set({ serialStatus: 'error' });
        get().addSerialLog('RX', `Error: Open failed - ${openError.message}`);
        alert(`Failed to open serial port. Please make sure the port is not in use by another application (like the Arduino IDE Serial Monitor).\n\nDetails: ${openError.message}`);
        return;
      }
      
      // Setup Writer
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();
      
      set({ serialPort: port, serialWriter: writer, serialStatus: 'handshaking' });
      console.log('Serial port opened, initiating handshake...');
      get().addSerialLog('TX', 'Serial port opened. Active handshake initiation...');

      // Send Handshake SYN packet
      try {
        await writer.write("SYN\n");
        get().addSerialLog('TX', 'SYN (Handshake Request)');
      } catch (wErr) {
        console.error("Failed to write initial SYN handshake packet:", wErr);
      }

      // 3.5s Fallback promotion in case standard/custom firmware does not support SYN/ACK handshaking
      const fallbackTimeout = setTimeout(() => {
        const currentStatus = get().serialStatus;
        if (currentStatus === 'handshaking') {
          console.warn('Handshake SYN timed out. Auto-promoting to legacy "connected" fallback.');
          get().addSerialLog('TX', 'Warning: SYN timeout. Auto-promoting to Legacy Fallback Mode');
          set({ serialStatus: 'connected' });
        }
      }, 3500);

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
                
                // Track handshake acknowledgement packages
                if (trimmed === 'ACK' || trimmed === 'READY' || trimmed.startsWith('ACK:')) {
                  console.log('Handshake verified successfully with:', trimmed);
                  get().addSerialLog('RX', trimmed + ' -> Handshake Established!');
                  clearTimeout(fallbackTimeout);
                  set({ serialStatus: 'connected' });
                  continue;
                }

                // Log any general incoming lines in sandbox console
                get().addSerialLog('RX', trimmed);

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
                } else if (trimmed.startsWith('TOUCH:')) {
                  const touched = trimmed.substring(6) === '1';
                  set({ isHardwareTouched: touched });
                  if (touched) {
                    set({ interactionMode: 'Pet', interactionActivity: 1.0 });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Read loop error:", error);
          set({ serialStatus: 'error' });
          get().addSerialLog('RX', `Error: Stream closed abruptly`);
        } finally {
          clearTimeout(fallbackTimeout);
          reader.releaseLock();
        }
      })();

    } catch (e) {
      console.error('Failed to connect to serial port:', e);
      set({ serialStatus: 'error' });
      get().addSerialLog('RX', `Error: requestPort rejected`);
    }
  },
  sendSerialData: async (data: string) => {
    const { serialWriter } = get();
    get().addSerialLog('TX', data.trim());
    if (serialWriter) {
      try {
        await serialWriter.write(data);
      } catch (e) {
        console.error('Error writing to serial:', e);
      }
    }
  }
}));
