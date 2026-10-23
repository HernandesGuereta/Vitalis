import { useEffect, useState } from 'react';
import { AccessibilityInfo, Linking, Text, View } from 'react-native';
import { useApp } from '../AppContext';
import { Icon } from '../components/Icon';
import {
  Body,
  Button,
  Card,
  Choice,
  Label,
  Link,
  Notice,
  Title,
  colors,
  s,
} from '../components/ui';
import { evaluateScreening, screeningQuestions, screeningSources } from '../data/screening';
import type { ScreeningAnswers } from '../data/screening';

export function ScreeningScreen({ onStepChange }: { onStepChange: () => void }) {
  const { go, root } = useApp();
  // Dados de saúde ficam somente neste componente e são descartados ao sair dele.
  const [answers, setAnswers] = useState<ScreeningAnswers>({});
  const [step, setStep] = useState<number | 'intro' | 'result'>('intro');
  const questions = screeningQuestions(answers);
  const question = typeof step === 'number' ? questions[step] : undefined;
  const result = evaluateScreening(answers);
  useEffect(() => {
    onStepChange();
    AccessibilityInfo.announceForAccessibility(
      question
        ? `Pergunta ${Number(step) + 1} de ${questions.length}. ${question.title}`
        : step === 'result'
          ? result.title
          : 'Pré-triagem no aplicativo. Orientação inicial para doar sangue.',
    );
  }, [step, question?.id, onStepChange]);
  const sources = (
    <Card>
      <Label>SAIBA MAIS</Label>
      {screeningSources.map((source) => (
        <Link
          key={source.url}
          title={source.label}
          onPress={() => void Linking.openURL(source.url)}
        />
      ))}
      <Body muted>Abre o site oficial no navegador. Referências conferidas em 22/10/2026.</Body>
    </Card>
  );
  if (step === 'intro')
    return (
      <>
        <Title subtitle="Uma orientação inicial, antes de sair de casa.">
          Pré-triagem no aplicativo
        </Title>
        <Card pink>
          <Icon name="shield" color={colors.accent} size={36} />
          <Text style={s.cardTitle}>Vamos entender como você está hoje?</Text>
          <Body>
            São 8 perguntas básicas, com uma pergunta extra conforme sua idade. Leva cerca de 2
            minutos.
          </Body>
          <Body>
            Ao terminar, você verá se há cuidados ou dúvidas para esclarecer antes de uma possível
            doação.
          </Body>
        </Card>
        <Notice>
          Este questionário não confirma aptidão para doar e não substitui a entrevista, os exames e
          a avaliação da equipe do hemocentro.
        </Notice>
        <Body muted>
          As respostas ficam somente nesta tela e são apagadas ao sair. Não são enviadas ao
          hemocentro nem salvas na sua conta. Use dados fictícios neste protótipo.
        </Body>
        <Button title="Começar pré-triagem" onPress={() => setStep(0)} />
        <Button secondary title="Voltar ao início" onPress={() => root('home')} />
        {sources}
      </>
    );
  if (step === 'result' && result.status !== 'incomplete')
    return (
      <>
        <Label>ORIENTAÇÃO INICIAL · HOJE</Label>
        <Title subtitle={result.description}>{result.title}</Title>
        <Notice warning={result.status !== 'no_flags'}>
          A decisão final sobre doar é sempre da equipe do hemocentro, após a triagem completa. Não
          há liberação de doação pelo aplicativo.
        </Notice>
        {result.reasons.length > 0 && (
          <Card>
            <Text style={s.cardTitle}>O que merece atenção</Text>
            {result.reasons.map((reason) => (
              <Body key={reason}>• {reason}</Body>
            ))}
          </Card>
        )}
        <Body>
          O resultado considera poucas perguntas e pode mudar com sua saúde e preparação. Refazer no
          dia da visita pode ajudar, mas não substitui a triagem.
        </Body>
        {result.status === 'no_flags' ? (
          <Button title="Agendar doação" onPress={() => go('schedule')} />
        ) : (
          <Button title="Ver unidades e orientações" onPress={() => root('units')} />
        )}
        <Button
          secondary
          title="Refazer pré-triagem"
          onPress={() => {
            setAnswers({});
            setStep(0);
          }}
        />
        <Button secondary title="Encerrar e apagar respostas" onPress={() => root('home')} />
        {sources}
      </>
    );
  if (!question || typeof step !== 'number') return null;
  const selected = answers[question.id];
  const hasAnswer = question.choices.some((choice) => choice.value === selected);
  const last = step === questions.length - 1;
  return (
    <>
      <Label>
        PRÉ-TRIAGEM · PERGUNTA {step + 1} DE {questions.length}
      </Label>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Progresso da pré-triagem"
        accessibilityValue={{ min: 0, max: questions.length, now: step + 1 }}
        style={{ height: 8, borderRadius: 8, backgroundColor: colors.border, overflow: 'hidden' }}
      >
        <View
          style={{
            height: 8,
            width: `${((step + 1) / questions.length) * 100}%`,
            backgroundColor: colors.accent,
          }}
        />
      </View>
      <Title subtitle={question.help}>{question.title}</Title>
      <View accessibilityRole="radiogroup" accessibilityLabel={question.title} style={{ gap: 12 }}>
        {question.choices.map((choice) => (
          <Choice
            key={choice.value}
            title={choice.label}
            selected={selected === choice.value}
            onPress={() =>
              setAnswers((current) =>
                question.id === 'age'
                  ? { age: choice.value }
                  : { ...current, [question.id]: choice.value },
              )
            }
          />
        ))}
      </View>
      <Button
        testID="screening-next"
        title={last ? 'Ver orientação inicial' : 'Continuar'}
        disabled={!hasAnswer}
        onPress={() => {
          if (hasAnswer && (!last || result.status !== 'incomplete'))
            setStep(last ? 'result' : step + 1);
        }}
      />
      {step > 0 && <Button secondary title="Pergunta anterior" onPress={() => setStep(step - 1)} />}
      <Link title="Sair e apagar respostas" onPress={() => root('home')} />
      <Body muted>
        Orientação inicial. Nenhuma resposta deste questionário será enviada ou salva.
      </Body>
    </>
  );
}
