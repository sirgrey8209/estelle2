/**
 * @file VersionSection.tsx
 * @description 버전 정보 섹션
 *
 * Client, Relay, Pylon 버전 정보를 표시합니다.
 * Pylon 1에서만 계정 전환 버튼을 제공합니다.
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useSettingsStore } from '../../stores';

export function VersionSection() {
  const clientVersion = useSettingsStore((s) => s.clientVersion);
  const relayVersion = useSettingsStore((s) => s.relayVersion);
  const pylonVersions = useSettingsStore((s) => s.pylonVersions);

  // Pylon 엔트리를 deviceId 기준으로 정렬
  const sortedPylons = Object.entries(pylonVersions)
    .map(([id, version]) => ({ id: Number(id), version }))
    .sort((a, b) => a.id - b.id);

  const handleAccountSwitch = () => {
    // 설정 다이얼로그 내 AccountSection으로 스크롤/포커스
    // 현재는 같은 설정 화면에 있으므로 스크롤만 해주면 됨
    const accountSection = document.querySelector('[data-section="account"]');
    if (accountSection) {
      accountSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span>📦</span>
          버전 정보
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 text-sm">
          {/* Client 버전 */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Client</span>
            <span className="font-mono">{clientVersion}</span>
          </div>

          {/* Relay 버전 */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Relay</span>
            <span className="font-mono">
              {relayVersion ?? '연결 중...'}
            </span>
          </div>

          {/* Pylon 버전들 */}
          {sortedPylons.length === 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pylon</span>
              <span className="text-muted-foreground">연결된 Pylon 없음</span>
            </div>
          ) : (
            sortedPylons.map(({ id, version }) => (
              <div key={id} className="flex items-center justify-between">
                <span className="text-muted-foreground">Pylon {id}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{version}</span>
                  {id === 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={handleAccountSwitch}
                    >
                      계정 전환
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
