import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { 
  Cpu, Sliders, Terminal, Sun, Moon, Wifi, WifiOff, Zap, 
  Trash2, Play, Sparkles, Activity, ShieldAlert, Layers,
  Smile, Eye, Volume2, Plus, ArrowRight, Settings2, Flame, Heart, Coffee, Unplug, Info, Check, Copy
} from 'lucide-react';

export default function PhysicalSandbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sim' | 'calibration' | 'hardware'>('sim');
  const [customCommand, setCustomCommand] = useState('');
  const [simulatedVibration, setSimulatedVibration] = useState(0);
  const [codeVersion, setCodeVersion] = useState<'micro' | 'distance_only' | 'light_only' | 'tokens_only' | 'vibro' | 'advanced'>('distance_only');
  const [copied, setCopied] = useState(false);

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

  // Calibration Dashboard fields we imported
  const headRotation = useStore((s) => s.headRotation);
  const armRotations = useStore((s) => s.armRotations);
  const legRotations = useStore((s) => s.legRotations);
  const calibrationAngles = useStore((s) => s.calibrationAngles);
  const setCalibrationAngles = useStore((s) => s.setCalibrationAngles);

  const nightThreshold = useStore((s) => s.nightModeLightThreshold);
  const setNightThreshold = useStore((s) => s.setNightModeLightThreshold);
  const proxMax = useStore((s) => s.proximityMaxDistance);
  const setProxMax = useStore((s) => s.setProximityMaxDistance);
  
  const faceTrackingActive = useStore((s) => s.faceTrackingActive);
  const setFaceTrackingActive = useStore((s) => s.setFaceTrackingActive);
  const ambientColor = useStore((s) => s.ambientColor);
  const handTrackingActive = useStore((s) => s.handTrackingActive);
  const connectSerial = useStore((s) => s.connectSerial);

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

  // Helper to convert radians to intuitive servo degrees for UI mapping
  const toDeg = (rad: number) => Math.floor((rad * 180) / Math.PI);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Arduino firmware generator
  const generateArduinoCode = (version: string) => {
    let code = `#include <Servo.h>\n`;
    if (version === 'advanced') {
      code += `#include <Adafruit_NeoPixel.h>\n`;
    }
    code += `\nServo servoX; // Pan (Left/Right)\nServo servoY; // Tilt (Up/Down)\n\n`;

    // Global variables
    if (version === 'tokens_only' || version === 'advanced') {
      code += `// TUI Buttons\nconst int btnHyper = 2;\nconst int btnSleepy = 3;\nconst int btnLoving = 4;\nconst int btnAngry = 5;\n\n// Debounce state\nunsigned long lastDebounceTime = 0;\nunsigned long debounceDelay = 200;\n\n`;
    }
    if (version === 'advanced') {
      code += `// Capacitive Touch\nconst int touchPin = 12;\nint lastTouchState = 0;\n\n// Neopixels\n#define PIN_NEO 11\n#define NUMPIXELS 8\nAdafruit_NeoPixel pixels(NUMPIXELS, PIN_NEO, NEO_GRB + NEO_KHZ800);\n\n`;
    }
    if (version === 'vibro' || version === 'advanced') {
      code += `// Vibration Motor\nconst int vibePin = 6;\nunsigned long vibeUntil = 0;\n\n`;
    }
    if (version === 'light_only' || version === 'advanced') {
      code += `// Light Sensor (LDR)\nconst int ldrPin = A0;\n\n`;
    }
    if (version === 'distance_only' || version === 'vibro' || version === 'advanced') {
      code += `// Ultrasonic Sensor\nconst int trigPin = 7;\nconst int echoPin = 8;\n\n`;
    }

    if (version !== 'micro' && version !== 'tokens_only') {
      code += `// General Env Config\nunsigned long lastEnvTime = 0;\nunsigned long envDelay = 500; // 500ms between updates\n\n`;
    }

    code += `void setup() {\n  Serial.begin(9600);\n  servoX.attach(9);\n  servoY.attach(10);\n`;

    if (version === 'tokens_only' || version === 'advanced') {
      code += `\n  // Configure Buttons\n  pinMode(btnHyper, INPUT_PULLUP);\n  pinMode(btnSleepy, INPUT_PULLUP);\n  pinMode(btnLoving, INPUT_PULLUP);\n  pinMode(btnAngry, INPUT_PULLUP);\n`;
    }
    if (version === 'vibro' || version === 'advanced') {
      code += `\n  // Configure Vibration\n  pinMode(vibePin, OUTPUT);\n  digitalWrite(vibePin, LOW);\n`;
    }
    if (version === 'distance_only' || version === 'vibro' || version === 'advanced') {
      code += `\n  // Configure Ultrasonic\n  pinMode(trigPin, OUTPUT);\n  pinMode(echoPin, INPUT);\n`;
    }
    if (version === 'advanced') {
      code += `\n  // Configure Touch & Neopixels\n  pinMode(touchPin, INPUT);\n  pixels.begin();\n  pixels.clear();\n  pixels.show();\n`;
    }

    code += `\n  // Initialize servos to center\n  servoX.write(90);\n  servoY.write(90);\n}\n\nvoid loop() {\n`;

    // Loop
    if (version === 'advanced') {
      code += `  // Handle Touch\n  int currentTouch = digitalRead(touchPin);\n  if (currentTouch != lastTouchState) {\n    lastTouchState = currentTouch;\n    Serial.print("TOUCH:");\n    Serial.println(currentTouch);\n  }\n\n`;
    }
    if (version === 'vibro' || version === 'advanced') {
      code += `  // Handle Vibration\n  if (millis() < vibeUntil) {\n    digitalWrite(vibePin, HIGH);\n  } else {\n    digitalWrite(vibePin, LOW);\n  }\n\n`;
    }

    if (version === 'tokens_only' || version === 'advanced') {
      code += `  // Handle Buttons\n  if ((millis() - lastDebounceTime) > debounceDelay) {\n    if (digitalRead(btnHyper) == LOW) {\n      Serial.println("TUI:hyper");\n      lastDebounceTime = millis();\n    } else if (digitalRead(btnSleepy) == LOW) {\n      Serial.println("TUI:sleepy");\n      lastDebounceTime = millis();\n    } else if (digitalRead(btnLoving) == LOW) {\n      Serial.println("TUI:loving");\n      lastDebounceTime = millis();\n    } else if (digitalRead(btnAngry) == LOW) {\n      Serial.println("TUI:angry");\n      lastDebounceTime = millis();\n    }\n  }\n\n`;
    }

    if (version === 'light_only' || version === 'distance_only' || version === 'vibro' || version === 'advanced') {
      code += `  // Send Env Data\n`;
      code += `  if ((millis() - lastEnvTime) > envDelay) {\n`;
      
      let lightValueCode = `    int lightVal = ${version === 'light_only' || version === 'advanced' ? 'analogRead(ldrPin)' : '500'};\n`;
      code += lightValueCode;

      if (version === 'distance_only' || version === 'vibro' || version === 'advanced') {
        code += `\n    // Read Distance\n    digitalWrite(trigPin, LOW);\n    delayMicroseconds(2);\n    digitalWrite(trigPin, HIGH);\n    delayMicroseconds(10);\n    digitalWrite(trigPin, LOW);\n    long duration = pulseIn(echoPin, HIGH, 30000);\n    int distanceCm = duration * 0.034 / 2;\n    if (distanceCm == 0) distanceCm = 999;\n`;
      } else {
        code += `\n    int distanceCm = 999;\n`;
      }

      code += `\n    Serial.print("ENV:");\n    Serial.print(lightVal);\n    Serial.print(",");\n    Serial.println(distanceCm);\n    lastEnvTime = millis();\n  }\n\n`;
    }

    code += `  // Handle Incoming Serial\n  if (Serial.available() > 0) {\n    String data = Serial.readStringUntil('\\n');\n    data.trim();\n\n`;
    
    if (version === 'vibro' || version === 'advanced') {
      code += `    if (data.startsWith("V")) {\n      int duration = data.substring(1).toInt();\n      vibeUntil = millis() + duration;\n    }\n\n`;
    }
    
    if (version === 'advanced') {
      code += `    if (data.startsWith("C")) {\n      int firstComma = data.indexOf(',');\n      int secondComma = data.indexOf(',', firstComma + 1);\n      int r = data.substring(1, firstComma).toInt();\n      int g = data.substring(firstComma + 1, secondComma).toInt();\n      int b = data.substring(secondComma + 1).toInt();\n      for(int i=0; i<NUMPIXELS; i++) { pixels.setPixelColor(i, pixels.Color(r,g,b)); }\n      pixels.show();\n    }\n\n`;
    }

    code += `    int xIndex = data.indexOf('X');\n    int yIndex = data.indexOf('Y');\n    if (xIndex != -1 && yIndex != -1) {\n      String xStr = data.substring(xIndex + 1, yIndex);\n      String yStr = data.substring(yIndex + 1);\n      if (xStr.length() > 0 && yStr.length() > 0) {\n        int xAngle = xStr.toInt();\n        int yAngle = yStr.toInt();\n        servoX.write(constrain(xAngle, 0, 180));\n        servoY.write(constrain(yAngle, 0, 180));\n      }\n    }\n  }\n}\n`;

    return code;
  };

  const getBOM = (version: string) => {
    return (
      <ul className="text-[11px] text-zinc-400 list-disc pl-4 space-y-1 mt-1 font-sans">
        <li>1x Arduino Board (Uno/Nano)</li>
        <li>2x Micro Servos (e.g. SG90) + Ext 5V power supply</li>
        {(version === 'tokens_only' || version === 'advanced') && (
          <li>4x Tactile Push Buttons</li>
        )}
        {(version === 'light_only' || version === 'advanced') && (
          <li>1x Photoresistor (LDR) + 10kΩ Resistor</li>
        )}
        {(version === 'distance_only' || version === 'vibro' || version === 'advanced') && (
          <li>1x HC-SR04 Ultrasonic Distance Sensor</li>
        )}
        {(version === 'vibro' || version === 'advanced') && (
          <>
            <li>1x 3V Coin Vibration Motor</li>
            <li>1x 2N2222 NPN Transistor & 1kΩ Resistor</li>
            <li>1x 1N4001 Diode (flyback protection)</li>
          </>
        )}
        {version === 'advanced' && (
          <>
            <li>1x TTP223 Capacitive Touch Sensor</li>
            <li>1x WS2812B Neopixel Ring / Strip (8 LEDs)</li>
          </>
        )}
      </ul>
    );
  };

  const getWiring = (version: string) => {
    return (
      <ol className="text-[11px] text-zinc-450 list-decimal pl-4 space-y-1.5 mt-1 font-sans">
        <li><b className="text-zinc-300">Servos:</b> Logic to Pins <b>9 (Pan)</b> & <b>10 (Tilt)</b>. Ext 5V power. Connect Ext GND to Arduino GND.</li>
        {(version === 'distance_only' || version === 'vibro' || version === 'advanced') && (
          <li><b className="text-zinc-300">HC-SR04 Sensor:</b> Connect VCC to <b>5V</b>, GND to <b>GND</b>. Trig to Pin <b>7</b>, Echo to Pin <b>8</b>.</li>
        )}
        {(version === 'light_only' || version === 'advanced') && (
          <li><b className="text-zinc-300">LDR Light Sensor:</b> Setup voltage divider. Connect LDR between <b>5V</b> and <b>A0</b>. Connect 10kΩ resistor from <b>A0</b> to <b>GND</b>.</li>
        )}
        {(version === 'tokens_only' || version === 'advanced') && (
          <li><b className="text-zinc-300">TUI Tokens:</b> Wire 4 push buttons between Arduino <b>GND</b> and digital Pins <b>2, 3, 4, 5</b>.</li>
        )}
        {(version === 'vibro' || version === 'advanced') && (
          <li><b className="text-zinc-300">Vibration Motor NPN Circuit:</b> Connect 1kΩ resistor from Arduino <b>Pin 6</b> to transistor Base. Transistor Emitter to <b>GND</b>. Collector to Motor negative (-). Motor positive (+) to <b>5V</b>. Diode parallel with motor.</li>
        )}
        {version === 'advanced' && (
          <>
            <li><b className="text-zinc-300">Capacitive Touch:</b> Connect VCC to <b>5V</b>, GND to <b>GND</b>, SIG/OUT to digital Pin <b>12</b>.</li>
            <li><b className="text-zinc-300">WS2812 Neopixels:</b> Connect VCC to <b>5V</b>, GND to <b>GND</b>, DIN to digital Pin <b>11</b>.</li>
          </>
        )}
      </ol>
    );
  };

  const getButtonState = () => {
    switch (serialStatus) {
      case 'connecting':
        return { text: 'Connecting Device...', className: 'bg-amber-600 hover:bg-amber-700 animate-pulse' };
      case 'handshaking':
        return { text: 'Synchronizing Serial...', className: 'bg-indigo-600 hover:bg-indigo-700 animate-pulse' };
      case 'connected':
        return { text: 'Hardware Live Connected', className: 'bg-emerald-600 hover:bg-emerald-700' };
      case 'error':
        return { text: 'Fault Detected! Retry', className: 'bg-red-650 hover:bg-red-700 animate-pulse' };
      default:
        return { text: 'Connect Physical Arduino', className: 'bg-indigo-600 hover:bg-indigo-550' };
    }
  };

  const btnMeta = getButtonState();

  return (
    <>
      {/* Floating Toggle Icon */}
      {!isOpen && (
        <button
          id="sandbox-toggle-btn"
          onClick={() => setIsOpen(true)}
          className="fixed top-4 right-4 z-[1001] bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-100 backdrop-blur-md px-4 py-2.5 rounded-full shadow-2xl transition-all duration-300 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase group cursor-pointer"
        >
          <Settings2 size={16} className="text-indigo-400 group-hover:rotate-45 transition-transform duration-300" />
          <span>Control Hub</span>
          <span className={`w-2 h-2 rounded-full ${serialStatus === 'connected' ? 'bg-emerald-450 animate-ping' : 'bg-indigo-500'}`} />
        </button>
      )}

      {/* Sidebar Control Hub */}
      <div
        id="sandbox-sidebar"
        className={`fixed top-0 right-0 h-screen w-96 md:w-[420px] bg-zinc-950/98 backdrop-blur-xl border-l border-zinc-900 shadow-2xl text-zinc-100 z-[1000] flex flex-col transition-all duration-300 overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-900/80 bg-zinc-900/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="text-indigo-400 animate-pulse" size={20} />
            <div>
              <h2 className="font-semibold text-xs tracking-wider text-zinc-200 uppercase">HMI Control Center</h2>
              <p className="text-[10px] text-zinc-500 font-mono">Unifying Simulators, Calibration, & Web Serial</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-1.5 hover:bg-zinc-900 rounded-md transition-colors"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-900/50 bg-zinc-950 px-2 pt-1 font-sans">
          <button
            onClick={() => setActiveTab('sim')}
            className={`flex-1 py-2 text-center text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'sim' 
                ? 'border-indigo-500 text-white bg-indigo-500/5' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'
            }`}
          >
            🎛️ Sim/Override
          </button>
          <button
            onClick={() => setActiveTab('calibration')}
            className={`flex-1 py-2 text-center text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'calibration' 
                ? 'border-indigo-500 text-white bg-indigo-500/5' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'
            }`}
          >
            🦾 Calibration
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`flex-1 py-2 text-center text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'hardware' 
                ? 'border-indigo-500 text-white bg-indigo-500/5' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/20'
            }`}
          >
            🔌 Serial & Docs
          </button>
        </div>

        {/* Scrollable Panel Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 select-none scrollbar-thin scrollbar-thumb-zinc-900">
          
          {/* TAB 1: SIMULATORS & OVERRIDES */}
          {activeTab === 'sim' && (
            <div className="space-y-4">
              
              {/* Performance quality profiles */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-2">
                <label className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-1.5">
                  <Layers size={12} className="text-zinc-500" />
                  R3F Simulation Quality Profile
                </label>
                <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded-lg">
                  {[
                    { key: 'cinematic', label: 'Cinematic' },
                    { key: 'standard', label: 'Standard' },
                    { key: 'powersave', label: 'Mobile Save' }
                  ].map((q) => (
                    <button
                      key={q.key}
                      onClick={() => setQualityMode(q.key as any)}
                      className={`py-1 text-[10px] rounded-md transition-all font-semibold ${
                        qualityMode === q.key 
                          ? 'bg-indigo-600 text-white font-bold' 
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-zinc-500 leading-relaxed font-mono">
                  {qualityMode === 'powersave' && '🔋 Fur depth sets: 6 shells. Cuts rendering CPU/GPU work by 60%.'}
                  {qualityMode === 'standard' && '⚡ Fur depth sets: 12 shells. Delivers balanced performance.'}
                  {qualityMode === 'cinematic' && '🎬 Fur depth sets: 18 shells. Renders ultra-plush volumetric fur.'}
                </p>
              </div>

              {/* Core interactive sensor simulators */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-3">
                <span className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-1.5 border-b border-zinc-900/65 pb-2">
                  <Sliders size={12} className="text-indigo-400" />
                  Virtual Sensor Loops Overrides
                </span>

                {/* Light LDR */}
                <div className="space-y-1 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1 text-[11px]">
                      {ambientLight < 200 ? <Moon size={12} className="text-indigo-400" /> : <Sun size={12} className="text-amber-400" />}
                      Ambient light (LDR Analog Register)
                    </span>
                    <span className="text-zinc-400 font-mono text-[10px] bg-zinc-950 px-1.5 py-0.5 rounded">{ambientLight} / 1023</span>
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
                    className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-md cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-zinc-500 font-mono">
                    <span>Darkness (0)</span>
                    <span>Threshold ({nightThreshold})</span>
                    <span>Direct Light (1023)</span>
                  </div>
                </div>

                {/* Proximity Distance */}
                <div className="space-y-1 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1 text-[11px]">
                      <Activity size={12} className="text-indigo-400" />
                      Ultrasonic Range Distance
                    </span>
                    <span className="text-zinc-400 font-mono text-[10px] bg-zinc-950 px-1.5 py-0.5 rounded">{userDistance} cm</span>
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
                    className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-md cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-zinc-500 font-mono">
                    <span>Immediate (5cm)</span>
                    <span>Trigger Max ({proxMax}cm)</span>
                    <span>Idle Range (200cm)</span>
                  </div>
                </div>

                {/* Touch Sensor override */}
                <div className="flex items-center justify-between bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/50">
                  <span className="text-zinc-300 text-[11px] flex items-center gap-1">
                    <Zap size={11} className={isHardwareTouched ? 'text-indigo-400' : 'text-zinc-500'} />
                    Capacitive Touch Simulation
                  </span>
                  <button
                    onClick={() => {
                      const prev = isHardwareTouched;
                      dispatchRX(`TOUCH:${prev ? '0' : '1'}`);
                    }}
                    className={`px-3 py-1 text-[10px] font-bold rounded shadow-inner cursor-pointer transition-colors ${
                      isHardwareTouched 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    {isHardwareTouched ? 'SIMULATOR ON' : 'TOUCH CONTACT'}
                  </button>
                </div>
              </div>

              {/* Biometric Face Landmark overrides */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-900/65 pb-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-1.5">
                    <Smile size={12} className="text-indigo-400" />
                    Biometric Face Overrides
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isFaceSim} 
                      onChange={(e) => setIsFaceSim(e.target.checked)} 
                      className="sr-only peer"
                    />
                    <div className="w-7 h-4 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-1.5 text-[9px] font-bold text-zinc-450">{isFaceSim ? 'ACTIVE' : 'MUTED'}</span>
                  </label>
                </div>

                {isFaceSim ? (
                  <div className="space-y-2 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/50">
                    {/* Blink */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1"><Eye size={10} /> Blink Tracks (L/R)</span>
                        <span className="font-mono text-[9px]">{blinkL.toFixed(2)}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05"
                        value={blinkL} 
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setBlinkL(v);
                          setBlinkR(v);
                        }}
                        className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-md"
                      />
                    </div>

                    {/* Smile */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1"><Smile size={10} /> Smile Tracks</span>
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
                        className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-md"
                      />
                    </div>

                    {/* Mouth Open */}
                    <div className="space-y-0.5">
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
                        className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-md"
                      />
                    </div>

                    {/* Brow Lift */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>Brow Lift</span>
                        <span className="font-mono text-[9px]">{browUpVal.toFixed(2)}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05"
                        value={browUpVal} 
                        onChange={(e) => setBrowUpVal(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-md"
                      />
                    </div>

                    {/* Face tilt angle rotX */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>Face Tilt (Pitch)</span>
                        <span className="font-mono text-[9px]">{(rotX * 180 / Math.PI).toFixed(1)}°</span>
                      </div>
                      <input 
                        type="range" 
                        min="-0.5" 
                        max="0.5" 
                        step="0.01"
                        value={rotX} 
                        onChange={(e) => setRotX(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-md"
                      />
                    </div>

                    {/* Face pan angle rotY */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>Face Pan (Yaw)</span>
                        <span className="font-mono text-[9px]">{(rotY * 180 / Math.PI).toFixed(1)}°</span>
                      </div>
                      <input 
                        type="range" 
                        min="-0.6" 
                        max="0.6" 
                        step="0.01"
                        value={rotY} 
                        onChange={(e) => setRotY(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-md"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-500 italic text-center py-2 bg-zinc-950/30 rounded-lg">
                    Toggle simulation switch on to bypass actual face webcam or tracker inputs and override.
                  </p>
                )}
              </div>

              {/* RFID Quick Scanner simulation */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-2">
                <span className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-1.5 border-b border-zinc-900/65 pb-2">
                  <Layers size={12} className="text-indigo-400" />
                  RFID Token Simulator Deck
                </span>
                <div className="grid grid-cols-2 gap-1 px-1">
                  {[
                    { id: 'NEUTRAL', label: 'Neutral', bg: 'border-zinc-800 hover:bg-zinc-800/40 text-zinc-300', emoji: '⚪' },
                    { id: 'SLEEPY', label: 'Moon (Sleepy)', bg: 'border-blue-900/50 hover:bg-blue-950/20 text-blue-300', emoji: '💤' },
                    { id: 'HYPER', label: 'Coffee (Wired)', bg: 'border-amber-900/50 hover:bg-amber-950/20 text-amber-300', emoji: '⚡' },
                    { id: 'LOVING', label: 'Heart (Loving)', bg: 'border-pink-900/50 hover:bg-pink-950/20 text-pink-300', emoji: '💖' },
                    { id: 'ANGRY', label: 'Spicy (Angry)', bg: 'border-red-900/50 hover:bg-red-950/20 text-red-400', emoji: '😡' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => simulateRFIDScan(t.id, t.id)}
                      className={`border p-2 rounded-lg text-left text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center gap-2 ${t.bg}`}
                    >
                      <span>{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: CALIBRATION & AI TRACKING */}
          {activeTab === 'calibration' && (
            <div className="space-y-4 font-sans">
              
              {/* Servo calibration angles offsets */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-900/65 pb-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-2">
                    <Settings2 size={12} className="text-amber-400 animate-pulse" />
                    Interactive Servo Calibration Offset Mapping
                  </span>
                  <button 
                    onClick={() => setCalibrationAngles({ x: 0, y: 0, z: 0, armL: 0, armR: 0, legL: 0, legR: 0 })}
                    className="px-2 py-0.5 rounded text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-900 space-y-3 font-mono text-[10px]">
                  {/* Head Yaw */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">HEAD PAN (YAW)</span>
                      <span className="text-amber-405 text-amber-300">{toDeg(headRotation.y + calibrationAngles.y)}° (Cal: {toDeg(calibrationAngles.y)}°)</span>
                    </div>
                    <input 
                      type="range" 
                      min={-90} 
                      max={90} 
                      value={toDeg(calibrationAngles.y)} 
                      onChange={(e) => setCalibrationAngles({y: (Number(e.target.value) * Math.PI) / 180})} 
                      className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>

                  {/* Head Pitch */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">HEAD TILT (PITCH)</span>
                      <span className="text-amber-405 text-amber-300">{toDeg(headRotation.x + calibrationAngles.x)}° (Cal: {toDeg(calibrationAngles.x)}°)</span>
                    </div>
                    <input 
                      type="range" 
                      min={-90} 
                      max={90} 
                      value={toDeg(calibrationAngles.x)} 
                      onChange={(e) => setCalibrationAngles({x: (Number(e.target.value) * Math.PI) / 180})} 
                      className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>

                  {/* Arm L */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-sans">LEFT ARM RANGE</span>
                      <span className="text-amber-300">{toDeg(armRotations.left + calibrationAngles.armL)}° (Cal: {toDeg(calibrationAngles.armL)}°)</span>
                    </div>
                    <input 
                      type="range" 
                      min={-90} 
                      max={90} 
                      value={toDeg(calibrationAngles.armL)} 
                      onChange={(e) => setCalibrationAngles({armL: (Number(e.target.value) * Math.PI) / 180})} 
                      className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>

                  {/* Arm R */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-sans">RIGHT ARM RANGE</span>
                      <span className="text-amber-300">{toDeg(armRotations.right + calibrationAngles.armR)}° (Cal: {toDeg(calibrationAngles.armR)}°)</span>
                    </div>
                    <input 
                      type="range" 
                      min={-90} 
                      max={90} 
                      value={toDeg(calibrationAngles.armR)} 
                      onChange={(e) => setCalibrationAngles({armR: (Number(e.target.value) * Math.PI) / 180})} 
                      className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>

                  <div className="flex items-center gap-1 border-t border-zinc-900 pt-2 text-[9px] text-zinc-500 font-sans leading-snug">
                     <Info size={10} className="shrink-0 text-amber-500" />
                     <span>Adjusting cal angles applies instant rotational offsets inside of the WebGL rendering context window.</span>
                  </div>
                </div>
              </div>

              {/* Environmental Threshold Tuning */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-3">
                <span className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-1.5 border-b border-zinc-900/65 pb-2">
                  <Sliders size={12} className="text-indigo-400" />
                  Environmental Calibration Bounds
                </span>

                <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-900 space-y-4 font-mono text-[10px]">
                  {/* Night mode threshold */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">NIGHT MODE THRESHOLD</span>
                      <span className="text-amber-300">{nightThreshold} / 1023</span>
                    </div>
                    <input 
                      type="range" 
                      min={0} 
                      max={1023} 
                      value={nightThreshold} 
                      onChange={(e) => setNightThreshold(Number(e.target.value))} 
                      className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
                    />
                    <p className="text-[8px] text-zinc-500 font-sans leading-tight mt-1">If ambient light registers lower than {nightThreshold}, sleeping loops trigger.</p>
                  </div>

                  {/* Proximity threshold */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">PROXIMITY RADIUS (cm)</span>
                      <span className="text-amber-300">{proxMax} cm</span>
                    </div>
                    <input 
                      type="range" 
                      min={10} 
                      max={200} 
                      value={proxMax} 
                      onChange={(e) => setProxMax(Number(e.target.value))} 
                      className="w-full h-1 accent-amber-500 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
                    />
                    <p className="text-[8px] text-zinc-500 font-sans leading-tight mt-1">Interactive haptics or tracking activate inside a {proxMax}cm bubble.</p>
                  </div>
                </div>
              </div>

              {/* AI Webcam face-tracking configuration */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-900/65 pb-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-1.5">
                    <Smile size={12} className="text-emerald-450 text-indigo-400" />
                    Computer Vision AI Camera Stream
                  </span>
                  <button 
                    onClick={() => setFaceTrackingActive(!faceTrackingActive)}
                    className={`px-3 py-1 rounded text-[10px] tracking-wide font-bold transition-all cursor-pointer ${
                      faceTrackingActive 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 animate-pulse' 
                        : 'bg-zinc-850 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {faceTrackingActive ? 'WEBCAM ON' : 'CONNECT CAMERA'}
                  </button>
                </div>

                {faceTrackingActive ? (
                  <div className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-900 space-y-2 text-[10px] font-mono leading-relaxed text-zinc-400">
                    <div className="flex justify-between items-center">
                      <span>Camera Average Brightness:</span>
                      <span className="text-zinc-200">Calculated Dynamic</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Dominant Extracted Color:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold">{ambientColor}</span>
                        <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 shadow-md" style={{ backgroundColor: ambientColor }} />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Waving Motion Wave Active:</span>
                      <span className={handTrackingActive ? "text-emerald-400 font-bold" : "text-zinc-650 font-sans"}>
                        {handTrackingActive ? "● ENGAGED" : "Idle"}
                      </span>
                    </div>
                    <p className="text-[8px] text-zinc-550 leading-snug font-sans border-t border-zinc-900 pt-1.5 mt-1">
                      Webcam runs Mediapipe model locally on GPU thread. Captures facial vectors & average surrounding color backdrops to balance internal parameters.
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-500 italic text-center py-2 bg-zinc-950/30 rounded-lg">
                    Webcam is disconnected. Connect to run real-time local mirror tracking.
                  </p>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: WEB SERIAL HARDWARE, CHIPTUNES, & ARDUINO DOCS */}
          {activeTab === 'hardware' && (
            <div className="space-y-4">
              
              {/* Web Serial Active Status */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-900/65 pb-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-1.5">
                    <Wifi size={12} className="text-indigo-400" />
                    Web Serial Port Connection
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    serialStatus === 'connected' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : serialStatus === 'handshaking'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {serialStatus === 'connected' ? 'LIVE BOARD' : serialStatus === 'handshaking' ? 'SYNC...' : 'EMULATED'}
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={connectSerial}
                    className={`w-full py-2.5 font-bold text-xs uppercase tracking-wider rounded-lg shadow-lg border backdrop-blur-md transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                      serialStatus === 'connected' 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' 
                        : serialStatus === 'handshaking' || serialStatus === 'connecting'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 animate-pulse'
                        : serialStatus === 'error'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 animate-pulse'
                        : 'bg-indigo-600 hover:bg-indigo-550 text-white border-indigo-500/10'
                    }`}
                  >
                    {serialStatus === 'connected' ? <Zap size={14} className="text-emerald-400" /> : <Unplug size={14} className="text-indigo-350" />}
                    {btnMeta.text}
                  </button>

                  <p className="text-[9px] text-zinc-450 leading-relaxed font-sans">
                    Connect an Arduino via USB using standard 9600 baud. It coordinates real hardware servo outputs, photoresistors, vibration motors, and LEDs.
                  </p>
                </div>
              </div>

              {/* Haptic Vibro-Melodies */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-3">
                <span className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-1.5 border-b border-zinc-900/65 pb-2">
                  <Volume2 size={12} className="text-indigo-400 animate-bounce" />
                  Composed Haptic Soundscapes
                </span>

                {/* Premade triggers */}
                <div className="grid grid-cols-2 gap-1 px-1">
                  {[
                    { name: '🪄 Sparkle Chime', id: 'sparkle', desc: 'Arpeggios + flickers' },
                    { name: '💓 Heart Thump', id: 'heartbeat', desc: 'Low bass + heartbeat' },
                    { name: '🚨 Alert Jolt', id: 'jolt', desc: 'Chiptune + alarm vibe' },
                    { name: '🍃 Calm Breeze', id: 'breeze', desc: 'Slow sweep + soft buzz' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setActiveMelody(m.id)}
                      className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-700/80 p-2 rounded-lg text-left text-[11px] font-bold flex flex-col transition-all cursor-pointer group active:scale-95"
                    >
                      <span className="text-zinc-200 flex items-center gap-1">
                        {m.name}
                      </span>
                      <span className="text-[8px] text-zinc-500 group-hover:text-zinc-400 mt-0.5 font-normal">{m.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Custom sequencer workspace */}
                <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-900 space-y-2">
                  <span className="text-[9px] font-bold text-indigo-400 tracking-wide uppercase">
                    Custom Triple-Step Melody Composer
                  </span>

                  <div className="space-y-1.5">
                    {customSteps.map((step, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-zinc-900/40 p-1 rounded border border-zinc-900/60">
                        <span className="text-[8px] font-mono font-bold text-zinc-600 shrink-0">STEP {idx + 1}</span>
                        
                        {/* Freq */}
                        <div className="flex-1 space-y-0.5">
                          <div className="flex justify-between text-[8px] text-zinc-500 font-mono">
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

                        {/* Duration */}
                        <div className="flex-1 space-y-0.5">
                          <div className="flex justify-between text-[8px] text-zinc-500 font-mono">
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
                            className="w-full accent-indigo-500 h-1 bg-zinc-850"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={playCustomMelodySequence}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 shadow-md cursor-pointer transition-colors active:scale-98"
                  >
                    <Play size={10} className="fill-white text-white" />
                    Play & Send Custom Steps
                  </button>
                </div>
              </div>

              {/* Simulated Vibration overlay warning */}
              {simulatedVibration > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 space-y-1.5 animate-pulse">
                  <div className="flex justify-between text-xs text-rose-450 font-bold items-center">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Activity size={12} className="animate-spin" />
                      HAPTIC VIBRATION MOTOR PULSE ACTIVE
                    </span>
                    <span className="font-mono text-[10px]">{simulatedVibration} Output</span>
                  </div>
                  <div className="w-full bg-zinc-950 h-1.5 rounded overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded transition-all duration-350" 
                      style={{ width: `${(simulatedVibration / 255) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Serial Live Console */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-center border-b border-zinc-900/65 pb-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-1.5 font-sans">
                    <Terminal size={12} className="text-indigo-400" />
                    Live System Bus Console
                  </label>
                  <button 
                    onClick={clearSerialLogs}
                    className="text-zinc-550 hover:text-zinc-300 p-1 rounded hover:bg-zinc-900 transition-colors"
                    title="Clear console"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* Console logs */}
                <div className="h-32 bg-zinc-950 rounded-lg p-2 font-mono text-[9px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-zinc-900">
                  {serialLogs.length === 0 ? (
                    <div className="text-zinc-700 italic text-center pt-10 select-text">Waiting for serial transactions...</div>
                  ) : (
                    serialLogs.map((log) => (
                      <div key={log.id} className="flex gap-1 border-b border-zinc-950 pb-0.5 leading-normal">
                        <span className="text-zinc-650 shrink-0">[{log.timestamp}]</span>
                        {log.dir === 'TX' ? (
                          <span className="text-indigo-455 text-indigo-400 shrink-0 font-bold">[TX]</span>
                        ) : (
                          <span className="text-emerald-455 text-emerald-400 shrink-0 font-bold">[RX]</span>
                        )}
                        <span className={log.dir === 'TX' ? 'text-zinc-400' : 'text-emerald-300'}>
                          {log.text}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>

                {/* Command inject form */}
                <form onSubmit={handleCustomSubmit} className="flex gap-1.5">
                  <input
                    type="text"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder="Inject Receive Packet (e.g., TUI:HYPER)"
                    className="flex-1 bg-zinc-950 border border-zinc-900 rounded-md px-2 py-1 text-[10px] font-mono focus:outline-hidden focus:border-indigo-500 text-zinc-250 placeholder-zinc-600"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-650 hover:bg-indigo-600 text-white rounded-md px-3 py-1 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <Play size={9} className="fill-white" />
                    Inject
                  </button>
                </form>
              </div>

              {/* Arduino Setup documentation step-by-step and copypasta firmware builds */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-900/65 pb-2">
                  <h3 className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider flex items-center gap-1.5 font-sans">
                    <Terminal size={12} className="text-amber-500" />
                    Arduino Assembly & Code Docs
                  </h3>
                  <select 
                    value={codeVersion} 
                    onChange={(e) => setCodeVersion(e.target.value as any)}
                    className="bg-zinc-955 bg-zinc-900 text-zinc-200 text-[10px] rounded border border-zinc-800 px-2 py-0.5 outline-none font-sans font-bold cursor-pointer"
                  >
                    <option value="micro">1. Just Servos</option>
                    <option value="distance_only">2. Proximity Control</option>
                    <option value="light_only">3. LDR Ambient Aware</option>
                    <option value="tokens_only">4. TUI Token Buttons</option>
                    <option value="vibro">5. Haptic Feedback Model</option>
                    <option value="advanced">6. Full Advanced Firmware</option>
                  </select>
                </div>

                <div className="space-y-3 font-sans">
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Bill of Materials (BOM)</h4>
                    {getBOM(codeVersion)}
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Step-by-Step Wiring Guide</h4>
                    {getWiring(codeVersion)}
                  </div>

                  <div className="relative border border-zinc-900 rounded-lg overflow-hidden bg-zinc-950 mt-1 dark">
                    <div className="bg-zinc-900 px-3 py-1 font-mono text-[9px] text-zinc-455 text-zinc-400 flex items-center justify-between">
                       <span>sketch_{codeVersion}.ino</span>
                       <button
                         onClick={() => handleCopyCode(generateArduinoCode(codeVersion))}
                         className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer font-sans text-[10px]"
                       >
                         {copied ? (
                           <>
                             <Check size={10} className="text-emerald-400" />
                             <span className="text-emerald-450 text-emerald-400">Copied!</span>
                           </>
                         ) : (
                           <>
                             <Copy size={10} />
                             <span>Copy Code</span>
                           </>
                         )}
                       </button>
                    </div>
                    <pre className="text-[9px] leading-relaxed max-h-56 bg-zinc-955 p-3 overflow-x-auto text-emerald-450 text-emerald-450/90 font-mono select-text">
                      {generateArduinoCode(codeVersion)}
                    </pre>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
        
        {/* Footer info line */}
        <div className="p-3 border-t border-zinc-900 bg-zinc-950 text-[10px] text-zinc-500 text-center select-none font-sans flex items-center justify-center gap-1.5 shrink-0">
          <Wifi size={10} className={serialStatus === 'connected' ? 'text-emerald-450 animate-pulse' : 'text-zinc-600'} />
          <span>Real-time Proxied Cybernetic HMI Host Workspace</span>
        </div>
      </div>
    </>
  );
}
