import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useSettingsStore, DeployPhase, BuildTaskStatus } from '../../stores';
import { cn } from '../../lib/utils';

/**
 * 배포 상태 카드
 */
export function DeployStatusCard() {
  const { deployPhase, deployErrorMessage, buildTasks, versionInfo } =
    useSettingsStore();

  const getPhaseLabel = (phase: DeployPhase): string => {
    const labels: Record<DeployPhase, string> = {
      initial: 'Idle',
      building: 'Building...',
      buildReady: 'Build Ready',
      preparing: 'Preparing...',
      ready: 'Ready',
      deploying: 'Deploying...',
      error: 'Error',
    };
    return labels[phase];
  };

  const getPhaseColor = (phase: DeployPhase): string => {
    const colors: Record<DeployPhase, string> = {
      initial: 'text-muted-foreground',
      building: 'text-yellow-500',
      buildReady: 'text-blue-500',
      preparing: 'text-yellow-500',
      ready: 'text-green-500',
      deploying: 'text-primary',
      error: 'text-destructive',
    };
    return colors[phase];
  };

  const getTaskColor = (status: BuildTaskStatus): string => {
    const colors: Record<BuildTaskStatus, string> = {
      pending: 'bg-muted',
      building: 'bg-yellow-500',
      ready: 'bg-green-500',
      error: 'bg-destructive',
    };
    return colors[status];
  };

  return (
    <Card className="mb-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span>🚀</span>
          Deploy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn('text-sm', getPhaseColor(deployPhase))}>
          Status: {getPhaseLabel(deployPhase)}
        </p>

        {Object.keys(buildTasks).length > 0 && (
          <div className="mt-2 p-2 bg-muted rounded flex flex-wrap gap-2">
            {Object.entries(buildTasks).map(([task, status]) => (
              <div
                key={task}
                className={cn('w-4 h-4 rounded-full', getTaskColor(status))}
              />
            ))}
          </div>
        )}

        {versionInfo && (
          <p className="text-xs text-muted-foreground mt-2">
            v{versionInfo.version} ({versionInfo.commit})
          </p>
        )}

        {deployErrorMessage && (
          <div className="mt-2 p-2 bg-destructive/10 rounded">
            <p className="text-xs text-destructive">
              {deployErrorMessage}
            </p>
          </div>
        )}

        {(deployPhase === 'building' ||
          deployPhase === 'preparing' ||
          deployPhase === 'deploying') && (
          <div className="mt-3 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
