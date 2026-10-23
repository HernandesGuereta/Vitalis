export type Tab = 'home' | 'units' | 'donations' | 'alerts' | 'account';
export type Screen =
  | Tab
  | 'login'
  | 'signup'
  | 'recover'
  | 'alert'
  | 'unit'
  | 'schedule'
  | 'screening'
  | 'profile'
  | 'preferences'
  | 'saved'
  | 'guide'
  | 'privacy';
export const tabLabels: Record<Tab, string> = {
  home: 'Início',
  units: 'Onde doar',
  donations: 'Agenda',
  alerts: 'Alertas',
  account: 'Conta',
};
export const authScreens: Screen[] = ['login', 'signup', 'recover'];
export function screenTab(screen: Screen): Tab {
  if (['alerts', 'alert'].includes(screen)) return 'alerts';
  if (['account', 'profile', 'preferences', 'saved', 'guide', 'privacy'].includes(screen))
    return 'account';
  if (['donations', 'schedule'].includes(screen)) return 'donations';
  if (['units', 'unit'].includes(screen)) return 'units';
  return 'home';
}
