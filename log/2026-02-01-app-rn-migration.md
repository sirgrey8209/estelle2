# Flutter → Expo (React Native) 마이그레이션

> **상태**: ✅ 완료 (UI 컴포넌트 마이그레이션 완료, Pylon 연동 대기)
> **작성일**: 2026-02-01
> **결정**: Expo 채택

---

## 배경

### 문제
- Pylon(TypeScript) ↔ App(Dart) 간 타입 불일치 문제
- `deviceId`가 string/number 혼용되어 런타임 에러 발생
- 두 언어 간 스키마 동기화가 수동으로 이루어짐

### 해결책
- App을 Expo(TypeScript)로 마이그레이션
- `@estelle/core` 타입을 직접 import
- 컴파일 타임에 타입 불일치 감지

---

## 기술 스택

| 영역 | Flutter (현재) | Expo (목표) |
|------|---------------|-------------|
| 언어 | Dart | **TypeScript** |
| 프레임워크 | Flutter | **Expo (React Native)** |
| 상태관리 | Riverpod | **Zustand** |
| 라우팅 | - | Expo Router |
| 스타일 | Flutter 위젯 | NativeWind (Tailwind) |
| 웹소켓 | web_socket_channel | ws |
| 파일 처리 | path_provider | expo-file-system |
| 이미지 | image_picker | expo-image-picker |

---

## 폴더 구조

### Flutter (현재)
```
packages/app-flutter/lib/
├── main.dart
├── app.dart
├── core/
│   ├── constants/
│   ├── theme/
│   ├── utils/
│   └── services/
├── data/
│   ├── models/
│   └── services/
├── state/
│   └── providers/
└── ui/
    ├── layouts/
    └── widgets/
```

### Expo (목표)
```
packages/app-rn/
├── app/                    # Expo Router
│   ├── _layout.tsx
│   └── index.tsx
├── src/
│   ├── components/         # UI 컴포넌트
│   │   ├── chat/
│   │   ├── sidebar/
│   │   ├── requests/
│   │   ├── settings/
│   │   ├── viewers/
│   │   ├── deploy/
│   │   ├── task/
│   │   └── common/
│   ├── layouts/            # 레이아웃
│   ├── stores/             # Zustand 스토어
│   ├── services/           # WebSocket 등
│   ├── hooks/              # 커스텀 훅
│   └── utils/              # 유틸리티
├── app.json
├── package.json
└── tsconfig.json
```

---

## 마이그레이션 체크리스트

### Phase 1: 프로젝트 셋업 ✅

#### 1.1 Expo 프로젝트 생성
- [x] `npx create-expo-app app-rn --template blank-typescript`
- [x] pnpm 워크스페이스 설정
- [x] `@estelle/core` import 테스트
- [x] tsconfig.json 경로 설정

#### 1.2 의존성 설치
- [x] zustand (상태관리)
- [x] expo-router (라우팅)
- [x] nativewind + tailwindcss (스타일)
- [x] react-native-reanimated (애니메이션)
- [x] expo-file-system (파일)
- [x] expo-image-picker (이미지)

---

### Phase 2: 코어 기능 ✅

#### 2.1 타입 정의 (from @estelle/core)
| Flutter | Expo | 상태 |
|---------|------|------|
| `models/workspace_info.dart` | `@estelle/core` import | ✅ |
| `models/claude_message.dart` | `@estelle/core` import | ✅ |
| `models/claude_usage.dart` | `@estelle/core` import | ✅ |
| `models/deploy_status.dart` | `@estelle/core` import | ✅ |
| `models/pending_request.dart` | `@estelle/core` import | ✅ |

#### 2.2 서비스
| Flutter | Expo | 상태 |
|---------|------|------|
| `services/relay_service.dart` | `services/relayService.ts` | ✅ |
| `services/blob_transfer_service.dart` | `services/blobService.ts` | ✅ |
| `services/image_cache_service.dart` | `services/imageCacheService.ts` | ✅ |

