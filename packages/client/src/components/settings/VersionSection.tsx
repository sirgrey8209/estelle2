/**
 * @file VersionSection.tsx
 * @description 버전 정보 섹션
 *
 * Client, Relay, Pylon 버전 정보를 표시합니다.
 */

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useSettingsStore } from '../../stores';
import { requestVersions } from '../../services/relaySender';

/** Pylon deviceId별 메타 정보 (Relay의 DEVICES 상수와 동기화) */
const PYLON_META: Record<number, { icon: string; role: string }> = {
  1: { icon: '🏢', role: 'office' },
  2: { icon: '🏠', role: 'home' },
  3: { icon: '☁️', role: 'cloud' },
};

export function VersionSection() {
  const clientVersion = useSettingsStore((s) => s.clientVersion);
  const relayVersion = useSettingsStore((s) => s.relayVersion);
  const pylonVersions = useSettingsStore((s) => s.pylonVersions);

  // 컴포넌트 마운트 시 버전 정보 요청
  useEffect(() => {
    requestVersions();
  }, []);

  // Pylon 엔트리를 deviceId 기준으로 정렬
  const sortedPylons = Object.entries(pylonVersions)
    .map(([id, version]) => ({ id: Number(id), version }))
    .sort((a, b) => a.id - b.id);

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
            sortedPylons.map(({ id, version }) => {
              const meta = PYLON_META[id] ?? { icon: '🔌', role: 'unknown' };
              return (
                <div key={id} className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {meta.icon} {meta.role}
                  </span>
                  <span className="font-mono">{version}</span>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
