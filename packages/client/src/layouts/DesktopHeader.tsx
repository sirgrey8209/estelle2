import React, { useState } from 'react';
import { View } from 'react-native';
import { Appbar, Chip, Text, useTheme } from 'react-native-paper';
import { useRelayStore } from '../stores/relayStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { SettingsDialog } from '../components/settings/SettingsDialog';

const APP_VERSION = '2.0.0';

/**
 * 데스크탑 상단 헤더
 */
export function DesktopHeader() {
  const theme = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const { isConnected } = useRelayStore();
  const { connectedPylons } = useWorkspaceStore();

  return (
    <>
      <Appbar.Header
        elevated={false}
        style={{
          backgroundColor: theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
          height: 48,
        }}
      >
        <Appbar.Action icon="cog" onPress={() => setShowSettings(true)} size={20} />

        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginLeft: 8 }}>
          <Text variant="titleMedium" style={{ fontWeight: '600' }}>
            Estelle
          </Text>
          <Text variant="labelSmall" style={{ marginLeft: 6, opacity: 0.5 }}>
            v{APP_VERSION}
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* 연결된 Pylon 아이콘 */}
        {connectedPylons.length > 0 && (
          <View style={{ flexDirection: 'row', marginRight: 8 }}>
            {connectedPylons.map((pylon) => (
              <Text key={pylon.deviceId} style={{ marginLeft: 4 }}>
                🖥️
              </Text>
            ))}
          </View>
        )}

        {/* 연결 상태 Chip */}
        <Chip
          mode="flat"
          compact
          textStyle={{ fontSize: 11 }}
          style={{
            backgroundColor: isConnected
              ? 'rgba(102, 187, 106, 0.2)'
              : 'rgba(239, 83, 80, 0.2)',
          }}
        >
          {isConnected ? 'Connected' : 'Disconnected'}
        </Chip>
      </Appbar.Header>

      <SettingsDialog
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
