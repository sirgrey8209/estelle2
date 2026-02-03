import React, { useState } from 'react';
import { View, Linking, Platform } from 'react-native';
import { Card, Text, Button, IconButton, ProgressBar, useTheme } from 'react-native-paper';
import { useSettingsStore } from '../../stores';
import { semanticColors } from '../../theme';

const BUILD_INFO = {
  version: '0.0.1',
  commit: 'dev',
};

/**
 * 앱 업데이트 섹션
 */
export function AppUpdateSection() {
  const theme = useTheme();
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
    const isAndroid = Platform.OS === 'android';

    let url: string;
    if (isAndroid && versionInfo?.apkUrl) {
      url = versionInfo.apkUrl;
    } else if (Platform.OS === 'windows' && versionInfo?.exeUrl) {
      url = versionInfo.exeUrl;
    } else {
      url = 'https://github.com/sirgrey8209/estelle/releases/tag/deploy';
    }

    try {
      await Linking.openURL(url);
    } catch (e) {
      console.error('Failed to open URL:', e);
    }
  };

  return (
    <Card mode="outlined" style={{ marginBottom: 8 }}>
      <Card.Title
        title="App Update"
        titleVariant="titleSmall"
        left={() => (
          <Text style={{ fontSize: 16 }}>
            {hasUpdate ? '🔄' : '✅'}
          </Text>
        )}
        right={() => (
          <IconButton
            icon="refresh"
            size={18}
            onPress={handleCheckVersion}
            loading={isLoading}
          />
        )}
      />
      <Card.Content>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="labelSmall" style={{ opacity: 0.6 }}>배포</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                {versionInfo?.version ?? '-'}
              </Text>
              {versionInfo?.commit && (
                <Text variant="labelSmall" style={{ marginLeft: 4, opacity: 0.6 }}>
                  ({versionInfo.commit})
                </Text>
              )}
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text variant="labelSmall" style={{ opacity: 0.6 }}>앱</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                {BUILD_INFO.version}
              </Text>
              <Text variant="labelSmall" style={{ marginLeft: 4, opacity: 0.6 }}>
                ({BUILD_INFO.commit})
              </Text>
            </View>
          </View>
        </View>

        {isDownloading && (
          <View style={{ marginBottom: 12 }}>
            <ProgressBar
              progress={downloadProgress}
              color={theme.colors.primary}
              style={{ height: 4, borderRadius: 2 }}
            />
            <Text variant="labelSmall" style={{ textAlign: 'right', marginTop: 4, opacity: 0.6 }}>
              {Math.round(downloadProgress * 100)}%
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          {!isDownloading && hasUpdate && (
            <Text variant="labelSmall" style={{ color: semanticColors.warning, marginRight: 8 }}>
              새 버전 있음
            </Text>
          )}
          {!isDownloading && !hasUpdate && versionInfo?.version && (
            <Text variant="labelSmall" style={{ color: semanticColors.success, marginRight: 8 }}>
              최신 버전
            </Text>
          )}

          <Button
            mode="contained"
            onPress={handleUpdate}
            disabled={isLoading || isDownloading}
            loading={isDownloading}
            buttonColor={hasUpdate ? semanticColors.warning : undefined}
            compact
            icon={Platform.OS === 'android' ? 'cellphone' : 'laptop'}
          >
            업데이트
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}
