"use client";

type LoadingOverlayProps = {
  open: boolean;
  title?: string;
  description?: string;
};

export function LoadingOverlay({
  open,
  title = "저장 중입니다",
  description = "잠시만 기다려주세요.",
}: LoadingOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-overlay-title"
      aria-describedby="loading-overlay-description"
    >
      <div className="flex w-full max-w-xs flex-col items-center rounded-3xl bg-white px-6 py-8 text-center shadow-2xl">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-[6px] border-orange-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-[6px] border-transparent border-r-[#d98238] border-t-[#7b310d]" />
          <div className="absolute inset-[18px] rounded-full bg-orange-50" />
        </div>
        <h2 id="loading-overlay-title" className="mt-5 text-lg font-black text-[#5a240d]">
          {title}
        </h2>
        <p id="loading-overlay-description" className="mt-2 text-sm font-semibold text-stone-500">
          {description}
        </p>
      </div>
    </div>
  );
}
