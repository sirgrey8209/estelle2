import { useWorkspaceStore, useConversationStore } from '../../stores';
import { PermissionRequest } from './PermissionRequest';
import { QuestionRequest } from './QuestionRequest';
import { sendPermissionResponse, sendQuestionResponse } from '../../services/relaySender';

/**
 * 요청 바
 */
export function RequestBar() {
  const { selectedConversation } = useWorkspaceStore();
  const conversationId = selectedConversation?.conversationId;

  // conversationStore에서 현재 대화의 pendingRequests 가져오기
  const currentState = useConversationStore((s) => s.getCurrentState());
  const pendingRequests = currentState?.pendingRequests ?? [];

  if (pendingRequests.length === 0) return null;

  const currentRequest = pendingRequests[0];

  const handlePermissionAllow = () => {
    if (!conversationId) return;
    sendPermissionResponse(conversationId, currentRequest.toolUseId, 'allow');
    useConversationStore.getState().removePendingRequest(conversationId, currentRequest.toolUseId);
  };

  const handlePermissionDeny = () => {
    if (!conversationId) return;
    sendPermissionResponse(conversationId, currentRequest.toolUseId, 'deny');
    useConversationStore.getState().removePendingRequest(conversationId, currentRequest.toolUseId);
  };

  const handleQuestionAnswer = (answer: string) => {
    if (!conversationId) return;
    sendQuestionResponse(conversationId, currentRequest.toolUseId, answer);
    useConversationStore.getState().removePendingRequest(conversationId, currentRequest.toolUseId);
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
