import { useState, useEffect, useContext, useCallback } from 'react';
import { Plus, ChevronRight, Folder } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import { Collapsible } from '../common/Collapsible';
import { Card } from '../ui/card';
import { useWorkspaceStore, useDeviceConfigStore } from '../../stores';
import { useClaudeStore } from '../../stores/claudeStore';
import { useLongPress } from '../../hooks/useLongPress';
import { ConversationItem } from './ConversationItem';
import { WorkspaceDialog } from './WorkspaceDialog';
import { NewConversationDialog } from './NewConversationDialog';
import { selectConversation, reorderWorkspaces, reorderConversations } from '../../services/relaySender';
import { getDeviceIcon } from '../../utils/device-icons';
import { MobileLayoutContext } from '../../layouts/MobileLayout';
import type { Workspace, Conversation } from '@estelle/core';

interface EditWorkspaceTarget {
  workspaceId: string;
  pylonId: number;
  name: string;
  workingDir: string;
}

interface WorkspaceWithPylon extends Workspace {
  pylonId: number;
}

// ============================================================================
// WorkspaceHeader 컴포넌트 (롱홀드 지원)
// ============================================================================

interface WorkspaceHeaderProps {
  workspace: WorkspaceWithPylon;
  expanded: boolean;
  onSelect: () => void;
  onLongPress: () => void;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: SyntheticListenerMap | undefined;
  };
}

function WorkspaceHeader({ workspace, expanded, onSelect, onLongPress, dragHandleProps }: WorkspaceHeaderProps) {
  const [progress, setProgress] = useState(0);
  const { getIcon } = useDeviceConfigStore();
  const pylonIcon = getIcon(workspace.pylonId);
  const IconComponent = getDeviceIcon(pylonIcon);

  const longPressHandlers = useLongPress(onLongPress, {
    delay: 500,
    onProgress: setProgress,
  });

  return (
    <div
      onClick={onSelect}
      {...longPressHandlers}
      className="relative w-full px-3 py-2.5 text-left hover:bg-accent/50 transition-colors overflow-hidden cursor-pointer"
    >
      {/* 롱프레스 진행률 오버레이 */}
      {progress > 0 && (
        <div
          className="absolute inset-0 bg-primary/15 transition-all duration-75"
          style={{ width: `${progress * 100}%` }}
        />
      )}
      <div className="relative flex items-center gap-2">
        {/* 아이콘을 드래그 핸들로 사용 */}
        <div
          {...dragHandleProps?.attributes}
          {...dragHandleProps?.listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            // dnd-kit 리스너 먼저 호출
            const handler = dragHandleProps?.listeners?.onPointerDown as ((e: React.PointerEvent) => void) | undefined;
            handler?.(e);
            // 롱홀드 방지를 위해 전파 중지
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            const handler = dragHandleProps?.listeners?.onTouchStart as ((e: React.TouchEvent) => void) | undefined;
            handler?.(e);
            e.stopPropagation();
          }}
        >
          <IconComponent className="h-4 w-4 text-primary" />
        </div>
        <span className="font-semibold text-sm">{workspace.name}</span>
        <ChevronRight
          className={cn(
            'ml-auto h-4 w-4 text-muted-foreground transition-transform',
            expanded && 'rotate-90'
          )}
        />
      </div>
      <p className="relative text-xs text-muted-foreground mt-0.5 ml-6 truncate">
        {workspace.workingDir}
      </p>
    </div>
  );
}

// ============================================================================
// SortableConversationItem 컴포넌트
// ============================================================================

interface SortableConversationItemProps {
  conversation: Conversation;
  workspaceName: string;
  workingDir: string;
  isSelected: boolean;
  onPress: () => void;
}

function SortableConversationItem({
  conversation,
  workspaceName,
  workingDir,
  isSelected,
  onPress,
}: SortableConversationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: conversation.conversationId });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(isDragging && 'opacity-50')}
    >
      <ConversationItem
        workspaceName={workspaceName}
        workingDir={workingDir}
        conversation={conversation}
        isSelected={isSelected}
        showWorkspaceName={false}
        onPress={onPress}
      />
    </div>
  );
}

// ============================================================================
// SortableWorkspaceCard 컴포넌트
// ============================================================================

interface SortableWorkspaceCardProps {
  workspace: WorkspaceWithPylon;
  expanded: boolean;
  selectedConvInWorkspace: Conversation | null | undefined;
  onSelect: () => void;
  onLongPress: () => void;
  onConversationSelect: (conversation: Conversation) => void;
  onNewConversation: () => void;
  isSelectedConversation: (conversationId: string) => boolean;
  closeSidebar: () => void;
  onConversationDragEnd: (workspaceId: string, conversationIds: string[]) => void;
  conversationSensors: ReturnType<typeof useSensors>;
}

