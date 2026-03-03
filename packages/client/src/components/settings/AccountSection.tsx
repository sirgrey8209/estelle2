import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useSettingsStore } from '../../stores';
import { requestAccountSwitch } from '../../services/relaySender';
import type { AccountType } from '@estelle/core';
import { cn } from '../../lib/utils';

/**
 * 계정 전환 섹션
 *
 * 회사(LineGames) / 개인(Personal) 계정 전환 UI를 제공합니다.
 * 계정 변경 시 모든 Claude SDK 세션이 재시작됩니다.
 */
export function AccountSection() {
  const currentAccount = useSettingsStore((s) => s.currentAccount);
  const subscriptionType = useSettingsStore((s) => s.subscriptionType);
  const isAccountSwitching = useSettingsStore((s) => s.isAccountSwitching);
  const setAccountSwitching = useSettingsStore((s) => s.setAccountSwitching);

  const handleSwitch = (account: AccountType) => {
    if (account === currentAccount || isAccountSwitching) return;

    setAccountSwitching(true);
    requestAccountSwitch(account);
  };

  const getSubscriptionLabel = (type: string | null) => {
    if (!type) return '';
    switch (type) {
      case 'team':
        return '(Team)';
      case 'max':
        return '(Max)';
      default:
        return `(${type})`;
    }
  };

  return (
    <Card data-section="account">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span>🔐</span>
          계정
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3">
          <Button
            variant={currentAccount === 'linegames' ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'flex-1',
              currentAccount === 'linegames' && 'bg-primary'
            )}
            onClick={() => handleSwitch('linegames')}
            disabled={isAccountSwitching}
          >
            {isAccountSwitching && currentAccount !== 'linegames' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            LineGames
          </Button>
          <Button
            variant={currentAccount === 'personal' ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'flex-1',
              currentAccount === 'personal' && 'bg-primary'
            )}
            onClick={() => handleSwitch('personal')}
            disabled={isAccountSwitching}
          >
            {isAccountSwitching && currentAccount !== 'personal' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            Personal
          </Button>
        </div>

        <div className="text-center">
          {currentAccount ? (
            <p className="text-sm text-muted-foreground">
              현재:{' '}
              <span className="font-medium text-foreground">
                {currentAccount === 'linegames' ? 'LineGames' : 'Personal'}
              </span>{' '}
              {getSubscriptionLabel(subscriptionType)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              계정 정보를 불러오는 중...
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          ⚠️ 계정 변경 시 모든 세션이 재시작됩니다
        </p>

        <div className="mt-3 border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2">프로젝트</p>
          <div className="space-y-1">
            {[
              { name: 'Neon Grid Defense', path: '/neon-grid-defense/' },
              { name: 'EB Navigation', path: '/eb-navigation/' },
              { name: 'Voxel Engine', path: '/voxel-engine/' },
            ].map((project) => (
              <button
                key={project.path}
                className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-accent text-left"
                onClick={() => {
                  const url = `https://estelle-hub.mooo.com${project.path}`;
                  if (/android/i.test(navigator.userAgent)) {
                    window.location.href = `intent://${url.replace('https://', '')}#Intent;scheme=https;package=com.sec.android.app.sbrowser;end`;
                  } else {
                    window.open(url, '_blank');
                  }
                }}
              >
                <span>{project.name}</span>
                <span className="text-muted-foreground">›</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
