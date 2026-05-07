import React, { useState, useEffect } from 'react';
import { useStore } from '../store';

export default function ArduinoConnection() {
  const [showCode, setShowCode] = useState(false);
  const [codeVersion, setCodeVersion] = useState<'micro' | 'distance_only' | 'light_only' | 'tokens_only' | 'vibro' | 'advanced'>('distance_only');
  const connectSerial = useStore(state => state.connectSerial);
  const serialPort = useStore(state => state.serialPort);
  const serialWriter = useStore(state => state.serialWriter);
  const mood = useStore(state => state.mood);
  const interactionMode = useStore(state => state.interactionMode);
  const ledColor = useStore(state => state.ledColor);
  const isHardwareTouched = useStore(state => state.isHardwareTouched);

  // 1. Send Servo Commands Periodically
  useEffect(() => {
    if (!serialWriter) return;

    let lastPan = -1;
    let lastTilt = -1;

    const interval = setInterval(async () => {
      const state = useStore.getState();
      
      const rot = state.servoRotation;
      let targetRot = {
        x: Math.floor(90 + (rot.x * 180 / Math.PI)),
        y: Math.floor(90 + (rot.y * 180 / Math.PI))
      };

      // Constrain just to be safe
      const safePan = Math.max(0, Math.min(180, targetRot.y));
      const safeTilt = Math.max(0, Math.min(180, targetRot.x));

      // Only send if the values have changed to reduce constant servo jitter
      if (Math.abs(safePan - lastPan) >= 1 || Math.abs(safeTilt - lastTilt) >= 1) {
        lastPan = safePan;
        lastTilt = safeTilt;
        
        try {
          await serialWriter.write(`X${safePan}Y${safeTilt}\n`);
        } catch (err) {
          console.error("Error writing to serial:", err);
        }
      }
    }, 50); // 20Hz update rate

    return () => clearInterval(interval);
  }, [serialWriter]);

  // 2. Trigger Vibration for 'Pinch' or 'Angry' (Spicy) mood
  useEffect(() => {
    if (!serialWriter) return;

    const triggerVibe = async (duration: number) => {
      try {
        await serialWriter.write(`V${duration}\n`);
      } catch (err) {
        console.error("Error writing vibe command:", err);
      }
    };

    if (interactionMode === 'Pinch') {
      const playPattern = async () => {
        await triggerVibe(80);
        await new Promise(r => setTimeout(r, 150));
        await triggerVibe(120);
        await new Promise(r => setTimeout(r, 150));
        await triggerVibe(80);
      };
      playPattern();
    }
  }, [interactionMode, serialWriter]);

  useEffect(() => {
    if (!serialWriter) return;

    if (mood === 'angry') {
      // Long, intense vibration for "Spicy" / angry mood token
      try {
        serialWriter.write(`V500\n`);
      } catch (err) {}
    }
  }, [mood, serialWriter]);

  // Update LED Color automatically based on mood & touch
  useEffect(() => {
    let r = 0, g = 0, b = 0;
    if (isHardwareTouched) {
       r = 255; g = 150; b = 255; // Pink when touched
    } else {
       if (mood === 'sleepy') { r = 0; g = 0; b = 50; }
       else if (mood === 'angry') { r = 255; g = 0; b = 0; }
       else if (mood === 'loving') { r = 255; g = 50; b = 100; }
       else if (mood === 'hyper') { r = 0; g = 255; b = 0; }
       else { r = 50; g = 50; b = 50; } // neutral
    }
    useStore.setState({ ledColor: { r, g, b } });
  }, [mood, isHardwareTouched]);

  // 3. Send Neopixel Commands
  useEffect(() => {
    if (!serialWriter) return;
    const sendLed = async () => {
      try {
        await serialWriter.write(`C${Math.floor(ledColor.r)},${Math.floor(ledColor.g)},${Math.floor(ledColor.b)}\n`);
      } catch (err) {}
    };
    sendLed();
  }, [ledColor, serialWriter]);

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
      
      let lightValueCode = `    int lightVal = ${version === 'light_only' || version === 'advanced' ? 'analogRead(ldrPin)' : '500'}; // mock if no LDR\n`;
      code += lightValueCode;

      if (version === 'distance_only' || version === 'vibro' || version === 'advanced') {
        code += `\n    // Read Distance\n    digitalWrite(trigPin, LOW);\n    delayMicroseconds(2);\n    digitalWrite(trigPin, HIGH);\n    delayMicroseconds(10);\n    digitalWrite(trigPin, LOW);\n    long duration = pulseIn(echoPin, HIGH, 30000);\n    int distanceCm = duration * 0.034 / 2;\n    if (distanceCm == 0) distanceCm = 999;\n`;
      } else {
        code += `\n    int distanceCm = 999; // mock if no distance sensor\n`;
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
      <ul className="text-xs text-white/80 list-disc pl-4 mb-4 space-y-1">
        <li>1x Arduino (Uno/Nano)</li>
        <li>2x Micro Servos (e.g. SG90) + Dedicated 5V power supply</li>
        {(version === 'tokens_only' || version === 'advanced') && (
          <li>4x Momentary Push Buttons</li>
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
            <li>1x NPN Transistor (2N2222) or N-MOSFET (logic level)</li>
            <li>1x 1kΩ Resistor & 1x 1N4001 Diode</li>
          </>
        )}
        {version === 'advanced' && (
          <>
            <li>1x TTP223 Capacitive Touch Sensor</li>
            <li>1x WS2812B Neopixel Ring/Strip (e.g. 8 LEDs)</li>
          </>
        )}
      </ul>
    );
  };

  const getWiring = (version: string) => {
    return (
      <ol className="text-xs text-white/80 list-decimal pl-4 mb-4 space-y-2">
        <li><b>Servos:</b> Logic to Pins <b>9 (Pan)</b> & <b>10 (Tilt)</b>. VCC/GND to Ext 5V Power. Connect Ext GND to Arduino GND.</li>
        {(version === 'distance_only' || version === 'vibro' || version === 'advanced') && (
          <li><b>Distance Sensor (HC-SR04):</b> Connect VCC to <b>5V</b>, GND to <b>GND</b>. Connect Trig to Pin <b>7</b>, Echo to Pin <b>8</b>.</li>
        )}
        {(version === 'light_only' || version === 'advanced') && (
          <li><b>Light Sensor (LDR):</b> Create a voltage divider. Connect LDR between <b>5V</b> and <b>A0</b>. Connect a 10kΩ resistor between <b>A0</b> and <b>GND</b>.</li>
        )}
        {(version === 'tokens_only' || version === 'advanced') && (
          <li><b>TUI Tokens:</b> Wire 4 push buttons between Arduino <b>GND</b> and Pins <b>2, 3, 4, 5</b>.</li>
        )}
        {(version === 'vibro' || version === 'advanced') && (
          <li><b>Vibration Motor Circuit (Using 2N2222 NPN Transistor):</b> 
            <ul className="list-[circle] pl-4 mt-1 space-y-2 text-zinc-300">
              <li><b>Step 1:</b> 1kΩ resistor from Arduino <b>Pin 6</b> to <b>Base (middle pin)</b> of Transistor.</li>
              <li><b>Step 2:</b> <b>Emitter (left pin)</b> of Transistor to Arduino <b>GND</b>.</li>
              <li><b>Step 3:</b> <b>Collector (right pin)</b> to <b>Negative (-)</b> of Motor.</li>
              <li><b>Step 4:</b> <b>Positive (+)</b> of Motor to Arduino <b>5V</b>.</li>
              <li><b>Step 5:</b> 1N4001 diode parallel to motor. <b>Cathode (stripe)</b> to 5V, <b>Anode</b> to Collector.</li>
            </ul>
          </li>
        )}
        {version === 'advanced' && (
          <>
            <li><b>Capacitive Touch:</b> Connect VCC to <b>5V</b>, GND to <b>GND</b>, Logic/SIG to Pin <b>12</b>.</li>
            <li><b>Neopixels:</b> Connect VCC to <b>Ext 5V/Arduino 5V</b>, GND to <b>GND</b>, DIN to Pin <b>11</b>.</li>
          </>
        )}
        <li><b>Upload</b> the sketch below, then click "Connect Arduino" above.</li>
      </ol>
    );
  };

  return (
    <div className="fixed bottom-4 left-4 z-[1000] flex flex-col items-start gap-2 max-h-[90vh] overflow-y-auto pointer-events-auto custom-scrollbar pr-2">
      <button 
        onClick={connectSerial}
        className={`px-4 py-2 rounded-lg font-bold shadow-lg transition-colors ${
          serialPort 
            ? 'bg-green-500 hover:bg-green-600 text-white' 
            : 'bg-[#a37c73] hover:bg-[#8a655d] text-white'
        }`}
      >
        {serialPort ? 'Arduino Connected' : 'Connect Arduino'}
      </button>

      <button 
        onClick={() => setShowCode(!showCode)}
        className="px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white/80 text-sm backdrop-blur-sm transition-colors"
      >
        {showCode ? 'Hide Setup & Code' : 'Show Hardware Setup & Arduino Code'}
      </button>

      {showCode && (
        <div className="mt-2 p-4 bg-black/80 backdrop-blur-md rounded-xl text-white shadow-2xl max-w-md w-full border border-white/10">
          <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
             <h3 className="font-bold text-sm">Hardware Setup</h3>
             <select 
               value={codeVersion} 
               onChange={(e) => setCodeVersion(e.target.value as any)}
               className="bg-zinc-800 text-white text-xs rounded border border-zinc-700 px-2 py-1 outline-none"
             >
               <option value="micro">Micro (Just Servos)</option>
               <option value="distance_only">Proximity Tracker (Distance + Servos)</option>
               <option value="light_only">Environment Aware (Light + Servos)</option>
               <option value="tokens_only">TUI Modeler (Tokens + Servos)</option>
               <option value="vibro">Haptic Setup (Dist + Vibe + Servos)</option>
               <option value="advanced">Advanced Version (Full Setup)</option>
             </select>
          </div>

          <h3 className="font-bold mb-2 text-sm">BOM (Bill of Materials)</h3>
          {getBOM(codeVersion)}

          <h3 className="font-bold mb-2 text-sm">Wiring Instructions</h3>
          {getWiring(codeVersion)}
          <div className="relative mt-2">
            <pre className="text-[10px] bg-black/50 p-3 rounded-lg overflow-x-auto text-green-400 font-mono">
              {generateArduinoCode(codeVersion)}
            </pre>
            <button 
              onClick={() => navigator.clipboard.writeText(generateArduinoCode(codeVersion))}
              className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
