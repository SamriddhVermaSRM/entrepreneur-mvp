"use client";

import { useEffect, useState } from "react";

function Lessons({ question, setCur, cur, setFinished, emotion }: any) {
  const [loadedAt, setLodedAt] = useState(Date.now());
  console.log(cur);

  const getTime = () => {
    const time = new Date(Date.now() - loadedAt);
    return {
      m: time.getMinutes() - 30,
      s: time.getSeconds(),
      ms: time.getMilliseconds(),
    };
  };

  const handleLogging = (ans: any) => {
    const timeRecord = getTime();
    console.log({ question, ans: null, timeRecord, emotion: emotion.current });
  };

  const handleClick = () => {
    handleLogging(null);
    if (!question.end) setCur(cur + 1);
    else setFinished(true);
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const ans = data.get("ans");
    handleLogging(ans);
    if (ans === question.choices[0].message) {
      setCur(cur + question.choices[0].next);
    }
    if (ans === question.choices[1].message) {
      setCur(cur + question.choices[1].next);
    }
  };

  if (question.speaker === "user") {
    return (
      <>
        <form
          className="flex flex-col m-[30px] max-w-[350px] p-5 border"
          onSubmit={handleSubmit}
        >
          <h2>{question.message}</h2>
          <div className="grid grid-cols-2 place-items-center">
            <label htmlFor="a">
              <input
                type="radio"
                name="ans"
                id="a"
                className="question"
                value={question.choices[0].message}
              />
              {question.choices[0].message}
            </label>

            <label htmlFor="b">
              <input
                type="radio"
                name="ans"
                id="b"
                className="question"
                value={question.choices[1].message}
              />
              {question.choices[1].message}
            </label>
          </div>
          <button type="submit">Submit</button>
        </form>
      </>
    );
  } else if (question.speaker === "bacche") {
    return (
      <>
        <div className="bacche" onClick={handleClick}>
          <h2>{question.message}</h2>
          <img src="/bacche.png" alt="" style={{ height: "400px" }} />
        </div>
      </>
    );
  } else if (question.speaker === "teacher") {
    return (
      <>
        <div className="teacher" onClick={handleClick}>
          <h2>{question.message}</h2>
          <img src="/teacher.png" alt="" style={{ height: "400px" }} />
        </div>
      </>
    );
  } else if (question.speaker === "girl") {
    return (
      <>
        <div className="girl" onClick={handleClick}>
          <h2>{question.message}</h2>
          <img src="/girl.png" alt="" style={{ height: "400px" }} />
        </div>
      </>
    );
  } else if (question.speaker === "boy") {
    return (
      <>
        <div className="boy" onClick={handleClick}>
          <h2>{question.message}</h2>
          <img src="/boy.png" alt="" style={{ height: "400px" }} />
        </div>
      </>
    );
  }
}

export default Lessons;
