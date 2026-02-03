import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text, ActivityIndicator, Button, Surface, useTheme } from 'react-native-paper';
import { semanticColors } from '../../theme';

interface TaskInfo {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  content?: string;
  error?: string;
  completedAt?: Date;
}

interface TaskDetailViewProps {
  task: TaskInfo | null;
  workspaceName?: string;
  onStartWorker?: () => void;
}

/**
 * 태스크 상세 뷰 (MD / 채팅 탭)
 */
export function TaskDetailView({ task, workspaceName, onStartWorker }: TaskDetailViewProps) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'md' | 'chat'>('md');
  const [isLoading, setIsLoading] = useState(false);

  if (!task) {
    return <EmptyState message="태스크를 선택하세요" />;
  }

  const getStatusIcon = (status: string): string => {
    const icons: Record<string, string> = {
      pending: '⏳',
      running: '▶️',
      done: '✅',
      failed: '❌',
    };
    return icons[status] || '❓';
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: theme.colors.outline,
      running: semanticColors.warning,
      done: semanticColors.success,
      failed: theme.colors.error,
    };
    return colors[status] || theme.colors.outline;
  };

  const getStatusBgColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: theme.colors.surfaceVariant,
      running: semanticColors.warningContainer,
      done: semanticColors.successContainer,
      failed: theme.colors.errorContainer,
    };
    return colors[status] || theme.colors.surfaceVariant;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: '대기 중',
      running: '실행 중',
      done: '완료',
      failed: '실패',
    };
    return labels[status] || '알 수 없음';
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header */}
      <Surface style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }} elevation={1}>
        <Text style={{ fontSize: 20, color: getStatusColor(task.status) }}>
          {getStatusIcon(task.status)}
        </Text>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text variant="titleMedium" numberOfLines={1}>
            {task.title}
          </Text>
          {workspaceName && (
            <Text variant="labelSmall" style={{ opacity: 0.6 }}>{workspaceName}</Text>
          )}
        </View>
        <View style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: getStatusBgColor(task.status),
        }}>
          <Text variant="labelSmall" style={{ color: getStatusColor(task.status), fontWeight: '500' }}>
            {getStatusLabel(task.status)}
          </Text>
        </View>
      </Surface>

      {/* Tab Bar */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.colors.outlineVariant,
      }}>
        <Pressable
          onPress={() => setActiveTab('md')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderBottomWidth: activeTab === 'md' ? 2 : 0,
            borderBottomColor: theme.colors.primary,
          }}
        >
          <Text
            variant="bodySmall"
            style={{
              textAlign: 'center',
              color: activeTab === 'md' ? theme.colors.onSurface : theme.colors.outline,
            }}
          >
            MD
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('chat')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderBottomWidth: activeTab === 'chat' ? 2 : 0,
            borderBottomColor: theme.colors.primary,
          }}
        >
          <Text
            variant="bodySmall"
            style={{
              textAlign: 'center',
              color: activeTab === 'chat' ? theme.colors.onSurface : theme.colors.outline,
            }}
          >
            채팅
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'md' ? (
          <MarkdownTab task={task} isLoading={isLoading} />
        ) : (
          <ChatTab task={task} onStartWorker={onStartWorker} />
        )}
      </View>
    </View>
  );
}

function MarkdownTab({ task, isLoading }: { task: TaskInfo; isLoading: boolean }) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!task.content) {
    return <EmptyState message="내용을 불러오는 중..." />;
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <Text
        variant="bodySmall"
        style={{ fontFamily: 'monospace', lineHeight: 24, opacity: 0.8 }}
        selectable
      >
        {task.content}
      </Text>
    </ScrollView>
  );
}

function ChatTab({
  task,
  onStartWorker,
}: {
  task: TaskInfo;
  onStartWorker?: () => void;
}) {
  const theme = useTheme();

  switch (task.status) {
    case 'pending':
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>▶️</Text>
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>대기 중인 태스크</Text>
          <Text variant="bodySmall" style={{ opacity: 0.6, marginBottom: 24 }}>{task.title}</Text>
          <Button mode="contained" onPress={onStartWorker} icon="play">
            워커 시작
          </Button>
        </View>
      );

    case 'running':
      return (
        <View style={{ flex: 1 }}>
          <View style={{
            padding: 12,
            backgroundColor: semanticColors.warningContainer,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <ActivityIndicator size="small" color={semanticColors.warning} />
            <Text variant="bodySmall" style={{ color: semanticColors.warning, marginLeft: 12 }}>
              워커가 "{task.title}" 작업 중...
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="bodySmall" style={{ opacity: 0.6 }}>
              실시간 대화가 여기에 표시됩니다.
            </Text>
          </View>
        </View>
      );

    case 'done':
    case 'failed':
      return (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>
              {task.status === 'done' ? '✅' : '❌'}
            </Text>
            <Text variant="bodyMedium" style={{ marginBottom: 8 }}>
              {task.status === 'done' ? '작업이 완료되었습니다' : '작업이 실패했습니다'}
            </Text>
            {task.error && (
              <View style={{
                marginTop: 16,
                marginHorizontal: 32,
                padding: 12,
                backgroundColor: theme.colors.errorContainer,
                borderRadius: 8,
              }}>
                <Text variant="bodySmall" style={{ color: theme.colors.error, textAlign: 'center' }}>
                  {task.error}
                </Text>
              </View>
            )}
            {task.completedAt && (
              <Text variant="labelSmall" style={{ marginTop: 16, opacity: 0.6 }}>
                완료: {task.completedAt.toLocaleString()}
              </Text>
            )}
          </View>
          <Surface style={{
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderTopWidth: 1,
            borderTopColor: theme.colors.outlineVariant,
          }} elevation={0}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔒</Text>
            <Text variant="bodySmall" style={{ opacity: 0.6 }}>작업이 종료되었습니다</Text>
          </Surface>
        </View>
      );

    default:
      return <EmptyState message="알 수 없는 상태" />;
  }
}

function EmptyState({ message }: { message: string }) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="bodyMedium" style={{ opacity: 0.6 }}>{message}</Text>
    </View>
  );
}
