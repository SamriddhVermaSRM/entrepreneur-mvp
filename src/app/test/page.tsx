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
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );

      setStatus("Creating FaceLandmarker...");

      // create FaceLandmarker with options:
      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          // point to your model placed in public/models/face_landmarker.task
          modelAssetPath: "/models/face_landmarker.task",
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
    const emotionWeights: Record<string, Record<string, number>> = {
      // for each emotion, specify weights for a few high-signal blendshapes
      happy: {
        mouthSmileLeft: 1.0,
        mouthSmileRight: 1.0,
        mouthOpen: 0.2,
      },
      sad: {
        mouthFrownLeft: 0.9,
        mouthFrownRight: 0.9,
        browInnerUp: 0.4,
      },
      angry: {
        browDownLeft: 0.9,
        browDownRight: 0.9,
        noseSneerLeft: 0.3,
        noseSneerRight: 0.3,
      },
      surprised: {
        eyesWideLeft: 0.9,
        eyesWideRight: 0.9,
        mouthOpen: 0.8,
      },
      disgusted: {
        noseSneerLeft: 0.9,
        noseSneerRight: 0.9,
        mouthFunnel: 0.2,
      },
      fearful: {
        eyesWideLeft: 0.6,
        eyesWideRight: 0.6,
        browInnerUp: 0.6,
        mouthOpen: 0.4,
      },
      neutral: {
        // neutral is "low activation" — we will compute as inverse of others later
        // leave weights empty; neutral will be computed from remainder
      },
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

      <div style={{ position: "relative", display: "inline-block" }}>
        <video
          ref={videoRef}
          style={{ width: 640, height: 360, borderRadius: 8 }}
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
