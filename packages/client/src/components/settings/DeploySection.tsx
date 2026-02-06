import { useState } from 'react';
import { ChevronUp, ChevronDown, Rocket, RefreshCw, Check, X, Cloud, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { useSettingsStore, useWorkspaceStore, DeployPhase, BuildTaskStatus } from '../../stores';
import { cn } from '../../lib/utils';

/**
 * 배포 섹션 (컴팩트)
 */
export function DeploySection() {
  const {
    deployPhase,
    deployErrorMessage,
    deployLogs,
    buildTasks,
    selectedPylonId,
    versionInfo,
    setSelectedPylonId,
    setDeployPhase,
    addDeployLog,
    resetDeploy,
  } = useSettingsStore();

  const { connectedPylons } = useWorkspaceStore();
  const [logExpanded, setLogExpanded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const pylons = connectedPylons.map((p) => ({
    pcId: String(p.deviceId),
    pcName: p.deviceName,
  }));

  const getBorderColor = (phase: DeployPhase): string => {
    switch (phase) {
      case 'building':
      case 'preparing':
      case 'deploying':
        return 'border-green-500';
      case 'error':
        return 'border-destructive';
      default:
        return 'border-border';
    }
  };

  const getStatusIcon = (phase: DeployPhase) => {
    switch (phase) {
      case 'initial':
        return <Rocket className="h-4 w-4" />;
      case 'building':
      case 'preparing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'buildReady':
      case 'ready':
        return <Check className="h-4 w-4" />;
      case 'deploying':
        return <Cloud className="h-4 w-4" />;
      case 'error':
        return <X className="h-4 w-4" />;
      default:
        return <Rocket className="h-4 w-4" />;
    }
  };

  const getStatusText = (): string => {
    if (deployPhase === 'initial') return 'Ready to deploy';
    if (deployErrorMessage) return deployErrorMessage;
    if (versionInfo && (deployPhase === 'buildReady' || deployPhase === 'ready')) {
      return `${deployPhase === 'ready' ? 'Ready' : 'Build complete'} (${versionInfo.commit})`;
    }
    return deployPhase;
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

  const handleStartBuild = () => {
    if (!selectedPylonId) return;
    setDeployPhase('building');
    addDeployLog('▶ Build started');
  };

  const handleToggleConfirm = () => {
    setConfirmed(!confirmed);
  };

  const handleExecuteDeploy = () => {
    setDeployPhase('deploying');
    addDeployLog('▶ Deploy started');
  };

  const renderActionButton = () => {
    switch (deployPhase) {
      case 'initial':
        return (
          <Button
            size="sm"
            onClick={handleStartBuild}
            disabled={!selectedPylonId}
          >
            Deploy
          </Button>
        );

      case 'building':
      case 'buildReady':
        return (
          <Button
            size="sm"
            onClick={handleToggleConfirm}
            variant={confirmed ? 'outline' : 'default'}
            className={confirmed ? 'border-yellow-500 text-yellow-500' : ''}
          >
            {confirmed ? '취소' : deployPhase === 'building' ? '미리승인' : '승인'}
          </Button>
        );

      case 'ready':
        return (
          <Button
            size="sm"
            onClick={handleExecuteDeploy}
            className="bg-green-500 hover:bg-green-600"
          >
            GO
          </Button>
        );

      case 'error':
        return (
          <Button
            size="sm"
            onClick={() => {
              resetDeploy();
              handleStartBuild();
            }}
            className="bg-yellow-500 hover:bg-yellow-600"
          >
            재시도
          </Button>
        );

      case 'preparing':
      case 'deploying':
        return (
          <Loader2 className="h-4 w-4 animate-spin" />
        );

      default:
        return null;
    }
  };

  return (
    <Card
      className={cn(
        'mb-2 border-2 cursor-pointer transition-colors',
        getBorderColor(deployPhase)
      )}
      onClick={() => setLogExpanded(!logExpanded)}
    >
      <CardContent className="p-3">
        <div className="flex items-center mb-2">
          <div className="flex-1 flex flex-wrap gap-1">
            {pylons.length === 0 ? (
              <span className="text-xs text-muted-foreground">Pylon 없음</span>
            ) : (
              pylons.map((pylon) => (
                <button
                  key={pylon.pcId}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deployPhase === 'initial' || deployPhase === 'error') {
                      setSelectedPylonId(pylon.pcId);
                    }
                  }}
                  className={cn(
                    'px-2 py-0.5 text-xs rounded-full border transition-colors',
                    selectedPylonId === pylon.pcId
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary'
                  )}
                >
                  🖥️ {pylon.pcName}
                </button>
              ))
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            {renderActionButton()}
          </div>
        </div>

        <div className="flex items-center">
          <span className={cn(
            deployPhase === 'error' ? 'text-destructive' : 'text-foreground'
          )}>
            {getStatusIcon(deployPhase)}
          </span>
          <span
            className={cn(
              'flex-1 ml-2 text-xs truncate',
              deployPhase === 'error' ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {getStatusText()}
          </span>

          {Object.keys(buildTasks).length > 0 && (
            <div className="flex gap-0.5 ml-2">
              {Object.entries(buildTasks).map(([task, status]) => (
                <div
                  key={task}
                  className={cn('w-1.5 h-1.5 rounded-full', getTaskColor(status))}
                />
              ))}
            </div>
          )}

          {logExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
          )}
        </div>
      </CardContent>

      {logExpanded && (
        <div
          className="h-[120px] bg-background rounded-b-lg border-t"
          onClick={(e) => e.stopPropagation()}
        >
          {deployLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs text-muted-foreground">로그가 없습니다</span>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-2">
              {deployLogs.map((line, index) => {
                const isError = line.startsWith('[ERR]');
                const isHeader = line.startsWith('▶');
                return (
                  <p
                    key={index}
                    className={cn(
                      'text-xs font-mono',
                      isError ? 'text-destructive' : isHeader ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {line}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
