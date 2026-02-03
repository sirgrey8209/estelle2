import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { IconButton, Menu, Text, useTheme } from 'react-native-paper';

type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions';

const PERMISSION_CONFIG: Record<
  PermissionMode,
  { label: string; icon: string }
> = {
  default: { label: 'Default', icon: 'lock' },
  acceptEdits: { label: 'Accept Edits', icon: 'pencil' },
  bypassPermissions: { label: 'Bypass All', icon: 'alert' },
};

const PERMISSION_MODES: PermissionMode[] = [
  'default',
  'acceptEdits',
  'bypassPermissions',
];

interface SessionMenuButtonProps {
  permissionMode?: PermissionMode;
  onPermissionModeChange?: (mode: PermissionMode) => void;
  onNewSession?: () => void;
  onCompact?: () => void;
  onBugReport?: () => void;
}

/**
 * 세션 메뉴 버튼
 */
export function SessionMenuButton({
  permissionMode = 'default',
  onPermissionModeChange,
  onNewSession,
  onCompact,
  onBugReport,
}: SessionMenuButtonProps) {
  const theme = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const config = PERMISSION_CONFIG[permissionMode];

  const handlePermissionCycle = () => {
    const currentIndex = PERMISSION_MODES.indexOf(permissionMode);
    const nextIndex = (currentIndex + 1) % PERMISSION_MODES.length;
    const nextMode = PERMISSION_MODES[nextIndex];
    onPermissionModeChange?.(nextMode);
  };

  const handleNewSession = () => {
    setShowMenu(false);
    Alert.alert(
      '새 세션',
      '현재 세션을 종료하고 새 세션을 시작할까요?\n기존 대화 내용은 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '새 세션 시작',
          style: 'destructive',
          onPress: onNewSession,
        },
      ]
    );
  };

  const handleCompact = () => {
    setShowMenu(false);
    onCompact?.();
  };

  const handleBugReport = () => {
    setShowMenu(false);
    onBugReport?.();
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <IconButton
        icon={config.icon}
        size={18}
        onPress={handlePermissionCycle}
      />

      <Menu
        visible={showMenu}
        onDismiss={() => setShowMenu(false)}
        anchor={
          <IconButton
            icon="dots-vertical"
            size={18}
            onPress={() => setShowMenu(true)}
          />
        }
      >
        <Menu.Item
          onPress={handleNewSession}
          leadingIcon="refresh"
          title="새 세션"
        />
        <Menu.Item
          onPress={handleCompact}
          leadingIcon="package-variant"
          title="컴팩트"
        />
        <Menu.Item
          onPress={handleBugReport}
          leadingIcon="bug"
          title="버그 리포트"
          titleStyle={{ color: theme.colors.error }}
        />
      </Menu>
    </View>
  );
}
