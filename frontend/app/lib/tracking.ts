/**
 * Utility per il tracking degli eventi Meta Pixel e Google Analytics
 *
 * Eventi Standard tracciati:
 * - ViewContent: Quando l'utente vede la pagina di gioco
 * - Lead: Quando un nuovo utente completa la registrazione
 * - CompleteRegistration: Alias di Lead per compatibilità
 * - InitiateCheckout: Quando l'utente clicca "GIOCA ORA"
 * - Purchase: Quando l'utente vince un premio
 *
 * Eventi Custom tracciati:
 * - PhoneValidated: Quando il telefono viene validato (nuovo/esistente)
 * - MarketingOptIn: Quando l'utente accetta il consenso marketing
 * - LeaderboardViewed: Quando l'utente visualizza la classifica
 * - ReturningUserLogin: Quando un utente già registrato torna a giocare
 * - GameLoss: Quando l'utente non vince
 * - GameError: Quando si verifica un errore nel flusso
 */

// Tipizzazione per fbq (Facebook Pixel)
declare global {
  interface Window {
    fbq?: (
      action: string,
      event: string,
      params?: Record<string, unknown>
    ) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Traccia un evento su Meta Pixel (Facebook)
 */
export function trackMetaEvent(
  eventName: string,
  params?: Record<string, unknown>
) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
    console.log(`[Meta Pixel] Tracked: ${eventName}`, params);
  }
}

/**
 * Traccia un evento custom su Meta Pixel
 */
export function trackMetaCustomEvent(
  eventName: string,
  params?: Record<string, unknown>
) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', eventName, params);
    console.log(`[Meta Pixel] Custom: ${eventName}`, params);
  }
}

/**
 * Push evento su Google Tag Manager dataLayer
 */
export function trackGTMEvent(
  eventName: string,
  params?: Record<string, unknown>
) {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...params,
    });
    console.log(`[GTM] Pushed: ${eventName}`, params);
  }
}

// ============================================
// EVENTI SPECIFICI PER CAMPARI LOTTERY
// ============================================

/**
 * Traccia quando l'utente visualizza la pagina di gioco
 */
export function trackViewContent(promotionId?: string | number) {
  trackMetaEvent('ViewContent', {
    content_name: 'Campari Lottery Game',
    content_category: 'Game',
    content_ids: promotionId ? [String(promotionId)] : undefined,
  });

  trackGTMEvent('view_game_page', {
    promotion_id: promotionId,
  });
}

/**
 * Traccia quando un nuovo utente completa la registrazione
 */
export function trackRegistration(data: {
  isNewUser: boolean;
  promotionId?: string | number;
  acceptedMarketing?: boolean;
}) {
  // Lead per Meta - indica un potenziale cliente
  trackMetaEvent('Lead', {
    content_name: 'User Registration',
    content_category: data.isNewUser ? 'New User' : 'Returning User',
    value: data.isNewUser ? 1 : 0.5, // Nuovo utente vale di più
    currency: 'EUR',
  });

  // CompleteRegistration per nuovo utente
  if (data.isNewUser) {
    trackMetaEvent('CompleteRegistration', {
      content_name: 'New Player Registration',
      status: 'complete',
      value: 1,
      currency: 'EUR',
    });
  }

  trackGTMEvent('user_registration', {
    is_new_user: data.isNewUser,
    promotion_id: data.promotionId,
    accepted_marketing: data.acceptedMarketing,
  });
}

/**
 * Traccia quando l'utente clicca "GIOCA ORA"
 */
export function trackInitiatePlay(data: {
  promotionId?: string | number;
  customerId?: string | number;
}) {
  trackMetaEvent('InitiateCheckout', {
    content_name: 'Start Game',
    content_category: 'Game',
    content_ids: data.promotionId ? [String(data.promotionId)] : undefined,
    num_items: 1,
  });

  trackGTMEvent('initiate_play', {
    promotion_id: data.promotionId,
    customer_id: data.customerId,
  });
}

/**
 * Traccia il risultato del gioco
 */
