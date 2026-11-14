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

export function OnboardingCoach({ kind, done, sourceSelected, step }) {
  return (
    <section
      className="onboarding-coach"
      aria-labelledby="onboarding-task"
      aria-live="polite"
    >
      {kind === "signal" && (
        <div className="onboarding-step">
          パラメトロンのしくみ ·{" "}
          {step === 0 ? "見る" : step === 3 ? "できた" : "試す"}
        </div>
      )}
      <h1 id="onboarding-task">
        {kind === "signal"
          ? step === 0
            ? "これが「多数決」の回路です。"
            : step === 1
              ? "Bの0を押して、1にしてみよう。"
              : step === 2
                ? "1が2票になり、結果も1に。"
                : "多数決のしくみを試せました。"
          : done
            ? "回路が完成しました！"
            : sourceSelected
              ? "次は、光っている空き端子を押そう。"
              : "固定0の、光っている端子を押そう。"}
      </h1>
      <p>
        {kind === "signal"
          ? step === 0
            ? "A・B・Cの数字が、それぞれ1票。3票のうち、2票以上ある数字を「結果」に出します。"
            : step === 1
              ? "1が2票になったら、結果はどう変わる？"
              : step === 2
                ? "今度はAの1を押して、0を2票にしてみよう。"
                : "この部品がパラメトロン。数字を自由に変えて試すか、次の回路へ進めます。"
          : done
            ? "AとBが両方1のときだけ、結果が1になります。"
            : sourceSelected
              ? "枠の中の丸は、どちらでもOK。2本まとめてつながります。"
              : "AとBが両方1のときだけ、結果が1になる回路を作ります。"}
      </p>
    </section>
  );
}

export function MajorityReading({ values, result }) {
  const ones = values.filter((value) => value === 1).length;
  return (
    <section
      className="majority-reading"
      aria-label="いまの多数決"
      aria-live="polite"
    >
      <div className="majority-votes">
        {[0, 1].map((value) => (
          <span key={value} data-value={value} data-winner={result === value}>
            <b>{value}</b>が <strong>{value === 0 ? 3 - ones : ones}票</strong>
          </span>
        ))}
      </div>
      <p>
        <strong>{result}</strong>が多いので、結果は<strong>{result}</strong>。
      </p>
      <details className="majority-wire-help">
        <summary>線が2本あるのは？</summary>
        <p>
          2本で1つの信号です。上の線は入力の数字、下の線は反対の数字を運びます。票はA・B・Cの数字を1票ずつ数えます。青が0、黄が1です。
        </p>
      </details>
    </section>
  );
}
