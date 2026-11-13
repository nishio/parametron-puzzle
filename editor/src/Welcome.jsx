import React, { useState } from "react";
import "./onboarding.css";

export function Welcome({ onStart, onResume }) {
  const [started, setStarted] = useState(false),
    [tried, setTried] = useState(false);
  if (!started)
    return (
      <main className="welcome-screen">
        <div className="quiet-entry">
          <h1>
            線をつないで、
            <br />
            計算機をつくろう。
          </h1>
          <p>お題どおりに動く回路をつくるパズル。</p>
          <button className="primary" onClick={() => setStarted(true)}>
            はじめる
          </button>
          {onResume && (
            <button className="welcome-resume" onClick={onResume}>
              ゲームに戻る
            </button>
          )}
        </div>
      </main>
    );
  return (
    <main className="welcome-screen">
      <div className="quiet-practice">
        <h1 aria-live="polite">
          {tried ? "1に変わりました。" : "0を押してみよう。"}
        </h1>
        <button
          className="practice-switch"
          aria-label={tried ? "数字1" : "数字を1に切り替える"}
          disabled={tried}
          style={{ color: tried ? "#b97713" : "#276eaf" }}
          onClick={() => setTried(true)}
        >
          {tried ? 1 : 0}
        </button>
        {tried && (
          <div className="practice-next">
            <p>0と1を使って、回路を動かします。</p>
            <button className="primary" onClick={onStart} autoFocus>
              回路で試す
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export function OnboardingCoach({ kind, done, sourceSelected, result, votes }) {
  return (
    <section
      className="onboarding-coach"
      aria-labelledby="onboarding-task"
      aria-live="polite"
    >
      <h1 id="onboarding-task">
        {kind === "signal"
          ? done
            ? `${result}が${votes}つで、結果も${result}です。`
            : "光っているBの0を押してみよう。"
          : done
            ? "回路が完成しました！"
            : sourceSelected
              ? "次は、光っている空き端子を押そう。"
              : "固定0の、光っている端子を押そう。"}
      </h1>
      {(kind !== "signal" || done) && (
        <p>
          {kind === "signal"
            ? "この素子は、3つの数字の多いほうを出します。これが多数決です。"
            : done
              ? "AとBが両方1のときだけ、結果が1になります。"
              : sourceSelected
                ? "枠の中の丸は、どちらでもOK。2本まとめてつながります。"
                : "AとBが両方1のときだけ、結果が1になる回路を作ります。"}
        </p>
      )}
    </section>
  );
}
