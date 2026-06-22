// 공유 페이지 배경음악 목록. public/music 폴더의 mp3 파일을 가리킨다.
// "(1)" 중복 파일은 제외한 대표 10곡. 새 곡을 추가하면 이 목록에도 파일명을 넣으면 된다.
const MUSIC_FILES = [
  "Blue Sky Waltz.mp3",
  "Dawn Henhouse.mp3",
  "Dew Over Gwangdeok.mp3",
  "Dew on Cedar Sill.mp3",
  "First Bird Prelude.mp3",
  "Forest Hourglass.mp3",
  "Garden Letter.mp3",
  "Rain on Petals.mp3",
  "Riverside Dawn.mp3",
  "Spring Letter.mp3",
] as const;

// 브라우저에서 바로 쓸 수 있는 인코딩된 공개 경로(/music/...) 배열.
export const SHARE_MUSIC: string[] = MUSIC_FILES.map(
  (name) => `/music/${encodeURIComponent(name)}`
);

// 공유 페이지 진입마다 무작위 한 곡을 고른다.
export function pickRandomMusic(): string {
  return SHARE_MUSIC[Math.floor(Math.random() * SHARE_MUSIC.length)];
}
