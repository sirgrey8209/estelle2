import React from 'react';
import { View } from 'react-native';
import { Card, Text, ActivityIndicator, useTheme } from 'react-native-paper';
import { useSettingsStore, DeployPhase, BuildTaskStatus } from '../../stores';
import { semanticColors } from '../../theme';

/**
 * 배포 상태 카드
 */
export function DeployStatusCard() {
  const theme = useTheme();
  const { deployPhase, deployErrorMessage, buildTasks, versionInfo } =
    useSettingsStore();

  const getPhaseLabel = (phase: DeployPhase): string => {
    const labels: Record<DeployPhase, string> = {
      initial: 'Idle',
      building: 'Building...',
      buildReady: 'Build Ready',
      preparing: 'Preparing...',
      ready: 'Ready',
      deploying: 'Deploying...',
      error: 'Error',
    };
    return labels[phase];
  };

  const getPhaseColor = (phase: DeployPhase): string => {
    const colors: Record<DeployPhase, string> = {
      initial: theme.colors.outline,
      building: semanticColors.warning,
      buildReady: semanticColors.info,
      preparing: semanticColors.warning,
      ready: semanticColors.success,
      deploying: theme.colors.primary,
      error: theme.colors.error,
    };
    return colors[phase];
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

  return (
    <Card mode="outlined" style={{ marginBottom: 8 }}>
      <Card.Title
        title="Deploy"
        titleVariant="titleSmall"
        left={() => <Text style={{ fontSize: 16 }}>🚀</Text>}
      />
      <Card.Content>
        <Text variant="bodySmall" style={{ color: getPhaseColor(deployPhase) }}>
          Status: {getPhaseLabel(deployPhase)}
        </Text>

        {Object.keys(buildTasks).length > 0 && (
          <View style={{
            marginTop: 8,
            padding: 8,
            backgroundColor: theme.colors.surfaceVariant,
            borderRadius: 4,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            {Object.entries(buildTasks).map(([task, status]) => (
              <View
                key={task}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: getTaskColor(status),
                }}
              />
            ))}
          </View>
        )}

        {versionInfo && (
          <Text variant="labelSmall" style={{ marginTop: 8, opacity: 0.6 }}>
            v{versionInfo.version} ({versionInfo.commit})
          </Text>
        )}

        {deployErrorMessage && (
          <View style={{
            marginTop: 8,
            padding: 8,
            backgroundColor: theme.colors.errorContainer,
            borderRadius: 4,
          }}>
            <Text variant="labelSmall" style={{ color: theme.colors.error }}>
              {deployErrorMessage}
            </Text>
          </View>
        )}

        {(deployPhase === 'building' ||
          deployPhase === 'preparing' ||
          deployPhase === 'deploying') && (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        )}
      </Card.Content>
    </Card>
  );
}
