import { enablePush, syncPushPreferences } from '../data/pushService';
import { useEffect, useState } from 'react';
import { useSharedAgenda } from '../SharedAgenda';
import { ApiError, sharedRequest } from '../data/sharedApi';
import { Switch, Text, View } from 'react-native';
import { useApp } from '../AppContext';
import {
  Body,
  Button,
  Card,
  Choice,
  ErrorText,
  Field,
  Label,
  Link,
  Logo,
  Notice,
  Title,
  colors,
  s,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { bloodTypes, validateApiUrl, validateProfile } from '../data/model';
import type { Profile } from '../data/model';
import type { Screen } from '../navigation';

function BloodPicker({
  value,
  onChange,
}: {
  value: Profile['bloodType'];
  onChange: (type: Profile['bloodType']) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Body>Qual é seu tipo sanguíneo?</Body>
      <View style={s.choices} accessibilityLabel="Tipo sanguíneo">
        {bloodTypes.map((type) => (
          <Choice
            key={type}
            title={type}
            selected={type === value}
            onPress={() => onChange(type)}
          />
        ))}
      </View>
      <Body muted>Não sabe seu tipo? Tudo bem, você pode informar depois.</Body>
    </View>
  );
}
export function AuthScreen({ screen }: { screen: Screen }) {
  const { data, setData, go, root, scrollToTop } = useApp();
  const shared = useSharedAgenda();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [address, setAddress] = useState(
    data.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000',
  );
  const [connection, setConnection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (error) scrollToTop();
  }, [error, scrollToTop]);
  async function submit() {
    if (busy) return;
    if (screen === 'signup' && password !== repeat) {
      setError('As senhas precisam ser iguais.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const url = validateApiUrl(address);
      await shared.authenticate(url, email, password, screen === 'signup' ? name : undefined);
      setPassword('');
      setRepeat('');
      setData((d) => ({ ...d, apiUrl: url }));
      root('home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível acessar.');
    } finally {
      setBusy(false);
    }
  }
  if (screen === 'recover')
    return (
      <>
        <Logo />
        <Title subtitle="A recuperação por e-mail ainda não está disponível no protótipo. Nenhuma mensagem será enviada.">
          Recuperar acesso
        </Title>
        <Body>
          Para a conta de teste, consulte os dados de acesso definidos para a demonstração.
        </Body>
        <Button title="Voltar para entrar" onPress={() => go('login')} />
      </>
    );
  return (
    <>
      <Logo />
      {shared.sessionMessage && <Notice warning>{shared.sessionMessage}</Notice>}
      <ErrorText message={error} />
      <View style={{ height: 16 }} />
      <Title
        subtitle={
          screen === 'signup'
            ? 'Crie sua conta de doador para agendar sua visita ao hemocentro.'
            : 'Entre para acompanhar seus agendamentos e ajudar sua região.'
        }
      >
        {screen === 'signup' ? 'Vamos começar?' : 'Bom te ver de novo.'}
      </Title>
      {screen === 'signup' && (
        <Field
          label="Nome completo"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          maxLength={100}
        />
      )}
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        maxLength={120}
      />
      <Field
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={128}
        onSubmitEditing={() => {
          if (screen !== 'signup') void submit();
        }}
      />
      {screen === 'signup' && (
        <>
          <Body muted>
            Use de 12 a 128 caracteres. Não utilize uma senha de outro serviço nesta demonstração.
          </Body>
          <Field
            label="Confirmar senha"
            value={repeat}
            onChangeText={setRepeat}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={128}
          />
        </>
      )}
      <Button
        title={screen === 'signup' ? 'Criar minha conta' : 'Entrar'}
        busy={busy}
        onPress={() => void submit()}
      />
      {screen === 'signup' ? (
        <Link title="Já tenho uma conta" onPress={() => go('login')} />
      ) : (
        <>
          <Link
            title="Recuperar acesso · indisponível no protótipo"
            onPress={() => go('recover')}
          />
          <View style={[s.divider, { gap: 12 }]}>
            <Body muted>Ainda não tem uma conta?</Body>
            <Button secondary title="Criar minha conta" onPress={() => go('signup')} />
          </View>
        </>
      )}
      <Notice>
        Ambiente de protótipo. Use dados fictícios. O cadastro é somente de doadores; o hemocentro
        possui acesso próprio no desktop.
      </Notice>
      <Link
        title={connection ? 'Ocultar configuração de conexão' : 'Configurar conexão'}
        onPress={() => setConnection(!connection)}
      />
      {connection && (
        <Field
          label="Endereço da API"
          value={address}
          onChangeText={(value) => {
            setAddress(value);
            setData((data) => ({ ...data, apiUrl: value }));
          }}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={200}
        />
      )}
    </>
  );
}
export function AccountScreen({ screen }: { screen: Screen }) {
  const shared = useSharedAgenda();
  const [busy, setBusy] = useState(false);
  const { data, setData, go, root } = useApp();
  const [profile, setProfile] = useState(data.profile);
  const [prefs, setPrefs] = useState(data.preferences);
  const [error, setError] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  if (screen === 'profile')
    return (
      <>
        <Title subtitle="Mantenha seus dados atualizados para receber avisos relevantes.">
          Do seu jeito.
        </Title>
        <Field
          label="Nome completo"
          value={profile.name}
          onChangeText={(name) => setProfile({ ...profile, name })}
          maxLength={100}
        />
        <Field
          label="E-mail da conta"
          value={profile.email}
          editable={false}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={120}
        />
        <Field
          label="Cidade / UF"
          value={profile.city}
          onChangeText={(city) => setProfile({ ...profile, city })}
          maxLength={100}
        />
        <BloodPicker
          value={profile.bloodType}
          onChange={(bloodType) => setProfile({ ...profile, bloodType })}
        />
        <ErrorText message={error} />
        <Button
          title="Salvar alterações"
          busy={busy}
          onPress={() => {
            void (async () => {
              if (busy || !shared.session) return;
              setBusy(true);
              try {
                const valid = validateProfile(profile);
                const result = await sharedRequest<{
                  user: typeof shared.session.user;
                }>(shared.session.url, '/v1/me', shared.session.token, 'PATCH', {
                  name: valid.name,
                });
                await syncPushPreferences(shared.session, valid, data.preferences);
                shared.setSession({ ...shared.session, user: result.user });
                setData((d) => ({ ...d, profile: valid }));
                go('saved');
              } catch (e) {
                if (e instanceof ApiError && e.status === 401)
                  shared.signOut('Sua sessão expirou. Entre novamente para continuar.');
                setError(e instanceof Error ? e.message : 'Revise os dados.');
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      </>
    );
  if (screen === 'preferences')
    return (
      <>
        <Title subtitle="Personalize os avisos exibidos dentro do aplicativo.">
          Só o que faz sentido para você.
        </Title>
        <Card>
          <Label>REGIÃO DE INTERESSE</Label>
          <Body>{data.profile.city}</Body>
          <Link title="Alterar cidade" onPress={() => go('profile')} />
        </Card>
        {(
          [
            {
              key: 'ownType',
              title: 'Alertas do meu tipo',
              detail: `Necessidades para ${data.profile.bloodType}`,
            },
            {
              key: 'otherTypes',
              title: 'Outros tipos na região',
              detail: 'Acompanhar mobilizações locais',
            },
          ] as const
        ).map((option) => (
          <View
            key={option.key}
            style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{option.title}</Text>
              <Body muted>{option.detail}</Body>
            </View>
            <Switch
              accessibilityLabel={option.title}
              value={prefs[option.key]}
              onValueChange={(value) => setPrefs({ ...prefs, [option.key]: value })}
              trackColor={{ false: '#b7afb4', true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        ))}
        <Notice>
          Os avisos de escassez são gerados automaticamente. E-mail e WhatsApp não estão
          disponíveis. Push requer build próprio, credenciais e sua autorização.
        </Notice>
        <Card>
          <Text style={s.cardTitle}>Receber com o app fechado</Text>
          <Body>
            Ao ativar, seu aparelho, cidade e tipo sanguíneo informado serão usados para selecionar
            os avisos. A notificação na tela bloqueada não mostra seu tipo. Você pode desativar
            quando quiser.
          </Body>
          <ErrorText message={error} />
          {pushMessage && <Notice>{pushMessage}</Notice>}
          <Button
            title="Ativar notificações no aparelho"
            busy={busy}
            onPress={() =>
              void (async () => {
                if (!shared.session || busy) return;
                setBusy(true);
                setError('');
                setPushMessage('');
                try {
                  const state = await enablePush(shared.session, data.profile, prefs);
                  setData((d) => ({ ...d, preferences: prefs }));
                  setPushMessage(
                    state.deliveryEnabled
                      ? 'Aparelho registrado. O recebimento depende das permissões do sistema e da conexão.'
                      : 'Aparelho registrado, mas o envio push ainda não foi ativado no servidor. Os avisos continuam disponíveis dentro do app.',
                  );
                } catch (e) {
                  if (e instanceof ApiError && e.status === 401)
                    shared.signOut('Sua sessão expirou. Entre novamente para continuar.');
                  setError(e instanceof Error ? e.message : 'Não foi possível ativar.');
                } finally {
                  setBusy(false);
                }
              })()
            }
          />
          <Button
            secondary
            title="Desativar notificações da conta"
            busy={busy}
            onPress={() =>
              void (async () => {
                if (!shared.session || busy) return;
                setBusy(true);
                setError('');
                try {
                  await sharedRequest(
                    shared.session.url,
                    '/v1/push/subscriptions',
                    shared.session.token,
                    'DELETE',
                  );
                  setPushMessage('Notificações desativadas para esta conta em todos os aparelhos.');
                } catch (e) {
                  if (e instanceof ApiError && e.status === 401)
                    shared.signOut('Sua sessão expirou. Entre novamente para continuar.');
                  setError(e instanceof Error ? e.message : 'Não foi possível desativar.');
                } finally {
                  setBusy(false);
                }
              })()
            }
          />
        </Card>
        <Button
          title="Salvar preferências"
          busy={busy}
          onPress={() =>
            void (async () => {
              if (busy || !shared.session) return;
              setBusy(true);
              setError('');
              try {
                await syncPushPreferences(shared.session, data.profile, prefs);
                setData((d) => ({ ...d, preferences: prefs }));
                go('saved');
              } catch (e) {
                if (e instanceof ApiError && e.status === 401)
                  shared.signOut('Sua sessão expirou. Entre novamente para continuar.');
                setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
              } finally {
                setBusy(false);
              }
            })()
          }
        />
      </>
    );
  if (screen === 'saved')
    return (
      <>
        <View style={{ paddingVertical: 24 }}>
          <Icon name="check" size={64} color={colors.accent} />
        </View>
        <Title subtitle="Suas alterações foram aplicadas. O nome fica na conta; as preferências de push também são atualizadas quando você autoriza notificações.">
          Tudo atualizado.
        </Title>
        <Button title="Voltar à minha conta" onPress={() => root('account')} />
      </>
    );
  return null;
}
