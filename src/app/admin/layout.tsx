// 관리자 페이지는 실시간 DB 데이터를 다루므로 빌드 타임 정적 프리렌더 대신 항상 동적 렌더링.
// (빌드 시 Supabase 접속/환경변수 의존을 없애 배포 견고성도 확보)
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
