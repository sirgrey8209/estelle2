import { AccountSection } from './AccountSection';

/**
 * 설정 화면 메인
 */
export function SettingsScreen() {
  return (
    <div className="flex-1 bg-background">
      <div className="h-full overflow-y-auto p-4">
        <AccountSection />
      </div>
    </div>
  );
}

/**
 * 설정 화면 내용 (Dialog/Screen 공용)
 */
export function SettingsContent() {
  return (
    <div className="space-y-4">
      <AccountSection />
    </div>
  );
}
