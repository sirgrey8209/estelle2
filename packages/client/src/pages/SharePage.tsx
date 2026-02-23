/**
 * @file SharePage.tsx
 * @description 공유 페이지 - 공유 링크를 통해 대화를 읽기 전용으로 조회
 *
 * - 로그인 없이 접근 가능
 * - 읽기 전용 (입력창 없음)
 * - 실시간 메시지 수신
 */

import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle, Link2Off } from 'lucide-react';
import { useShareStore } from '../stores';
import { useShareConnection } from '../hooks';
import { ShareMessageList } from '../components/share/ShareMessageList';

/**
 * 공유 페이지 컴포넌트
 *
 * /share/:shareId 경로로 접근하여 공유된 대화를 읽기 전용으로 조회합니다.
 */
export function SharePage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { isConnected, isAuthenticated, error } = useShareStore();

  // WebSocket 연결 관리
  useShareConnection(shareId ?? '');

  // shareId가 없는 경우
  if (!shareId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Link2Off className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">
          잘못된 공유 링크
        </h1>
        <p className="text-muted-foreground text-center">
          공유 링크가 올바르지 않습니다.
        </p>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">
          연결 오류
        </h1>
        <p className="text-muted-foreground text-center max-w-md">
          {error}
        </p>
      </div>
    );
  }

  // 연결 중 상태
  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">서버에 연결 중...</p>
      </div>
    );
  }

  // 인증 중 상태
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">공유 링크 확인 중...</p>
      </div>
    );
  }

  // 정상 연결됨 - 메시지 목록 표시
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 헤더 */}
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-lg font-semibold text-foreground">
            공유된 대화
          </h1>
          <span className="text-xs text-muted-foreground">
            읽기 전용
          </span>
        </div>
      </header>

      {/* 메시지 목록 */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto">
          <ShareMessageList />
        </div>
      </main>
    </div>
  );
}
