import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from './src/AppContext';
import { Icon } from './src/components/Icon';
import type { IconName } from './src/components/Icon';
import { Logo, colors, s } from './src/components/ui';
import { fetchAlerts } from './src/data/api';
import { createMobileDemo, exampleAlerts, visibleAlerts } from './src/data/model';
import type { MobileAlert, MobileData } from './src/data/model';

import { authScreens, screenTab, tabLabels } from './src/navigation';
import type { Screen, Tab } from './src/navigation';
import { AccountScreen, AuthScreen } from './src/screens/AccountScreens';
import { MainScreen } from './src/screens/MainScreens';

import {
  SharedAgendaProvider,
  AppointmentScreen,
  PrivacyScreen,
  useSharedAgenda,
} from './src/SharedAgenda';

const tabs: { key: Tab; icon: IconName }[] = [
  { key: 'home', icon: 'home' },
  { key: 'units', icon: 'pin' },
  { key: 'donations', icon: 'calendar' },
  { key: 'alerts', icon: 'bell' },
  { key: 'account', icon: 'user' },
];
function freshData(): MobileData {
  const data = createMobileDemo();
  return { ...data, profile: { name: '', email: '', city: 'Ourinhos, SP', bloodType: 'Não sei' } };
}
function MobileApp() {
  const shared = useSharedAgenda();
  const { width, fontScale } = useWindowDimensions();
  const wrapTabs = Math.min(width, 600) < 360 || fontScale > 1.3;
  const [localData, setData] = useState<MobileData>(freshData);
  const data = {
    ...localData,
    profile: {
      ...localData.profile,
      name: shared.session?.user.name ?? '',
      email: shared.session?.user.email ?? '',
    },
  };
  const [history, setHistory] = useState<Screen[]>(['login']);
  const requestedScreen = history[history.length - 1]!;
  const screen =
    !shared.session && !authScreens.includes(requestedScreen)
      ? 'login'
      : shared.session && authScreens.includes(requestedScreen)
        ? 'home'
        : requestedScreen;
  const isAuth = authScreens.includes(screen);
  const [selectedAlert, setSelectedAlert] = useState<MobileAlert>();
  const [unitId, selectUnit] = useState('centro');
  const [refreshing, setRefreshing] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const requestActive = useRef(false);
  const connectionGeneration = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const root = (tab: Tab) => setHistory([tab]);
  const go = (next: Screen) => setHistory((h) => [...h, next]);
  useEffect(() => {
    setData((d) => ({ ...freshData(), apiUrl: shared.session?.url || d.apiUrl }));
    setHistory([shared.session ? 'home' : 'login']);
    setSelectedAlert(undefined);
  }, [shared.session?.user.id]);
  const refresh = useCallback(
    async (address = data.apiUrl) => {
      if (!address || requestActive.current) return false;
      const generation = connectionGeneration.current;
      requestActive.current = true;
      setRefreshing(true);
      try {
        const alerts = await fetchAlerts(address);
        if (generation !== connectionGeneration.current) return false;
        setData((d) => ({ ...d, remoteAlerts: alerts }));
        setConnectionMessage(
          `Conectado. ${alerts.length} aviso(s) na API. Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
        );
        return true;
      } catch {
        if (generation === connectionGeneration.current)
          setConnectionMessage(
            'Sem conexão com o desktop. Os últimos avisos continuam disponíveis. Confira o endereço, a API e a rede Wi-Fi.',
          );
        return false;
      } finally {
        requestActive.current = false;
        setRefreshing(false);
      }
    },
    [data.apiUrl, setData],
  );
  useEffect(() => {
    connectionGeneration.current++;
    setConnectionMessage('');
  }, [data.apiUrl]);
  useEffect(() => {
    if (isAuth || !data.apiUrl) return;
    void refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 20000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [isAuth, data.apiUrl, refresh]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    AccessibilityInfo.announceForAccessibility(
      isAuth ? 'Acesso ao Vitalis' : `${tabLabels[screenTab(screen)]}. Tela do Vitalis.`,
    );
  }, [screen, isAuth]);
  function back() {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (history.length > 1) {
        setHistory((h) => h.slice(0, -1));
        return true;
      }
      if (!isAuth && screen !== 'home') {
        setHistory(['home']);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [history.length, isAuth, screen]);
  const unread = visibleAlerts(
    [...data.remoteAlerts, ...exampleAlerts],
    data.profile,
    data.preferences,
  ).filter((a) => !data.readAlertIds.includes(a.id)).length;
  function openAlert(alert: MobileAlert) {
    setSelectedAlert(alert);
    setData((d) => ({
      ...d,
      readAlertIds: d.readAlertIds.includes(alert.id)
        ? d.readAlertIds
        : [...d.readAlertIds, alert.id],
    }));
    go('alert');
  }
  return (
    <AppContext.Provider
      value={{
        data,
        setData,
        go,
        root,
        selectedAlert,
        openAlert,
        unitId,
        selectUnit,
        refresh,
        refreshing,
        connectionMessage,
        logout: () => {
          shared.signOut();
          setHistory(['login']);
          setSelectedAlert(undefined);
        },
      }}
    >
      <SafeAreaView style={s.app} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="dark-content" />
        <View style={s.frame}>
          {!isAuth && (
            <View
              style={{
                backgroundColor: '#fff',
                paddingHorizontal: 20,
                paddingVertical: 12,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Logo />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name="pin" size={18} />
                  <Text
                    style={{ color: colors.muted, fontSize: 14, lineHeight: 22, flexShrink: 1 }}
                  >
                    {data.profile.city}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Alertas, ${unread} não lidos`}
                onPress={() => root('alerts')}
                style={{
                  minWidth: 48,
                  minHeight: 48,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Icon name="bell" size={26} color={colors.ink} />
                {unread > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      minWidth: 20,
                      paddingHorizontal: 4,
                      borderRadius: 12,
                      backgroundColor: colors.accent,
                    }}
                  >
                    <Text
                      style={{ color: '#fff', fontSize: 12, lineHeight: 20, textAlign: 'center' }}
                    >
                      {unread}
                    </Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Minha conta"
                onPress={() => root('account')}
                style={{
                  width: 48,
                  minHeight: 48,
                  borderRadius: 24,
                  backgroundColor: colors.pink,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="user" color={colors.accent} />
              </Pressable>
            </View>
          )}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              ref={scroll}
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              refreshControl={
                !isAuth && data.apiUrl ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void refresh()}
                    tintColor={colors.accent}
                  />
                ) : undefined
              }
            >
              {history.length > 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Voltar à tela anterior"
                  onPress={back}
                  style={{
                    minHeight: 48,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    alignSelf: 'flex-start',
                  }}
                >
                  <Icon name="back" color={colors.accent} />
                  <Text style={s.linkText}>Voltar</Text>
                </Pressable>
              )}
              {isAuth ? (
                <AuthScreen key={screen} screen={screen} />
              ) : (
                <>
                  {screen === 'schedule' && <AppointmentScreen />}
                  {screen === 'donations' && <AppointmentScreen mode="visits" />}
                  {screen === 'privacy' && <PrivacyScreen />}
                  <MainScreen key={`main-${screen}`} screen={screen} />
                  <AccountScreen key={`account-${screen}`} screen={screen} />
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
          {!isAuth && (
            <View
              accessibilityRole="tablist"
              style={{
                flexDirection: 'row',
                flexWrap: wrapTabs ? 'wrap' : 'nowrap',
                backgroundColor: '#fff',
                borderTopWidth: 1,
                borderColor: colors.border,
                paddingTop: 8,
                paddingBottom: 6,
              }}
            >
              {tabs.map((tab) => {
                const selected = screenTab(screen) === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${tabLabels[tab.key]}${tab.key === 'alerts' && unread ? `, ${unread} avisos não lidos` : ''}`}
                    onPress={() => root(tab.key)}
                    style={({ pressed }) => [
                      {
                        flex: wrapTabs ? undefined : 1,
                        flexBasis: wrapTabs ? '33.333%' : undefined,
                        flexGrow: 1,
                        minHeight: 62,
                        paddingVertical: 6,
                        paddingHorizontal: 2,
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 6,
                      },
                      pressed && s.pressed,
                    ]}
                  >
                    <Icon
                      name={tab.icon}
                      size={24}
                      color={selected ? colors.accent : colors.muted}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        lineHeight: 18,
                        fontWeight: selected ? '700' : '500',
                        color: selected ? colors.accent : colors.muted,
                        textAlign: 'center',
                        width: '100%',
                      }}
                    >
                      {tabLabels[tab.key]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </SafeAreaView>
    </AppContext.Provider>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <SharedAgendaProvider>
        <MobileApp />
      </SharedAgendaProvider>
    </SafeAreaProvider>
  );
}
