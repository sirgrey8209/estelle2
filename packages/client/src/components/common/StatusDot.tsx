import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { statusColors } from '../../theme';

/**
 * 상태 타입
 */
type StatusType =
  | 'idle'
  | 'working'
  | 'permission'
  | 'offline'
  | 'error'
  | 'waiting'
  | 'unread'
  | 'done';

interface StatusDotProps {
  status: StatusType;
  size?: number;
}

/**
 * 상태별 색상 매핑
 */
function getStatusColor(status: StatusType): string | null {
  switch (status) {
    case 'error':
    case 'permission':
    case 'waiting':
      return statusColors.permission;
    case 'working':
      return statusColors.working;
    case 'unread':
    case 'done':
      return statusColors.ready;
    case 'idle':
    case 'offline':
    default:
      return statusColors.idle;
  }
}

/**
 * 점멸 여부
 */
function shouldBlink(status: StatusType): boolean {
  return status === 'working' || status === 'waiting' || status === 'permission';
}

/**
 * 상태 표시점
 */
export function StatusDot({ status, size = 8 }: StatusDotProps) {
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const color = getStatusColor(status);

  useEffect(() => {
    if (shouldBlink(status)) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.3,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1.0,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      blinkAnim.stopAnimation();
      blinkAnim.setValue(1);
    }

    return () => {
      blinkAnim.stopAnimation();
    };
  }, [status, blinkAnim]);

  if (!color) {
    return null;
  }

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: blinkAnim,
      }}
    />
  );
}
