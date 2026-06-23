"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, Volume2, X } from "lucide-react";
import { SHARE_MUSIC, pickRandomMusic } from "@/lib/share-music";

function trackLabel(url: string): string {
  try {
    return decodeURIComponent(url.split("/").pop() ?? "").replace(/\.mp3$/i, "");
  } catch {
    return "음악";
  }
}

/**
 * 떠 있는 배경음악 플레이어. (홈 화면 + 카드 공유 페이지 공용)
 * - 재생/일시정지, 곡 선택, 볼륨 조절
 * - autoPlay=true 면 진입 시 자동재생 시도(브라우저 차단 시 버튼이 깜빡이며 유도)
 * - 곡은 public/music 목록(SHARE_MUSIC)에서 선택. 기본은 랜덤(또는 initialTrack).
 */
export function MusicPlayer({
  autoPlay = false,
  autoPlayDelayMs = 0,
  initialTrack = null,
  positionClassName = "bottom-5 right-5",
}: {
  autoPlay?: boolean;
  /** 자동재생 시도까지의 지연(ms). GIF 등 콘텐츠 다운로드 시간을 고려해 텀을 준다. */
  autoPlayDelayMs?: number;
  initialTrack?: string | null;
  positionClassName?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [track, setTrack] = useState<string>(() =>
    initialTrack && SHARE_MUSIC.includes(initialTrack) ? initialTrack : pickRandomMusic()
  );
  const [volume, setVolume] = useState(0.6);

  // 오디오 1개 생성 후 첫 트랙 로드 + (옵션) 자동재생 시도
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.6;
    audio.src = track;
    audioRef.current = audio;
    setReady(true);

    let cancelled = false;
    let removeInteraction = () => {};

    if (autoPlay) {
      // 브라우저는 소리 자동재생을 제스처 전까지 막으므로,
      // (1) 지연 후 자동재생 시도 → (2) 막히면 첫 사용자 동작(터치/스크롤/클릭) 때 시작.
      const startOnInteraction = () => {
        const handler = () => {
          audio.play().then(() => setPlaying(true)).catch(() => {});
        };
        const opts: AddEventListenerOptions = { once: true, passive: true };
        window.addEventListener("pointerdown", handler, opts);
        window.addEventListener("touchstart", handler, opts);
        window.addEventListener("keydown", handler, opts);
        window.addEventListener("scroll", handler, opts);
        removeInteraction = () => {
          window.removeEventListener("pointerdown", handler);
          window.removeEventListener("touchstart", handler);
          window.removeEventListener("keydown", handler);
          window.removeEventListener("scroll", handler);
        };
      };

      const timer = window.setTimeout(() => {
        if (cancelled) return;
        audio.play().then(() => setPlaying(true)).catch(() => startOnInteraction());
      }, autoPlayDelayMs);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        removeInteraction();
        audio.pause();
        audio.src = "";
        audioRef.current = null;
      };
    }

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
    // 최초 1회만 — track/volume 변경은 아래 핸들러에서 직접 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const selectTrack = (next: string) => {
    setTrack(next);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = next;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  if (!ready) return null;

  return (
    <div className={`fixed z-50 flex flex-col items-end gap-2 ${positionClassName}`}>
      {open && (
        <div className="w-60 rounded-2xl border border-white/30 bg-white/95 p-3 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-black text-stone-600">배경음악</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="text-stone-400 hover:text-stone-600">
              <X size={15} />
            </button>
          </div>
          <select
            value={track}
            onChange={(e) => selectTrack(e.target.value)}
            aria-label="곡 선택"
            className="mb-2 h-9 w-full rounded-lg border border-stone-200 bg-white px-2 text-xs font-bold text-stone-700 outline-none"
          >
            {SHARE_MUSIC.map((url) => (
              <option key={url} value={url}>
                {trackLabel(url)}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "일시정지" : "재생"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#7b310d] text-white"
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <Volume2 size={15} className="shrink-0 text-stone-500" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="볼륨"
              className="flex-1 accent-[#7b310d]"
            />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="배경음악 열기"
        className={`flex h-12 w-12 items-center justify-center rounded-full bg-[#7b310d] text-white shadow-lg transition active:scale-95 ${
          playing || open ? "" : "animate-pulse"
        }`}
      >
        <Music size={18} />
      </button>
    </div>
  );
}
