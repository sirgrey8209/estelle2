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
 * 스크립트 뷰 노드 (v2)
 * 인라인 JS 또는 외부 JS 파일과 HTML 템플릿을 조합하여 렌더링
 */
export interface ScriptViewNode {
  type: 'script';
  code?: string;                      // 인라인 JS 코드
  file?: string;                      // 또는 JS 파일 경로
  html: string;                       // HTML 템플릿
  assets?: Record<string, string>;    // 에셋 경로 맵
  height?: number;                    // 초기 높이 (없으면 auto)
}

/**
 * 모든 뷰 노드 유니온
 */
export type ViewNode =
  | TextViewNode
  | LayoutViewNode
  | ImageViewNode
  | SpacerViewNode
  | HtmlViewNode
  | ScriptViewNode;

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
 * v2: ScriptViewNode일 경우 inputs는 선택적 (클라이언트 드리븐)
 */
export interface WidgetCliRenderMessage {
  type: 'render';
  view: ViewNode;
  inputs?: InputNode[];  // v2: optional for ScriptViewNode
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
 * CLI → Pylon: 이벤트 메시지 (v2)
 */
export interface WidgetCliEventMessage {
  type: 'event';
  data: unknown;
}

/**
 * CLI → Pylon 메시지 유니온
 */
export type WidgetCliMessage =
  | WidgetCliRenderMessage
  | WidgetCliCompleteMessage
  | WidgetCliErrorMessage
  | WidgetCliEventMessage;

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
 * Pylon → CLI: 이벤트 메시지 (v2)
 */
export interface WidgetPylonEventMessage {
  type: 'event';
  data: unknown;
}

/**
 * Pylon → CLI 메시지 유니온
 */
export type WidgetPylonMessage =
  | WidgetPylonInputMessage
  | WidgetPylonCancelMessage
  | WidgetPylonEventMessage;

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

/**
 * Pylon ↔ Client: 위젯 이벤트 메시지 (v2)
 */
export interface WidgetEventWsMessage {
  type: 'widget_event';
  sessionId: string;
  data: unknown;
}

// ============================================================================
// Type Guards
// ============================================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isWidgetCliRenderMessage(value: unknown): value is WidgetCliRenderMessage {
  // v2: inputs is optional for ScriptViewNode
  return isObject(value) && value.type === 'render' && 'view' in value;
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

// v2 Type Guards

export function isScriptViewNode(node: ViewNode): node is ScriptViewNode {
  return node.type === 'script';
}

export function isWidgetCliEventMessage(value: unknown): value is WidgetCliEventMessage {
  return isObject(value) && value.type === 'event' && 'data' in value;
}

export function isWidgetEventWsMessage(value: unknown): value is WidgetEventWsMessage {
  return isObject(value) && value.type === 'widget_event' && typeof value.sessionId === 'string';
}

// ============================================================================
// Widget Check Messages (세션 유효성 확인)
// ============================================================================

/**
 * 위젯 세션 유효성 확인 요청 페이로드
 */
export interface WidgetCheckPayload {
  conversationId: number;
  sessionId: string;
}

/**
 * 위젯 세션 유효성 확인 응답 페이로드
 */
export interface WidgetCheckResultPayload {
  conversationId: number;
  sessionId: string;
  valid: boolean;
}

export function isWidgetCheckPayload(value: unknown): value is WidgetCheckPayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'number' &&
    typeof value.sessionId === 'string'
  );
}

export function isWidgetCheckResultPayload(value: unknown): value is WidgetCheckResultPayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'number' &&
    typeof value.sessionId === 'string' &&
    typeof value.valid === 'boolean'
  );
}
