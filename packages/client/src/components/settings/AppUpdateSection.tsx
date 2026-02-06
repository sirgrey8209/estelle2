import { useState } from 'react';
import { RefreshCw, Monitor, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useSettingsStore } from '../../stores';
import { cn } from '../../lib/utils';

const BUILD_INFO = {
  version: '0.0.1',
  commit: 'dev',
};

/**
 * 앱 업데이트 섹션
 */
export function AppUpdateSection() {
  const { versionInfo } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const hasUpdate =
    versionInfo?.version != null && versionInfo.version !== BUILD_INFO.version;

  const handleCheckVersion = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  const handleUpdate = async () => {
    // Web에서는 항상 GitHub releases 페이지로 이동
    const url = 'https://github.com/sirgrey8209/estelle/releases/tag/deploy';

    try {
      window.open(url, '_blank');
    } catch (e) {
      console.error('Failed to open URL:', e);
    }
  };

  return (
    <Card className="mb-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span>{hasUpdate ? '🔄' : '✅'}</span>
            App Update
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCheckVersion}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex mb-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">배포</p>
            <div className="flex items-center mt-0.5">
              <span className="text-sm font-semibold">
                {versionInfo?.version ?? '-'}
              </span>
              {versionInfo?.commit && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({versionInfo.commit})
                </span>
              )}
            </div>
          </div>

          <div className="flex-1">
            <p className="text-xs text-muted-foreground">앱</p>
            <div className="flex items-center mt-0.5">
              <span className="text-sm font-semibold">
                {BUILD_INFO.version}
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                ({BUILD_INFO.commit})
              </span>
            </div>
          </div>
        </div>

        {isDownloading && (
          <div className="mb-3">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${downloadProgress * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right mt-1">
              {Math.round(downloadProgress * 100)}%
            </p>
          </div>
        )}

        <div className="flex items-center justify-end">
          {!isDownloading && hasUpdate && (
            <span className="text-xs text-yellow-500 mr-2">
              새 버전 있음
            </span>
          )}
          {!isDownloading && !hasUpdate && versionInfo?.version && (
            <span className="text-xs text-green-500 mr-2">
              최신 버전
            </span>
          )}

          <Button
            size="sm"
            onClick={handleUpdate}
            disabled={isLoading || isDownloading}
            className={cn(hasUpdate && 'bg-yellow-500 hover:bg-yellow-600')}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Monitor className="h-4 w-4 mr-1" />
            )}
            업데이트
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
