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
    <Card>
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

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3"
          onClick={() => window.open('http://5.223.72.58:8080/hub', '_blank')}
        >
          🌐 Hub 열기
        </Button>
      </CardContent>
    </Card>
  );
}
