import { useColorScheme } from 'react-native';

/** Colour tokens from the prototype (:root and the dark override). */
const light = {
  bg: '#F2F7F3', card: '#FFFFFF', ink: '#16302A', mute: '#5A726C', line: '#D9E6DE', track: '#E3EDE7',
  leaf: '#1E8A5A', leafd: '#126B44', haldi: '#E89A0C', chilli: '#D63F2E', sky: '#2E78C7', plum: '#8A4BA8',
  leafSoft: '#DDF1E6', haldiSoft: '#FCEBC8', chilliSoft: '#FADBD6', skySoft: '#D9E8F8', plumSoft: '#EBDDF2',
  onLeaf: '#FFFFFF', white: '#FFFFFF',
};

export type Colors = typeof light;

const dark: Colors = {
  bg: '#0F1C18', card: '#17282A', ink: '#E6F2EC', mute: '#97ADA6', line: '#274238', track: '#233830',
  leaf: '#3FBF86', leafd: '#2FA06E', haldi: '#F5B73D', chilli: '#EF6A58', sky: '#5BA3E8', plum: '#BA8AD6',
  leafSoft: '#173528', haldiSoft: '#3A2D10', chilliSoft: '#3E1D19', skySoft: '#152B42', plumSoft: '#2D1D37',
  onLeaf: '#0F1C18', white: '#FFFFFF',
};

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const FONT = {
  medium: 'Baloo2_500Medium',
  semibold: 'Baloo2_600SemiBold',
  bold: 'Baloo2_700Bold',
  heavy: 'Baloo2_800ExtraBold',
} as const;

export type Weight = keyof typeof FONT;

export const RADIUS = { sm: 14, md: 18, lg: 22 };
