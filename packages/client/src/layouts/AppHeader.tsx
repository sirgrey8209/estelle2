import { useState } from 'react';
import { Menu, CloudOff, MonitorOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useRelayStore } from '../stores/relayStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useDeviceConfigStore } from '../stores/deviceConfigStore';
import { SettingsDialog } from '../components/settings/SettingsDialog';
import { getDeviceIcon } from '../utils/device-icons';
import { BuildInfo } from '../utils/buildInfo';

/**
 * 통합 앱 헤더 (데스크탑/모바일 공용)
 *
 * 좌측: Estelle + 버전
 * 우측: Pylon 아이콘들 + 설정 버튼
 */
export function AppHeader() {
  const [showSettings, setShowSettings] = useState(false);
  const { isConnected } = useRelayStore();
  const { connectedPylons } = useWorkspaceStore();
  const { getIcon } = useDeviceConfigStore();

  // Pylon 상태 아이콘 렌더링
  const renderPylonStatus = () => {
    // Relay 연결 안됨
    if (!isConnected) {
      return (
        <CloudOff className="h-5 w-5 text-destructive mr-1" />
      );
    }

    // Relay 연결됨, Pylon 없음
    if (connectedPylons.length === 0) {
      return (
        <MonitorOff className="h-5 w-5 text-muted-foreground mr-1" />
      );
    }

    // Pylon 연결됨
    return connectedPylons.map((pylon) => {
      const IconComponent = getDeviceIcon(getIcon(pylon.deviceId));
      return (
        <IconComponent
          key={pylon.deviceId}
          className="h-5 w-5 text-primary ml-1"
        />
      );
    });
  };

  return (
    <>
      <header className="flex h-11 items-center justify-between bg-primary/20 px-4">
        {/* 좌측: 타이틀 + 버전 */}
        <div className="flex items-baseline">
          <h1 className="text-lg font-semibold text-foreground">
            Estelle
          </h1>
          <span className="ml-2 text-xs text-muted-foreground">
            {BuildInfo.display}
          </span>
        </div>

        {/* 우측: Pylon 상태 아이콘 + 설정 버튼 */}
        <div className="flex items-center">
          <div className="flex items-center mr-2">
            {renderPylonStatus()}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
