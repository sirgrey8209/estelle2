import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { Plus, ChevronRight, Folder, Star } from 'lucide-react';
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
import { useWorkspaceStore, useDeviceConfigStore, useConversationStore } from '../../stores';
import { useLongPress } from '../../hooks/useLongPress';
import { ConversationItem } from './ConversationItem';
import { WorkspaceDialog } from './WorkspaceDialog';
import { NewConversationDialog } from './NewConversationDialog';
import { selectConversation, reorderWorkspaces, reorderConversations } from '../../services/relaySender';
import { getDeviceIcon } from '../../utils/device-icons';
import { MobileLayoutContext } from '../../layouts/MobileLayout';
import { PylonTabs, type PylonTabValue } from './PylonTabs';
import { useFavoriteWorkspaces } from '../../hooks/useFavoriteWorkspaces';
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

/** 탭 선택 상태 localStorage 키 */
const TAB_STORAGE_KEY = 'estelle:selectedPylonTab';

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
  /** 즐겨찾기 탭에서 표시 중인지 여부 (true면 Pylon 아이콘 표시) */
  showPylonIcon: boolean;
  /** 즐겨찾기 여부 */
  isFavorite: boolean;
  /** 즐겨찾기 토글 콜백 */
  onToggleFavorite: () => void;
}

