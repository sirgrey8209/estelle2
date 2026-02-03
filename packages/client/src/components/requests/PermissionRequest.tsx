import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Surface, Text, Button, useTheme } from 'react-native-paper';
import type { PermissionRequest as PermissionRequestType } from '../../stores/claudeStore';
import { semanticColors } from '../../theme';

interface PermissionRequestProps {
  request: PermissionRequestType;
  onAllow?: () => void;
  onDeny?: () => void;
}

/**
 * 권한 요청 뷰
 */
export function PermissionRequest({
  request,
  onAllow,
  onDeny,
}: PermissionRequestProps) {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View style={{ padding: 12, backgroundColor: semanticColors.warningContainer }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: semanticColors.warning,
            marginRight: 8,
          }}
        />
        <Text variant="titleSmall" style={{ color: semanticColors.warning }}>
          권한 요청
        </Text>
      </View>

      <Surface
        style={{
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
        elevation={1}
      >
        <Text variant="labelMedium" style={{ fontFamily: 'monospace', marginBottom: 4 }}>
          {request.toolName}
        </Text>

        <Pressable onPress={() => setIsExpanded(!isExpanded)}>
          <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
            {isExpanded ? '접기 ▲' : '자세히 보기 ▼'}
          </Text>
        </Pressable>

        {isExpanded && (
          <ScrollView style={{ maxHeight: 120, marginTop: 8 }}>
            <Text variant="labelSmall" style={{ fontFamily: 'monospace', opacity: 0.7 }}>
              {JSON.stringify(request.toolInput, null, 2)}
            </Text>
          </ScrollView>
        )}
      </Surface>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          mode="outlined"
          onPress={onDeny}
          style={{ flex: 1 }}
          textColor={theme.colors.error}
        >
          거부
        </Button>
        <Button
          mode="contained"
          onPress={onAllow}
          style={{ flex: 1 }}
          buttonColor={semanticColors.success}
        >
          허용
        </Button>
      </View>
    </View>
  );
}