#### 2.3 상태 관리 (Riverpod → Zustand)
| Flutter | Expo | 상태 |
|---------|------|------|
| `providers/relay_provider.dart` | `stores/relayStore.ts` | ✅ |
| `providers/workspace_provider.dart` | `stores/deskStore.ts` | ✅ |
| `providers/claude_provider.dart` | `stores/claudeStore.ts` | ✅ |
| `providers/settings_provider.dart` | `stores/settingsStore.ts` | ✅ |
| `providers/image_upload_provider.dart` | `stores/uploadStore.ts` | ✅ |
| `providers/file_download_provider.dart` | `stores/downloadStore.ts` | ✅ |

---

### Phase 3: UI 컴포넌트 ✅

#### 3.1 진입점
| Flutter | Expo | 상태 |
|---------|------|------|
| `main.dart` | `app/_layout.tsx` | ✅ |
| `app.dart` | `app/index.tsx` | ✅ |

#### 3.2 레이아웃
| Flutter | Expo | 상태 |
|---------|------|------|
| `layouts/responsive_layout.dart` | `layouts/ResponsiveLayout.tsx` | ✅ |
| `layouts/desktop_layout.dart` | `layouts/DesktopLayout.tsx` | ✅ |
| `layouts/mobile_layout.dart` | `layouts/MobileLayout.tsx` | ✅ |

#### 3.3 채팅 위젯 (10개)
| Flutter | Expo | 상태 |
|---------|------|------|
| `widgets/chat/chat_area.dart` | `components/chat/ChatArea.tsx` | ✅ |
| `widgets/chat/message_list.dart` | `components/chat/MessageList.tsx` | ✅ |
| `widgets/chat/message_bubble.dart` | `components/chat/MessageBubble.tsx` | ✅ |
| `widgets/chat/streaming_bubble.dart` | `components/chat/StreamingBubble.tsx` | ✅ |
| `widgets/chat/input_bar.dart` | `components/chat/InputBar.tsx` | ✅ |
| `widgets/chat/working_indicator.dart` | `components/chat/WorkingIndicator.tsx` | ✅ |
| `widgets/chat/tool_card.dart` | `components/chat/ToolCard.tsx` | ✅ |
| `widgets/chat/result_info.dart` | `components/chat/ResultInfo.tsx` | ✅ |
| `widgets/chat/uploading_image_bubble.dart` | `components/chat/UploadingBubble.tsx` | ✅ |
| `widgets/chat/system_divider.dart` | `components/chat/SystemDivider.tsx` | ✅ |

#### 3.4 사이드바 위젯 (3개)
| Flutter | Expo | 상태 |
|---------|------|------|
| `widgets/sidebar/workspace_sidebar.dart` | `components/sidebar/DeskSidebar.tsx` | ✅ |
| `widgets/sidebar/workspace_item.dart` | `components/sidebar/DeskItem.tsx` | ✅ |
| `widgets/sidebar/new_workspace_dialog.dart` | `components/sidebar/NewDeskDialog.tsx` | ✅ |

#### 3.5 권한 요청 위젯 (3개)
| Flutter | Expo | 상태 |
|---------|------|------|
| `widgets/requests/request_bar.dart` | `components/requests/RequestBar.tsx` | ✅ |
| `widgets/requests/question_request_view.dart` | `components/requests/QuestionRequest.tsx` | ✅ |
| `widgets/requests/permission_request_view.dart` | `components/requests/PermissionRequest.tsx` | ✅ |

#### 3.6 설정 위젯 (6개)
| Flutter | Expo | 상태 |
|---------|------|------|
| `widgets/settings/settings_screen.dart` | `components/settings/SettingsScreen.tsx` | ✅ |
| `widgets/settings/settings_dialog.dart` | `components/settings/SettingsDialog.tsx` | ✅ |
| `widgets/settings/claude_usage_card.dart` | `components/settings/ClaudeUsageCard.tsx` | ✅ |
| `widgets/settings/deploy_status_card.dart` | `components/settings/DeployStatusCard.tsx` | ✅ |
| `widgets/settings/deploy_section.dart` | `components/settings/DeploySection.tsx` | ✅ |
| `widgets/settings/app_update_section.dart` | `components/settings/AppUpdateSection.tsx` | ✅ |

