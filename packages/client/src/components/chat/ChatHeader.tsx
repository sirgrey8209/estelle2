import React, { useState, useContext } from 'react';
import { View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWorkspaceStore, useDeviceConfigStore } from '../../stores';
import { useResponsive } from '../../hooks/useResponsive';
import { SessionMenuButton } from '../common/SessionMenuButton';
import { BugReportDialog } from '../common/BugReportDialog';
import { MobileLayoutContext } from '../../layouts/MobileLayout';

interface ChatHeaderProps {
  showSessionMenu?: boolean;
}

/**
 * 채팅 헤더
 *
 * - 워크스페이스/대화명
 * - StatusDot (상태 표시)
 * - SessionMenuButton (데스크탑에서)
 */
export function ChatHeader({ showSessionMenu = true }: ChatHeaderProps) {
  const theme = useTheme();
  const [showBugReport, setShowBugReport] = useState(false);
  const { selectedConversation } = useWorkspaceStore();
  const { getIcon } = useDeviceConfigStore();
  const { isDesktop } = useResponsive();
  const { openSidebar } = useContext(MobileLayoutContext);

  if (!selectedConversation) {
    return (
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: theme.colors.secondaryContainer,
        }}
      >
        <Text
          variant="bodyMedium"
          style={{ opacity: 0.6, color: theme.colors.onSecondaryContainer }}
        >
          워크스페이스를 선택하세요
        </Text>
      </View>
    );
  }

  const pylonIcon = getIcon(selectedConversation.pylonId);

  return (
    <>
      <View
        style={{
          paddingHorizontal: isDesktop ? 12 : 4,
          paddingVertical: 4,
          backgroundColor: theme.colors.secondaryContainer,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* 뒤로 가기 버튼 (모바일) */}
        {!isDesktop && (
          <Pressable
            onPress={openSidebar}
            style={({ pressed }) => ({
              padding: 6,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Icon
              name="arrow-left"
              size={20}
              color={theme.colors.onSecondaryContainer}
            />
          </Pressable>
        )}

        {/* 대화명 + 워크스페이스 */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginLeft: isDesktop ? 0 : 4,
          }}
        >
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={{
              fontWeight: '600',
              color: theme.colors.onSecondaryContainer,
              flexShrink: 1,
            }}
          >
            {selectedConversation.conversationName}
          </Text>

          {/* 워크스페이스 아이콘 + 이름 (작게) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon
              name={pylonIcon}
              size={12}
              color={theme.colors.onSecondaryContainer}
              style={{ opacity: 0.6 }}
            />
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSecondaryContainer, opacity: 0.6 }}
              numberOfLines={1}
            >
              {selectedConversation.workspaceName}
            </Text>
          </View>
        </View>

        {/* 세션 메뉴 */}
        {showSessionMenu && (
          <SessionMenuButton onBugReport={() => setShowBugReport(true)} />
        )}
      </View>

      {/* 버그 리포트 다이얼로그 */}
      <BugReportDialog
        visible={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </>
  );
}
