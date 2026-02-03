import React, { useEffect, useState, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useClaudeStore } from '../../stores';
import { semanticColors } from '../../theme';

interface WorkingIndicatorProps {
  startTime?: number | null;
}

/**
 * 작업 표시기 (펄스 점 + 경과 시간)
 */
export function WorkingIndicator({ startTime }: WorkingIndicatorProps = {}) {
  const theme = useTheme();
  const storeStartTime = useClaudeStore((s) => s.workStartTime);
  const workStartTime = startTime ?? storeStartTime;
  const [elapsed, setElapsed] = useState(0);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      pulseAnim.stopAnimation();
    };
  }, [pulseAnim]);

  useEffect(() => {
    if (!workStartTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - workStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [workStartTime]);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1.0],
  });

  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 4, backgroundColor: theme.colors.surfaceVariant, borderRadius: 16, flexDirection: 'row', alignItems: 'center' }}>
        <Animated.View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: semanticColors.warning,
            opacity,
          }}
        />
        <Text
          variant="labelSmall"
          style={{ marginLeft: 8, fontFamily: 'monospace', opacity: 0.7 }}
        >
          {elapsed}s
        </Text>
      </View>
    </View>
  );
}
