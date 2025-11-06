"use client";

import { useEffect, useRef } from "react";

export type EmotionResult = {
  topEmotion: string;
  topScore: number;
  scores: Record<string, number>;
};

export default function EmotionDetector({
  resultRef,
}: {
  resultRef: React.RefObject<EmotionResult | null>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let faceLandmarker: any = null;
    let running = true;

    async function init() {
      const vision = await import("@mediapipe/tasks-vision");
      const { FilesetResolver, FaceLandmarker } = vision;

      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );

      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/models/face_landmarker.task",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      await startCamera();
      renderLoop();
    }

    async function startCamera() {
      if (!videoRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    // ---- Emotion Weights (your Indian-tuned version) ----
    const emotionWeights: Record<string, Record<string, number>> = {
      happy: {
        mouthSmileLeft: 1.3,
        mouthSmileRight: 1.3,
        eyeSquintLeft: 0.9,
        eyeSquintRight: 0.9,
        mouthPressLeft: 0.8,
        mouthPressRight: 0.8,
        browOuterUpLeft: 0.7,
        browOuterUpRight: 0.7,
        mouthDimpleLeft: 0.5,
        mouthDimpleRight: 0.5,
      },
      sad: {
        mouthShrugLower: 1.3,
        mouthShrugUpper: 1.0,
        browInnerUp: 0.7,
        browDownLeft: 0.6,
        browDownRight: 0.6,
        eyeSquintLeft: 0.8,
        eyeSquintRight: 0.8,
        mouthPressLeft: 0.7,
        mouthPressRight: 0.5,
        mouthFrownLeft: 0.3,
        mouthFrownRight: 0.3,
      },
      angry: {
        mouthPucker: 1.2,
        eyeSquintLeft: 0.8,
        eyeSquintRight: 0.8,
        browDownLeft: 0.7,
        browDownRight: 0.7,
        jawForward: 0.6,
        noseSneerLeft: 0.3,
        noseSneerRight: 0.3,
        eyeWideLeft: -0.7,
        eyeWideRight: -0.7,
        mouthSmileLeft: -1.0,
        mouthSmileRight: -1.0,
      },
      surprised: {
        eyeWideLeft: 1.0,
        eyeWideRight: 1.0,
        browInnerUp: 0.8,
        browOuterUpLeft: 0.5,
        browOuterUpRight: 0.5,
        jawOpen: 0.8,
        mouthPucker: -0.6,
      },
      disgusted: {
        noseSneerLeft: 1.0,
        noseSneerRight: 1.0,
        upperLipRaiseLeft: 0.7,
        upperLipRaiseRight: 0.7,
        mouthPucker: 0.3,
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
        mouthPucker: 0.2,
      },
      neutral: {},
    };

    function computeEmotionScores(blendshapes: Record<string, number>) {
      const emotions = Object.keys(emotionWeights);
      const scores: Record<string, number> = {};
      let total = 0;

      for (const e of emotions) {
        let s = 0;
        const wmap = emotionWeights[e];
        for (const [bs, w] of Object.entries(wmap)) {
          const v = blendshapes[bs] ?? 0;
          s += v * w;
        }
        scores[e] = Math.max(0, s);
        total += scores[e];
      }

      scores["neutral"] =
        1.0 - Math.min(1.0, total / Math.max(0.0001, emotions.length));

      const sumAll = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
      for (const k of Object.keys(scores)) scores[k] = scores[k] / sumAll;
      return scores;
    }

    async function renderLoop() {
      if (!running || !faceLandmarker || !videoRef.current) return;

      if (videoRef.current.readyState >= 2) {
        try {
          const result = await faceLandmarker.detectForVideo(
            videoRef.current,
            performance.now(),
          );

          let blendDict: Record<string, number> = {};
          if (result?.faceBlendshapes?.[0]) {
            const first = result.faceBlendshapes[0];
            if (Array.isArray(first.categories)) {
              for (const b of first.categories)
                blendDict[b.categoryName] = b.score ?? 0;
            }
          }

          const scores = computeEmotionScores(blendDict);
          const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
          const [topEmotion, topScore] = sorted[0] ?? ["neutral", 0];

          resultRef.current = {
            topEmotion,
            topScore,
            scores,
          };
        } catch (err) {
          console.error("faceLandmarker error", err);
        }
      }

      requestAnimationFrame(renderLoop);
    }

    init();

    return () => {
      running = false;
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      try {
        faceLandmarker?.close?.();
      } catch {}
    };
  }, [resultRef]);

  return <video ref={videoRef} style={{ display: "none" }} playsInline muted />;
}
