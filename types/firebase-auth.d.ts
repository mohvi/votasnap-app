import 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import type AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase 12 exposes this API in its React Native runtime, but its root
// declaration file omits the RN export. Keep the declaration scoped to this API.
declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>,
  ): Persistence;
}
