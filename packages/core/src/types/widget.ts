/**
 * @file widget.ts
 * @description Widget Protocol 타입 정의
 *
 * CLI ↔ Pylon ↔ Client 간 Widget 통신에 사용되는 타입들
 */

// ============================================================================
// View Types (렌더링)
// ============================================================================

/**
 * 텍스트 뷰 노드
 */
export interface TextViewNode {
  type: 'text';
  content: string;
  style?: 'title' | 'body' | 'caption';
}

/**
 * 레이아웃 뷰 노드 (row/column)
 */
export interface LayoutViewNode {
  type: 'row' | 'column';
  children: ViewNode[];
  gap?: number;
}

/**
 * 이미지 뷰 노드
 */
export interface ImageViewNode {
  type: 'image';
  src: string;
}

/**
 * 스페이서 뷰 노드
 */
export interface SpacerViewNode {
  type: 'spacer';
  size?: number;
}

/**
 * HTML 뷰 노드
 */
export interface HtmlViewNode {
  type: 'html';
  content: string;
}

/**
 * 모든 뷰 노드 유니온
 */
export type ViewNode =
  | TextViewNode
  | LayoutViewNode
  | ImageViewNode
  | SpacerViewNode
  | HtmlViewNode;

// ============================================================================
// Input Types (유저 입력)
// ============================================================================

/**
 * 버튼 인풋 노드
 */
export interface ButtonsInputNode {
  type: 'buttons';
  id: string;
  options: string[];
  disabled?: string[];
}

/**
 * 텍스트 인풋 노드
 */
export interface TextInputNode {
  type: 'text';
  id: string;
  placeholder?: string;
}

/**
 * 슬라이더 인풋 노드
 */
export interface SliderInputNode {
  type: 'slider';
  id: string;
  min: number;
  max: number;
  step?: number;
}

/**
 * 확인 버튼 인풋 노드
 */
export interface ConfirmInputNode {
  type: 'confirm';
  id: string;
  label: string;
}

/**
 * 모든 인풋 노드 유니온
 */
export type InputNode =
  | ButtonsInputNode
  | TextInputNode
  | SliderInputNode
  | ConfirmInputNode;

// ============================================================================
// CLI Protocol Messages
// ============================================================================

/**
 * CLI → Pylon: 렌더 메시지
 */
export interface WidgetCliRenderMessage {
  type: 'render';
  view: ViewNode;
  inputs: InputNode[];
}

/**
 * CLI → Pylon: 완료 메시지
 */
export interface WidgetCliCompleteMessage {
  type: 'complete';
  result: unknown;
}

/**
 * CLI → Pylon: 에러 메시지
 */
export interface WidgetCliErrorMessage {
  type: 'error';
  message: string;
}

/**
 * CLI → Pylon 메시지 유니온
 */
export type WidgetCliMessage =
  | WidgetCliRenderMessage
  | WidgetCliCompleteMessage
  | WidgetCliErrorMessage;

/**
 * Pylon → CLI: 인풋 메시지
 */
export interface WidgetPylonInputMessage {
  type: 'input';
  data: Record<string, unknown>;
}

/**
 * Pylon → CLI: 취소 메시지
 */
export interface WidgetPylonCancelMessage {
  type: 'cancel';
}

/**
 * Pylon → CLI 메시지 유니온
 */
export type WidgetPylonMessage =
  | WidgetPylonInputMessage
  | WidgetPylonCancelMessage;

// ============================================================================
// Pylon ↔ Client Messages (WebSocket)
// ============================================================================

/**
 * Pylon → Client: 위젯 렌더 메시지
 */
export interface WidgetRenderMessage {
  type: 'widget_render';
  sessionId: string;
  view: ViewNode;
  inputs: InputNode[];
}

/**
 * Pylon → Client: 위젯 닫기 메시지
 */
export interface WidgetCloseMessage {
  type: 'widget_close';
  sessionId: string;
}

/**
 * Client → Pylon: 위젯 인풋 메시지
 */
export interface WidgetInputMessage {
  type: 'widget_input';
  sessionId: string;
  data: Record<string, unknown>;
}

/**
 * Client → Pylon: 위젯 취소 메시지
 */
export interface WidgetCancelMessage {
  type: 'widget_cancel';
  sessionId: string;
}

// ============================================================================
// Type Guards
// ============================================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isWidgetCliRenderMessage(value: unknown): value is WidgetCliRenderMessage {
  return isObject(value) && value.type === 'render' && 'view' in value && 'inputs' in value;
}

export function isWidgetCliCompleteMessage(value: unknown): value is WidgetCliCompleteMessage {
  return isObject(value) && value.type === 'complete' && 'result' in value;
}

export function isWidgetCliErrorMessage(value: unknown): value is WidgetCliErrorMessage {
  return isObject(value) && value.type === 'error' && typeof value.message === 'string';
}

export function isWidgetRenderMessage(value: unknown): value is WidgetRenderMessage {
  return isObject(value) && value.type === 'widget_render' && typeof value.sessionId === 'string';
}

export function isWidgetCloseMessage(value: unknown): value is WidgetCloseMessage {
  return isObject(value) && value.type === 'widget_close' && typeof value.sessionId === 'string';
}

export function isWidgetInputMessage(value: unknown): value is WidgetInputMessage {
  return isObject(value) && value.type === 'widget_input' && typeof value.sessionId === 'string';
}

export function isWidgetCancelMessage(value: unknown): value is WidgetCancelMessage {
  return isObject(value) && value.type === 'widget_cancel' && typeof value.sessionId === 'string';
}
