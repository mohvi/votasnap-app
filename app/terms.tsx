import { router } from 'expo-router';
import { Linking, ScrollView, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

const rules = [
  ['Participação', 'Consulta o tema, o prazo, os critérios de participação e as condições do prémio de cada desafio antes de publicar. Não participes se essas informações não estiverem claras.'],
  ['Conteúdo', 'Publica apenas conteúdo que tens direito de utilizar. Não publiques conteúdo ilegal, exploração sexual, ameaças, assédio, discriminação, dados privados de terceiros ou spam.'],
  ['Votação', 'É permitido um voto por conta em cada desafio. Não votes na tua própria participação, não compres votos e não utilizes contas falsas para manipular resultados. Os votos deixam de ser aceites no encerramento.'],
  ['Moderação', 'Podes denunciar conteúdo e bloquear utilizadores no menu de uma publicação. Conteúdo que viole estas regras pode ser removido e contas podem ser suspensas. Para contestar uma decisão, contacta o suporte.'],
  ['Prémios', 'Os prémios e as respetivas condições devem constar das regras do desafio. Os resultados sujeitos a confirmação ou desempate não representam uma entrega de prémio. A Apple não patrocina nem participa nos concursos da VotaSnap.'],
  ['Conta e privacidade', 'Podes iniciar a eliminação da tua conta no perfil ou na página de eliminação de conta do site. Consulta a política de privacidade para conhecer o tratamento dos teus dados.'],
];

export default function TermsScreen() {
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
    <TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.primary, paddingVertical: 16 }}>Voltar</Text></TouchableOpacity>
    <ScrollView>
      <Text style={{ color: 'white', fontSize: 26, marginBottom: 24 }}>Termos de participação</Text>
      {rules.map(([title, text]) => <Text key={title} style={{ color: '#ddd', fontSize: 16, lineHeight: 24, marginBottom: 24 }}>
        <Text style={{ fontWeight: 'bold' }}>{title}{'\n'}</Text>{text}
      </Text>)}
      <TouchableOpacity onPress={() => Linking.openURL('https://votasnap.vercel.app/policy')}><Text style={{ color: colors.primary, marginBottom: 24 }}>Política de privacidade</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL('mailto:geral@votasnap.com')}><Text style={{ color: colors.primary, marginBottom: 24 }}>Contactar suporte</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
