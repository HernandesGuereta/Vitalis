import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { createMobileDemo, restoreMobile } from './model';
import type { MobileData } from './model';

const key = 'vitalis.mobile.demo.v1';
export function useMobileData() {
  const [data, setData] = useState<MobileData>(createMobileDemo);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (mounted && raw) setData(restoreMobile(raw));
      })
      .catch(() => {
        if (mounted)
          setStorageError(
            'Não foi possível recuperar os dados locais. Abrimos os exemplos iniciais.',
          );
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    void AsyncStorage.setItem(key, JSON.stringify(data)).catch(() =>
      setStorageError(
        'Não foi possível salvar neste aparelho. Suas alterações durarão apenas nesta sessão.',
      ),
    );
  }, [data, ready]);
  return { data, setData, ready, storageError };
}
