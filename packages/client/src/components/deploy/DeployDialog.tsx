import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Portal, Dialog, Text, Button, RadioButton, ActivityIndicator, useTheme } from 'react-native-paper';
import { useSettingsStore, useWorkspaceStore, BuildTaskStatus } from '../../stores';
import { semanticColors } from '../../theme';

interface DeployDialogProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * 배포 다이얼로그
 */
export function DeployDialog({ visible, onClose }: DeployDialogProps) {
  const theme = useTheme();
  const {
    deployPhase,
    deployErrorMessage,
    buildTasks,
    selectedPylonId,
    pylonAckCount,
    versionInfo,
    setSelectedPylonId,
    setDeployPhase,
    addDeployLog,
    resetDeploy,
  } = useSettingsStore();

  const { connectedPylons } = useWorkspaceStore();
  const [confirmed, setConfirmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('배포할 Pylon을 선택하세요');

  // Pylon 목록을 PC 형태로 변환
  const pylons = connectedPylons.map((p) => ({
    pcId: String(p.deviceId),
    pcName: p.deviceName,
  }));

  const getTaskColor = (status: BuildTaskStatus): string => {
    const colors: Record<BuildTaskStatus, string> = {
      pending: theme.colors.outline,
      building: semanticColors.warning,
      ready: semanticColors.success,
      error: theme.colors.error,
    };
    return colors[status];
  };

  const getTaskIcon = (status: BuildTaskStatus): string => {
    const icons: Record<BuildTaskStatus, string> = {
      pending: '⏳',
      building: '🔄',
      ready: '✅',
      error: '❌',
    };
    return icons[status];
  };

  const handleStartBuild = () => {
    if (!selectedPylonId) {
      return;
    }
    setDeployPhase('building');
    setStatusMessage('빌드 시작...');
    setConfirmed(false);
    addDeployLog('▶ Build started');
  };

  const handleToggleConfirm = () => {
    setConfirmed(!confirmed);
  };

  const handleExecuteDeploy = () => {
    setDeployPhase('deploying');
    setStatusMessage('배포 실행 중...');
    addDeployLog('▶ Deploy started');

    setTimeout(() => {
      onClose();
    }, 5000);
  };

  const handleCancel = () => {
    resetDeploy();
    onClose();
  };

  const renderActionButtons = () => {
    return (
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <Button
          mode="outlined"
          onPress={handleCancel}
          disabled={deployPhase === 'deploying'}
        >
          취소
        </Button>

        {(deployPhase === 'building' || deployPhase === 'buildReady') && (
          <Button
            mode="contained"
            onPress={handleToggleConfirm}
            buttonColor={confirmed ? semanticColors.warning : theme.colors.primary}
          >
            {confirmed
              ? '승인 취소'
              : deployPhase === 'building'
              ? '미리 승인'
              : '승인'}
          </Button>
        )}

        {deployPhase === 'initial' && (
          <Button
            mode="contained"
            onPress={handleStartBuild}
            disabled={!selectedPylonId}
          >
            배포 시작
          </Button>
        )}

        {deployPhase === 'ready' && (
          <Button
            mode="contained"
            onPress={handleExecuteDeploy}
            buttonColor={semanticColors.success}
          >
            GO
          </Button>
        )}

        {deployPhase === 'error' && (
          <Button
            mode="contained"
            onPress={() => {
              resetDeploy();
              handleStartBuild();
            }}
            buttonColor={semanticColors.warning}
          >
            재시도
          </Button>
        )}

        {(deployPhase === 'deploying' || deployPhase === 'preparing') && (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}
      </View>
    );
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleCancel} style={{ maxWidth: 400, alignSelf: 'center' }}>
        <Dialog.Title>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 20 }}>🚀</Text>
            <Text variant="titleLarge" style={{ marginLeft: 8 }}>배포</Text>
          </View>
        </Dialog.Title>

        <Dialog.ScrollArea style={{ maxHeight: 400, paddingHorizontal: 0 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
            {/* Pylon 선택 (idle) */}
            {deployPhase === 'initial' && (
              <View style={{ marginBottom: 16 }}>
                <Text variant="labelMedium" style={{ opacity: 0.6, marginBottom: 8 }}>
                  주도 Pylon 선택:
                </Text>
                <RadioButton.Group
                  value={selectedPylonId || ''}
                  onValueChange={(value) => setSelectedPylonId(value)}
                >
                  {pylons.map((pylon) => (
                    <RadioButton.Item
                      key={pylon.pcId}
                      label={`🖥️ ${pylon.pcName}`}
                      value={pylon.pcId}
                      mode="android"
                    />
                  ))}
                </RadioButton.Group>
              </View>
            )}

            {/* 빌드 태스크 상태 */}
            {Object.keys(buildTasks).length > 0 && (
              <View
                style={{
                  padding: 12,
                  backgroundColor: theme.colors.surfaceVariant,
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <Text variant="labelSmall" style={{ fontWeight: '700', marginBottom: 8 }}>
                  빌드 상태
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {Object.entries(buildTasks).map(([task, status]) => (
                    <View key={task} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text>{getTaskIcon(status)}</Text>
                      <Text
                        variant="labelSmall"
                        style={{ marginLeft: 4, color: getTaskColor(status) }}
                      >
                        {task.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 상태 메시지 */}
            <Text
              variant="bodySmall"
              style={{
                color:
                  deployPhase === 'error'
                    ? theme.colors.error
                    : deployPhase === 'ready'
                    ? semanticColors.success
                    : theme.colors.onSurfaceVariant,
              }}
            >
              {statusMessage}
            </Text>

            {/* 버전/커밋 정보 */}
            {versionInfo && (
              <Text variant="labelSmall" style={{ marginTop: 4, opacity: 0.6 }}>
                v{versionInfo.version} ({versionInfo.commit})
              </Text>
            )}

            {/* Pylon ack 상태 */}
            {pylonAckCount > 0 && (
              <Text variant="labelSmall" style={{ marginTop: 8, opacity: 0.6 }}>
                준비된 Pylon: {pylonAckCount}
              </Text>
            )}

            {/* 에러 메시지 */}
            {deployErrorMessage && (
              <View
                style={{
                  marginTop: 8,
                  padding: 8,
                  backgroundColor: theme.colors.errorContainer,
                  borderRadius: 4,
                }}
              >
                <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                  {deployErrorMessage}
                </Text>
              </View>
            )}

            {/* 사전 승인 안내 */}
            {deployPhase === 'building' && !confirmed && (
              <View
                style={{
                  marginTop: 12,
                  padding: 8,
                  backgroundColor: theme.colors.primaryContainer,
                  borderRadius: 4,
                }}
              >
                <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>
                  💡 빌드 완료 전에 미리 승인하면 바로 다음 단계로 진행됩니다.
                </Text>
              </View>
            )}

            {/* 액션 버튼 */}
            {renderActionButtons()}
          </ScrollView>
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}
