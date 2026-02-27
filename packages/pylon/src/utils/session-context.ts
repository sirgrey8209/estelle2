/**
 * SessionContext - Claude 세션 컨텍스트 빌더
 *
 * 시스템 프롬프트와 system-reminder 메시지를 생성하는 유틸리티 함수들.
 * - buildSystemPrompt: 환경 정보를 포함한 시스템 프롬프트
 * - buildInitialReminder: 대화 시작 시 초기 알림
 * - buildDocumentAddedReminder: 문서 추가 알림
 * - buildDocumentRemovedReminder: 문서 제거 알림
 * - buildConversationRenamedReminder: 대화명 변경 알림
 *
 * @module utils/session-context
 */

/**
 * 환경 정보를 포함한 시스템 프롬프트를 빌드합니다.
 *
 * @param buildEnv - 빌드 환경 (release, stage, dev)
 * @returns 환경 정보가 포함된 시스템 프롬프트 문자열
 */
export function buildSystemPrompt(buildEnv: string): string {
  return `현재 환경: ${buildEnv}`;
}

/**
 * buildInitialReminder 옵션
 */
interface BuildInitialReminderOptions {
  /** autorun이 설정된 문서 경로 */
  autorunDoc?: string;
}

/**
 * 대화 시작 시 초기 system-reminder를 빌드합니다.
 *
 * @param conversationName - 대화명
 * @param linkedDocs - 연결된 문서 목록
 * @param options - 추가 옵션 (autorunDoc 등)
 * @returns system-reminder 태그로 감싸진 초기 알림 문자열
 */
export function buildInitialReminder(
  conversationName: string,
  linkedDocs: string[],
  options?: BuildInitialReminderOptions
): string {
  const docsText =
    linkedDocs.length > 0 ? linkedDocs.join(', ') : '없음';

  let content = `대화명: ${conversationName}
연결된 문서: ${docsText}

대화를 시작해 주세요.`;

  if (options?.autorunDoc) {
    content += `

[자동실행] ${options.autorunDoc} 문서에 autorun이 설정되어 있습니다. /autorun 스킬을 실행하세요.`;
  }

  return wrapInSystemReminder(content);
}

/**
 * 문서가 추가되었을 때의 알림을 빌드합니다.
 *
 * @param docPath - 추가된 문서의 경로
 * @returns system-reminder 태그로 감싸진 문서 추가 알림 문자열
 */
export function buildDocumentAddedReminder(docPath: string): string {
  const content = `문서가 연결되었습니다: ${docPath}`;
  return wrapInSystemReminder(content);
}

/**
 * 문서가 제거되었을 때의 알림을 빌드합니다.
 *
 * @param docPath - 제거된 문서의 경로
 * @returns system-reminder 태그로 감싸진 문서 제거 알림 문자열
 */
export function buildDocumentRemovedReminder(docPath: string): string {
  const content = `문서 연결이 해제되었습니다: ${docPath}`;
  return wrapInSystemReminder(content);
}

/**
 * 대화명이 변경되었을 때의 알림을 빌드합니다.
 *
 * @param oldName - 이전 대화명
 * @param newName - 새로운 대화명
 * @returns system-reminder 태그로 감싸진 대화명 변경 알림 문자열
 */
export function buildConversationRenamedReminder(
  oldName: string,
  newName: string
): string {
  const content = `대화명이 변경되었습니다: ${oldName} -> ${newName}`;
  return wrapInSystemReminder(content);
}

/**
 * 내용을 system-reminder 태그로 감쌉니다.
 *
 * @param content - 감쌀 내용
 * @returns system-reminder 태그로 감싸진 문자열
 */
function wrapInSystemReminder(content: string): string {
  return `<system-reminder>
${content}
</system-reminder>`;
}
