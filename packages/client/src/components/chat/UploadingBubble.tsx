import React from 'react';
import { View, Image } from 'react-native';
import { Surface, Text, ProgressBar, useTheme } from 'react-native-paper';
import { useUploadStore, useImageUploadStore } from '../../stores';
import { imageCache } from '../../services/imageCacheService';
import { semanticColors } from '../../theme';

interface UploadingBubbleProps {
  blobId: string;
  /** 같이 전송한 메시지 */
  message?: string;
}

/**
 * 업로드 중 버블 (v1 Flutter UploadingImageBubble 대응)
 * - 이미지 미리보기
 * - 진행률 바
 * - 상태별 색상 (업로드/완료/실패)
 * - 같이 전송한 메시지 표시
 */
export function UploadingBubble({ blobId, message }: UploadingBubbleProps) {
  const theme = useTheme();
  const { uploads, getProgress } = useUploadStore();
  const upload = uploads[blobId];
  const progress = getProgress(blobId);

  // 이미지 미리보기용 로컬 URI 가져오기
  const { attachedImages } = useImageUploadStore();
  const attachedImage = attachedImages.find((img) => img.id === blobId);

  if (!upload) return null;

  const isCompleted = upload.status === 'completed';
  const isFailed = upload.status === 'failed';
  const isUploading = upload.status === 'uploading';

  // 테두리 색상
  const borderColor = isFailed
    ? theme.colors.error
    : isCompleted
    ? semanticColors.success
    : theme.colors.primary;

  return (
    <View style={{ marginVertical: 4, maxWidth: '90%' }}>
      <Surface
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 4,
          borderLeftWidth: 2,
          borderLeftColor: borderColor,
        }}
        elevation={1}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* 이미지 미리보기 */}
          <ImagePreview uri={attachedImage?.uri} filename={upload.filename} />

          {/* 정보 영역 */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            {/* 파일명 */}
            <Text
              variant="labelSmall"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {upload.filename}
            </Text>

            {/* 상태 텍스트 */}
            <View style={{ marginTop: 4 }}>
              {isFailed && (
                <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                  업로드 실패
                </Text>
              )}
              {isCompleted && (
                <Text variant="labelSmall" style={{ color: semanticColors.success }}>
                  업로드 완료
                </Text>
              )}
              {isUploading && (
                <Text variant="labelSmall" style={{ opacity: 0.6 }}>
                  업로드 중... {progress}%
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* 진행률 바 (업로드 중일 때만) */}
        {isUploading && (
          <View style={{ marginTop: 8 }}>
            <ProgressBar
              progress={progress / 100}
              color={theme.colors.primary}
              style={{ height: 4, borderRadius: 2 }}
            />
          </View>
        )}

        {/* 같이 보낸 메시지 */}
        {message && message.trim().length > 0 && (
          <Text variant="bodySmall" style={{ marginTop: 8, lineHeight: 20 }}>
            {message}
          </Text>
        )}
      </Surface>
    </View>
  );
}

/**
 * 이미지 미리보기
 */
function ImagePreview({ uri, filename }: { uri?: string; filename: string }) {
  const theme = useTheme();
  // 캐시에서 이미지 확인
  const cachedData = imageCache.get(filename);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: 64, height: 64, borderRadius: 4 }}
        resizeMode="cover"
      />
    );
  }

  if (cachedData) {
    // Uint8Array를 base64로 변환
    const base64 = Buffer.from(cachedData).toString('base64');
    const mimeType = getMimeType(filename);
    return (
      <Image
        source={{ uri: `data:${mimeType};base64,${base64}` }}
        style={{ width: 64, height: 64, borderRadius: 4 }}
        resizeMode="cover"
      />
    );
  }

  // 플레이스홀더
  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 4,
        backgroundColor: theme.colors.surfaceVariant,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
      }}
    >
      <Text style={{ fontSize: 20 }}>📷</Text>
    </View>
  );
}

/**
 * 파일명에서 MIME 타입 추출
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}
