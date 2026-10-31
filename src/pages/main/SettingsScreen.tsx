import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Trash2, ChevronLeft, MessageCircle, Gift } from 'lucide-react-native';
import { useLanguage, useLogout, useDeleteAccount } from '../../shared/lib/hooks';
import { useNavigation } from '@react-navigation/native';
import { AirplaneBackground } from '../../shared/ui/AirplaneBackground';
import { wp, hp, fontSize, sizes } from '../../shared/lib/responsive';
import {
  getLocalNotificationPreferences,
  setNotificationPreference,
} from '../../shared/lib/notifications/pushService';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
  },
  backButton: {
    padding: wp(4),
  },
  headerTitle: {
    fontSize: fontSize(20),
    fontWeight: '700',
    color: '#1E293B',
  },
  content: {
    paddingHorizontal: wp(16),
    paddingTop: hp(24),
    gap: hp(12),
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: hp(14),
    borderRadius: wp(16),
    gap: wp(10),
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  logoutButtonText: {
    fontSize: fontSize(16),
    fontWeight: '600',
    color: '#0EA5E9',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: hp(14),
    borderRadius: wp(16),
    gap: wp(10),
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    fontSize: fontSize(16),
    fontWeight: '600',
    color: '#EF4444',
  },
  notifCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(16),
    paddingHorizontal: wp(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(14),
    gap: wp(12),
  },
  notifIcon: {
    width: wp(36),
    height: wp(36),
    borderRadius: wp(10),
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifLabel: {
    flex: 1,
    fontSize: fontSize(15),
    fontWeight: '600',
    color: '#1E293B',
  },
  notifDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.6)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const SettingsScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const logoutMutation = useLogout();
  const deleteAccountMutation = useDeleteAccount();

  const [chatNotifEnabled, setChatNotifEnabled] = useState(true);
  const [jackpotNotifEnabled, setJackpotNotifEnabled] = useState(true);

  useEffect(() => {
    getLocalNotificationPreferences().then((prefs) => {
      setChatNotifEnabled(prefs.chatEnabled);
      setJackpotNotifEnabled(prefs.jackpotEnabled);
    });
  }, []);

  const toggleChatNotif = (value: boolean) => {
    setChatNotifEnabled(value); // optimistic — feels instant, syncs to server in the background
    void setNotificationPreference('chatEnabled', value);
  };

  const toggleJackpotNotif = (value: boolean) => {
    setJackpotNotifEnabled(value);
    void setNotificationPreference('jackpotEnabled', value);
  };

  const handleLogout = () => {
    Alert.alert(t.common.logout, t.common.logoutConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.logout,
        style: 'destructive',
        onPress: async () => {
          try {
            await logoutMutation.mutateAsync();
          } catch (error: any) {
            const detail = [error?.message, error?.requestUrl].filter(Boolean).join(' — ');
            Alert.alert(t.common.error, detail || t.common.logoutFailed);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t.common.deleteAccount, t.common.deleteAccountConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: () => {
          // Двойное подтверждение
          Alert.alert(
            t.common.deleteAccount,
            t.common.deleteAccountConfirm,
            [
              { text: t.common.cancel, style: 'cancel' },
              {
                text: t.common.delete,
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteAccountMutation.mutateAsync();
                    Alert.alert(t.common.success, t.common.deleteAccountSuccess);
                  } catch (error: any) {
                    const detail = [error?.message, error?.requestUrl].filter(Boolean).join(' — ');
                    Alert.alert(t.common.error, detail || t.common.deleteAccountFailed);
                  }
                },
              },
            ],
          );
        },
      },
    ]);
  };

  const isLoading = logoutMutation.isPending || deleteAccountMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AirplaneBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={wp(28)} color="#1E293B" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.common.settings}</Text>
        <View style={{ width: wp(28) }} />
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      )}

      <View style={styles.content}>
        {/* Notification preferences */}
        <View style={styles.notifCard}>
          <View style={styles.notifRow}>
            <View style={styles.notifIcon}>
              <MessageCircle size={sizes.iconSM} color="#0EA5E9" strokeWidth={2} />
            </View>
            <Text style={styles.notifLabel}>
              {t.common.chatNotifications || 'Уведомления от чата'}
            </Text>
            <Switch
              value={chatNotifEnabled}
              onValueChange={toggleChatNotif}
              trackColor={{ false: '#E2E8F0', true: '#0EA5E9' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.notifDivider} />
          <View style={styles.notifRow}>
            <View style={styles.notifIcon}>
              <Gift size={sizes.iconSM} color="#0EA5E9" strokeWidth={2} />
            </View>
            <Text style={styles.notifLabel}>
              {t.common.jackpotNotifications || 'Уведомления от Колеса удачи'}
            </Text>
            <Switch
              value={jackpotNotifEnabled}
              onValueChange={toggleJackpotNotif}
              trackColor={{ false: '#E2E8F0', true: '#0EA5E9' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleLogout}
          style={styles.logoutButton}
          disabled={isLoading}>
          <LogOut size={sizes.iconSM} color="#0EA5E9" strokeWidth={2.5} />
          <Text style={styles.logoutButtonText}>{t.common.logout}</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleDeleteAccount}
          style={styles.deleteButton}
          disabled={isLoading}>
          <Trash2 size={sizes.iconSM} color="#EF4444" strokeWidth={2.5} />
          <Text style={styles.deleteButtonText}>{t.common.deleteAccount}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
