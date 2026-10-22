import Svg, { Circle, Path, Rect } from 'react-native-svg';
export type IconName =
  | 'home'
  | 'pin'
  | 'heart'
  | 'bell'
  | 'user'
  | 'chevron'
  | 'back'
  | 'calendar'
  | 'check'
  | 'info'
  | 'drop'
  | 'shield'
  | 'refresh'
  | 'link'
  | 'settings';
export function Icon({
  name,
  size = 24,
  color = '#796d76',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <Path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" />,
    pin: (
      <>
        <Path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
        <Circle cx="12" cy="10" r="2.5" />
      </>
    ),
    heart: (
      <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    ),
    bell: (
      <>
        <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    user: (
      <>
        <Circle cx="12" cy="7" r="4" />
        <Path d="M4 22v-3a8 8 0 0 1 16 0v3" />
      </>
    ),
    chevron: <Path d="m9 5 7 7-7 7" />,
    back: <Path d="m14 5-7 7 7 7M7 12h14" />,
    calendar: (
      <>
        <Rect x="3" y="5" width="18" height="16" rx="2" />
        <Path d="M7 3v4m10-4v4M3 11h18M7 15h2m6 0h2" />
      </>
    ),
    check: <Path d="m5 12 4 4L19 6" />,
    info: (
      <>
        <Circle cx="12" cy="12" r="9" />
        <Path d="M12 11v6m0-10v.1" />
      </>
    ),
    drop: <Path d="M12 3s-6.5 7.1-6.5 11.3a6.5 6.5 0 0 0 13 0C18.5 10.1 12 3 12 3Z" />,
    shield: (
      <>
        <Path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Z" />
        <Path d="m8 12 3 3 5-6" />
      </>
    ),
    refresh: <Path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" />,
    link: (
      <Path d="m10 13 4-4m-6 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" />
    ),
    settings: (
      <>
        <Circle cx="12" cy="12" r="8" />
        <Circle cx="12" cy="12" r="3" />
        <Path d="M12 1v3m0 16v3M1 12h3m16 0h3" />
      </>
    ),
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {paths[name]}
    </Svg>
  );
}
