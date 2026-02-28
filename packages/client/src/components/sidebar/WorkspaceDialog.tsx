import { useState, useEffect, useCallback } from 'react';
import { Monitor, ArrowUp, Folder, FolderPlus, ChevronRight, Trash2, HardDrive } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { LoadingSpinner } from '../ui/loading-spinner';
import { cn } from '../../lib/utils';
import { useWorkspaceStore } from '../../stores';
import { useLongPress } from '../../hooks/useLongPress';
import {
  requestFolderList,
  requestFolderCreate,
  requestWorkspaceCreate,
  updateWorkspace,
  deleteWorkspace,
} from '../../services/relaySender';
import { PlatformUtils, type PlatformType } from '../../utils/config';

interface FolderInfo {
  name: string;
  hasChildren: boolean;
  isDrive?: boolean;
  path?: string;  // 드라이브/루트인 경우 전체 경로 (예: 'C:\\' 또는 '/')
}

interface FolderState {
  path: string;
  folders: string[];
  foldersWithChildren: FolderInfo[];
  isLoading: boolean;
  error: string | null;
  platform: PlatformType;  // Pylon에서 받은 플랫폼 정보
}

interface WorkspaceData {
  workspaceId: string;
  pylonId: number;
  name: string;
  workingDir: string;
}

interface WorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'new' | 'edit';
  workspace?: WorkspaceData;
}

// 기본 경로는 Pylon에서 folder_list_result로 받아옴 (첫 요청 시 path 없이 요청)
const DEFAULT_NAME = '새 워크스페이스';

/**
 * 중복되지 않는 워크스페이스 이름 생성
 */
function getUniqueWorkspaceName(existingNames: string[]): string {
  if (!existingNames.includes(DEFAULT_NAME)) {
    return DEFAULT_NAME;
  }
  let counter = 2;
  while (existingNames.includes(`${DEFAULT_NAME} ${counter}`)) {
    counter++;
  }
  return `${DEFAULT_NAME} ${counter}`;
}

/**
 * 워크스페이스 생성/편집 다이얼로그
 */
