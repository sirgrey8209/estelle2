# 설정창 계정 변경 라우팅 및 Hub 링크 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 계정 변경을 office Pylon 전용으로 변경하고 Hub 링크 버튼을 추가한다.

**Architecture:** relaySender의 계정 전환 함수를 수정하여 브로드캐스트 대신 특정 pylonId로 전송하고, AccountSection 컴포넌트에 외부 링크 버튼을 추가한다.

**Tech Stack:** React, TypeScript, Vite PWA

---

### Task 1: 계정 변경 라우팅을 office Pylon 전용으로 수정

**Files:**
- Modify: `packages/client/src/services/relaySender.ts:440-446`

**Step 1: requestAccountSwitch 함수 수정**

`broadcast: 'pylons'`를 `to: [1]`로 변경:

```typescript
export function requestAccountSwitch(account: AccountType): boolean {
  return sendMessage({
    type: MessageType.ACCOUNT_SWITCH,
    payload: { account },
    to: [1],  // office Pylon 전용
  });
}
```

**Step 2: 변경 확인**

Run: `grep -A 6 "requestAccountSwitch" packages/client/src/services/relaySender.ts`
Expected: `to: [1]`이 포함된 출력

**Step 3: Commit**

```bash
git add packages/client/src/services/relaySender.ts
git commit -m "fix: 계정 변경을 office Pylon 전용으로 변경"
```

---

### Task 2: Hub 링크 버튼 추가

**Files:**
- Modify: `packages/client/src/components/settings/AccountSection.tsx:98-101`

**Step 1: Hub 링크 버튼 추가**

경고 메시지(`⚠️ 계정 변경 시...`) 아래에 버튼 추가:

```tsx
        <p className="text-xs text-muted-foreground text-center mt-2">
          ⚠️ 계정 변경 시 모든 세션이 재시작됩니다
        </p>

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3"
          onClick={() => window.open('http://5.223.72.58:8080/hub', '_blank')}
        >
          🌐 Hub 열기
        </Button>
```

**Step 2: 빌드 확인**

Run: `cd packages/client && pnpm build`
Expected: 빌드 성공

**Step 3: Commit**

```bash
git add packages/client/src/components/settings/AccountSection.tsx
git commit -m "feat: 설정창에 Hub 링크 버튼 추가"
```

---

## 완료 조건

- [ ] 계정 변경이 `to: [1]`로 전송됨
- [ ] Hub 버튼 클릭 시 외부 브라우저로 `http://5.223.72.58:8080/hub` 열림
- [ ] 빌드 성공
