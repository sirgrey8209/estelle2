import { useClaudeStore, useWorkspaceStore } from '../../stores';
import { PermissionRequest } from './PermissionRequest';
import { QuestionRequest } from './QuestionRequest';
import { sendPermissionResponse, sendQuestionResponse } from '../../services/relaySender';

/**
 * 요청 바
 */
export function RequestBar() {
  const { pendingRequests, removePendingRequest } = useClaudeStore();
  const { selectedConversation } = useWorkspaceStore();

  if (pendingRequests.length === 0) return null;

  const currentRequest = pendingRequests[0];
  const conversationId = selectedConversation?.conversationId;

  const handlePermissionAllow = () => {
    if (!conversationId) return;
    sendPermissionResponse(conversationId, currentRequest.toolUseId, 'allow');
    removePendingRequest(currentRequest.toolUseId);
  };

  const handlePermissionDeny = () => {
    if (!conversationId) return;
    sendPermissionResponse(conversationId, currentRequest.toolUseId, 'deny');
    removePendingRequest(currentRequest.toolUseId);
  };

  const handleQuestionAnswer = (answer: string) => {
    if (!conversationId) return;
    sendQuestionResponse(conversationId, currentRequest.toolUseId, answer);
    removePendingRequest(currentRequest.toolUseId);
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
