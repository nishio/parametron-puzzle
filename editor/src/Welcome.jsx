import React, { useState } from "react";
import "./onboarding.css";

export function Welcome({ onStart, onResume }) {
  const [value, setValue] = useState(0),
    [tried, setTried] = useState(false);
  return (
    <main className="welcome-screen">
      <div className="welcome-content">
        <header className="welcome-brand">
          PARAMETRON <span>配線パズル</span>
        </header>
        <p className="welcome-eyebrow">予備知識はいりません</p>
        <h1>
          つないで、動かす。
          <br />
          小さな計算機を作ろう。
        </h1>
        <p className="welcome-intro">
          数字のスイッチと小さな素子を線でつなぎ、
          <strong>お題どおりに動く回路</strong>
          を作るパズルです。最後は足し算をする回路にも挑戦できます。
        </p>
        <section className="signal-practice" aria-labelledby="practice-title">
          <h2 id="practice-title">まずは、この0を押してみよう</h2>
          <p>回路で使う数字は、0と1だけです。</p>
          <div className="practice-controls">
            <div>
              <span>押して送る</span>
              <button
                className="practice-switch"
                style={{ color: value === 1 ? "#b97713" : "#276eaf" }}
                aria-label={"数字を" + (1 - value) + "に切り替える"}
                onClick={() => {
                  setValue(1 - value);
                  setTried(true);
                }}
              >
                {value}
              </button>
            </div>
            <div>
              <span>届いた数字</span>
              <output
                aria-label="届いた数字"
                aria-live="polite"
                data-value={value}
              >
                {value}
              </output>
            </div>
          </div>
          <p className="practice-feedback" role="status">
            {tried
              ? "できました！ 数字を変えると、届く数字も変わりました。"
              : "左の数字を押して、0から1にしてみよう。"}
          </p>
        </section>
        <button
          className="primary welcome-start"
          disabled={!tried}
          onClick={onStart}
        >
          回路で試す
        </button>
        <p className="welcome-note">
          次は実際の回路で練習します。進み具合は自動で保存されます。
        </p>
        {onResume && (
          <button className="welcome-resume" onClick={onResume}>
            練習を閉じてゲームに戻る
          </button>
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
      <p className="onboarding-step">
        {kind === "signal" ? "練習：数字と結果" : "練習：線をつなぐ"}
      </p>
      <h1 id="onboarding-task">
        {kind === "signal"
          ? done
            ? `できました！ ${result}が${votes}つで、結果も${result}です。`
            : "光っているBの数字を押して、1にしよう。"
          : done
            ? "最初の回路が完成しました！"
            : sourceSelected
              ? "次は、光っている空き端子を押そう。"
              : "固定0の、光っている丸い端子を押そう。"}
      </h1>
      <p>
        {kind === "signal"
          ? done
            ? "中央の素子は、3つの数字の多いほうを出します。これが「多数決」。次は線をつないで、自分で回路を完成させます。"
            : "左の数字が入力、右の「結果」が出力です。まずは1つ押して、変化を見てみよう。"
          : done
            ? "常に0を1票加えると、AとBが両方1のときだけ結果が1になります。この回路をANDと呼びます。"
            : sourceSelected
              ? "固定0を1票加えます。光っている枠内を押すと、2本まとめてつながります。丸はどちらでもOK。"
              : "お題は『AとBが両方1のときだけ結果を1』。固定0を1票加えます。枠内の丸はどちらでもOK。"}
      </p>
    </section>
  );
}
