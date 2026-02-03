# Device ID 체계 정리

> 완료일: 2025-02-02

## 개요

deviceId를 숫자로 통일하고, deviceType을 ID 대역으로 구분하는 리팩토링 작업.

## ID 대역 규칙

| 대역 | deviceType | 설명 |
|------|------------|------|
| 1-9 | pylon | Pylon 서버 (최대 9대) |
| 10-99 | (예약) | 향후 확장용 |
| 100+ | desktop | 데스크톱 클라이언트 (자동 할당) |

## 작업 단위

### 1. core-deviceId

**구현 목표:** @estelle/core의 deviceId 관련 타입을 숫자 기반으로 통일

**생성/수정 파일:**
- `packages/core/src/utils/deviceId.ts` (신규)
  - 상수: `PYLON_ID_MIN`, `PYLON_ID_MAX`, `RESERVED_ID_MIN`, `RESERVED_ID_MAX`, `DESKTOP_ID_MIN`
  - 함수: `isValidPylonId`, `isValidDesktopId`, `isReservedId`, `getDeviceTypeFromId`
- `packages/core/src/types/device.ts` - DeviceType: 'pylon' | 'desktop' (mobile 제거)
- `packages/core/src/types/auth.ts` - AuthPayload.name?: string 추가

**테스트:** 26개 케이스

---

### 2. pylon-deviceId

**구현 목표:** @estelle/pylon의 deviceId를 숫자로 변경하고, deviceName을 별도 필드로 분리

**수정 파일:**
- `packages/pylon/src/network/relay-client.ts`
  - `deviceId: number` (string → number)
  - `deviceName?: string` 추가
  - `getDeviceName()` 메서드 추가
  - `createIdentifyMessage()`에 name 필드 포함
- `packages/pylon/src/pylon.ts`
  - `PylonConfig.deviceId: number`
  - `PylonConfig.deviceName?: string` 추가
  - `getDeviceName()` 메서드 추가

**테스트:** 5개 신규 케이스, 전체 497개 통과

---

### 3. relay-deviceId

**구현 목표:** @estelle/relay의 인증 로직에서 deviceId 대역 기반 검증 구현

**생성 파일:**
- `packages/relay/src/device-id-validation.ts` (신규)
  - `validateDeviceId(deviceId, deviceType)` - ID 대역 검증
  - `assignDeviceId(deviceType)` - 자동 할당
  - `DeviceIdAssigner` 클래스 - 연결된 ID 관리

**테스트:** 27개 케이스

---

### 4. client-deviceIcon

**구현 목표:** 클라이언트에서 deviceType 기반으로 아이콘 매핑

**생성 파일:**
- `packages/client/src/utils/device-icons.ts` (신규)
  - `DEVICE_ICONS` 상수: pylon → '🖥️', desktop → '💻'
  - `getDeviceIcon(deviceType)` 함수

**테스트:** 7개 케이스

---

## 진행 로그

- [250202 15:55] 플랜 분할 및 문서 작성
- [250202 16:44] core-deviceId 2-TEST 완료
- [250202 16:50] core-deviceId 4-IMPL 완료 (402개 테스트 통과)
- [250202 17:02] pylon-deviceId 2-TEST 완료
- [250202 17:10] pylon-deviceId 4-IMPL 완료 (497개 테스트 통과)
- [250202 17:18] relay-deviceId 2-TEST 완료
- [250202 17:22] relay-deviceId 4-IMPL 완료 (162개 테스트 통과)
- [250202 17:26] client-deviceIcon 2-TEST 완료
- [250202 17:30] client-deviceIcon 4-IMPL 완료 (113개 테스트 통과)
- [250202 17:30] 전체 완료
