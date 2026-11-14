import React, { useEffect, useRef } from "react";
import "./dialog.css";

export function ClearDialog({ completion, nextName, onClose, onNext }) {
  const ref = useRef(null);
  const optimal = completion.advanced && completion.cost === completion.minimum;
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="clear-dialog"
      aria-labelledby="clear-title"
      aria-describedby="clear-summary"
      onCancel={onClose}
    >
      <div className="clear-dialog-content">
        <span className="clear-mark" aria-hidden="true">
          ✓
        </span>
        <p className="clear-chapter">{completion.chapter}</p>
        <h2 id="clear-title">
          {completion.name} {optimal ? "理論最小クリア！" : "クリア！"}
        </h2>
        <p id="clear-summary">すべての入力で正しく動きました。</p>
        {(completion.reward === "AND" || completion.name === "AND") && (
          <p className="clear-auto-check">
            全4通りの入力を、ゲームが自動チェックしました。
          </p>
        )}
        {completion.practice && (
          <p className="clear-auto-check">
            復習中です。元のゲームの進捗は変わりません。
          </p>
        )}
        <p className="clear-explanation">{completion.explanation}</p>
        <p className="clear-score">
          パラメトロン <strong>{completion.cost}</strong>個
          {completion.cost === completion.minimum && (
            <span>{optimal ? "理論最小" : "最少達成"}</span>
          )}
        </p>
        {completion.advanced && !optimal && (
          <div className="minimum-challenge">
            <strong>次は、理論最小の{completion.minimum}個に挑戦</strong>
            <p>
              通常クリア達成。素子や配線を共有して、あと
              {completion.cost - completion.minimum}個減らしてみよう。
            </p>
          </div>
        )}
        {completion.reward && (
          <section
            className="unlocked-blueprint"
            aria-label="獲得したブループリント"
          >
            <span className="blueprint-name">{completion.reward}</span>
            <div>
              <h3>
                {completion.newUnlock
                  ? "ブループリントをアンロック"
                  : "ブループリントを獲得済み"}
              </h3>
              <p>
                作った回路を保存しました。
                {completion.reward === "XOR" ? "半加算器" : "XOR"}
                の課題から、画面上部の「{completion.reward}
                」ボタンで再利用できます。固定信号も設定済みです。
              </p>
            </div>
          </section>
        )}
        {completion.isLast && (
          <p className="clear-finish">
            全課題クリア！ 素子を共有して、さらに個数を減らすこともできます。
          </p>
        )}
        <div className="clear-dialog-actions">
          <button className={nextName ? "" : "primary"} onClick={onClose}>
            回路を見る
          </button>
          {nextName && (
            <button className="primary" onClick={onNext} autoFocus>
              次へ：{nextName} →
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
