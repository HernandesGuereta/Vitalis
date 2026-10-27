import type { ExpoConfig, ConfigContext } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  return {
    ...config,
    name: 'Vitalis',
    slug: 'vitalis',
    ...(projectId ? { extra: { ...config.extra, eas: { projectId } } } : {}),
  };
};
