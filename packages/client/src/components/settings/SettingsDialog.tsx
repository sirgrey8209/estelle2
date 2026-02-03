import React from 'react';
import { ScrollView } from 'react-native';
import { Portal, Dialog, IconButton } from 'react-native-paper';
import { SettingsContent } from './SettingsScreen';

interface SettingsDialogProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Desktop용 설정 다이얼로그
 */
export function SettingsDialog({ visible, onClose }: SettingsDialogProps) {
  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onClose}
        style={{ maxWidth: 420, alignSelf: 'center', maxHeight: '80%' }}
      >
        <Dialog.Title style={{ paddingRight: 48 }}>
          Settings
          <IconButton
            icon="close"
            size={20}
            onPress={onClose}
            style={{ position: 'absolute', right: 8, top: 8 }}
          />
        </Dialog.Title>
        <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <SettingsContent />
          </ScrollView>
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}
