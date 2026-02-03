import React, { useState } from 'react';
import { View } from 'react-native';
import { Appbar, Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRelayStore } from '../stores/relayStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useDeviceConfigStore } from '../stores/deviceConfigStore';
import { SettingsDialog } from '../components/settings/SettingsDialog';

const APP_VERSION = '2.0.0';

/**
 * 통합 앱 헤더 (데스크탑/모바일 공용)
 *
 * 좌측: Estelle + 버전
 * 우측: Pylon 아이콘들 + 설정 버튼
 */
export function AppHeader() {
  const theme = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const { isConnected } = useRelayStore();
  const { connectedPylons } = useWorkspaceStore();
  const { getIcon } = useDeviceConfigStore();

  // Pylon 상태 아이콘 렌더링
  const renderPylonStatus = () => {
    // Relay 연결 안됨
    if (!isConnected) {
      return (
        <Icon
          name="cloud-off-outline"
          size={20}
          color={theme.colors.error}
          style={{ marginRight: 4 }}
        />
      );
    }

    // Relay 연결됨, Pylon 없음
    if (connectedPylons.length === 0) {
      return (
        <Icon
          name="monitor-off"
          size={20}
          color={theme.colors.onSurfaceVariant}
          style={{ marginRight: 4 }}
        />
      );
    }

    // Pylon 연결됨
    return connectedPylons.map((pylon) => (
      <Icon
        key={pylon.deviceId}
        name={getIcon(pylon.deviceId)}
        size={20}
        color={theme.colors.onPrimaryContainer}
        style={{ marginLeft: 4 }}
      />
    ));
  };


  return (
    <>
      <Appbar.Header
        elevated={false}
        style={{
          backgroundColor: theme.colors.primaryContainer,
          height: 44,
        }}
        mode="small"
      >
        {/* 좌측: 타이틀 + 버전 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            marginLeft: 16,
          }}
        >
          <Text
            variant="titleMedium"
            style={{ fontWeight: '600', color: theme.colors.onPrimaryContainer }}
          >
            Estelle
          </Text>
          <Text
            variant="labelSmall"
            style={{ marginLeft: 6, opacity: 0.6, color: theme.colors.onPrimaryContainer }}
          >
            v{APP_VERSION}
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* 우측: Pylon 상태 아이콘 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
          {renderPylonStatus()}
        </View>

        {/* 설정 버튼 */}
        <Appbar.Action
          icon="menu"
          onPress={() => setShowSettings(true)}
          size={22}
        />
      </Appbar.Header>

      <SettingsDialog
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
