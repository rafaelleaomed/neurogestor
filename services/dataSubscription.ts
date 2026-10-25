export type RealtimeSubscription<T> = {
  unsubscribe: () => void;
  ready: Promise<void>;
};

export const subscribeWithReady = <T>(
  start: (next: (value: T) => void, error: (error: unknown) => void) => () => void,
  onValue: (value: T) => void,
  onError: (error: unknown) => void,
  timeoutMs = 10_000
): RealtimeSubscription<T> => {
  let releaseReady: () => void = () => {};
  let released = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const ready = new Promise<void>((resolve) => {
    releaseReady = resolve;
  });
  const releaseOnce = () => {
    if (released) return;
    released = true;
    if (timeoutId) clearTimeout(timeoutId);
    releaseReady();
  };

  const unsubscribeSource = start(
    (value) => {
      try {
        onValue(value);
      } finally {
        releaseOnce();
      }
    },
    (error) => {
      try {
        onError(error);
      } finally {
        releaseOnce();
      }
    }
  );
  timeoutId = setTimeout(releaseOnce, timeoutMs);
  if (released) clearTimeout(timeoutId);

  return {
    ready,
    unsubscribe: () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribeSource();
      releaseOnce();
    }
  };
};