export function trackGameResult(data: {
  isWinner: boolean;
  prizeName?: string;
  prizeCode?: string;
  promotionId?: string | number;
  customerId?: string | number;
}) {
  if (data.isWinner) {
    // Purchase per le vincite - è l'evento di conversione più importante
    trackMetaEvent('Purchase', {
      content_name: data.prizeName || 'Prize Won',
      content_category: 'Prize',
      content_type: 'product',
      value: 10, // Valore simbolico del premio
      currency: 'EUR',
      content_ids: data.prizeCode ? [data.prizeCode] : undefined,
    });

    trackGTMEvent('game_win', {
      prize_name: data.prizeName,
      prize_code: data.prizeCode,
      promotion_id: data.promotionId,
      customer_id: data.customerId,
    });
  } else {
    // Evento custom per le non-vincite
    trackMetaCustomEvent('GameLoss', {
      content_name: 'No Prize',
      content_category: 'Game',
    });

    trackGTMEvent('game_loss', {
      promotion_id: data.promotionId,
      customer_id: data.customerId,
    });
  }
}

/**
 * Traccia errori nel flusso di gioco
 */
export function trackError(errorType: string, errorMessage?: string) {
  trackMetaCustomEvent('GameError', {
    error_type: errorType,
    error_message: errorMessage,
  });

  trackGTMEvent('game_error', {
    error_type: errorType,
    error_message: errorMessage,
  });
}

// ============================================
// EVENTI CUSTOM AVANZATI PER FUNNEL ANALYSIS
// ============================================

/**
 * Traccia quando il numero di telefono viene validato dal backend
 * Distingue tra utente nuovo e utente già registrato
 */
export function trackPhoneValidated(data: {
  isNewUser: boolean;
  promotionId?: string | number;
}) {
  trackMetaCustomEvent('PhoneValidated', {
    content_name: 'Phone Validation',
    content_category: data.isNewUser ? 'New User' : 'Returning User',
    user_type: data.isNewUser ? 'new' : 'returning',
    value: data.isNewUser ? 1 : 0.8,
    currency: 'EUR',
  });

  trackGTMEvent('phone_validated', {
    is_new_user: data.isNewUser,
    promotion_id: data.promotionId,
  });
}

/**
 * Traccia quando l'utente accetta il consenso marketing
 * Evento di alto valore per segmentazione audience
 */
export function trackMarketingOptIn(data: {
  promotionId?: string | number;
  customerId?: string | number;
}) {
  trackMetaCustomEvent('MarketingOptIn', {
    content_name: 'Marketing Consent',
    content_category: 'Lead Quality',
    value: 2, // Alto valore: utente disposto a ricevere comunicazioni
    currency: 'EUR',
  });

  trackGTMEvent('marketing_opt_in', {
    promotion_id: data.promotionId,
    customer_id: data.customerId,
  });
}

/**
 * Traccia quando l'utente visualizza la classifica nella pagina risultati
 * Utile per misurare engagement post-gioco
 */
export function trackLeaderboardViewed(data: {
  promotionId?: string | number;
  customerId?: string | number;
  isWinner: boolean;
}) {
  trackMetaCustomEvent('LeaderboardViewed', {
    content_name: 'Leaderboard View',
    content_category: data.isWinner ? 'Winner' : 'Non-Winner',
    game_result: data.isWinner ? 'win' : 'loss',
  });

  trackGTMEvent('leaderboard_viewed', {
    promotion_id: data.promotionId,
    customer_id: data.customerId,
    is_winner: data.isWinner,
  });
}

/**
 * Traccia specificamente quando un utente già registrato torna a giocare
 * Indica retention e engagement della promozione
 */
export function trackReturningUserLogin(data: {
  promotionId?: string | number;
  customerName?: string;
}) {
  trackMetaCustomEvent('ReturningUserLogin', {
    content_name: 'Returning User',
    content_category: 'Retention',
    value: 1.5, // Valore medio-alto: indica retention
    currency: 'EUR',
  });

  trackGTMEvent('returning_user_login', {
    promotion_id: data.promotionId,
    customer_name: data.customerName,
  });
}
