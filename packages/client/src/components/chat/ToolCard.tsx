import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Surface, Text, Icon, useTheme } from 'react-native-paper';
import { parseToolInput } from '../../utils/toolInputParser';
import { semanticColors } from '../../theme';

interface ToolCardProps {
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  isComplete: boolean;
  success?: boolean;
}

/**
 * 도구 호출 카드 (컴팩트)
 */
export function ToolCard({
  toolName,
  toolInput,
  toolOutput,
  isComplete,
  success,
}: ToolCardProps) {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatus = () => {
    if (!isComplete) {
      return { icon: 'dots-horizontal', color: semanticColors.warning };
    }
    return success
      ? { icon: 'check', color: semanticColors.success }
      : { icon: 'close', color: theme.colors.error };
  };

  const { icon: statusIcon, color: statusColor } = getStatus();
  const { desc, cmd } = parseToolInput(toolName, toolInput);

  const bgColor = isComplete
    ? success
      ? semanticColors.successContainer
      : theme.colors.errorContainer
    : semanticColors.warningContainer;

  return (
    <Surface
      style={{
        marginVertical: 2,
        borderRadius: 4,
        backgroundColor: bgColor,
        overflow: 'hidden',
      }}
      elevation={0}
    >
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Icon source={statusIcon} size={14} color={statusColor} />
        <Text
          variant="labelSmall"
          style={{ marginLeft: 6, fontFamily: 'monospace', opacity: 0.9 }}
        >
          {toolName}
        </Text>
        <Text
          variant="labelSmall"
          style={{ flex: 1, marginLeft: 8, opacity: 0.6 }}
          numberOfLines={1}
        >
          {desc}
        </Text>
        <Icon
          source={isExpanded ? 'chevron-down' : 'chevron-right'}
          size={14}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>

      {cmd && !isExpanded && (
        <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
          <Text
            variant="labelSmall"
            style={{ fontFamily: 'monospace', opacity: 0.5 }}
            numberOfLines={1}
          >
            {cmd}
          </Text>
        </View>
      )}

      {isExpanded && (
        <View
          style={{
            paddingHorizontal: 8,
            paddingBottom: 8,
            borderTopWidth: 1,
            borderTopColor: theme.colors.outlineVariant,
            marginTop: 4,
            paddingTop: 4,
          }}
        >
          {cmd && (
            <Text
              variant="labelSmall"
              style={{ fontFamily: 'monospace', marginBottom: 8 }}
              selectable
            >
              {cmd}
            </Text>
          )}

          {toolInput && (
            <View style={{ marginBottom: 8 }}>
              <Text variant="labelSmall" style={{ opacity: 0.5, marginBottom: 2 }}>
                Input:
              </Text>
              <Text
                variant="labelSmall"
                style={{ fontFamily: 'monospace', opacity: 0.7 }}
                selectable
              >
                {JSON.stringify(toolInput, null, 2)}
              </Text>
            </View>
          )}

          {isComplete && toolOutput !== undefined && (
            <View>
              <Text variant="labelSmall" style={{ opacity: 0.5, marginBottom: 2 }}>
                Output:
              </Text>
              <Text
                variant="labelSmall"
                style={{ fontFamily: 'monospace', opacity: 0.7 }}
                numberOfLines={20}
                selectable
              >
                {typeof toolOutput === 'string'
                  ? toolOutput.length > 500
                    ? toolOutput.substring(0, 500) + '...'
                    : toolOutput
                  : JSON.stringify(toolOutput, null, 2)}
              </Text>
            </View>
          )}
        </View>
      )}
    </Surface>
  );
}
