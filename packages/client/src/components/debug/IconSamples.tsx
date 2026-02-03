import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text, useTheme, Surface } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * 헤더용 아이콘 샘플 페이지
 */
export function IconSamples() {
  const theme = useTheme();

  const IconBox = ({
    name,
    label,
    description,
  }: {
    name: string;
    label: string;
    description?: string;
  }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
      }}
    >
      <Icon name={name} size={24} color={theme.colors.onSurface} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
          {label}
        </Text>
        <Text variant="bodySmall" style={{ opacity: 0.6 }}>
          {name}
        </Text>
        {description && (
          <Text variant="bodySmall" style={{ opacity: 0.8, marginTop: 2 }}>
            {description}
          </Text>
        )}
      </View>
    </View>
  );

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <Surface
      style={{
        marginBottom: 16,
        borderRadius: 12,
        backgroundColor: theme.colors.elevation.level1,
      }}
      elevation={0}
    >
      <Text
        variant="titleSmall"
        style={{
          padding: 12,
          paddingBottom: 4,
          fontWeight: 'bold',
          color: theme.colors.primary,
        }}
      >
        {title}
      </Text>
      {children}
    </Surface>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text variant="headlineSmall" style={{ marginBottom: 16 }}>
        Header Icon Options
      </Text>

      <Section title="Relay 연결 안됨 (Offline)">
        <IconBox name="cloud-off-outline" label="cloud-off-outline" />
        <IconBox name="wifi-off" label="wifi-off" />
        <IconBox name="connection" label="connection" />
        <IconBox name="lan-disconnect" label="lan-disconnect" />
        <IconBox name="signal-off" label="signal-off" />
        <IconBox name="access-point-off" label="access-point-off" />
      </Section>

      <Section title="Relay 연결 O, Pylon 없음">
        <IconBox name="monitor-off" label="monitor-off" />
        <IconBox name="desktop-classic-off" label="desktop-classic-off" />
        <IconBox name="close-circle-outline" label="close-circle-outline" />
        <IconBox name="minus-circle-outline" label="minus-circle-outline" />
        <IconBox name="cancel" label="cancel" />
        <IconBox name="server-off" label="server-off" />
      </Section>

      <Section title="Pylon 연결됨 (기본 아이콘)">
        <IconBox name="monitor" label="monitor" description="기본값 추천" />
        <IconBox name="desktop-classic" label="desktop-classic" />
        <IconBox name="desktop-tower-monitor" label="desktop-tower-monitor" />
        <IconBox name="laptop" label="laptop" />
        <IconBox name="server" label="server" />
        <IconBox name="cube-outline" label="cube-outline" />
      </Section>

      <Section title="설정 버튼">
        <IconBox name="cog" label="cog" description="현재 사용 중" />
        <IconBox name="cog-outline" label="cog-outline" />
        <IconBox name="dots-vertical" label="dots-vertical" />
        <IconBox name="menu" label="menu" />
        <IconBox name="tune" label="tune" />
      </Section>

      <Section title="Pylon 개별 아이콘 - Home">
        <IconBox name="home" label="home" />
        <IconBox name="home-outline" label="home-outline" />
        <IconBox name="home-variant" label="home-variant" />
        <IconBox name="home-variant-outline" label="home-variant-outline" />
        <IconBox name="home-city" label="home-city" />
        <IconBox name="laptop" label="laptop" description="노트북" />
      </Section>

      <Section title="Pylon 개별 아이콘 - Office">
        <IconBox name="office-building" label="office-building" />
        <IconBox name="office-building-outline" label="office-building-outline" />
        <IconBox name="domain" label="domain" />
        <IconBox name="city" label="city" />
        <IconBox name="briefcase" label="briefcase" />
        <IconBox name="briefcase-outline" label="briefcase-outline" />
        <IconBox name="desktop-tower-monitor" label="desktop-tower-monitor" />
      </Section>

      <Section title="조합 예시 (헤더 미리보기)">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            gap: 8,
          }}
        >
          <Text variant="titleMedium" style={{ fontWeight: '600' }}>
            Estelle
          </Text>
          <Text variant="labelSmall" style={{ opacity: 0.5 }}>
            v2.0.0
          </Text>
          <View style={{ flex: 1 }} />
          <Text variant="bodySmall" style={{ opacity: 0.6 }}>
            Offline:
          </Text>
          <Icon
            name="cloud-off-outline"
            size={20}
            color={theme.colors.error}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            gap: 8,
          }}
        >
          <Text variant="titleMedium" style={{ fontWeight: '600' }}>
            Estelle
          </Text>
          <Text variant="labelSmall" style={{ opacity: 0.5 }}>
            v2.0.0
          </Text>
          <View style={{ flex: 1 }} />
          <Text variant="bodySmall" style={{ opacity: 0.6 }}>
            No Pylon:
          </Text>
          <Icon
            name="monitor-off"
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
          <Icon name="cog-outline" size={20} color={theme.colors.onSurface} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            gap: 8,
          }}
        >
          <Text variant="titleMedium" style={{ fontWeight: '600' }}>
            Estelle
          </Text>
          <Text variant="labelSmall" style={{ opacity: 0.5 }}>
            v2.0.0
          </Text>
          <View style={{ flex: 1 }} />
          <Text variant="bodySmall" style={{ opacity: 0.6 }}>
            Connected:
          </Text>
          <Icon name="monitor" size={20} color={theme.colors.primary} />
          <Icon name="laptop" size={20} color={theme.colors.primary} />
          <Icon name="cog-outline" size={20} color={theme.colors.onSurface} />
        </View>
      </Section>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}
