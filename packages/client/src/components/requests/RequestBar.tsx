import { useWorkspaceStore, useConversationStore, useCurrentConversationState } from '../../stores';
import { PermissionRequest } from './PermissionRequest';
import { QuestionRequest } from './QuestionRequest';
import { sendPermissionResponse, sendQuestionResponse } from '../../services/relaySender';

/**
 * 요청 바
 */
export function RequestBar() {
  const { selectedConversation } = useWorkspaceStore();
  const entityId = selectedConversation?.entityId;

  // conversationStore에서 현재 대화의 pendingRequests 가져오기
  const currentState = useCurrentConversationState();
  const pendingRequests = currentState?.pendingRequests ?? [];

  if (pendingRequests.length === 0) return null;

  const currentRequest = pendingRequests[0];

  const handlePermissionAllow = () => {
    if (!entityId) return;
    sendPermissionResponse(entityId, currentRequest.toolUseId, 'allow');
    useConversationStore.getState().removePendingRequest(entityId, currentRequest.toolUseId);
  };

  const handlePermissionDeny = () => {
    if (!entityId) return;
    sendPermissionResponse(entityId, currentRequest.toolUseId, 'deny');
    useConversationStore.getState().removePendingRequest(entityId, currentRequest.toolUseId);
  };

  const handleQuestionAnswer = (answer: string) => {
    if (!entityId) return;
    sendQuestionResponse(entityId, currentRequest.toolUseId, answer);
    useConversationStore.getState().removePendingRequest(entityId, currentRequest.toolUseId);
  };

  return (
    <div className="border-t border-border">
      {currentRequest.type === 'permission' ? (
        <PermissionRequest
          request={currentRequest}
          onAllow={handlePermissionAllow}
          onDeny={handlePermissionDeny}
        />
      ) : (
        <QuestionRequest
          request={currentRequest}
          onAnswer={handleQuestionAnswer}
        />
      )}
    </div>
  );
}
