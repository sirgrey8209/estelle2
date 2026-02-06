import { useRelayStore, useWorkspaceStore } from '../stores';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { ResponsiveLayout } from '../layouts/ResponsiveLayout';
import { WorkspaceSidebar } from '../components/sidebar/WorkspaceSidebar';
import { ChatArea } from '../components/chat/ChatArea';

export function HomePage() {
  const { isConnected, isAuthenticated } = useRelayStore();
  const isSynced = useWorkspaceStore((s) => s.isSynced);

  // 로딩 메시지 결정
  const getLoadingMessage = () => {
    if (!isConnected) return 'Relay 서버에 연결 중...';
    if (!isAuthenticated) return '인증 중...';
    if (!isSynced) return '워크스페이스 동기화 중...';
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
