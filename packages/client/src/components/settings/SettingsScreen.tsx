import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { ClaudeUsageCard } from './ClaudeUsageCard';
import { DeploySection } from './DeploySection';
import { AppUpdateSection } from './AppUpdateSection';

/**
 * 설정 화면 메인
 */
export function SettingsScreen() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <ClaudeUsageCard />
        <DeploySection />
        <AppUpdateSection />
      </ScrollView>
    </View>
  );
}

/**
 * 설정 화면 내용 (Dialog/Screen 공용)
 */
export function SettingsContent() {
  return (
    <View>
      <ClaudeUsageCard />
      <DeploySection />
      <AppUpdateSection />
    </View>
  );
}
