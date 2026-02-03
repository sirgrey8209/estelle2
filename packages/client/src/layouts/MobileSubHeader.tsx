import React from 'react';
import { View } from 'react-native';
import { Appbar, Text, useTheme } from 'react-native-paper';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { SessionMenuButton } from '../components/common/SessionMenuButton';

interface MobileSubHeaderProps {
  pageIndex: number;
  onBack?: () => void;
  onBugReport?: () => void;
}

/**
 * 모바일 서브 헤더 (컴팩트)
 */
export function MobileSubHeader({
  pageIndex,
  onBack,
  onBugReport,
}: MobileSubHeaderProps) {
  const theme = useTheme();
  const { selectedConversation, connectedPylons } = useWorkspaceStore();

  const pylonName = connectedPylons.find(
    (p) => selectedConversation && p.deviceId === connectedPylons[0]?.deviceId
  )?.deviceName;

  // 페이지 0: 워크스페이스 목록
  if (pageIndex === 0) {
    return (
      <Appbar.Header
        elevated={false}
        style={{
          backgroundColor: theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outlineVariant,
          height: 40,
        }}
        mode="small"
      >
        <Text style={{ marginLeft: 16, marginRight: 8 }}>📁</Text>
        <Appbar.Content title="Workspaces" titleStyle={{ fontSize: 15 }} />
      </Appbar.Header>
    );
  }

  // 페이지 1: 채팅
  return (
    <Appbar.Header
      elevated={false}
      style={{
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.outlineVariant,
        height: 40,
      }}
      mode="small"
    >
      <Appbar.BackAction onPress={onBack} size={20} />

      <View style={{ flex: 1 }}>
        <Text variant="titleSmall" numberOfLines={1}>
          {selectedConversation?.workspaceName || 'No selection'}
        </Text>
        {selectedConversation && (
          <Text variant="labelSmall" style={{ opacity: 0.6 }} numberOfLines={1}>
            {pylonName || 'Unknown'}
          </Text>
        )}
      </View>

      <SessionMenuButton onBugReport={onBugReport} />
    </Appbar.Header>
  );
}
