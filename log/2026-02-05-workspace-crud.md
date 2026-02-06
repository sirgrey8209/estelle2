# Workspace CRUD 구현

## 구현 목표

워크스페이스 편집/삭제 기능 구현:
- 워크스페이스 이름, 경로 변경
- 롱홀드로 편집 다이얼로그 열기
- 롱홀드로 삭제 실행
- 탐색기 스타일 폴더 탐색

---

## Phase 1: Backend + API

### 구현 방향

1. **FolderManager 개선**
   - `listDrives()`: C:\, D:\ 드라이브 목록 반환
   - `listFolders()` 결과에 `foldersWithChildren` 추가 (hasChildren 정보 포함)

2. **WorkspaceStore 추가**
   - `updateWorkspace(workspaceId, name?, workingDir?)`: 이름과/또는 경로 변경

3. **Pylon 핸들러**
   - `workspace_update` 메시지 처리
   - 성공 시 `broadcastWorkspaceList()` 호출

4. **Core 타입**
   - `MessageType.WORKSPACE_UPDATE`, `WORKSPACE_UPDATE_RESULT` 추가
   - `WorkspaceUpdatePayload` 타입 정의

5. **Client relaySender**
   - `updateWorkspace()`, `deleteWorkspace()` 함수 추가

### 테스트 케이스 (19개)

**FolderManager - listDrives (4개)**
1. should_return_drives_list_when_called
2. should_include_hasChildren_for_each_drive
3. should_include_drive_label
4. should_return_empty_drives_when_no_drives_exist

**FolderManager - listFolders with hasChildren (6개)**
5. should_include_hasChildren_in_result_when_folders_have_subfolders
6. should_return_hasChildren_false_when_folder_only_has_files
7. should_return_hasChildren_true_when_subfolder_has_hidden_folders
8. should_maintain_backwards_compatibility_with_folders_array
9. should_handle_deeply_nested_folders_for_hasChildren
10. should_return_empty_foldersWithChildren_when_directory_is_empty

**WorkspaceStore - updateWorkspace (9개)**
11. should_update_name_when_only_name_provided
12. should_update_workingDir_when_only_workingDir_provided
13. should_update_both_name_and_workingDir_when_both_provided
14. should_return_false_when_workspace_not_found
15. should_return_false_when_no_updates_provided
16. should_trim_whitespace_from_name
17. should_return_false_when_name_is_empty_after_trim
18. should_update_lastUsed_timestamp
19. should_normalize_workingDir_path

### 파일
- packages/pylon/tests/managers/folder-manager.test.ts
- packages/pylon/tests/stores/workspace-store.test.ts
- packages/pylon/src/managers/folder-manager.ts
- packages/pylon/src/stores/workspace-store.ts
- packages/pylon/src/pylon.ts (workspace_update 핸들러)
- packages/core/src/constants/message-type.ts (WORKSPACE_UPDATE)
- packages/core/src/types/workspace.ts (WorkspaceUpdatePayload)
- packages/client/src/services/relaySender.ts (updateWorkspace, deleteWorkspace)

---

## Phase 2: UI

### 구현 방향

1. **WorkspaceDialog 통합 (New/Edit 모드)**

| 구분 | New 모드 | Edit 모드 |
|------|----------|-----------|
| Props | `mode: 'new'` | `mode: 'edit', workspace: {...}` |
| Pylon 선택 | Cycle 가능 | 비활성화 |
| 경로 기본값 | `C:\workspace` | 기존 workingDir |
| 이름 기본값 | 빈 문자열 | 기존 name |
| 하단 버튼 | [생성] | [적용] [삭제(롱홀드)] |

2. **폴더 탐색 UI (탐색기 스타일)**
   - 폴더 클릭 → 하위 폴더 있으면 진입
   - 폴더 클릭 → 하위 폴더 없으면 선택 확정
   - 상위로 이동 버튼 (↑)

3. **이름 자동 설정 로직**
   - 경로 변경 시 마지막 세그먼트로 자동 설정
   - 사용자가 직접 입력하면 자동 설정 비활성화
   - 이름 삭제 시 자동 설정 재활성화

4. **WorkspaceSidebar 롱홀드 연동**
   - 워크스페이스 헤더에 롱홀드 이벤트
   - 롱홀드 시 WorkspaceDialog(mode: 'edit') 열기

5. **삭제 버튼 롱홀드**
   - 일반 클릭 무시
   - 롱홀드(~1초) 시 삭제 실행
   - 프로그레스 표시

### 테스트 케이스 - useLongPress 훅 (11개)

**기본 동작 (3개)**
1. should call callback after long press duration
2. should not call callback if released before duration
3. should support custom duration

**터치 이벤트 (3개)**
4. should call callback on touch long press
5. should cancel on touch move
6. should cancel on touch end before duration

**마우스 이동 취소 (1개)**
7. should cancel on mouse leave

**프로그레스 콜백 (2개)**
8. should call onProgress during long press
9. should call onProgress with 0 when cancelled

**cleanup (1개)**
10. should clear timer on unmount

**비활성화 옵션 (1개)**
11. should not trigger when disabled

### 파일
- packages/client/src/hooks/useLongPress.ts (신규)
- packages/client/src/hooks/useLongPress.test.ts (신규)
- packages/client/src/components/sidebar/WorkspaceDialog.tsx (신규, NewWorkspaceDialog 대체)
- packages/client/src/components/sidebar/WorkspaceSidebar.tsx (리팩토링)

---

## 진행 로그

### Phase 1
- [250205 15:30] 1-PLAN 시작
- [250205 15:30] 사용자 승인 완료, 2-TEST 진행
- [250205 15:35] 2-TEST 완료 - 19개 테스트 케이스 작성
- [250205 16:07] 3-VERIFY 통과
- [250205 16:13] 4-IMPL 완료 (508개 테스트 통과)
- [250205 16:16] 5-REFACTOR 완료

### Phase 2
- [250205 16:25] 1-PLAN 시작
- [250205 16:25] 사용자 승인 완료, 2-TEST 진행
- [250205 16:30] 2-TEST: useLongPress 테스트 11개 작성
- [250205 16:32] 3-VERIFY 통과
- [250205 16:33] 4-IMPL: useLongPress 훅 구현 완료
- [250205 16:36] 5-REFACTOR 완료
- [250205 16:45] UI 구현: WorkspaceDialog, WorkspaceSidebar 리팩토링 완료
- [250205 16:45] 전체 테스트 통과: pylon 508개, client 172개
- [250205 16:45] 빌드 성공
