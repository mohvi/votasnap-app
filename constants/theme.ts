// Design tokens do VotaSnap. Usar estes valores em vez de cores/tamanhos soltos.

export const colors = {
  // Superfícies (do mais escuro ao mais claro)
  background: '#0D0D0D',
  surfaceSunken: '#111111',
  surface: '#1A1A1A',
  surfaceRaised: '#222222',
  border: '#2A2A2A',
  borderStrong: '#333333',

  // Texto — todos com contraste ≥ 4.5:1 sobre `background`
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textMuted: '#8A8A8A',
  textSubtle: '#7A7A7A',

  // Marca
  primary: '#FF286A',
  primaryEnd: '#FF8C5A',

  // Estado
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',

  // Pódio
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  bronzeDark: '#A0522D',
} as const;

export const gradients = {
  primary: [colors.primary, colors.primaryEnd],
  // Categorias de desafio
  paid: ['#7C3AED', '#A855F7'],
  free: ['#0F766E', '#14B8A6'],
  bronze: [colors.bronze, colors.bronzeDark],
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  display: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
