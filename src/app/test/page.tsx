"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [emotionText, setEmotionText] = useState("—");

  useEffect(() => {
    let faceLandmarker: any = null;
    let running = true;

    async function init() {
      // load mediapipe tasks-vision in the browser (dynamic import)
      setStatus("Loading MediaPipe...");

      const vision = await import("@mediapipe/tasks-vision");
      const { FilesetResolver, FaceLandmarker } = vision;

      // FilesetResolver.forVisionTasks expects the wasm root (CDN or local)
      const fileset = await FilesetResolver.forVisionTasks("/wasm");

      setStatus("Creating FaceLandmarker...");

      // create FaceLandmarker with options:
      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          // point to your model placed in public/models/face_landmarker.task
          modelAssetPath: "/models/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      setStatus("Starting camera...");
      await startCamera();
      setStatus("Running");
      renderLoop();
    }

    async function startCamera() {
      if (!videoRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    // mapping from blendshapes -> emotions (simple heuristic weights)
    // Keys correspond to MediaPipe blendshape names; weights chosen heuristically.
    // This is a lightweight no-training mapping: you can replace or tune weights.
    /**
     * Heuristic mapping of MediaPipe Face Blendshapes to 6 basic emotions.
     * Values are weights; you can tune them. Higher = more influence.
     */
    const emotionWeights: Record<string, Record<string, number>> = {
      happy: {
        mouthSmileLeft: 1.3,
        mouthSmileRight: 1.3,

        // Indians show subtle cheek + eye expression
        eyeSquintLeft: 0.9,
        eyeSquintRight: 0.9,

        // Lip press is common while smiling in India
        mouthPressLeft: 0.8,
        mouthPressRight: 0.8,

        // Eyebrow lift is a strong happiness sign
        browOuterUpLeft: 0.7,
        browOuterUpRight: 0.7,

        // Dimples support happiness
        mouthDimpleLeft: 0.5,
        mouthDimpleRight: 0.5,
      },

      sad: {
        // Most dominant sadness markers in Indian expressions
        mouthShrugLower: 1.3,
        mouthShrugUpper: 1.0,

        // Subtle brow sadness cues
        browInnerUp: 0.7,
        browDownLeft: 0.6,
        browDownRight: 0.6,

        // Indians tighten eyes when sad instead of widening
        eyeSquintLeft: 0.8,
        eyeSquintRight: 0.8,

        // Holding lips together when sad
        mouthPressLeft: 0.7,
        mouthPressRight: 0.5,

        // Light frown contribution (because here it's very low)
        mouthFrownLeft: 0.3,
        mouthFrownRight: 0.3,
      },

      angry: {
        // Indian style anger: pouted lips + squint + slight brow down
        mouthPucker: 1.2, // <-- BIG DIFFERENCE: detect pouted anger
        eyeSquintLeft: 0.8,
        eyeSquintRight: 0.8,
        browDownLeft: 0.7,
        browDownRight: 0.7,
        jawForward: 0.6,
        noseSneerLeft: 0.3,
        noseSneerRight: 0.3,
        eyeWideLeft: -0.7, // anger ≠ wide eyes
        eyeWideRight: -0.7,
        mouthSmileLeft: -1.0, // reduce “angry smiling” confusion
        mouthSmileRight: -1.0,
      },

      surprised: {
        eyeWideLeft: 1.0,
        eyeWideRight: 1.0,
        browInnerUp: 0.8,
        browOuterUpLeft: 0.5,
        browOuterUpRight: 0.5,
        jawOpen: 0.8,
        mouthPucker: -0.6, // avoids confusing “pout” as surprise
      },

      disgusted: {
        noseSneerLeft: 1.0,
        noseSneerRight: 1.0,
        upperLipRaiseLeft: 0.7,
        upperLipRaiseRight: 0.7,
        mouthPucker: 0.3, // in India, disgust often includes a small pout
        eyeSquintLeft: 0.3,
        eyeSquintRight: 0.3,
      },

      fearful: {
        eyeWideLeft: 0.9,
        eyeWideRight: 0.9,
        browInnerUp: 0.7,
        mouthStretchLeft: 0.5,
        mouthStretchRight: 0.5,
        jawOpen: 0.5,
        mouthPucker: 0.2, // fear sometimes has puckering
      },

      neutral: {},
    };

    // helper to compute emotion scores from blendshapes object
    function computeEmotionScores(blendshapes: Record<string, number>) {
      const emotions = Object.keys(emotionWeights);
      console.table(blendshapes);
      const scores: Record<string, number> = {};
      let total = 0;
      for (const e of emotions) {
        let s = 0;
        const wmap = emotionWeights[e];
        for (const [bs, w] of Object.entries(wmap)) {
          const v = blendshapes[bs] ?? 0;
          s += v * w;
        }
        // clamp and store
        scores[e] = Math.max(0, s);
        total += scores[e];
      }
      // compute neutral as remainder (if others low)
      const otherSum = total;
      scores["neutral"] = Math.max(
        0,
        1.0 - Math.min(1.0, otherSum / Math.max(0.0001, emotions.length)),
      );
      // normalize to probabilities
      const sumAll = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
      for (const k of Object.keys(scores)) scores[k] = scores[k] / sumAll;
      return scores;
    }

    function drawResults(result: any) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // draw landmarks if available (simple points)
      const faces = result.faceLandmarks ?? result.face_landmarks ?? null;
      if (faces && faces.length > 0) {
        const lm = faces[0];
        ctx.fillStyle = "rgba(255,0,0,0.8)";
        for (const p of lm) {
          const x = p.x * canvas.width;
          const y = p.y * canvas.height;
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // render loop: call detectForVideo and process results
    async function renderLoop() {
      if (!running || !faceLandmarker || !videoRef.current) return;

      // Ensure video metadata loaded
      if (videoRef.current.readyState < 2) {
        requestAnimationFrame(renderLoop);
        return;
      }

      try {
        const result = await faceLandmarker.detectForVideo(
          videoRef.current,
          performance.now(),
        );

        // Normalize blendshapes to a dictionary
        let blendDict: Record<string, number> = {};
        if (result?.faceBlendshapes && result.faceBlendshapes.length > 0) {
          const first = result.faceBlendshapes[0];

          if (Array.isArray(first)) {
            for (const b of first) blendDict[b.categoryName] = b.score ?? 0;
          } else if (Array.isArray(first.categories)) {
            for (const b of first.categories)
              blendDict[b.categoryName] = b.score ?? 0;
          } else {
            Object.assign(blendDict, first);
          }
        }

        const scores = computeEmotionScores(blendDict);
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const [topEmotion, topScore] = sorted[0] ?? ["neutral", 0];

        setEmotionText(`${topEmotion} (${(topScore * 100).toFixed(1)}%)`);

        drawResults(result);
      } catch (err) {
        console.error("faceLandmarker error", err);
      }

      requestAnimationFrame(renderLoop);
    }

    init().catch((e) => {
      console.error(e);
      setStatus("Init error — check console");
    });

    return () => {
      running = false;
      // stop camera
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      // dispose faceLandmarker if present
      try {
        faceLandmarker?.close?.();
      } catch {}
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 720,
        margin: "24px auto",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2>Minimal Emotion Detector (MediaPipe FaceLandmarker)</h2>
      <p style={{ color: "#666" }}>{status}</p>

      <div
        style={{
          position: "relative",
          display: "inline-block",
          width: 640,
          height: 360,
        }}
      >
        <video
          ref={videoRef}
          style={{ width: 640, height: 360, borderRadius: 8, opacity: 0 }}
          playsInline
          // autoPlay
          muted
        />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: 360,
            width: 640,
            pointerEvents: "none",
          }}
        />
      </div>

      <h3 style={{ marginTop: 12 }}>{emotionText}</h3>
      <p style={{ fontSize: 12, color: "#777" }}>
        Uses MediaPipe FaceLandmarker blendshapes → heuristic mapping to 7
        emotions.
      </p>
    </div>
  );
}
