type AppleSignInResponse = {
  authorization?: {
    code?: string;
    id_token?: string;
    state?: string;
  };
  user?: {
    email?: string;
    name?: {
      firstName?: string;
      lastName?: string;
    };
  };
};

declare global {
  interface Window {
    AppleID?: {
      auth?: {
        init: (config: {
          clientId: string;
          scope?: string;
          redirectURI: string;
          state?: string;
          nonce?: string;
          usePopup?: boolean;
        }) => void;
        signIn: () => Promise<AppleSignInResponse>;
      };
    };
  }
}

let appleScriptPromise: Promise<void> | null = null;

function randomNonce(size = 24): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < size; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function loadAppleSignInScript(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Apple SSO is only available in the browser");
  }

  if (window.AppleID?.auth) {
    return;
  }

  if (!appleScriptPromise) {
    appleScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"]'
      );
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load Apple SSO script")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Apple SSO script"));
      document.head.appendChild(script);
    });
  }

  await appleScriptPromise;
}

export async function requestAppleIdToken(config: {
  clientId: string;
  redirectURI?: string;
}): Promise<{ idToken: string; name?: string | null }> {
  await loadAppleSignInScript();
  const auth = window.AppleID?.auth;
  if (!auth) {
    throw new Error("Apple SSO SDK is not available");
  }

  const redirectURI =
    config.redirectURI || process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || window.location.origin;

  auth.init({
    clientId: config.clientId,
    scope: "name email",
    redirectURI,
    usePopup: true,
    state: randomNonce(20),
    nonce: randomNonce(32),
  });

  const response = await auth.signIn();
  const idToken = response.authorization?.id_token;
  if (!idToken) {
    throw new Error("Apple did not return an ID token");
  }

  const firstName = response.user?.name?.firstName?.trim() || "";
  const lastName = response.user?.name?.lastName?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return { idToken, name: fullName || null };
}
