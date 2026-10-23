import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MobileAlert, MobileData } from './data/model';
import type { Screen, Tab } from './navigation';
export interface MobileContext {
  data: MobileData;
  setData: Dispatch<SetStateAction<MobileData>>;
  go: (screen: Screen) => void;
  root: (tab: Tab) => void;
  openAlert: (alert: MobileAlert) => void;
  selectedAlert: MobileAlert | undefined;
  unitId: string;
  selectUnit: (id: string) => void;
  refresh: (address?: string) => Promise<boolean>;
  refreshing: boolean;
  connectionMessage: string;
  logout: () => void;
  scrollToTop: () => void;
}
export const AppContext = createContext<MobileContext | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('Aplicativo indisponível.');
  return value;
}