export function WorkspaceDialog({ open, onClose, mode, workspace }: WorkspaceDialogProps) {
  const { connectedPylons, getAllWorkspaces } = useWorkspaceStore();

  const pcs = connectedPylons.map((p) => ({
    pcId: p.deviceId,
    pcName: p.deviceName,
  }));

  // 기존 워크스페이스 이름 목록 (중복 체크용)
  const existingWorkspaceNames = getAllWorkspaces()
    .flatMap(({ workspaces }) => workspaces.map((ws) => ws.name));

  // Edit 모드에서는 해당 Pylon 인덱스 찾기
  const getInitialPcIndex = () => {
    if (mode === 'edit' && workspace) {
      const idx = pcs.findIndex((p) => p.pcId === workspace.pylonId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  };

  const [selectedPcIndex, setSelectedPcIndex] = useState(getInitialPcIndex);
  const [name, setName] = useState(mode === 'edit' ? workspace?.name || '' : '');
  const [userEditedName, setUserEditedName] = useState(mode === 'edit');
  const [folderState, setFolderState] = useState<FolderState>({
    path: mode === 'edit' ? workspace?.workingDir || '' : '',
    folders: [],
    foldersWithChildren: [],
    isLoading: false,
    error: null,
    platform: 'windows',  // 기본값, Pylon에서 실제 값을 받아옴
  });
  const [deleteProgress, setDeleteProgress] = useState(0);

  const selectedPc = pcs[selectedPcIndex];
  const platform = folderState.platform;

  // 다이얼로그 열릴 때 초기화
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && workspace) {
        setSelectedPcIndex(getInitialPcIndex());
        setName(workspace.name);
        setUserEditedName(true);  // Edit 모드는 항상 고정 모드
        loadFolders(workspace.workingDir);
      } else {
        // New 모드: 초기 이름은 "새 워크스페이스" (중복 시 숫자)
        setSelectedPcIndex(0);
        setName(getUniqueWorkspaceName(existingWorkspaceNames));
        setUserEditedName(false);  // 폴더명 추적 모드
        // path 없이 요청하면 Pylon이 기본 경로로 응답
        loadFolders();
      }
    }
  }, [open, mode, workspace?.workspaceId]);

  // folder_list_result 이벤트 리스너
  useEffect(() => {
    const handleFolderListResult = (event: CustomEvent) => {
      const { path, folders, foldersWithChildren, error, platform: responsePlatform } = event.detail;
      const newPath = path || '';
      const newPlatform = (responsePlatform as PlatformType) || folderState.platform;

      setFolderState({
        path: newPath,
        folders: folders || [],
        foldersWithChildren: foldersWithChildren || [],
        isLoading: false,
        error: error || null,
        platform: newPlatform,
      });

      // 폴더명 추적 모드일 때 경로가 변경되면 이름도 변경
      if (!userEditedName && newPath !== '' && !PlatformUtils.isRootPath(newPath, newPlatform)) {
        const folderName = PlatformUtils.getFolderName(newPath, newPlatform);
        if (folderName) {
          setName(folderName);
        }
      }
    };

    window.addEventListener('folder_list_result' as any, handleFolderListResult);
    return () => {
      window.removeEventListener('folder_list_result' as any, handleFolderListResult);
    };
  }, [userEditedName, folderState.platform]);

  const loadFolders = useCallback((path?: string) => {
    if (!selectedPc) return;

    setFolderState((prev) => ({ ...prev, isLoading: true, error: null }));
    requestFolderList(selectedPc.pcId, path);
  }, [selectedPc]);

  // Pylon cycle (New 모드에서만)
  const cyclePc = () => {
    if (pcs.length > 1 && mode === 'new') {
      const nextIndex = (selectedPcIndex + 1) % pcs.length;
      setSelectedPcIndex(nextIndex);
      // Pylon 변경 시 경로 리셋 (새 Pylon의 기본 경로로)
      loadFolders();
      // 폴더명 추적 모드면 기본 이름으로 리셋
      if (!userEditedName) {
        setName(getUniqueWorkspaceName(existingWorkspaceNames));
      }
    }
  };

  // 상위 폴더로 이동
  const goToParent = () => {
    const currentPath = folderState.path;

    // 루트이거나 빈 경로면 이동 불가
    if (PlatformUtils.isRootPath(currentPath, platform)) {
      return;
    }

    const parentPath = PlatformUtils.getParentPath(currentPath, platform);

    if (parentPath === null) {
      // 더 이상 올라갈 수 없음 (Linux에서 / 위)
      return;
    }

    if (parentPath === '') {
      // Windows: 드라이브 목록으로
      loadFolders('');
    } else {
      loadFolders(parentPath);
    }
  };

  // 폴더 클릭 (탐색기 스타일)
  const handleFolderClick = (folder: FolderInfo) => {
    // 드라이브인 경우 해당 드라이브로 이동
    if (folder.isDrive && folder.path) {
      loadFolders(folder.path);
      return;
    }

    const fullPath = PlatformUtils.joinPath(folderState.path, folder.name, platform);

    if (folder.hasChildren) {
      // 하위 폴더가 있으면 진입 (이름은 folder_list_result에서 처리)
      loadFolders(fullPath);
    } else {
      // 하위 폴더가 없으면 선택 확정 + 현재 경로로 설정
      setFolderState((prev) => ({ ...prev, path: fullPath }));
      // 폴더명 추적 모드일 때만 이름 변경
      if (!userEditedName) {
        setName(folder.name);
      }
    }
  };

  // 이름 입력 핸들러
  const handleNameChange = (value: string) => {
    setName(value);
    if (value === '') {
      // 이름을 지우면 폴더명 추적 모드로 전환
      setUserEditedName(false);
      // 현재 경로의 폴더명으로 설정 (루트가 아닌 경우)
      const folderName = PlatformUtils.getFolderName(folderState.path, platform);
      if (folderName) {
        setName(folderName);
      } else {
        // 루트이면 기본 이름
        setName(getUniqueWorkspaceName(existingWorkspaceNames));
      }
    } else {
      setUserEditedName(true);
    }
  };

  // 새 폴더 생성
  const createFolder = () => {
    const folderName = prompt('새 폴더 이름을 입력하세요');
    if (folderName && selectedPc) {
      requestFolderCreate(selectedPc.pcId, folderState.path, folderName);
      setTimeout(() => loadFolders(folderState.path), 500);
    }
  };

  // 생성 (New 모드)
  const handleCreate = () => {
    if (!name.trim() || !selectedPc) return;

    requestWorkspaceCreate(selectedPc.pcId, name.trim(), folderState.path);
    handleClose();
  };

  // 적용 (Edit 모드)
  const handleApply = () => {
    if (!name.trim() || !workspace) return;

    const updates: { name?: string; workingDir?: string } = {};
    if (name.trim() !== workspace.name) {
      updates.name = name.trim();
    }
    if (folderState.path !== workspace.workingDir) {
      updates.workingDir = folderState.path;
    }

    if (Object.keys(updates).length > 0) {
      updateWorkspace(Number(workspace.workspaceId), updates);
    }
    handleClose();
  };

  // 삭제 (롱홀드)
  const handleDelete = () => {
    if (!workspace) return;
    deleteWorkspace(Number(workspace.workspaceId));
    handleClose();
  };

  const deleteLongPress = useLongPress(handleDelete, {
    delay: 1000,
    onProgress: setDeleteProgress,
    disabled: mode !== 'edit',
  });

  const handleClose = () => {
    setName('');
    setUserEditedName(false);
    setDeleteProgress(0);
    onClose();
  };

  // 경로 표시 텍스트
  const getPathDisplay = () => {
    if (folderState.path === '') {
      return platform === 'windows' ? '드라이브 선택' : '로딩 중...';
    }
    return folderState.path || '로딩 중...';
  };

  // 상위 이동 버튼 비활성화 조건
  const isParentDisabled = () => {
    const currentPath = folderState.path;
    // 빈 문자열(Windows 드라이브 목록) 또는 루트면 비활성화
    if (currentPath === '') return true;
    return PlatformUtils.isRootPath(currentPath, platform);
  };

  // PC 없음 상태
  if (pcs.length === 0) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {mode === 'new' ? '새 워크스페이스' : '워크스페이스 편집'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-muted-foreground py-6">
            연결된 PC가 없습니다
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'new' ? '새 워크스페이스' : '워크스페이스 편집'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pylon 선택 + 이름 입력 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={cyclePc}
              disabled={pcs.length <= 1 || mode === 'edit'}
              title={selectedPc?.pcName}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Input
              placeholder="워크스페이스 이름"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* 경로 표시 */}
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm text-muted-foreground truncate">
              {getPathDisplay()}
            </p>
            <Button variant="ghost" size="icon" onClick={goToParent} disabled={isParentDisabled()}>
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>

          {/* 폴더 목록 */}
          <div className="max-h-48 overflow-y-auto border rounded-md">
            {folderState.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner />
              </div>
            ) : folderState.error ? (
              <div className="flex items-center justify-center py-6">
                <p className="text-destructive text-sm">{folderState.error}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {folderState.foldersWithChildren.length > 0
                  ? folderState.foldersWithChildren.map((folder) => (
                      <button
                        key={folder.name}
                        onClick={() => handleFolderClick(folder)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                      >
                        {folder.isDrive ? (
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Folder className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="flex-1 text-left truncate">{folder.name}</span>
                        {folder.hasChildren && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    ))
                  : folderState.folders.map((folder) => (
                      // 하위 호환성: foldersWithChildren이 없으면 folders 사용
                      <button
                        key={folder}
                        onClick={() => handleFolderClick({ name: folder, hasChildren: true })}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                      >
                        <Folder className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-left truncate">{folder}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                {/* 드라이브 목록일 때는 새 폴더 버튼 숨김 */}
                {folderState.path !== '' && (
                  <button
                    onClick={createFolder}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span>새 폴더</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {mode === 'new' ? (
            <Button onClick={handleCreate} disabled={!name.trim()}>
              생성
            </Button>
          ) : (
            <div className="flex gap-2 w-full">
              <Button onClick={handleApply} disabled={!name.trim()} className="flex-1">
                적용
              </Button>
              <Button
                variant="destructive"
                className="relative overflow-hidden"
                {...deleteLongPress}
              >
                {deleteProgress > 0 && (
                  <div
                    className="absolute inset-0 bg-destructive-foreground/20"
                    style={{ width: `${deleteProgress * 100}%` }}
                  />
                )}
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
