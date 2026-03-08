export type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type PromptMomentNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (listener?: (notification: PromptMomentNotification) => void) => void;
        };
      };
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

export async function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Google SSO is only available in the browser");
  }

  if (window.google?.accounts?.id) {
    return;
  }

  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://accounts.google.com/gsi/client"]'
      );
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load Google SSO script")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google SSO script"));
      document.head.appendChild(script);
    });
  }

  await scriptLoadPromise;
}

export async function requestGoogleIdToken(clientId: string): Promise<string> {
  await loadGoogleIdentityScript();

  const googleId = window.google?.accounts?.id;
  if (!googleId) {
    throw new Error("Google SSO script not available");
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Google sign-in timed out"));
      }
    }, 120000);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      fn();
    };

    googleId.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response: GoogleCredentialResponse) => {
        if (response.credential) {
          finish(() => resolve(response.credential!));
          return;
        }
        finish(() => reject(new Error("Google did not return an ID token")));
      },
    });

    googleId.prompt((notification) => {
      if (settled) return;
      if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
        finish(() =>
          reject(
            new Error(
              "Google sign-in was cancelled or unavailable. Check popup/cookie settings and try again."
            )
          )
        );
      }
    });
  });
}
