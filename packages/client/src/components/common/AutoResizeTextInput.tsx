/**
 * @file AutoResizeTextInput.tsx
 * @description 1~maxLines 줄까지 자동 높이 조절, 초과 시 스크롤 활성화되는 TextInput
 */

import React, { useState, useCallback } from 'react';
import {
  TextInput,
  TextInputProps,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
  Platform,
  StyleProp,
  TextStyle,
} from 'react-native';

/** 테스트와 동일하게 사용하는 상수 */
const LINE_HEIGHT = 20;
const DEFAULT_MIN_LINES = 1;
const DEFAULT_MAX_LINES = 6;

export interface AutoResizeTextInputProps extends Omit<TextInputProps, 'multiline' | 'scrollEnabled' | 'onContentSizeChange' | 'textAlignVertical'> {
  /** 입력값 */
  value: string;
  /** 텍스트 변경 핸들러 */
  onChangeText: (text: string) => void;
  /** 플레이스홀더 텍스트 */
  placeholder?: string;
  /** 최소 줄 수 (기본: 1) */
  minLines?: number;
  /** 최대 줄 수 (기본: 6) */
  maxLines?: number;
  /** 편집 가능 여부 */
  editable?: boolean;
  /** 커스텀 스타일 */
  style?: StyleProp<TextStyle>;
  /** 테스트 ID */
  testID?: string;
}

/**
 * 자동 높이 조절 TextInput 컴포넌트
 *
 * - minLines ~ maxLines 범위 내에서 높이 자동 조절
 * - maxLines 초과 시 스크롤 활성화
 * - Android에서 textAlignVertical='top' 자동 적용
 */
export function AutoResizeTextInput({
  value,
  onChangeText,
  placeholder,
  minLines = DEFAULT_MIN_LINES,
  maxLines = DEFAULT_MAX_LINES,
  editable,
  style,
  testID,
  ...rest
}: AutoResizeTextInputProps): React.ReactElement {
  const minHeight = LINE_HEIGHT * minLines;
  const maxHeight = LINE_HEIGHT * maxLines;

  const [height, setHeight] = useState(minHeight);
  const [scrollEnabled, setScrollEnabled] = useState(false);

  const handleContentSizeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const contentHeight = event.nativeEvent.contentSize.height;

      // 높이를 min~max 범위로 클램핑
      const clampedHeight = Math.min(maxHeight, Math.max(minHeight, contentHeight));
      setHeight(clampedHeight);

      // 콘텐츠가 최대 높이를 초과하면 스크롤 활성화
      setScrollEnabled(contentHeight > maxHeight);
    },
    [minHeight, maxHeight]
  );

  // 배열 스타일 처리
  const combinedStyle: StyleProp<TextStyle> = Array.isArray(style)
    ? [...style, { minHeight, height }]
    : [style, { minHeight, height }];

  return (
    <TextInput
      {...rest}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      editable={editable}
      multiline
      scrollEnabled={scrollEnabled}
      onContentSizeChange={handleContentSizeChange}
      textAlignVertical={Platform.OS === 'android' ? 'top' : undefined}
      style={combinedStyle}
      testID={testID}
    />
  );
}
