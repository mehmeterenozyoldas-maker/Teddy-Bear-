import React, { useEffect, useRef } from 'react';
import { FaceLandmarker, PoseLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useStore } from '../store';

export default function FaceTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const setHeadRotation = useStore((state) => state.setHeadRotation);
  const setArmRotations = useStore((state) => state.setArmRotations);
  const setLegRotations = useStore((state) => state.setLegRotations);
  const faceTrackingActive = useStore((state) => state.faceTrackingActive);

  useEffect(() => {
    if (!faceTrackingActive) return;

    let faceLandmarker: FaceLandmarker;
    let poseLandmarker: PoseLandmarker;
    let handLandmarker: HandLandmarker;
    let stream: MediaStream;
    let animationFrameId: number;
    let lastVideoTime = -1;

    const initTracking = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.x/wasm"
      );
      
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });

      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1
      });

      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });

      if (videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", predictWebcam);
        } catch (error) {
          console.error("Error accessing webcam:", error);
          alert("Could not access webcam for tracking. Please ensure you have granted permission.");
          useStore.getState().setFaceTrackingActive(false);
        }
      }
    };

    const predictWebcam = async () => {
      if (!videoRef.current || !faceLandmarker || !poseLandmarker) return;

      const radio = videoRef.current.videoHeight / videoRef.current.videoWidth;
      videoRef.current.style.width = "320px";
      videoRef.current.style.height = `${320 * radio}px`;

      let startTimeMs = performance.now();
      if (lastVideoTime !== videoRef.current.currentTime) {
        lastVideoTime = videoRef.current.currentTime;
        
        // --- Face ---
        const faceResults = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);
        if (faceResults.facialTransformationMatrixes && faceResults.facialTransformationMatrixes.length > 0) {
          const matrix = faceResults.facialTransformationMatrixes[0].data;
          
          const m00 = matrix[0], m01 = matrix[4], m02 = matrix[8];
          const m10 = matrix[1], m11 = matrix[5], m12 = matrix[9];
          const m20 = matrix[2], m21 = matrix[6], m22 = matrix[10];
          
          let sy = Math.sqrt(m00 * m00 + m10 * m10);
          let singular = sy < 1e-6;

          let x, y, z;
          if (!singular) {
            x = Math.atan2(m21, m22);
            y = Math.atan2(-m20, sy);
            z = Math.atan2(m10, m00);
          } else {
            x = Math.atan2(-m12, m11);
            y = Math.atan2(-m20, sy);
            z = 0;
          }

          setHeadRotation({ x: x, y: -y, z: -z });
        }

        if (faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0) {
          const blendshapes = faceResults.faceBlendshapes[0].categories;
          
          let eyeBlinkLeft = 0;
          let eyeBlinkRight = 0;
          let mouthSmileLeft = 0;
          let mouthSmileRight = 0;
          let mouthOpen = 0;
          let browInnerUpLeft = 0;
          let browInnerUpRight = 0;
          let browOuterUpLeft = 0;
          let browOuterUpRight = 0;

          blendshapes.forEach((shape) => {
            if (shape.categoryName === 'eyeBlinkLeft') eyeBlinkLeft = shape.score;
            if (shape.categoryName === 'eyeBlinkRight') eyeBlinkRight = shape.score;
            if (shape.categoryName === 'mouthSmileLeft') mouthSmileLeft = shape.score;
            if (shape.categoryName === 'mouthSmileRight') mouthSmileRight = shape.score;
            if (shape.categoryName === 'jawOpen') mouthOpen = shape.score;
            if (shape.categoryName === 'browInnerUp') {
               browInnerUpLeft = shape.score;
               browInnerUpRight = shape.score;
            }
            if (shape.categoryName === 'browOuterUpLeft') browOuterUpLeft = shape.score;
            if (shape.categoryName === 'browOuterUpRight') browOuterUpRight = shape.score;
          });

          useStore.getState().setBlendshapes({
            eyeBlinkLeft,
            eyeBlinkRight,
            mouthSmileLeft,
            mouthSmileRight,
            mouthOpen,
            browInnerUp: Math.max(browInnerUpLeft, browInnerUpRight),
            browOuterUpLeft,
            browOuterUpRight
          });
        }
        
         // --- Pose ---
        const poseResults = poseLandmarker.detectForVideo(videoRef.current, startTimeMs);
        if (poseResults.landmarks && poseResults.landmarks.length > 0) {
           const lm = poseResults.landmarks[0];
           
           // Helper to get angle normalized to 0 = straight down.
           const getAngle = (p1: any, p2: any) => {
             return -(Math.atan2(p2.y - p1.y, p2.x - p1.x) - Math.PI / 2);
           };

           // Arm Tracking
           const leftArmVisible = lm[11] && lm[13] && lm[11].visibility > 0.5;
           const rightArmVisible = lm[12] && lm[14] && lm[12].visibility > 0.5;
           
           let currArms = useStore.getState().armRotations;
           let leftAngle = leftArmVisible ? -getAngle(lm[11], lm[13]) : 0;
           let rightAngle = rightArmVisible ? getAngle(lm[12], lm[14]) : 0;
           
           setArmRotations({ left: leftAngle, right: rightAngle });
           useStore.getState().setArmTrackingActive(leftArmVisible || rightArmVisible);
           
           // Leg Tracking
           if (lm[23] && lm[25] && lm[23].visibility > 0.5) { // Left Leg
              let angle = getAngle(lm[23], lm[25]);
              setLegRotations({ left: -angle, right: useStore.getState().legRotations.right });
           }
           if (lm[24] && lm[26] && lm[24].visibility > 0.5) { // Right Leg
              let angle = getAngle(lm[24], lm[26]);
              setLegRotations({ left: useStore.getState().legRotations.left, right: angle });
           }
        }

        // --- Hands ---
        const handResults = handLandmarker.detectForVideo(videoRef.current, startTimeMs);
        if (handResults.landmarks && handResults.landmarks.length > 0) {
           useStore.getState().setHandTrackingActive(true);
           const wrist = handResults.landmarks[0][0]; // landmark 0 is wrist
           // Simple wave/raise hand detection: if hand is raised high
           if (wrist.y < 0.4) {
               // raise left arm as a wave response
               setArmRotations({ left: -Math.PI/1.2, right: useStore.getState().armRotations.right });
           }
        } else {
           useStore.getState().setHandTrackingActive(false);
        }

        // --- Ambient Color ---
        if (Math.random() < 0.05) { // Extract once in a while
           const canvas = document.createElement('canvas');
           canvas.width = 16;
           canvas.height = 16;
           const ctx = canvas.getContext('2d', { willReadFrequently: true });
           if (ctx && videoRef.current) {
             ctx.drawImage(videoRef.current, 0, 0, 16, 16);
             const data = ctx.getImageData(0,0,16,16).data;
             let r=0, g=0, b=0;
             for(let i=0; i<data.length; i+=4) {
               r += data[i]; g += data[i+1]; b += data[i+2];
             }
             const count = data.length/4;
             // Boost brightness to make it look good on the bear
             const avgR = Math.min(255, Math.floor((r/count) * 1.5));
             const avgG = Math.min(255, Math.floor((g/count) * 1.5));
             const avgB = Math.min(255, Math.floor((b/count) * 1.5));
             const hex = `#${avgR.toString(16).padStart(2,'0')}${avgG.toString(16).padStart(2,'0')}${avgB.toString(16).padStart(2,'0')}`;
             useStore.getState().setAmbientColor(hex);
           }
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    initTracking();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (faceLandmarker) faceLandmarker.close();
      if (poseLandmarker) poseLandmarker.close();
    };
  }, [faceTrackingActive, setHeadRotation]);

  if (!faceTrackingActive) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl pointer-events-none">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "160px", height: "auto", transform: "scaleX(-1)" }} // Mirror view for user
      />
    </div>
  );
}
