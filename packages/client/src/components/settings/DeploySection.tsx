import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Card, Text, Button, Chip, ActivityIndicator, Icon, useTheme } from 'react-native-paper';
import { useSettingsStore, useWorkspaceStore, DeployPhase, BuildTaskStatus } from '../../stores';
import { semanticColors } from '../../theme';

/**
 * 배포 섹션 (컴팩트)
 */
export function DeploySection() {
  const theme = useTheme();
  const {
    deployPhase,
    deployErrorMessage,
    deployLogs,
    buildTasks,
    selectedPylonId,
    versionInfo,
    setSelectedPylonId,
    setDeployPhase,
    addDeployLog,
    resetDeploy,
  } = useSettingsStore();

  const { connectedPylons } = useWorkspaceStore();
  const [logExpanded, setLogExpanded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const pylons = connectedPylons.map((p) => ({
    pcId: String(p.deviceId),
    pcName: p.deviceName,
  }));

  const getBorderColor = (phase: DeployPhase): string => {
    switch (phase) {
      case 'building':
      case 'preparing':
      case 'deploying':
        return semanticColors.success;
      case 'error':
        return theme.colors.error;
      default:
        return theme.colors.outline;
    }
  };

  const getStatusIcon = (phase: DeployPhase): string => {
    const icons: Record<DeployPhase, string> = {
      initial: 'rocket-launch',
      building: 'sync',
      buildReady: 'check-circle',
      preparing: 'sync',
      ready: 'check-circle',
      deploying: 'cloud-upload',
      error: 'close-circle',
    };
    return icons[phase];
  };

  const getStatusText = (): string => {
    if (deployPhase === 'initial') return 'Ready to deploy';
    if (deployErrorMessage) return deployErrorMessage;
    if (versionInfo && (deployPhase === 'buildReady' || deployPhase === 'ready')) {
      return `${deployPhase === 'ready' ? 'Ready' : 'Build complete'} (${versionInfo.commit})`;
    }
    return deployPhase;
  };

  const getTaskColor = (status: BuildTaskStatus): string => {
    const colors: Record<BuildTaskStatus, string> = {
      pending: theme.colors.outline,
      building: semanticColors.warning,
      ready: semanticColors.success,
      error: theme.colors.error,
    };
    return colors[status];
  };

  const handleStartBuild = () => {
    if (!selectedPylonId) return;
    setDeployPhase('building');
    addDeployLog('▶ Build started');
  };

  const handleToggleConfirm = () => {
    setConfirmed(!confirmed);
  };

  const handleExecuteDeploy = () => {
    setDeployPhase('deploying');
    addDeployLog('▶ Deploy started');
  };

  const renderActionButton = () => {
    switch (deployPhase) {
      case 'initial':
        return (
          <Button
            mode="contained"
            onPress={handleStartBuild}
            disabled={!selectedPylonId}
            compact
          >
            Deploy
          </Button>
        );

      case 'building':
      case 'buildReady':
        return (
          <Button
            mode="contained"
            onPress={handleToggleConfirm}
            buttonColor={confirmed ? semanticColors.warning : theme.colors.primary}
            compact
          >
            {confirmed ? '취소' : deployPhase === 'building' ? '미리승인' : '승인'}
          </Button>
        );

      case 'ready':
        return (
          <Button
            mode="contained"
            onPress={handleExecuteDeploy}
            buttonColor={semanticColors.success}
            compact
          >
            GO
          </Button>
        );

      case 'error':
        return (
          <Button
            mode="contained"
            onPress={() => {
              resetDeploy();
              handleStartBuild();
            }}
            buttonColor={semanticColors.warning}
            compact
          >
            재시도
          </Button>
        );

      case 'preparing':
      case 'deploying':
        return (
          <ActivityIndicator size="small" />
        );

      default:
        return null;
    }
  };

  return (
    <Card
      mode="outlined"
      style={{
        marginBottom: 8,
        borderColor: getBorderColor(deployPhase),
        borderWidth: 2,
      }}
      onPress={() => setLogExpanded(!logExpanded)}
    >
      <Card.Content>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {pylons.length === 0 ? (
              <Text variant="labelSmall" style={{ opacity: 0.6 }}>Pylon 없음</Text>
            ) : (
              pylons.map((pylon) => (
                <Chip
                  key={pylon.pcId}
                  mode={selectedPylonId === pylon.pcId ? 'flat' : 'outlined'}
                  selected={selectedPylonId === pylon.pcId}
                  onPress={() => {
                    if (deployPhase === 'initial' || deployPhase === 'error') {
                      setSelectedPylonId(pylon.pcId);
                    }
                  }}
                  compact
                  textStyle={{ fontSize: 11 }}
                >
                  🖥️ {pylon.pcName}
                </Chip>
              ))
            )}
          </View>
          {renderActionButton()}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon
            source={getStatusIcon(deployPhase)}
            size={16}
            color={deployPhase === 'error' ? theme.colors.error : theme.colors.onSurface}
          />
          <Text
            variant="labelSmall"
            style={{
              flex: 1,
              marginLeft: 8,
              color: deployPhase === 'error' ? theme.colors.error : undefined,
              opacity: deployPhase === 'error' ? 1 : 0.7,
            }}
            numberOfLines={1}
          >
            {getStatusText()}
          </Text>

          {Object.keys(buildTasks).length > 0 && (
            <View style={{ flexDirection: 'row', gap: 2, marginLeft: 8 }}>
              {Object.entries(buildTasks).map(([task, status]) => (
                <View
                  key={task}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: getTaskColor(status),
                  }}
                />
              ))}
            </View>
          )}

          <Icon
            source={logExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
      </Card.Content>

      {logExpanded && (
        <View style={{ height: 120, backgroundColor: theme.colors.background, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          {deployLogs.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="labelSmall" style={{ opacity: 0.5 }}>로그가 없습니다</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 8 }}>
              {deployLogs.map((line, index) => {
                const isError = line.startsWith('[ERR]');
                const isHeader = line.startsWith('▶');
                return (
                  <Text
                    key={index}
                    variant="labelSmall"
                    style={{
                      fontFamily: 'monospace',
                      color: isError ? theme.colors.error : isHeader ? theme.colors.primary : theme.colors.onSurfaceVariant,
                    }}
                  >
                    {line}
                  </Text>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </Card>
  );
}
