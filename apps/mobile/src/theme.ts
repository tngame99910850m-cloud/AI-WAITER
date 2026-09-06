// Design system: premium, modern, restaurant-focused. Colors are overridable
// per-restaurant via branding (primary/accent).

export const palette = {
  bg: '#0B1220',
  surface: '#111A2E',
  surfaceAlt: '#16223B',
  border: '#22304F',
  text: '#F4F7FF',
  textMuted: '#9AA7C7',
  primary: '#E8552B',
  primaryText: '#FFFFFF',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  star: '#FBBF24',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 30, fontWeight: '800' as const, color: palette.text },
  h2: { fontSize: 22, fontWeight: '700' as const, color: palette.text },
  h3: { fontSize: 17, fontWeight: '700' as const, color: palette.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: palette.text },
  muted: { fontSize: 13, fontWeight: '400' as const, color: palette.textMuted },
  price: { fontSize: 16, fontWeight: '800' as const, color: palette.text },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
};

/** Format integer minor units as a display price, e.g. 2200 -> "22.00 QAR". */
export function formatMoney(m: { amount: number; currency: string }, digits = 2): string {
  return `${(m.amount / 10 ** digits).toFixed(digits)} ${m.currency}`;
}
