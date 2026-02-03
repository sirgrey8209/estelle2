/**
 * @file AutoResizeTextInput.test.tsx
 * @description AutoResizeTextInput 컴포넌트 테스트
 *
 * 테스트 범위:
 * - 기본 렌더링 (1줄 높이)
 * - 텍스트 증가에 따른 높이 자동 조절 (1~6줄)
 * - 최대 높이 초과 시 스크롤 활성화
 * - Props 전달 (value, onChangeText, placeholder, editable)
 * - 엣지 케이스 (빈 값, 경계값)
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { AutoResizeTextInput } from './AutoResizeTextInput';

// 테스트용 상수 (컴포넌트에서도 동일하게 사용해야 함)
const LINE_HEIGHT = 20; // 예상 1줄 높이
const DEFAULT_MIN_LINES = 1;
const DEFAULT_MAX_LINES = 6;

describe('AutoResizeTextInput', () => {
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('기본 렌더링', () => {
    it('should render TextInput with initial 1-line height', () => {
      render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      expect(input).toBeTruthy();
    });

    it('should render with placeholder text', () => {
      render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          placeholder="메시지를 입력하세요"
        />
      );

      expect(screen.getByPlaceholderText('메시지를 입력하세요')).toBeTruthy();
    });

    it('should render with initial value', () => {
      render(
        <AutoResizeTextInput
          value="Hello World"
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      expect(input.props.value).toBe('Hello World');
    });

    it('should be multiline by default', () => {
      render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      expect(input.props.multiline).toBe(true);
    });
  });

  describe('텍스트 입력', () => {
    it('should call onChangeText when text changes', () => {
      render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      fireEvent.changeText(input, 'New text');

      expect(mockOnChangeText).toHaveBeenCalledWith('New text');
    });

    it('should be editable by default', () => {
      render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      expect(input.props.editable).not.toBe(false);
    });

    it('should not be editable when editable prop is false', () => {
      render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          editable={false}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('높이 자동 조절', () => {
    it('should have minimum height for 1 line when minLines is 1', () => {
      render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          minLines={1}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      // 최소 높이가 1줄 높이 이상이어야 함
      const style = input.props.style;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};

      expect(flatStyle.minHeight).toBeGreaterThanOrEqual(LINE_HEIGHT);
    });

    it('should have minimum height for 2 lines when minLines is 2', () => {
      render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          minLines={2}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      const style = input.props.style;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};

      expect(flatStyle.minHeight).toBeGreaterThanOrEqual(LINE_HEIGHT * 2);
    });

    it('should increase height when content grows (via onContentSizeChange)', () => {
      const { getByTestId } = render(
        <AutoResizeTextInput
          value="Line1\nLine2\nLine3"
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // Simulate content size change for 3 lines
      fireEvent(input, 'contentSizeChange', {
        nativeEvent: {
          contentSize: { height: LINE_HEIGHT * 3, width: 300 },
        },
      });

      const style = input.props.style;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};

      // 높이가 3줄에 맞게 조절되어야 함
      expect(flatStyle.height).toBeGreaterThanOrEqual(LINE_HEIGHT * 3);
    });

    it('should not exceed maxLines height (6 lines by default)', () => {
      const { getByTestId } = render(
        <AutoResizeTextInput
          value="1\n2\n3\n4\n5\n6\n7\n8"
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // Simulate content size change for 8 lines (exceeds max)
      fireEvent(input, 'contentSizeChange', {
        nativeEvent: {
          contentSize: { height: LINE_HEIGHT * 8, width: 300 },
        },
      });

      const style = input.props.style;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};

      // 최대 6줄 높이를 초과하지 않아야 함
      expect(flatStyle.height).toBeLessThanOrEqual(LINE_HEIGHT * DEFAULT_MAX_LINES);
    });

    it('should respect custom maxLines prop', () => {
      const customMaxLines = 4;
      const { getByTestId } = render(
        <AutoResizeTextInput
          value="1\n2\n3\n4\n5\n6"
          onChangeText={mockOnChangeText}
          maxLines={customMaxLines}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // Simulate content size change for 6 lines
      fireEvent(input, 'contentSizeChange', {
        nativeEvent: {
          contentSize: { height: LINE_HEIGHT * 6, width: 300 },
        },
      });

      const style = input.props.style;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};

      // 최대 4줄 높이를 초과하지 않아야 함
      expect(flatStyle.height).toBeLessThanOrEqual(LINE_HEIGHT * customMaxLines);
    });
  });

  describe('스크롤 동작', () => {
    it('should disable scroll when content is within maxLines', () => {
      const { getByTestId } = render(
        <AutoResizeTextInput
          value="Line1\nLine2"
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // Simulate content size change for 2 lines (within max)
      fireEvent(input, 'contentSizeChange', {
        nativeEvent: {
          contentSize: { height: LINE_HEIGHT * 2, width: 300 },
        },
      });

      expect(input.props.scrollEnabled).toBe(false);
    });

    it('should enable scroll when content exceeds maxLines', () => {
      const { getByTestId } = render(
        <AutoResizeTextInput
          value="1\n2\n3\n4\n5\n6\n7\n8"
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // Simulate content size change for 8 lines (exceeds max 6)
      fireEvent(input, 'contentSizeChange', {
        nativeEvent: {
          contentSize: { height: LINE_HEIGHT * 8, width: 300 },
        },
      });

      expect(input.props.scrollEnabled).toBe(true);
    });

    it('should enable scroll exactly at boundary (maxLines + 1)', () => {
      const { getByTestId } = render(
        <AutoResizeTextInput
          value="1\n2\n3\n4\n5\n6\n7"
          onChangeText={mockOnChangeText}
          maxLines={6}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // Simulate content size change for 7 lines (exceeds max 6)
      fireEvent(input, 'contentSizeChange', {
        nativeEvent: {
          contentSize: { height: LINE_HEIGHT * 7, width: 300 },
        },
      });

      expect(input.props.scrollEnabled).toBe(true);
    });
  });

  describe('플랫폼별 동작', () => {
    it('should have textAlignVertical top on Android', () => {
      // Save original platform
      const originalPlatform = Platform.OS;

      // Mock Android
      Object.defineProperty(Platform, 'OS', { value: 'android' });

      const { getByTestId } = render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // textAlignVertical should be 'top' on Android
      expect(input.props.textAlignVertical).toBe('top');

      // Restore platform
      Object.defineProperty(Platform, 'OS', { value: originalPlatform });
    });
  });

  describe('엣지 케이스', () => {
    it('should handle empty string value', () => {
      render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      expect(input.props.value).toBe('');
    });

    it('should handle very long single line text', () => {
      const longText = 'a'.repeat(1000);
      render(
        <AutoResizeTextInput
          value={longText}
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      expect(input.props.value).toBe(longText);
    });

    it('should handle text with only newlines', () => {
      const { getByTestId } = render(
        <AutoResizeTextInput
          value="\n\n\n"
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // Simulate content size change for 4 lines
      fireEvent(input, 'contentSizeChange', {
        nativeEvent: {
          contentSize: { height: LINE_HEIGHT * 4, width: 300 },
        },
      });

      // Should handle gracefully without errors
      expect(input).toBeTruthy();
    });

    it('should handle rapid content size changes', () => {
      const { getByTestId } = render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // Rapid size changes
      for (let i = 1; i <= 10; i++) {
        fireEvent(input, 'contentSizeChange', {
          nativeEvent: {
            contentSize: { height: LINE_HEIGHT * i, width: 300 },
          },
        });
      }

      // Should handle gracefully without errors
      expect(input).toBeTruthy();
    });

    it('should handle minLines equal to maxLines', () => {
      const { getByTestId } = render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          minLines={3}
          maxLines={3}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');
      const style = input.props.style;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};

      // 높이가 정확히 3줄이어야 함
      expect(flatStyle.minHeight).toBeGreaterThanOrEqual(LINE_HEIGHT * 3);
    });

    it('should handle zero content height gracefully', () => {
      const { getByTestId } = render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // Simulate zero height content
      fireEvent(input, 'contentSizeChange', {
        nativeEvent: {
          contentSize: { height: 0, width: 300 },
        },
      });

      // Should still have minimum height
      const style = input.props.style;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};

      expect(flatStyle.minHeight).toBeGreaterThanOrEqual(LINE_HEIGHT);
    });
  });

  describe('스타일 Props', () => {
    it('should apply custom style prop', () => {
      const customStyle = { backgroundColor: 'red', padding: 10 };

      render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          style={customStyle}
          testID="auto-resize-input"
        />
      );

      const input = screen.getByTestId('auto-resize-input');
      const style = input.props.style;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};

      expect(flatStyle.backgroundColor).toBe('red');
      expect(flatStyle.padding).toBe(10);
    });

    it('should not override height-related styles from component logic', () => {
      const customStyle = { height: 500 }; // Should be ignored

      const { getByTestId } = render(
        <AutoResizeTextInput
          value=""
          onChangeText={mockOnChangeText}
          style={customStyle}
          maxLines={2}
          testID="auto-resize-input"
        />
      );

      const input = getByTestId('auto-resize-input');

      // Simulate content size for 1 line
      fireEvent(input, 'contentSizeChange', {
        nativeEvent: {
          contentSize: { height: LINE_HEIGHT, width: 300 },
        },
      });

      const style = input.props.style;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};

      // Component logic should control height, not custom style
      expect(flatStyle.height).toBeLessThanOrEqual(LINE_HEIGHT * 2);
    });
  });
});
