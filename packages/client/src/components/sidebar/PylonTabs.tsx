import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useWorkspaceStore, useDeviceConfigStore } from '../../stores';
import { getDeviceIcon } from '../../utils/device-icons';

export type PylonTabValue = 'favorites' | number;

interface PylonTabsProps {
  selectedTab: PylonTabValue;
  onTabChange: (tab: PylonTabValue) => void;
  /** 즐겨찾기가 있는지 여부 */
  hasFavorites: boolean;
}

/**
 * Pylon별 탭 컴포넌트
 * - 즐겨찾기 탭 (⭐)
 * - 연결된 Pylon별 아이콘 탭
 */
export function PylonTabs({ selectedTab, onTabChange, hasFavorites }: PylonTabsProps) {
  const { connectedPylons } = useWorkspaceStore();
  const { getIcon, getName } = useDeviceConfigStore();

  const isFavoritesDisabled = !hasFavorites;
  const isFavoritesSelected = selectedTab === 'favorites';

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/30">
      {/* 즐겨찾기 탭 */}
      <button
        onClick={() => !isFavoritesDisabled && onTabChange('favorites')}
        disabled={isFavoritesDisabled}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
          isFavoritesDisabled
            ? 'text-muted-foreground/40 cursor-not-allowed'
            : isFavoritesSelected
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent text-muted-foreground hover:text-foreground'
        )}
        title={isFavoritesDisabled ? '즐겨찾기 없음' : '즐겨찾기'}
      >
        <Star className={cn('h-4 w-4', isFavoritesSelected && hasFavorites && 'fill-current')} />
      </button>

      {/* 구분선 */}
      {connectedPylons.length > 0 && (
        <div className="w-px h-5 bg-border mx-1" />
      )}

      {/* Pylon 탭들 */}
      {connectedPylons.map((pylon) => {
        const icon = getIcon(pylon.deviceId);
        const name = getName(pylon.deviceId);
        const IconComponent = getDeviceIcon(icon);
        const isSelected = selectedTab === pylon.deviceId;

        return (
          <button
            key={pylon.deviceId}
            onClick={() => onTabChange(pylon.deviceId)}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
            title={name}
          >
            <IconComponent className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
