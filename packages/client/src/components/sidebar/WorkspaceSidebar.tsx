import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Collapsible } from '../common/Collapsible';
import { Text, useTheme, Surface } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWorkspaceStore, useDeviceConfigStore } from '../../stores';
import { useClaudeStore } from '../../stores/claudeStore';
import { ConversationItem } from './ConversationItem';
import { NewWorkspaceDialog } from './NewWorkspaceDialog';
import { NewConversationDialog } from './NewConversationDialog';
import { selectConversation } from '../../services/relaySender';

/**
 * 워크스페이스 사이드바 (2단계: 워크스페이스 → 대화)
 */
export function WorkspaceSidebar() {
  const theme = useTheme();
  const [showNewWorkspaceDialog, setShowNewWorkspaceDialog] = useState(false);
  const [newConversationTarget, setNewConversationTarget] = useState<{
    workspaceId: string;
    workspaceName: string;
  } | null>(null);
  // 선택된 워크스페이스 (대화 선택과 별개)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const {
    getAllWorkspaces,
    selectedConversation,
    selectConversation: selectInStore,
  } = useWorkspaceStore();
  const { getIcon } = useDeviceConfigStore();

  const allWorkspaces = getAllWorkspaces();

  const flatWorkspaces = allWorkspaces.flatMap(({ pylonId, workspaces }) =>
    workspaces.map((ws) => ({ ...ws, pylonId }))
  );

  // 초기화: 선택된 대화가 있는 워크스페이스 또는 첫 번째 워크스페이스 선택
  useEffect(() => {
    if (selectedWorkspaceId === null && flatWorkspaces.length > 0) {
      // 선택된 대화가 있는 워크스페이스 찾기
      const workspaceWithSelectedConv = selectedConversation
        ? flatWorkspaces.find(
            (ws) => ws.workspaceId === selectedConversation.workspaceId
          )
        : null;

      setSelectedWorkspaceId(
        workspaceWithSelectedConv?.workspaceId ?? flatWorkspaces[0].workspaceId
      );
    }
  }, [flatWorkspaces, selectedConversation, selectedWorkspaceId]);

  // 워크스페이스가 열려있는지 (선택된 워크스페이스만 열림)
  const isExpanded = (workspaceId: string) =>
    selectedWorkspaceId === workspaceId;

  // 워크스페이스 선택 (클릭하면 해당 워크스페이스 선택)
  const selectWorkspace = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
  };

  // 해당 워크스페이스에 선택된 대화가 있는지
  const hasSelectedConversation = (workspaceId: string) =>
    selectedConversation?.workspaceId === workspaceId;

  // 특정 대화가 현재 선택된 대화인지
  const isSelectedConversation = (conversationId: string) =>
    selectedConversation?.conversationId === conversationId;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 8, gap: 8 }}
      >
        {flatWorkspaces.map((workspace) => {
          const pylonIcon = getIcon(workspace.pylonId);
          const expanded = isExpanded(workspace.workspaceId);
          const isActive = hasSelectedConversation(workspace.workspaceId);

          // 닫힌 워크스페이스에서 선택된 대화 찾기
          const selectedConvInWorkspace = !expanded
            ? workspace.conversations.find((c) =>
                isSelectedConversation(c.conversationId)
              )
            : null;

          return (
            <Surface
              key={workspace.workspaceId}
              style={{
                borderRadius: 12,
                backgroundColor: expanded
                  ? theme.colors.elevation.level3
                  : theme.colors.elevation.level1,
                borderWidth: expanded ? 1 : 0,
                borderColor: theme.colors.outlineVariant,
              }}
              elevation={0}
            >
              {/* 워크스페이스 헤더 */}
              <Pressable
                onPress={() => selectWorkspace(workspace.workspaceId)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon
                    name={pylonIcon}
                    size={18}
                    color={theme.colors.primary}
                  />
                  <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                    {workspace.name}
                  </Text>
                </View>
                <Text
                  variant="bodySmall"
                  style={{ opacity: 0.6, marginTop: 2, marginLeft: 24 }}
                  numberOfLines={1}
                >
                  {workspace.workingDir}
                </Text>
              </Pressable>

              {/* 닫힌 워크스페이스에서 선택된 대화만 표시 */}
              {!expanded && selectedConvInWorkspace && (
                <View style={{ paddingBottom: 6 }}>
                  <ConversationItem
                    workspaceName={workspace.name}
                    workingDir={workspace.workingDir}
                    conversation={selectedConvInWorkspace}
                    isSelected={true}
                    showWorkspaceName={false}
                    onPress={() => selectWorkspace(workspace.workspaceId)}
                  />
                </View>
              )}

              {/* 열린 워크스페이스: 대화 목록 + 새 대화 버튼 */}
              <Collapsible expanded={expanded}>
                <View style={{ paddingBottom: 6 }}>
                  {workspace.conversations.length > 0 ? (
                    workspace.conversations.map((conversation) => (
                      <ConversationItem
                        key={conversation.conversationId}
                        workspaceName={workspace.name}
                        workingDir={workspace.workingDir}
                        conversation={conversation}
                        isSelected={isSelectedConversation(
                          conversation.conversationId
                        )}
                        showWorkspaceName={false}
                        onPress={() => {
                          selectInStore(
                            workspace.pylonId,
                            workspace.workspaceId,
                            conversation.conversationId
                          );
                          selectConversation(
                            workspace.workspaceId,
                            conversation.conversationId
                          );
                          useClaudeStore.getState().clearMessages();
                        }}
                      />
                    ))
                  ) : (
                    <Text
                      variant="bodySmall"
                      style={{
                        paddingHorizontal: 12,
                        paddingBottom: 2,
                        opacity: 0.5,
                        fontStyle: 'italic',
                      }}
                    >
                      대화 없음
                    </Text>
                  )}

                  {/* + 새 대화 버튼 */}
                  <Pressable
                    onPress={() => {
                      setNewConversationTarget({
                        workspaceId: workspace.workspaceId,
                        workspaceName: workspace.name,
                      });
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      marginHorizontal: 4,
                      borderRadius: 8,
                      opacity: pressed ? 0.5 : 0.7,
                    })}
                  >
                    <Icon
                      name="plus"
                      size={16}
                      color={theme.colors.onSurfaceVariant}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      새 대화
                    </Text>
                  </Pressable>
                </View>
              </Collapsible>
            </Surface>
          );
        })}

        {/* 빈 상태 */}
        {flatWorkspaces.length === 0 && (
          <Surface
            style={{
              padding: 24,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: theme.colors.elevation.level1,
            }}
            elevation={0}
          >
            <Text style={{ opacity: 0.6 }}>연결된 워크스페이스가 없습니다</Text>
          </Surface>
        )}

        {/* + 워크스페이스 추가 버튼 */}
        <Pressable
          onPress={() => setShowNewWorkspaceDialog(true)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: theme.colors.elevation.level1,
            borderWidth: 1,
            borderColor: theme.colors.outlineVariant,
            borderStyle: 'dashed',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon
            name="plus"
            size={18}
            color={theme.colors.onSurfaceVariant}
            style={{ marginRight: 8 }}
          />
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            워크스페이스 추가
          </Text>
        </Pressable>

        {/* 하단 여백 */}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* 다이얼로그들 */}
      <NewWorkspaceDialog
        visible={showNewWorkspaceDialog}
        onClose={() => setShowNewWorkspaceDialog(false)}
      />

      <NewConversationDialog
        visible={newConversationTarget !== null}
        workspaceId={newConversationTarget?.workspaceId ?? ''}
        workspaceName={newConversationTarget?.workspaceName ?? ''}
        onClose={() => setNewConversationTarget(null)}
      />
    </View>
  );
}
