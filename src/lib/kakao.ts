function initKakao(): boolean {
  if (typeof window === "undefined" || !window.Kakao) return false;
  if (!window.Kakao.isInitialized()) {
    const key = process.env.NEXT_PUBLIC_KAKAO_API_KEY;
    if (!key) return false;
    window.Kakao.init(key);
  }
  return true;
}

export interface ShareCardParams {
  recipientName: string;
  honorific: string;
  message: string;
  cardId?: string;
}

export function shareCard({ recipientName, honorific, message, cardId }: ShareCardParams) {
  if (!initKakao()) {
    console.warn("Kakao SDK not ready");
    return;
  }

  const shareUrl = cardId
    ? `${window.location.origin}/share/${cardId}`
    : window.location.origin;

  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: `${recipientName}${honorific}에게 보내는 💞 마음카드`,
      description: message.length > 80 ? message.slice(0, 80) + "…" : message,
      link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
    },
    buttons: [
      {
        title: "카드 보기",
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      },
    ],
  });
}