function SortableWorkspaceCard({
  workspace,
  expanded,
  selectedConvInWorkspace,
  onSelect,
  onLongPress,
  onConversationSelect,
  onNewConversation,
  isSelectedConversation,
  closeSidebar,
  onConversationDragEnd,
  conversationSensors,
}: SortableWorkspaceCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workspace.workspaceId });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handleConversationDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const conversations = workspace.conversations;
      const oldIndex = conversations.findIndex((c) => c.conversationId === active.id);
      const newIndex = conversations.findIndex((c) => c.conversationId === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(conversations, oldIndex, newIndex);
        const newIds = newOrder.map((c) => c.conversationId);
        onConversationDragEnd(workspace.workspaceId, newIds);
      }
    }
  }, [workspace.workspaceId, workspace.conversations, onConversationDragEnd]);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'overflow-hidden transition-colors',
        expanded ? 'bg-card border-border' : 'bg-card/50',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      {/* 워크스페이스 헤더 (아이콘이 드래그 핸들) */}
      <WorkspaceHeader
        workspace={workspace}
        expanded={expanded}
        onSelect={onSelect}
        onLongPress={onLongPress}
        dragHandleProps={{ attributes, listeners }}
      />

      {/* 닫힌 워크스페이스에서 선택된 대화만 표시 */}
      {!expanded && selectedConvInWorkspace && (
        <div className="pb-1.5">
          <ConversationItem
            workspaceName={workspace.name}
            workingDir={workspace.workingDir}
            conversation={selectedConvInWorkspace}
            isSelected={true}
            showWorkspaceName={false}
            onPress={() => closeSidebar()}
          />
        </div>
      )}

      {/* 열린 워크스페이스: 대화 목록 + 새 대화 버튼 */}
      <Collapsible expanded={expanded}>
        <div className="pb-1.5">
          {workspace.conversations.length > 0 ? (
            <DndContext
              sensors={conversationSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleConversationDragEnd}
            >
              <SortableContext
                items={workspace.conversations.map((c) => c.conversationId)}
                strategy={verticalListSortingStrategy}
              >
                {workspace.conversations.map((conversation) => (
                  <SortableConversationItem
                    key={conversation.conversationId}
                    conversation={conversation}
                    workspaceName={workspace.name}
                    workingDir={workspace.workingDir}
                    isSelected={isSelectedConversation(conversation.conversationId)}
                    onPress={() => onConversationSelect(conversation)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <p className="px-3 pb-0.5 text-xs text-muted-foreground italic">
              대화 없음
            </p>
          )}

          {/* + 새 대화 버튼 */}
          <button
            onClick={onNewConversation}
            className="flex items-center gap-2 w-full px-3 py-2 mx-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            새 대화
          </button>
        </div>
      </Collapsible>
    </Card>
  );
}

// ============================================================================
// WorkspaceSidebar 메인 컴포넌트
// ============================================================================

/**
 * 워크스페이스 사이드바 (2단계: 워크스페이스 → 대화)
 */
export function WorkspaceSidebar() {
  const [workspaceDialogMode, setWorkspaceDialogMode] = useState<'new' | 'edit' | null>(null);
  const [editWorkspaceTarget, setEditWorkspaceTarget] = useState<EditWorkspaceTarget | null>(null);
  const [newConversationTarget, setNewConversationTarget] = useState<{
    workspaceId: string;
    workspaceName: string;
  } | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  const {
    getAllWorkspaces,
    selectedConversation,
    selectConversation: selectInStore,
    reorderWorkspaces: reorderInStore,
    reorderConversations: reorderConversationsInStore,
  } = useWorkspaceStore();

  // 워크스페이스 드래그 센서 설정
  const workspaceSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 대화 드래그 센서 설정
  const conversationSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { closeSidebar } = useContext(MobileLayoutContext);

  const allWorkspaces = getAllWorkspaces();

  const flatWorkspaces: WorkspaceWithPylon[] = allWorkspaces.flatMap(({ pylonId, workspaces }) =>
    workspaces.map((ws) => ({ ...ws, pylonId }))
  );

  // 초기화: 선택된 대화가 있는 워크스페이스 또는 첫 번째 워크스페이스 선택
  useEffect(() => {
    if (selectedWorkspaceId === null && flatWorkspaces.length > 0) {
      const workspaceWithSelectedConv = selectedConversation
        ? flatWorkspaces.find(
            (ws) => ws.workspaceId === selectedConversation.workspaceId
          )
        : null;

      setSelectedWorkspaceId(
        workspaceWithSelectedConv?.workspaceId ?? flatWorkspaces[0].workspaceId
      );
    }
  }, [flatWorkspaces, selectedConversation, selectedWorkspaceId]);

  const isExpanded = (workspaceId: string) => selectedWorkspaceId === workspaceId;

  const selectWorkspace = useCallback((workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
  }, []);

  const isSelectedConversation = (conversationId: string) =>
    selectedConversation?.conversationId === conversationId;

  // 워크스페이스 편집 다이얼로그 열기
  const openEditDialog = useCallback((workspace: WorkspaceWithPylon) => {
    setEditWorkspaceTarget({
      workspaceId: workspace.workspaceId,
      pylonId: workspace.pylonId,
      name: workspace.name,
      workingDir: workspace.workingDir,
    });
    setWorkspaceDialogMode('edit');
  }, []);

  // 새 워크스페이스 다이얼로그 열기
  const openNewDialog = useCallback(() => {
    setEditWorkspaceTarget(null);
    setWorkspaceDialogMode('new');
  }, []);

  // 다이얼로그 닫기
  const closeWorkspaceDialog = useCallback(() => {
    setWorkspaceDialogMode(null);
    setEditWorkspaceTarget(null);
  }, []);

  // 드래그 종료 핸들러
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = flatWorkspaces.findIndex((w) => w.workspaceId === active.id);
      const newIndex = flatWorkspaces.findIndex((w) => w.workspaceId === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // 같은 Pylon의 워크스페이스만 이동 가능
        const movedWorkspace = flatWorkspaces[oldIndex];
        const targetWorkspace = flatWorkspaces[newIndex];

        if (movedWorkspace.pylonId === targetWorkspace.pylonId) {
          const pylonId = movedWorkspace.pylonId;
          const pylonWorkspaces = flatWorkspaces.filter((w) => w.pylonId === pylonId);
          const pylonOldIndex = pylonWorkspaces.findIndex((w) => w.workspaceId === active.id);
          const pylonNewIndex = pylonWorkspaces.findIndex((w) => w.workspaceId === over.id);

          const newOrder = arrayMove(pylonWorkspaces, pylonOldIndex, pylonNewIndex);
          const newIds = newOrder.map((w) => w.workspaceId);

          // 로컬 상태 먼저 업데이트 (낙관적)
          reorderInStore(pylonId, newIds);

          // 서버에 동기화
          reorderWorkspaces(newIds);
        }
      }
    }
  }, [flatWorkspaces, reorderInStore]);

  // 대화 선택 핸들러
  const handleConversationSelect = useCallback((workspace: WorkspaceWithPylon, conversation: Conversation) => {
    selectInStore(
      workspace.pylonId,
      workspace.workspaceId,
      conversation.conversationId
    );
    selectConversation(
      workspace.workspaceId,
      conversation.conversationId
    );
    useClaudeStore.getState().clearMessages();
    closeSidebar();
  }, [selectInStore, closeSidebar]);

  // 대화 드래그 종료 핸들러
  const handleConversationDragEnd = useCallback((workspaceId: string, conversationIds: string[]) => {
    const workspace = flatWorkspaces.find((w) => w.workspaceId === workspaceId);
    if (!workspace) return;

    // 로컬 상태 먼저 업데이트 (낙관적)
    reorderConversationsInStore(workspace.pylonId, workspaceId, conversationIds);

    // 서버에 동기화
    reorderConversations(workspaceId, conversationIds);
  }, [flatWorkspaces, reorderConversationsInStore]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <DndContext
          sensors={workspaceSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={flatWorkspaces.map((w) => w.workspaceId)}
            strategy={verticalListSortingStrategy}
          >
            {flatWorkspaces.map((workspace) => {
              const expanded = isExpanded(workspace.workspaceId);
              const selectedConvInWorkspace = !expanded
                ? workspace.conversations.find((c) =>
                    isSelectedConversation(c.conversationId)
                  )
                : null;

              return (
                <SortableWorkspaceCard
                  key={workspace.workspaceId}
                  workspace={workspace}
                  expanded={expanded}
                  selectedConvInWorkspace={selectedConvInWorkspace}
                  onSelect={() => selectWorkspace(workspace.workspaceId)}
                  onLongPress={() => openEditDialog(workspace)}
                  onConversationSelect={(conv) => handleConversationSelect(workspace, conv)}
                  onNewConversation={() => {
                    setNewConversationTarget({
                      workspaceId: workspace.workspaceId,
                      workspaceName: workspace.name,
                    });
                  }}
                  isSelectedConversation={isSelectedConversation}
                  closeSidebar={closeSidebar}
                  onConversationDragEnd={handleConversationDragEnd}
                  conversationSensors={conversationSensors}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* 빈 상태 */}
        {flatWorkspaces.length === 0 && (
          <Card className="p-6 text-center">
            <Folder className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">연결된 워크스페이스가 없습니다</p>
          </Card>
        )}

        {/* + 워크스페이스 추가 버튼 */}
        <button
          onClick={openNewDialog}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          워크스페이스 추가
        </button>
      </div>

      {/* 워크스페이스 다이얼로그 (New/Edit 통합) */}
      <WorkspaceDialog
        open={workspaceDialogMode !== null}
        onClose={closeWorkspaceDialog}
        mode={workspaceDialogMode || 'new'}
        workspace={editWorkspaceTarget || undefined}
      />

      {/* 새 대화 다이얼로그 */}
      <NewConversationDialog
        open={newConversationTarget !== null}
        workspaceId={newConversationTarget?.workspaceId ?? ''}
        workspaceName={newConversationTarget?.workspaceName ?? ''}
        onClose={() => setNewConversationTarget(null)}
      />
    </div>
  );
}
