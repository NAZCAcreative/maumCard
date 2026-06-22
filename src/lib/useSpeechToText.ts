"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API 의 최소 타입 (브라우저 표준 + webkit 접두 구현 대응).
type SpeechRecognitionResultLike = { 0: { transcript: string }; isFinal: boolean };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * 음성 → 텍스트 입력 훅. (브라우저 Web Speech API 기반, 한국어 기본)
 * start(onText) 호출 시 인식 시작, onText 로 "현재 세션의 전체 받아쓰기"가 누적 전달된다.
 * 호출부는 녹음 시작 시점의 기존 텍스트에 이 값을 이어 붙이면 된다.
 */
export function useSpeechToText(lang = "ko-KR") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef<((sessionText: string) => void) | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(
    (onText: (sessionText: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return;
      recognitionRef.current?.abort();

      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      onTextRef.current = onText;
      rec.onresult = (e) => {
        // 0번부터 모두 합쳐 이번 세션의 전체 받아쓰기를 만든다(중간 결과 포함).
        let text = "";
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        onTextRef.current?.(text);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    },
    [lang]
  );

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, start, stop };
}
