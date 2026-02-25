import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let isNavigationReady = false;
let pendingAction: (() => void) | null = null;

export function setNavigationReady() {
  isNavigationReady = true;
  if (pendingAction) {
    const fn = pendingAction;
    pendingAction = null;
    fn();
  }
}

export function runWhenNavigationReady(action: () => void) {
  if (isNavigationReady && navigationRef.isReady()) {
    action();
    return;
  }
  pendingAction = action;
}

export function navigate<Name extends keyof RootStackParamList>(
  name: Name,
  params: RootStackParamList[Name]
) {
  runWhenNavigationReady(() => {
    if (navigationRef.isReady()) {
      // @ts-expect-error react-navigation typing can be strict for generics
      navigationRef.navigate(name, params);
    }
  });
}


