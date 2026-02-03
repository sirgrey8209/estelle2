import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text, useTheme, Surface } from 'react-native-paper';

/**
 * Material Design 3 색상 팔레트 샘플 페이지
 */
export function ColorPalette() {
  const theme = useTheme();

  const ColorBox = ({
    name,
    color,
    textColor,
    description,
  }: {
    name: string;
    color: string;
    textColor?: string;
    description?: string;
  }) => (
    <View
      style={{
        backgroundColor: color,
        padding: 12,
        borderRadius: 8,
        marginBottom: 4,
      }}
    >
      <Text style={{ color: textColor || '#fff', fontWeight: '600' }}>
        {name}
      </Text>
      <Text style={{ color: textColor || '#fff', opacity: 0.7, fontSize: 11 }}>
        {color}
      </Text>
      {description && (
        <Text
          style={{
            color: textColor || '#fff',
            opacity: 0.9,
            fontSize: 12,
            marginTop: 4,
            fontStyle: 'italic',
          }}
        >
          → {description}
        </Text>
      )}
    </View>
  );

  const Section = ({
    title,
    description,
    children,
  }: {
    title: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <View style={{ marginBottom: 24 }}>
      <Text
        variant="titleMedium"
        style={{ marginBottom: 4, fontWeight: 'bold' }}
      >
        {title}
      </Text>
      {description && (
        <Text
          variant="bodySmall"
          style={{ marginBottom: 8, opacity: 0.7 }}
        >
          {description}
        </Text>
      )}
      {children}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text variant="headlineMedium" style={{ marginBottom: 8 }}>
        🎨 MD3 Color Palette
      </Text>
      <Text variant="bodyMedium" style={{ marginBottom: 24, opacity: 0.7 }}>
        Material Design 3 색상 시스템 - 각 색상의 용도와 현재 값
      </Text>

      <Section
        title="Primary"
        description="앱의 주요 브랜드 색상. 가장 눈에 띄는 요소에 사용"
      >
        <ColorBox
          name="primary"
          color={theme.colors.primary}
          textColor={theme.colors.onPrimary}
          description="FAB, 중요 버튼, 선택된 상태, 강조 요소"
        />
        <ColorBox
          name="onPrimary"
          color={theme.colors.onPrimary}
          textColor={theme.colors.primary}
          description="primary 위의 텍스트/아이콘"
        />
        <ColorBox
          name="primaryContainer"
          color={theme.colors.primaryContainer}
          textColor={theme.colors.onPrimaryContainer}
          description="덜 강조된 선택 상태, 칩, 토글 배경"
        />
        <ColorBox
          name="onPrimaryContainer"
          color={theme.colors.onPrimaryContainer}
          textColor={theme.colors.primaryContainer}
          description="primaryContainer 위의 텍스트/아이콘"
        />
      </Section>

      <Section
        title="Secondary"
        description="보조 강조 색상. Primary보다 덜 눈에 띄는 요소에 사용"
      >
        <ColorBox
          name="secondary"
          color={theme.colors.secondary}
          textColor={theme.colors.onSecondary}
          description="필터 칩, 보조 버튼"
        />
        <ColorBox
          name="onSecondary"
          color={theme.colors.onSecondary}
          textColor={theme.colors.secondary}
          description="secondary 위의 텍스트/아이콘"
        />
        <ColorBox
          name="secondaryContainer"
          color={theme.colors.secondaryContainer}
          textColor={theme.colors.onSecondaryContainer}
          description="입력 필드, 선택된 네비게이션 아이템"
        />
        <ColorBox
          name="onSecondaryContainer"
          color={theme.colors.onSecondaryContainer}
          textColor={theme.colors.secondaryContainer}
          description="secondaryContainer 위의 텍스트/아이콘"
        />
      </Section>

      <Section
        title="Tertiary"
        description="세 번째 강조 색상. 균형과 대비를 위해 사용"
      >
        <ColorBox
          name="tertiary"
          color={theme.colors.tertiary}
          textColor={theme.colors.onTertiary}
          description="특별한 강조, 보완적 요소"
        />
        <ColorBox
          name="onTertiary"
          color={theme.colors.onTertiary}
          textColor={theme.colors.tertiary}
          description="tertiary 위의 텍스트/아이콘"
        />
        <ColorBox
          name="tertiaryContainer"
          color={theme.colors.tertiaryContainer}
          textColor={theme.colors.onTertiaryContainer}
          description="입력 필드 포커스, 특수 상태"
        />
        <ColorBox
          name="onTertiaryContainer"
          color={theme.colors.onTertiaryContainer}
          textColor={theme.colors.tertiaryContainer}
          description="tertiaryContainer 위의 텍스트/아이콘"
        />
      </Section>

      <Section
        title="Surface & Background"
        description="앱의 기본 배경과 카드, 시트 등의 표면"
      >
        <ColorBox
          name="background"
          color={theme.colors.background}
          textColor={theme.colors.onBackground}
          description="앱 전체 배경"
        />
        <ColorBox
          name="surface"
          color={theme.colors.surface}
          textColor={theme.colors.onSurface}
          description="카드, 시트, 메뉴의 기본 배경"
        />
        <ColorBox
          name="surfaceVariant"
          color={theme.colors.surfaceVariant}
          textColor={theme.colors.onSurfaceVariant}
          description="구분이 필요한 영역, 입력 필드 배경"
        />
        <ColorBox
          name="surfaceDisabled"
          color={theme.colors.surfaceDisabled}
          textColor={theme.colors.onSurface}
          description="비활성화된 요소의 배경"
        />
      </Section>

      <Section
        title="Elevation Levels"
        description="다크모드에서 깊이를 표현. 높을수록 표면이 밝아짐"
      >
        <ColorBox
          name="elevation.level0"
          color={theme.colors.elevation.level0}
          textColor={theme.colors.onSurface}
          description="기본 배경, elevation 없음"
        />
        <ColorBox
          name="elevation.level1"
          color={theme.colors.elevation.level1}
          textColor={theme.colors.onSurface}
          description="Card, Drawer (낮은 elevation)"
        />
        <ColorBox
          name="elevation.level2"
          color={theme.colors.elevation.level2}
          textColor={theme.colors.onSurface}
          description="Autocomplete, Menu, 드롭다운"
        />
        <ColorBox
          name="elevation.level3"
          color={theme.colors.elevation.level3}
          textColor={theme.colors.onSurface}
          description="Navigation drawer, FAB (보통)"
        />
        <ColorBox
          name="elevation.level4"
          color={theme.colors.elevation.level4}
          textColor={theme.colors.onSurface}
          description="App bar (스크롤 시)"
        />
        <ColorBox
          name="elevation.level5"
          color={theme.colors.elevation.level5}
          textColor={theme.colors.onSurface}
          description="Modal, Dialog (최상위)"
        />
      </Section>

      <Section
        title="Error"
        description="오류 상태와 파괴적 액션 표시"
      >
        <ColorBox
          name="error"
          color={theme.colors.error}
          textColor={theme.colors.onError}
          description="오류 텍스트, 삭제 버튼"
        />
        <ColorBox
          name="errorContainer"
          color={theme.colors.errorContainer}
          textColor={theme.colors.onErrorContainer}
          description="오류 메시지 배경, 경고 배너"
        />
      </Section>

      <Section
        title="Outline & Others"
        description="테두리, 구분선, 반전 색상"
      >
        <ColorBox
          name="outline"
          color={theme.colors.outline}
          textColor="#fff"
          description="입력 필드 테두리, 버튼 외곽선"
        />
        <ColorBox
          name="outlineVariant"
          color={theme.colors.outlineVariant}
          textColor={theme.colors.onSurface}
          description="구분선, Divider"
        />
        <ColorBox
          name="inverseSurface"
          color={theme.colors.inverseSurface}
          textColor={theme.colors.inverseOnSurface}
          description="스낵바 배경 (반전 색상)"
        />
        <ColorBox
          name="inversePrimary"
          color={theme.colors.inversePrimary}
          textColor={theme.colors.primary}
          description="스낵바 액션 버튼 (반전 강조)"
        />
      </Section>

      <Section
        title="🔧 현재 사이드바 조합"
        description="워크스페이스 + 대화 선택 샘플"
      >
        <View style={{ gap: 8 }}>
          <Surface
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: theme.colors.elevation.level2,
            }}
          >
            <Text variant="titleSmall" style={{ marginBottom: 8 }}>
              워크스페이스 (elevation.level2)
            </Text>
            <View
              style={{
                backgroundColor: theme.colors.primary,
                padding: 12,
                borderRadius: 8,
                marginBottom: 4,
              }}
            >
              <Text style={{ color: theme.colors.onPrimary }}>
                ● 선택된 대화 (primary + onPrimary)
              </Text>
            </View>
            <View
              style={{
                backgroundColor: 'transparent',
                padding: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: theme.colors.onSurface }}>
                ● 선택 안된 대화 (transparent)
              </Text>
            </View>
          </Surface>

          <Text variant="bodySmall" style={{ opacity: 0.6, marginTop: 8 }}>
            대안 조합들:
          </Text>

          <Surface
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: theme.colors.elevation.level1,
            }}
          >
            <Text variant="titleSmall" style={{ marginBottom: 8 }}>
              워크스페이스 (elevation.level1)
            </Text>
            <View
              style={{
                backgroundColor: theme.colors.primaryContainer,
                padding: 12,
                borderRadius: 8,
                marginBottom: 4,
              }}
            >
              <Text style={{ color: theme.colors.onPrimaryContainer }}>
                ● 선택된 대화 (primaryContainer)
              </Text>
            </View>
            <View
              style={{
                backgroundColor: 'transparent',
                padding: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: theme.colors.onSurface }}>
                ● 선택 안된 대화
              </Text>
            </View>
          </Surface>

          <Surface
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: theme.colors.surfaceVariant,
            }}
          >
            <Text variant="titleSmall" style={{ marginBottom: 8 }}>
              워크스페이스 (surfaceVariant)
            </Text>
            <View
              style={{
                backgroundColor: theme.colors.secondaryContainer,
                padding: 12,
                borderRadius: 8,
                marginBottom: 4,
              }}
            >
              <Text style={{ color: theme.colors.onSecondaryContainer }}>
                ● 선택된 대화 (secondaryContainer)
              </Text>
            </View>
            <View
              style={{
                backgroundColor: 'transparent',
                padding: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: theme.colors.onSurface }}>
                ● 선택 안된 대화
              </Text>
            </View>
          </Surface>
        </View>
      </Section>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}
