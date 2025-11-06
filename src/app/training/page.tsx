"use client";

import { useState, useRef } from "react";
import modulesJson from "./modules.json";
import Lessons from "./Lessons";
import { Module } from "../../../types/types";
import EmotionDetector, { EmotionResult } from "./emotion";

function Training() {
  const [cur, setCur] = useState(-1);
  const [finished, setFinished] = useState(false);
  const [module, setModule] = useState<Module | null>();
  const modules: any = modulesJson;
  const resultRef = useRef<EmotionResult | null>(null);

  if (!module) {
    return (
      <>
        <main
          className="h-screen w-full flex flex-col items-center justify-center gap-3"
          style={{ background: "url('final_bg.webp')" }}
        >
          <button
            onClick={() => {
              console.log(resultRef.current!);
            }}
          >
            emotion
          </button>
          {Object.keys(modules).map((key, idx) => {
            console.log(modules[key]);
            return (
              <button
                key={idx}
                className="p-3 max-w-2xs w-full border rounded-3xl border-black text-black cursor-pointer"
                onClick={() => setModule(modules[key])}
              >
                <h1>{key}</h1>
                <h2>{modules[key].name}</h2>
              </button>
            );
          })}
        </main>
      </>
    );
  }

  if (finished) {
    return (
      <main className="training">
        <div className="module-deets">
          <h1>You Finished the</h1>
          <h1>{module?.name}</h1>
          <h1>Thank youuu</h1>
          <button
            onClick={() => {
              setModule(null);
              setCur(-1);
              setFinished(false);
            }}
          >
            Click to go back to modules
          </button>
        </div>
      </main>
    );
  }

  // Render the training page
  return (
    <main
      className="h-screen w-full flex flex-col items-center justify-center"
      style={{ background: "url('final_bg.webp')" }}
    >
      <EmotionDetector resultRef={resultRef} />

      {cur === -1 ? (
        <div className="absolute top-[170px] flex flex-flex-col items-center m-6">
          <h1>{module.name}</h1>
          <button
            className="flex justify-center items-center bg-black text-white"
            onClick={() => setCur(0)}
          >
            Start <img className="h-[50px]" src="/left-arrow.svg" alt="Start" />
          </button>
        </div>
      ) : (
        <Lessons
          question={module.lessons[cur]}
          setCur={setCur}
          cur={cur}
          setFinished={setFinished}
          emotion={resultRef}
        />
      )}
    </main>
  );
}

export default Training;
