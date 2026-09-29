import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
  focused?: boolean;
}

// Home icon - house shape like mockup
export const IconHome = ({ color, size = 24, focused }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15V15H9V21H4C3.44772 21 3 20.5523 3 20V10.5Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? color : 'none'}
    />
  </Svg>
);

// Akademik icon - clipboard/document with lines
export const IconAkademik = ({ color, size = 24, focused }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="3" width="14" height="18" rx="2" stroke={color} strokeWidth={2} fill={focused ? color : 'none'} />
    <Rect x="8" y="1" width="8" height="4" rx="1" stroke={color} strokeWidth={2} fill={focused ? color : 'white'} />
    <Line x1="9" y1="10" x2="15" y2="10" stroke={focused ? 'white' : color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1="9" y1="13" x2="15" y2="13" stroke={focused ? 'white' : color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1="9" y1="16" x2="13" y2="16" stroke={focused ? 'white' : color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

// Keuangan icon - wallet/bag with lock
export const IconKeuangan = ({ color, size = 24, focused }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="6" width="18" height="14" rx="2" stroke={color} strokeWidth={2} fill={focused ? color : 'none'} />
    <Path d="M7 6V4C7 2.89543 7.89543 2 9 2H15C16.1046 2 17 2.89543 17 4V6" stroke={color} strokeWidth={2} />
    <Circle cx="12" cy="13" r="2" stroke={focused ? 'white' : color} strokeWidth={1.5} />
  </Svg>
);

// Notifikasi icon - bell shape
export const IconNotifikasi = ({ color, size = 24, focused }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 8C18 4.68629 15.3137 2 12 2C8.68629 2 6 4.68629 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? color : 'none'}
    />
    <Path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Profil icon - person head and shoulders
export const IconProfil = ({ color, size = 24, focused }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={2} fill={focused ? color : 'none'} />
    <Path
      d="M20 21C20 16.5817 16.4183 13 12 13C7.58172 13 4 16.5817 4 21"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);
