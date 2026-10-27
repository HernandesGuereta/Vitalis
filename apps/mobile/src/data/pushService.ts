import { getPushToken } from './push';
import { sharedRequest } from './sharedApi';
import type { SharedSession } from './sharedApi';
import type { Profile, Preferences } from './model';
function preferences(profile: Profile, prefs: Preferences) {
  return {
    city: profile.city,
    bloodType: profile.bloodType === 'Não sei' ? null : profile.bloodType,
    ownType: prefs.ownType,
    otherTypes: prefs.otherTypes,
  };
}
export async function enablePush(session: SharedSession, profile: Profile, prefs: Preferences) {
  const token = await getPushToken();
  return sharedRequest<{ enabled: boolean; deliveryEnabled: boolean }>(
    session.url,
    '/v1/push/subscriptions',
    session.token,
    'POST',
    { token, ...preferences(profile, prefs), consent: true },
  );
}
export async function syncPushPreferences(
  session: SharedSession,
  profile: Profile,
  prefs: Preferences,
) {
  const state = await sharedRequest<{ enabled: boolean }>(
    session.url,
    '/v1/push/preferences',
    session.token,
  );
  if (state.enabled)
    await sharedRequest(
      session.url,
      '/v1/push/preferences',
      session.token,
      'PATCH',
      preferences(profile, prefs),
    );
}
