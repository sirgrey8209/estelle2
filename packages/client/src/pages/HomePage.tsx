import { useRelayStore, useSyncStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { ResponsiveLayout } from '../layouts/ResponsiveLayout';
import { WorkspaceSidebar } from '../components/sidebar/WorkspaceSidebar';
import { ChatArea } from '../components/chat/ChatArea';
import { LoginScreen } from '../components/auth/LoginScreen';

export function HomePage() {
  const { isConnected, isAuthenticated } = useRelayStore();
  const { isAuthenticated: isGoogleAuthenticated } = useAuthStore();
  const workspaceSync = useSyncStore((s) => s.workspaceSync);

  // Google 로그인하지 않은 경우 로그인 화면 표시
  if (!isGoogleAuthenticated) {
    return <LoginScreen />;
  }

  // 로딩 메시지 결정
  const getLoadingMessage = () => {
    if (!isConnected) return 'Relay 서버에 연결 중...';
    if (!isAuthenticated) return '인증 중...';
    if (workspaceSync !== 'synced') {
      return workspaceSync === 'failed'
        ? '워크스페이스 동기화 실패'
        : '워크스페이스 동기화 중...';
    }
    return null;
  };

  const loadingMessage = getLoadingMessage();

  return (
    <>
      <ResponsiveLayout
        sidebar={<WorkspaceSidebar />}
        main={<ChatArea />}
      />
      {loadingMessage && <LoadingOverlay message={loadingMessage} />}
    </>
  );
}
