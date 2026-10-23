import { useId } from 'react';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export const colors = {
  background: '#f8f7f6',
  paper: '#fff',
  ink: '#2b2028',
  muted: '#6e626b',
  accent: '#bb2043',
  burgundy: '#43182b',
  pink: '#fcecf0',
  border: '#e7dfe4',
  amber: '#805317',
};
export function Logo() {
  return (
    <Image
      source={require('../../assets/vitalis-logo.png')}
      style={{ width: 120, height: 40 }}
      resizeMode="contain"
      accessibilityLabel="Vitalis"
    />
  );
}
export function Title({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <View style={s.titleGroup}>
      <Text accessibilityRole="header" style={s.title}>
        {children}
      </Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
}
export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[s.body, muted && { color: colors.muted }]}>{children}</Text>;
}
export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
export function Card({ children, pink = false }: { children: ReactNode; pink?: boolean }) {
  return (
    <View style={[s.card, pink && { backgroundColor: colors.pink, borderColor: colors.pink }]}>
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      aria-disabled={disabled || busy}
      aria-busy={busy}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        pressed && s.pressed,
        (disabled || busy) && { opacity: 0.55 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.accent }]}>
        {busy ? 'Aguarde…' : title}
      </Text>
    </Pressable>
  );
}
export function Link({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.link, pressed && s.pressed]}
    >
      <Text style={s.linkText}>{title}</Text>
    </Pressable>
  );
}
export function Notice({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return (
    <View style={[s.notice, warning && { backgroundColor: '#fff4df' }]}>
      <Icon name="info" color={warning ? colors.amber : colors.accent} />
      <Text style={[s.noticeText, warning && { color: colors.amber }]}>{children}</Text>
    </View>
  );
}
export function ErrorText({ message, testID }: { message: string; testID?: string }) {
  return message ? (
    <Text
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={s.error}
    >
      {message}
    </Text>
  ) : null;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const id = useId();
  return (
    <View style={s.field}>
      <Text nativeID={id} style={s.fieldLabel}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={id}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 110, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}
export function Choice({
  title,
  selected,
  onPress,
  disabled = false,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.choice,
        selected && s.choiceSelected,
        pressed && s.pressed,
        disabled && { opacity: 0.55 },
      ]}
    >
      <Text style={[s.choiceText, selected && { color: colors.accent, fontWeight: '700' }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function RowAction({
  title,
  detail,
  icon,
  onPress,
}: {
  title: string;
  detail: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.rowAction, pressed && s.pressed]}
    >
      <Icon name={icon} color={colors.accent} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={s.cardTitle}>{title}</Text>
        <Body muted>{detail}</Body>
      </View>
      <Icon name="chevron" />
    </Pressable>
  );
}
export const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  content: { padding: 20, paddingBottom: 32, gap: 20, flexGrow: 1 },
  titleGroup: { gap: 10, marginTop: 4 },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.6,
  },
  subtitle: { fontSize: 17, lineHeight: 26, color: colors.muted },
  body: { fontSize: 16, lineHeight: 25, color: colors.ink },
  label: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 20,
    gap: 14,
  },
  cardTitle: { fontSize: 19, lineHeight: 27, color: colors.ink, fontWeight: '600' },
  button: {
    minHeight: 54,
    paddingVertical: 15,
    paddingHorizontal: 18,
    backgroundColor: colors.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  secondary: { backgroundColor: colors.pink },
  pressed: { opacity: 0.72 },
  link: { minHeight: 48, justifyContent: 'center', paddingVertical: 8 },
  linkText: { color: colors.accent, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  field: { gap: 9 },
  fieldLabel: { fontSize: 16, lineHeight: 24, color: colors.ink, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: '#fff',
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 17,
    lineHeight: 24,
    color: colors.ink,
  },
  notice: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: colors.pink,
    borderRadius: 16,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, color: colors.muted, fontSize: 15, lineHeight: 23 },
  error: {
    fontSize: 16,
    lineHeight: 24,
    color: '#a11937',
    backgroundColor: colors.pink,
    padding: 14,
    borderRadius: 12,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: {
    minWidth: 74,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  choiceSelected: {
    backgroundColor: colors.pink,
    borderColor: colors.accent,
    borderWidth: 2,
    padding: 12,
  },
  choiceText: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  rowAction: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
  },
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 21,
    lineHeight: 29,
    fontWeight: '600',
    color: colors.ink,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: colors.pink,
    borderRadius: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bigType: { fontSize: 52, lineHeight: 62, fontWeight: '700', color: colors.accent },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20 },
});
