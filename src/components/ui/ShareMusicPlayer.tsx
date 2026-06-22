"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { pickRandomMusic } from "@/lib/share-music";

/**
 * 공유 페이지 배경음악 플레이어.
 * - 진입 시 public/music 의 랜덤 mp3 자동재생을 시도한다.
 * - 브라우저 자동재생 정책으로 막히면 "음악 켜기" 버튼이 깜빡이며 사용자 클릭을 유도한다.
 * - 버튼으로 언제든 재생/일시정지 가능. 곡은 반복 재생된다.
 */
export function ShareMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const audio = new Audio(pickRandomMusic());
    audio.loop = true;
    audio.volume = 0.6;
    audioRef.current = audio;
    setReady(true);

    // 자동재생 시도 — 정책상 막히면 조용히 실패하고 버튼으로 유도.
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  if (!ready) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? "음악 멈추기" : "음악 켜기"}
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#7b310d] px-4 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 ${
        playing ? "" : "animate-pulse"
      }`}
    >
      {playing ? <Pause size={16} /> : <Play size={16} />}
      {playing ? "음악 재생 중" : "음악 켜기"}
    </button>
  );
}
