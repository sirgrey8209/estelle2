import { SafeAreaView } from 'react-native-safe-area-context';
import { ResponsiveLayout } from '../src/layouts';
import { WorkspaceSidebar } from '../src/components/sidebar';
import { ChatArea } from '../src/components/chat';
import { LoadingOverlay } from '../src/components/common';
import { useRelayStore } from '../src/stores';

export default function HomeScreen() {
  const { loadingState } = useRelayStore();

  // 로딩 중
  if (loadingState === 'connecting') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingOverlay message="Relay 서버에 연결 중..." />
      </SafeAreaView>
    );
  }

  if (loadingState === 'loadingDesks') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingOverlay message="워크스페이스 목록 로드 중..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ResponsiveLayout
        sidebar={<WorkspaceSidebar />}
        main={<ChatArea />}
      />
    </SafeAreaView>
  );
}
