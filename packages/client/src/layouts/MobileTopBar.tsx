import React, { useState } from 'react';
import { View } from 'react-native';
import { Appbar, Text, useTheme } from 'react-native-paper';
import { useRelayStore } from '../stores/relayStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { SettingsDialog } from '../components/settings/SettingsDialog';

/**
 * 모바일 상단 바 (컴팩트)
 */
export function MobileTopBar() {
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
          height: 44,
        }}
        mode="small"
      >
        <Appbar.Content
          title="Estelle"
          titleStyle={{ fontSize: 16, fontWeight: '600' }}
        />

        {/* 연결된 Pylon 상태 */}
        <View style={{ flexDirection: 'row', marginRight: 4 }}>
          {connectedPylons.length > 0 ? (
            connectedPylons.map((pylon) => (
              <Text key={pylon.deviceId} style={{ fontSize: 14, marginLeft: 2 }}>
                {isConnected ? '🖥️' : '📴'}
              </Text>
            ))
          ) : (
            <Text style={{ fontSize: 14 }}>
              {isConnected ? '🔗' : '📴'}
            </Text>
          )}
        </View>

        <Appbar.Action icon="cog" onPress={() => setShowSettings(true)} size={20} />
      </Appbar.Header>

      <SettingsDialog
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
