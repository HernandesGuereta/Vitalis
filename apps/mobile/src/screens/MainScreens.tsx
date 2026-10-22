import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { useSharedAgenda } from '../SharedAgenda';
import { useApp } from '../AppContext';
import {
  Body,
  Button,
  Card,
  Choice,
  Label,
  Link,
  Notice,
  RowAction,
  Title,
  colors,
  s,
} from '../components/ui';
import { Icon } from '../components/Icon';
import { dateLabel, exampleAlerts, normalize, units, visibleAlerts } from '../data/model';
import type { MobileAlert } from '../data/model';
import type { Screen } from '../navigation';

function AlertCard({ alert }: { alert: MobileAlert }) {
  const { openAlert, data } = useApp();
  const unread = !data.readAlertIds.includes(alert.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Novo aviso. ' : ''}${alert.title}. Tipo ${alert.bloodType}. ${alert.region}`}
      onPress={() => openAlert(alert)}
      style={({ pressed }) => [s.card, pressed && s.pressed]}
    >
      <Label>
        {alert.level === 'critico'
          ? 'ESTOQUE CRÍTICO'
          : alert.level === 'baixo'
            ? 'ESTOQUE BAIXO'
            : 'AVISO DO HEMOCENTRO'}{' '}
        · {alert.bloodType}
        {unread ? ' · NOVO' : ''}
      </Label>
      <Text style={s.cardTitle}>{alert.title}</Text>
      <Body muted>{alert.message}</Body>
      <View style={s.sectionRow}>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22, flexShrink: 1 }}>
          {alert.id.startsWith('exemplo-')
            ? 'Exemplo ilustrativo'
            : new Date(alert.publishedAt).toLocaleString('pt-BR')}{' '}
          · {alert.region}
        </Text>
        <Icon name="chevron" color={colors.accent} />
      </View>
    </Pressable>
  );
}
export function MainScreen({ screen }: { screen: Screen }) {
  const app = useApp();
  const shared = useSharedAgenda();
  const { data, go, root } = app;
  const [onlyMine, setOnlyMine] = useState(false);
  const all = visibleAlerts(
    [...data.remoteAlerts, ...exampleAlerts],
    data.profile,
    data.preferences,
  );
  const alerts = onlyMine ? all.filter((a) => a.bloodType === data.profile.bloodType) : all;
  const unit = units.find((u) => u.id === app.unitId) ?? units[0]!;
  if (screen === 'home')
    return (
      <>
        <Title subtitle="Seu próximo gesto começa com uma visita.">
          Olá, {data.profile.name.split(' ')[0]}.
        </Title>
        <View
          style={[
            s.card,
            {
              backgroundColor: colors.burgundy,
              borderColor: colors.burgundy,
              padding: 24,
              gap: 20,
              borderRadius: 26,
            },
          ]}
        >
          <Icon name="calendar" color="#efbbc8" size={36} />
          <Text style={{ fontSize: 26, lineHeight: 34, fontWeight: '700', color: '#fff' }}>
            Vamos marcar sua pré-triagem?
          </Text>
          <Text style={{ fontSize: 17, lineHeight: 26, color: '#fff' }}>
            Escolha o hemocentro e um horário. Sua solicitação será enviada diretamente para a
            unidade.
          </Text>
          <Button title="Agendar pré-triagem" onPress={() => go('schedule')} />
        </View>
        <RowAction
          icon="calendar"
          title="Meus agendamentos"
          detail={
            shared.appointments.some((a) => a.status === 'booked')
              ? 'Acompanhe suas visitas marcadas'
              : 'Consulte suas solicitações e horários'
          }
          onPress={() => root('donations')}
        />
        <Notice>
          A pré-triagem e a avaliação para doar serão realizadas presencialmente pela equipe do
          hemocentro.
        </Notice>
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Sua região precisa de você</Text>
          <Link title="Ver todos" onPress={() => root('alerts')} />
        </View>
        {all.length ? (
          <AlertCard alert={all[0]!} />
        ) : (
          <Notice>Não há avisos para as suas preferências.</Notice>
        )}
        <Body muted>Unidades e horários fictícios para demonstração.</Body>
      </>
    );
  if (screen === 'alerts')
    return (
      <>
        <Title subtitle="Informação perto de você. Ajuda na hora certa.">Alertas da região</Title>
        <View style={s.badge}>
          <Body>{data.profile.city}</Body>
        </View>
        <View style={s.choices}>
          <Choice title="Todos os tipos" selected={!onlyMine} onPress={() => setOnlyMine(false)} />
          <Choice
            title={`Meu tipo · ${data.profile.bloodType}`}
            selected={onlyMine}
            onPress={() => setOnlyMine(true)}
          />
        </View>
        <Notice warning>
          Os avisos são demonstrativos. Mobilizações publicadas no desktop aparecem aqui
          automaticamente enquanto o aplicativo estiver conectado.
        </Notice>
        <Button
          secondary
          title="Atualizar avisos"
          busy={app.refreshing}
          onPress={() => void app.refresh()}
        />
        {app.connectionMessage ? (
          <Text accessibilityLiveRegion="polite" style={s.body}>
            {app.connectionMessage}
          </Text>
        ) : null}
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} />
        ))}
        {!alerts.length && (
          <Card>
            <Text style={s.cardTitle}>Tudo tranquilo por aqui.</Text>
            <Body muted>Nenhum aviso para o filtro e a cidade selecionados.</Body>
            <Link title="Rever minhas preferências" onPress={() => go('preferences')} />
          </Card>
        )}
        <Card>
          <Text style={s.cardTitle}>Entenda os níveis</Text>
          <Body>
            Crítico · prioridade de mobilização{'\n'}Baixo · necessidade de reposição{'\n'}Aviso ·
            mensagem publicada pelo hemocentro
          </Body>
        </Card>
        <Body muted>
          Atualização automática a cada 20 segundos com o aplicativo aberto e conectado. Os filtros
          consideram o tipo exato e a cidade, sem calcular compatibilidade clínica ou distância.
        </Body>
      </>
    );
  if (screen === 'alert') {
    const alert = app.selectedAlert;
    if (!alert) return <Notice>Selecione um aviso em Alertas.</Notice>;
    return (
      <>
        <Label>ALERTA DA REGIÃO</Label>
        <Title subtitle={`${alert.unitName} · ${alert.region}`}>{alert.title}</Title>
        <Card pink>
          <Text style={s.bigType}>{alert.bloodType}</Text>
          <Text style={s.cardTitle}>
            {alert.level === 'critico'
              ? 'Estoque crítico'
              : alert.level === 'baixo'
                ? 'Estoque baixo'
                : 'Mobilização de doadores'}
          </Text>
          <Body>{alert.message}</Body>
          <Body muted>
            {alert.id.startsWith('exemplo-')
              ? 'Atualização ilustrativa'
              : 'Publicado pelo desktop · demonstração'}
          </Body>
        </Card>
        <Notice>
          Seu tipo cadastrado é {data.profile.bloodType}. A equipe da unidade orienta sobre a doação
          e confirma sua aptidão presencialmente.
        </Notice>
        <Button title="Ver unidades de coleta" onPress={() => root('units')} />
        <Button secondary title="Agendar pré-triagem" onPress={() => go('schedule')} />
      </>
    );
  }
  if (screen === 'units')
    return (
      <>
        <Title subtitle="Encontre uma unidade e veja os próximos horários.">
          Onde seu gesto encontra uma vida.
        </Title>
        <Label>SUA REGIÃO</Label>
        <Body>{data.profile.city}</Body>
        {units
          .filter((u) => normalize(u.city) === normalize(data.profile.city))
          .map((u) => (
            <Pressable
              key={u.id}
              accessibilityRole="button"
              accessibilityLabel={`Ver ${u.name}`}
              onPress={() => {
                app.selectUnit(u.id);
                go('unit');
              }}
              style={({ pressed }) => [s.card, pressed && s.pressed]}
            >
              <Label>A {u.distance.toUpperCase()} · EXEMPLO</Label>
              <Icon name="pin" color={colors.accent} size={30} />
              <Text style={s.cardTitle}>{u.name}</Text>
              <Body muted>{u.area}</Body>
              <Body>Horários demonstrativos disponíveis</Body>
              <View style={s.sectionRow}>
                <Text style={s.linkText}>Ver unidade</Text>
                <Icon name="chevron" color={colors.accent} />
              </View>
            </Pressable>
          ))}
        {!units.some((u) => normalize(u.city) === normalize(data.profile.city)) && (
          <Notice>
            Os exemplos disponíveis ficam em Ourinhos, SP. Altere sua cidade em Conta → Meus dados
            para explorar essas unidades.
          </Notice>
        )}
        <Notice>
          Distâncias e horários ilustrativos. Nenhuma visita real é reservada neste protótipo.
        </Notice>
      </>
    );
  if (screen === 'unit')
    return (
      <>
        <Label>HEMOCENTRO · EXEMPLO</Label>
        <Title subtitle={`${unit.area} · a ${unit.distance}`}>{unit.name}</Title>
        <Card pink>
          <Icon name="pin" size={40} color={colors.accent} />
          <Text style={s.cardTitle}>Perto de você</Text>
          <Body>Atendimento com agendamento</Body>
        </Card>
        <Card>
          <Text style={s.cardTitle}>Próximos horários</Text>
          <Body>A partir de amanhã · das 9h às 10h</Body>
          <Text style={s.cardTitle}>Como funciona</Text>
          <Body muted>
            Escolha um horário e confirme sua visita. A solicitação é recebida pela unidade fictícia
            no desktop; a pré-triagem será realizada presencialmente.
          </Body>
        </Card>
        <Button title="Agendar pré-triagem" onPress={() => go('schedule')} />
        <Notice>A avaliação presencial é indispensável para confirmar sua aptidão.</Notice>
      </>
    );
  if (screen === 'account')
    return (
      <>
        <Title subtitle="Seu perfil, suas escolhas.">Minha conta</Title>
        <Card>
          <View
            style={{
              alignSelf: 'flex-start',
              borderRadius: 30,
              padding: 14,
              backgroundColor: colors.pink,
            }}
          >
            <Icon name="user" color={colors.accent} size={30} />
          </View>
          <Text style={s.cardTitle}>{data.profile.name}</Text>
          <Body muted>{data.profile.email}</Body>
          <Body>
            {data.profile.bloodType} · {data.profile.city}
          </Body>
        </Card>
        <RowAction
          title="Privacidade"
          detail="Consulte seus dados e controle sua conta"
          icon="shield"
          onPress={() => go('privacy')}
        />
        <RowAction
          title="Meus dados"
          detail="Nome, tipo sanguíneo e localização"
          icon="user"
          onPress={() => go('profile')}
        />
        <RowAction
          title="Preferências de alertas"
          detail="Escolha os avisos que quer acompanhar"
          icon="bell"
          onPress={() => go('preferences')}
        />
        <RowAction
          title="Guia da doação"
          detail="Conheça as etapas da sua visita"
          icon="heart"
          onPress={() => go('guide')}
        />
        <Notice>
          Você está em um protótipo com autenticação. Use somente dados fictícios nesta fase.
        </Notice>
        <Button secondary title="Sair da conta" onPress={app.logout} />
      </>
    );
  if (screen === 'guide')
    return (
      <>
        <Title subtitle="Conheça as etapas da sua doação.">
          Um gesto simples. Uma jornada de cuidado.
        </Title>
        {[
          [
            'Prepare sua visita',
            'Escolha o hemocentro e solicite um horário para a pré-triagem presencial.',
          ],
          [
            'Siga as orientações',
            'Confirme as informações e a disponibilidade diretamente com a equipe antes de ir.',
          ],
          [
            'Converse com a equipe',
            'A avaliação presencial confirma sua aptidão e esclarece suas dúvidas.',
          ],
          ['Continue essa conexão', 'Acompanhe seu histórico e as necessidades da sua região.'],
        ].map(([title, detail], i) => (
          <Card key={title}>
            <Label>0{i + 1}</Label>
            <Text style={s.cardTitle}>{title}</Text>
            <Body muted>{detail}</Body>
          </Card>
        ))}
        <Notice>
          Este guia explica a jornada do protótipo. Ele não substitui as orientações do hemocentro.
        </Notice>
      </>
    );
  return null;
}
