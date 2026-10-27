import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
async function nativeNotifications() {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    throw new Error(
      'Push requer um build próprio do Vitalis. No Expo Go, os avisos continuam disponíveis dentro do app.',
    );
  return import('expo-notifications');
}
export async function getPushToken(): Promise<string> {
  const notifications = await nativeNotifications();
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId)
    throw new Error(
      'O projeto Expo/EAS ainda precisa ser configurado para ativar push neste build.',
    );
  if (Platform.OS === 'android')
    await notifications.setNotificationChannelAsync('escassez', {
      name: 'Avisos de escassez',
      importance: notifications.AndroidImportance.DEFAULT,
    });
  let permission = await notifications.getPermissionsAsync();
  if (permission.status !== 'granted') permission = await notifications.requestPermissionsAsync();
  if (permission.status !== 'granted')
    throw new Error(
      'Notificações não autorizadas. Você pode permitir nas configurações do aparelho; os avisos continuam na área Alertas.',
    );
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  return (await notifications.getExpoPushTokenAsync({ projectId })).data;
}
export function watchPushOpen(onOpen: () => void) {
  let active = true,
    remove: (() => void) | undefined;
  void nativeNotifications()
    .then(async (n) => {
      const open = (response: Awaited<ReturnType<typeof n.getLastNotificationResponseAsync>>) => {
        if (active && response?.notification.request.content.data?.screen === 'alerts') {
          n.clearLastNotificationResponse();
          onOpen();
        }
      };
      const sub = n.addNotificationResponseReceivedListener(open);
      remove = () => sub.remove();
      if (!active) {
        remove();
        return;
      }
      open(await n.getLastNotificationResponseAsync());
    })
    .catch(() => {});
  return () => {
    active = false;
    remove?.();
  };
}
