# send-file MCP TDD

## 상태
✅ 완료

## 테스트 케이스
1. [정상] should_return_success_with_file_info_when_file_exists
2. [정상] should_include_description_when_provided
3. [정상] should_set_description_null_when_not_provided
4. [정상] should_resolve_relative_path_against_working_dir
5. [정상] should_use_absolute_path_as_is
6. [MIME] should_detect_image_jpeg_for_jpg_extension
7. [MIME] should_detect_image_png_for_png_extension
8. [MIME] should_detect_text_markdown_for_md_extension
9. [MIME] should_detect_text_plain_for_txt_extension
10. [MIME] should_detect_application_json_for_json_extension
11. [MIME] should_detect_text_typescript_for_ts_extension
12. [MIME] should_detect_octet_stream_for_unknown_extension
13. [분류] should_classify_as_image_when_mime_starts_with_image
14. [분류] should_classify_as_markdown_when_mime_is_text_markdown
15. [분류] should_classify_as_text_when_mime_starts_with_text
16. [분류] should_classify_as_binary_when_mime_is_unknown
17. [에러] should_return_error_when_file_not_found
18. [에러] should_return_error_when_path_is_undefined
19. [에러] should_return_error_when_path_is_empty_string
20. [포맷] should_return_content_array_with_text_type
21. [포맷] should_return_parseable_json_in_success_response
22. [포맷] should_return_content_array_with_text_type_on_error

## 파일
- 플랜: wip/send-file-mcp-plan.md
- 테스트: packages/pylon/tests/mcp/tools/send-file.test.ts
- 구현: packages/pylon/src/mcp/tools/send-file.ts

## 재시도 횟수
- 2-TEST → 3-VERIFY: 0/3
- 4-IMPL: 0/3

## 로그
- [260206 16:00] 1-PLAN 시작
- [260206 16:00] 1-PLAN 승인
- [260206 18:32] 2-TEST 시작 - 22개 테스트 케이스 작성
- [260206 18:35] 4-IMPL 완료 - 22개 테스트 전부 통과
- [260206 18:38] 5-REFACTOR 완료 - 타입 리터럴 강화, 매직스트링 상수 추출, buildFileInfo 함수 분리
- [260206 18:42] 인프라 추가 - MCP 서버(server.ts), bin.ts 자동 주입, @modelcontextprotocol/sdk 의존성