#### 3.7 배포 위젯 (1개)
| Flutter | Expo | 상태 |
|---------|------|------|
| `widgets/deploy/deploy_dialog.dart` | `components/deploy/DeployDialog.tsx` | ✅ |

#### 3.8 뷰어 위젯 (4개)
| Flutter | Expo | 상태 |
|---------|------|------|
| `widgets/viewers/file_viewer_dialog.dart` | `components/viewers/FileViewer.tsx` | ✅ |
| `widgets/viewers/image_viewer.dart` | `components/viewers/ImageViewer.tsx` | ✅ |
| `widgets/viewers/text_viewer.dart` | `components/viewers/TextViewer.tsx` | ✅ |
| `widgets/viewers/markdown_viewer.dart` | `components/viewers/MarkdownViewer.tsx` | ✅ |

#### 3.9 태스크 위젯 (1개)
| Flutter | Expo | 상태 |
|---------|------|------|
| `widgets/task/task_detail_view.dart` | `components/task/TaskDetailView.tsx` | ✅ |

#### 3.10 공통 위젯 (3개)
| Flutter | Expo | 상태 |
|---------|------|------|
| `widgets/common/loading_overlay.dart` | `components/common/LoadingOverlay.tsx` | ✅ |
| `widgets/common/status_dot.dart` | `components/common/StatusDot.tsx` | ✅ |
| `widgets/common/bug_report_dialog.dart` | `components/common/BugReportDialog.tsx` | ✅ |

---

### Phase 4: 유틸리티 & 상수 ✅

#### 4.1 상수/설정
| Flutter | Expo | 상태 |
|---------|------|------|
| `core/constants/colors.dart` | NativeWind theme (Nord colors) | ✅ |
| `core/constants/build_info.dart` | `utils/buildInfo.ts` | ✅ |
| `core/constants/relay_config.dart` | `utils/config.ts` | ✅ |
| `core/theme/app_colors.dart` | NativeWind theme | ✅ |
| `core/theme/app_theme.dart` | NativeWind theme | ✅ |

#### 4.2 유틸리티
| Flutter | Expo | 상태 |
|---------|------|------|
| `core/utils/responsive_utils.dart` | `hooks/useResponsive.ts` | ✅ |
| `core/services/apk_installer.dart` | (Android 전용, 나중에) | ⬜ |

---

### Phase 5: 정리

- [ ] Flutter 앱과 기능 동등성 테스트
- [ ] `packages/app-flutter` 제거
- [x] CLAUDE.md 업데이트
- [x] ROADMAP.md 업데이트
- [ ] 문서를 log/로 이동

---

## 진행 상황 요약

| 카테고리 | 파일 수 | 완료 | 진행률 |
|----------|---------|------|--------|
| 셋업 | 6 | 6 | 100% |
| 타입 (core) | 5 | 5 | 100% |
| 서비스 | 3 | 3 | 100% |
| 스토어 | 6 | 6 | 100% |
| 레이아웃 | 3 | 3 | 100% |
| 채팅 위젯 | 10 | 10 | 100% |
| 사이드바 위젯 | 3 | 3 | 100% |
| 요청 위젯 | 3 | 3 | 100% |
| 설정 위젯 | 6 | 6 | 100% |
| 배포 위젯 | 1 | 1 | 100% |
| 뷰어 위젯 | 4 | 4 | 100% |
| 태스크 위젯 | 1 | 1 | 100% |
| 공통 위젯 | 3 | 3 | 100% |
| 유틸리티 | 7 | 6 | 86% |
| 정리 | 5 | 2 | 40% |
| **합계** | **66** | **62** | **94%** |

---

## 다음 단계

**Phase 5: 정리**

1. Flutter 앱과 기능 동등성 테스트
2. `packages/app-flutter` 제거
3. CLAUDE.md 업데이트
4. 문서를 log/로 이동

---

*작성일: 2026-02-01*
*결정: Expo 채택*
*Phase 4 완료: 2026-02-01*
