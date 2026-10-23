// Orientação inicial, sem diagnóstico, pontuação de aptidão ou persistência de respostas.
// Fontes e limites: docs/pre-triagem-digital.md. Revisão: 2026-10-22.
export type ScreeningQuestionId =
  | 'age'
  | 'guardian'
  | 'previousBefore60'
  | 'weight'
  | 'well'
  | 'prepared'
  | 'alcohol'
  | 'care'
  | 'pregnancy'
  | 'lastDonation';
export type ScreeningAnswers = Partial<Record<ScreeningQuestionId, string>>;
type Question = {
  id: ScreeningQuestionId;
  title: string;
  help: string;
  choices: { value: string; label: string }[];
};
const unknown = { value: 'unknown', label: 'Não sei / prefiro não responder' };
const yesNo = [{ value: 'yes', label: 'Sim' }, { value: 'no', label: 'Não' }, unknown];
const baseQuestions: Question[] = [
  {
    id: 'age',
    title: 'Qual é sua faixa de idade?',
    help: 'Não precisamos da sua data de nascimento.',
    choices: [
      { value: 'under16', label: 'Menos de 16 anos' },
      { value: 'teen', label: '16 ou 17 anos' },
      { value: 'adult', label: '18 a 59 anos' },
      { value: 'senior', label: '60 a 69 anos' },
      { value: 'older', label: '70 anos ou mais' },
      unknown,
    ],
  },
  {
    id: 'weight',
    title: 'Você pesa 50 kg ou mais?',
    help: 'Basta escolher uma opção. Não precisamos do seu peso exato.',
    choices: yesNo,
  },
  {
    id: 'well',
    title: 'Você está se sentindo bem, sem febre ou infecção recente?',
    help: 'Considere também gripe, resfriado e outros sintomas recentes.',
    choices: yesNo,
  },
  {
    id: 'prepared',
    title: 'Você está alimentado e dormiu pelo menos 6 horas nas últimas 24 horas?',
    help: 'Marque Sim somente se as duas condições forem verdadeiras hoje.',
    choices: yesNo,
  },
  {
    id: 'alcohol',
    title: 'Você consumiu bebida alcoólica nas últimas 12 horas?',
    help: 'Pense no período anterior ao momento em que está respondendo.',
    choices: yesNo,
  },
  {
    id: 'care',
    title: 'Usa medicamento, está em tratamento ou passou por algum cuidado recente?',
    help: 'Por exemplo: vacina, cirurgia, endoscopia, tatuagem ou piercing. Não informe detalhes aqui.',
    choices: yesNo,
  },
  {
    id: 'pregnancy',
    title: 'Está grávida, amamentando ou teve parto nos últimos 12 meses?',
    help: 'Essas situações têm orientações diferentes. A equipe pode esclarecer seu caso.',
    choices: [...yesNo.slice(0, 2), { value: 'not_applicable', label: 'Não se aplica' }, unknown],
  },
  {
    id: 'lastDonation',
    title: 'Quando foi sua última doação de sangue?',
    help: 'Os intervalos e o limite anual devem ser confirmados com a equipe.',
    choices: [
      { value: 'never', label: 'Nunca doei' },
      { value: 'recent', label: 'Há menos de 90 dias' },
      { value: 'over90', label: 'Há 90 dias ou mais' },
      unknown,
    ],
  },
];
export function screeningQuestions(answers: ScreeningAnswers): Question[] {
  const questions = [...baseQuestions];
  if (answers.age === 'teen')
    questions.splice(1, 0, {
      id: 'guardian',
      title: 'Você tem autorização do seu responsável legal para doar?',
      help: 'A unidade orientará sobre os documentos e o acompanhamento necessário.',
      choices: yesNo,
    });
  if (answers.age === 'senior')
    questions.splice(1, 0, {
      id: 'previousBefore60',
      title: 'Você já doou sangue antes de completar 60 anos?',
      help: 'Essa informação precisa ser conferida na triagem da unidade.',
      choices: yesNo,
    });
  return questions;
}
export type ScreeningResult = {
  status: 'incomplete' | 'not_now' | 'guidance' | 'no_flags';
  title: string;
  description: string;
  reasons: string[];
};
export function evaluateScreening(answers: ScreeningAnswers): ScreeningResult {
  if (
    screeningQuestions(answers).some(
      (question) => !question.choices.some((choice) => choice.value === answers[question.id]),
    )
  )
    return {
      status: 'incomplete',
      title: 'Ainda faltam respostas',
      description: 'Escolha uma opção em cada pergunta. Você pode preferir não responder.',
      reasons: [],
    };
  const postpone: string[] = [];
  const guidance: string[] = [];
  if (answers.age === 'under16') postpone.push('A idade mínima para doar sangue é 16 anos.');
  if (answers.weight === 'no') postpone.push('O peso mínimo para doar sangue é 50 kg.');
  if (answers.well === 'no')
    postpone.push('Aguarde sua recuperação e confirme com o hemocentro o prazo após os sintomas.');
  if (answers.prepared === 'no')
    postpone.push('Antes de doar, alimente-se e descanse. Evite comparecer em jejum.');
  if (answers.alcohol === 'yes')
    postpone.push('A doação exige pelo menos 12 horas sem ingestão de bebida alcoólica.');
  if (answers.age === 'teen')
    guidance.push(
      'Aos 16 ou 17 anos, confirme com a unidade a autorização e os documentos do responsável.',
    );
  if (answers.age === 'senior' && answers.previousBefore60 !== 'yes')
    guidance.push('Dos 60 aos 69 anos, é necessário verificar se houve doação antes dos 60 anos.');
  if (answers.age === 'older')
    guidance.push(
      'A partir dos 70 anos, doadores regulares precisam de avaliação médica específica no serviço.',
    );
  if (answers.care === 'yes')
    guidance.push(
      'Medicamentos, vacinas e procedimentos precisam de avaliação individual. Não suspenda seu tratamento para doar.',
    );
  if (answers.pregnancy === 'yes')
    guidance.push(
      'Gravidez, pós-parto e amamentação têm prazos próprios. Confirme sua situação com a equipe.',
    );
  if (answers.lastDonation === 'recent')
    guidance.push(
      'Uma doação há menos de 90 dias precisa ter seu intervalo conferido. Isso não significa impedimento em todos os casos.',
    );
  if (screeningQuestions(answers).some((question) => answers[question.id] === 'unknown'))
    guidance.push(
      'Algumas informações não foram respondidas com certeza. Esclareça essas dúvidas com o hemocentro.',
    );
  if (postpone.length)
    return {
      status: 'not_now',
      title: 'Melhor adiar por enquanto',
      description:
        'Suas respostas indicam cuidados antes de uma possível doação. Confira os motivos abaixo.',
      reasons: [...postpone, ...guidance],
    };
  if (guidance.length)
    return {
      status: 'guidance',
      title: 'Converse com o hemocentro antes',
      description:
        'Algumas respostas precisam ser esclarecidas pela equipe antes de você se deslocar.',
      reasons: guidance,
    };
  return {
    status: 'no_flags',
    title: 'Nenhum alerta inicial nas respostas',
    description:
      'Você pode considerar uma visita para doar. Este questionário curto não confirma que você está apto: outros critérios serão avaliados pela equipe.',
    reasons: [],
  };
}
export const screeningSources = [
  {
    label: 'Requisitos do Ministério da Saúde',
    url: 'https://www.gov.br/saude/pt-br/composicao/saes/doacao-de-sangue/doacao-de-sangue/',
  },
  { label: 'Orientações da Hemoba', url: 'https://www.ba.gov.br/hemoba/doacao-de-sangue' },
];
