interface KakaoAuthObj {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

interface KakaoShareLink {
  mobileWebUrl: string;
  webUrl: string;
}

interface Window {
  Kakao: {
    init(key: string): void;
    isInitialized(): boolean;
    cleanup(): void;
    Auth: {
      login(settings: {
        scope: string;
        success(authObj: KakaoAuthObj): void;
        fail?(err: unknown): void;
      }): void;
      authorize(settings: {
        redirectUri: string;
        scope?: string;
        state?: string;
      }): void;
      logout(callback?: () => void): void;
    };
    Share: {
      sendDefault(settings: {
        objectType: "feed" | "list" | "location" | "commerce" | "text";
        content: {
          title: string;
          description?: string;
          imageUrl?: string;
          link: KakaoShareLink;
        };
        buttons?: Array<{
          title: string;
          link: KakaoShareLink;
        }>;
        installTalk?: boolean;
      }): void;
    };
  };
}