function WorkspaceHeader({
  workspace,
  expanded,
  onSelect,
  onLongPress,
  dragHandleProps,
  showPylonIcon,
  isFavorite,
  onToggleFavorite,
}: WorkspaceHeaderProps) {
  const [progress, setProgress] = useState(0);
  const { getIcon } = useDeviceConfigStore();
  const pylonIcon = getIcon(workspace.pylonId);
  const IconComponent = getDeviceIcon(pylonIcon);

  const longPressHandlers = useLongPress(onLongPress, {
    delay: 500,
    onProgress: setProgress,
  });

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite();
  };

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
        {/* 즐겨찾기 탭: Pylon 아이콘 (드래그 핸들) / Pylon 탭: 즐겨찾기 토글 버튼 */}
        {showPylonIcon ? (
          <div
            {...dragHandleProps?.attributes}
            {...dragHandleProps?.listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              const handler = dragHandleProps?.listeners?.onPointerDown as ((e: React.PointerEvent) => void) | undefined;
              handler?.(e);
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
        ) : (
          <button
            onClick={handleFavoriteClick}
            className={cn(
              'p-0.5 rounded transition-colors',
              isFavorite
                ? 'text-yellow-500 hover:text-yellow-600'
                : 'text-muted-foreground hover:text-yellow-500'
            )}
            title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
          </button>
        )}
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
  isSelectedConversation: (conversationId: number) => boolean;
  closeSidebar: () => void;
  onConversationDragEnd: (workspaceId: string, conversationIds: number[]) => void;
  conversationSensors: ReturnType<typeof useSensors>;
  /** 즐겨찾기 탭에서 표시 중인지 여부 */
  showPylonIcon: boolean;
  /** 즐겨찾기 여부 */
  isFavorite: boolean;
  /** 즐겨찾기 토글 콜백 */
  onToggleFavorite: () => void;
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
  showPylonIcon,
  isFavorite,
  onToggleFavorite,
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
      {/* 워크스페이스 헤더 */}
      <WorkspaceHeader
        workspace={workspace}
        expanded={expanded}
        onSelect={onSelect}
        onLongPress={onLongPress}
        dragHandleProps={{ attributes, listeners }}
        showPylonIcon={showPylonIcon}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('estelle:expandedWorkspaces');
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // 탭 상태
  const [selectedTab, setSelectedTab] = useState<PylonTabValue>(() => {
    try {
      const saved = localStorage.getItem(TAB_STORAGE_KEY);
      if (!saved) return 'favorites';
      const parsed = JSON.parse(saved);
      return parsed === 'favorites' ? 'favorites' : Number(parsed);
    } catch {
      return 'favorites';
    }
  });

  // 즐겨찾기 상태
  const { isFavorite, toggleFavorite } = useFavoriteWorkspaces();

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

  // 탭 변경 핸들러
  const handleTabChange = useCallback((tab: PylonTabValue) => {
    setSelectedTab(tab);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(tab));
    } catch {
      // 무시
    }
  }, []);

  // 즐겨찾기된 워크스페이스 목록
  const favoriteWorkspaces = useMemo(
    () => flatWorkspaces.filter((ws) => isFavorite(ws.workspaceId)),
    [flatWorkspaces, isFavorite]
  );

  const hasFavorites = favoriteWorkspaces.length > 0;

  // 필터링된 워크스페이스 목록
  const filteredWorkspaces = useMemo(() => {
    if (selectedTab === 'favorites') {
      return favoriteWorkspaces;
    }
    return flatWorkspaces.filter((ws) => ws.pylonId === selectedTab);
  }, [flatWorkspaces, favoriteWorkspaces, selectedTab]);

  // 즐겨찾기 탭인지 여부
  const isFavoritesTab = selectedTab === 'favorites';

  // 즐겨찾기가 없는데 즐겨찾기 탭이 선택된 경우 → 첫 번째 Pylon 탭으로 전환
  const { connectedPylons } = useWorkspaceStore();
  useEffect(() => {
    if (selectedTab === 'favorites' && !hasFavorites && connectedPylons.length > 0) {
      const firstPylonId = connectedPylons[0].deviceId;
      setSelectedTab(firstPylonId);
      try {
        localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(firstPylonId));
      } catch {
        // 무시
      }
    }
  }, [selectedTab, hasFavorites, connectedPylons]);

  // 초기화: 저장된 상태가 없으면 선택된 대화가 있는 워크스페이스를 펼침
  useEffect(() => {
    if (expandedIds.size === 0 && flatWorkspaces.length > 0) {
      const workspaceWithSelectedConv = selectedConversation
        ? flatWorkspaces.find(
            (ws) => ws.workspaceId === selectedConversation.workspaceId
          )
        : null;

      const initialId = workspaceWithSelectedConv?.workspaceId ?? flatWorkspaces[0].workspaceId;
      const next = new Set([initialId]);
      setExpandedIds(next);
      localStorage.setItem('estelle:expandedWorkspaces', JSON.stringify([...next]));
    }
  }, [flatWorkspaces, selectedConversation, expandedIds.size]);

  const isExpanded = (workspaceId: string) => expandedIds.has(workspaceId);

  const toggleWorkspace = useCallback((workspaceId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      localStorage.setItem('estelle:expandedWorkspaces', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isSelectedConversation = (conversationId: number) =>
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
          const newIds = newOrder.map((w) => Number(w.workspaceId));

          // 로컬 상태 먼저 업데이트 (낙관적)
          reorderInStore(pylonId, newIds.map(String));

          // 서버에 동기화
          reorderWorkspaces(newIds);
        }
      }
    }
  }, [flatWorkspaces, reorderInStore]);

  // 대화 선택 핸들러
  const handleConversationSelect = useCallback((workspace: WorkspaceWithPylon, conversation: Conversation) => {
    // workspaceStore에서 대화 선택 (conversationId 사용)
    selectInStore(
      workspace.pylonId,
      conversation.conversationId
    );

    // conversationStore에서 현재 대화 설정 (conversationId 사용)
    useConversationStore.getState().setCurrentConversation(conversation.conversationId);

    // Pylon에 대화 선택 알림 (히스토리 로드 요청) - conversationId 사용
    selectConversation(conversation.conversationId);

    closeSidebar();
  }, [selectInStore, closeSidebar]);

  // 대화 드래그 종료 핸들러
  const handleConversationDragEnd = useCallback((workspaceId: string, conversationIds: number[]) => {
    const workspace = flatWorkspaces.find((w) => w.workspaceId === workspaceId);
    if (!workspace) return;

    // 로컬 상태 먼저 업데이트 (낙관적)
    reorderConversationsInStore(workspace.pylonId, workspaceId, conversationIds);

    // 서버에 동기화
    reorderConversations(Number(workspaceId), conversationIds);
  }, [flatWorkspaces, reorderConversationsInStore]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Pylon 탭 */}
      <PylonTabs selectedTab={selectedTab} onTabChange={handleTabChange} hasFavorites={hasFavorites} />

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <DndContext
          sensors={workspaceSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredWorkspaces.map((w) => w.workspaceId)}
            strategy={verticalListSortingStrategy}
          >
            {filteredWorkspaces.map((workspace) => {
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
                  onSelect={() => toggleWorkspace(workspace.workspaceId)}
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
                  showPylonIcon={isFavoritesTab}
                  isFavorite={isFavorite(workspace.workspaceId)}
                  onToggleFavorite={() => toggleFavorite(workspace.workspaceId)}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* 빈 상태 */}
        {filteredWorkspaces.length === 0 && (
          <Card className="p-6 text-center">
            {isFavoritesTab ? (
              <>
                <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">즐겨찾기한 워크스페이스가 없습니다</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pylon 탭에서 ⭐ 버튼을 눌러 추가하세요
                </p>
              </>
            ) : (
              <>
                <Folder className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">워크스페이스가 없습니다</p>
              </>
            )}
          </Card>
        )}

        {/* + 워크스페이스 추가 버튼 (Pylon 탭에서만 표시) */}
        {!isFavoritesTab && (
          <button
            onClick={openNewDialog}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            워크스페이스 추가
          </button>
        )}
      </div>

      {/* 워크스페이스 다이얼로그 (New/Edit 통합) */}
      <WorkspaceDialog
        open={workspaceDialogMode !== null}
        onClose={closeWorkspaceDialog}
        mode={workspaceDialogMode || 'new'}
        workspace={editWorkspaceTarget || undefined}
        pylonId={typeof selectedTab === 'number' ? selectedTab : undefined}
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
