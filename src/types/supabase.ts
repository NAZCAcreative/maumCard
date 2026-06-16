export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nickname: string;
          avatar_url: string | null;
          credits: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nickname?: string;
          avatar_url?: string | null;
          credits?: number;
        };
        Update: {
          nickname?: string;
          avatar_url?: string | null;
          credits?: number;
        };
      };
      cards: {
        Row: {
          id: string;
          user_id: string;
          purpose: string;
          recipient: string;
          honorific: string;
          message: string;
          background_id: string;
          is_ai_bg: boolean;
          card_image_url: string | null;
          share_token: string | null;
          is_favorite: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          purpose: string;
          recipient: string;
          honorific?: string;
          message: string;
          background_id: string;
          is_ai_bg?: boolean;
          card_image_url?: string | null;
          share_token?: string | null;
          is_favorite?: boolean;
        };
        Update: {
          is_favorite?: boolean;
          share_token?: string | null;
          card_image_url?: string | null;
        };
      };
      card_library: {
        Row: {
          id: string;
          user_id: string;
          purpose: string;
          recipient: string;
          honorific: string;
          message: string;
          background_id: string;
          is_ai_bg: boolean;
          card_image_url: string | null;
          share_token: string | null;
          is_favorite: boolean;
          is_hidden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          purpose: string;
          recipient: string;
          honorific?: string;
          message: string;
          background_id: string;
          is_ai_bg?: boolean;
          card_image_url?: string | null;
          share_token?: string | null;
          is_favorite?: boolean;
          is_hidden?: boolean;
        };
        Update: {
          purpose?: string;
          recipient?: string;
          honorific?: string;
          message?: string;
          background_id?: string;
          is_ai_bg?: boolean;
          card_image_url?: string | null;
          share_token?: string | null;
          is_favorite?: boolean;
          is_hidden?: boolean;
        };
      };
      anniversaries: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          date: string;
          anniversary_type: string;
          notify_days_before: number[];
          memo: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          date: string;
          anniversary_type?: string;
          notify_days_before?: number[];
          memo?: string | null;
        };
        Update: {
          name?: string;
          date?: string;
          anniversary_type?: string;
          notify_days_before?: number[];
          memo?: string | null;
        };
      };
      backgrounds: {
        Row: {
          id: string;
          name: string;
          category: string;
          storage_path: string;
          url: string;
          prompt: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          name: string;
          category?: string;
          storage_path: string;
          url: string;
          prompt?: string | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          category?: string;
          is_active?: boolean;
          sort_order?: number;
        };
      };
      card_prompt_templates: {
        Row: {
          id: string;
          code: string;
          purpose: string;
          name: string;
          description: string;
          template: string;
          style: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          purpose: string;
          name: string;
          description: string;
          template: string;
          style: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          description?: string;
          template?: string;
          style?: string;
          is_active?: boolean;
          sort_order?: number;
        };
      };
      home_featured_cards: {
        Row: {
          id: string;
          title: string;
          message: string;
          image_url: string;
          link_href: string;
          cta_label: string;
          is_active: boolean;
          show_title: boolean;
          show_text: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title?: string;
          message?: string;
          image_url: string;
          link_href?: string;
          cta_label?: string;
          is_active?: boolean;
          show_title?: boolean;
          show_text?: boolean;
          sort_order?: number;
        };
        Update: {
          title?: string;
          message?: string;
          image_url?: string;
          link_href?: string;
          cta_label?: string;
          is_active?: boolean;
          show_title?: boolean;
          show_text?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
      };
      common_anniversaries: {
        Row: {
          id: string;
          name: string;
          month: number | null;
          day: number | null;
          yearly_dates: Json;
          anniversary_type: string;
          memo: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          month?: number | null;
          day?: number | null;
          yearly_dates?: Json;
          anniversary_type?: string;
          memo?: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          month?: number | null;
          day?: number | null;
          yearly_dates?: Json;
          anniversary_type?: string;
          memo?: string;
          is_active?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
      };
      curated_phrases: {
        Row: {
          id: string;
          category: string;
          phrase_type: string;
          content: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          phrase_type?: string;
          content: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          content?: string;
          is_active?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
      };
      common_anniversary_settings: {
        Row: {
          id: string;
          max_visible: number;
          window_days: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          max_visible?: number;
          window_days?: number;
          updated_at?: string;
        };
        Update: {
          max_visible?: number;
          window_days?: number;
          updated_at?: string;
        };
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          reason: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          amount: number;
          reason: string;
        };
        Update: never;
      };
      system_settings: {
        Row: {
          id: string;
          signup_bonus_credits: number;
          ai_suggestions_enabled: boolean;
          announcement_enabled: boolean;
          announcement_title: string;
          announcement_message: string;
          hand_font_round_enabled: boolean;
          hand_font_brush_enabled: boolean;
          hand_font_pen_enabled: boolean;
          hand_paper_enabled: boolean;
          hand_paper_style: string;
          hand_compose_font_size: number;
          hand_viewer_font_size: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          signup_bonus_credits?: number;
          ai_suggestions_enabled?: boolean;
          announcement_enabled?: boolean;
          announcement_title?: string;
          announcement_message?: string;
          hand_font_round_enabled?: boolean;
          hand_font_brush_enabled?: boolean;
          hand_font_pen_enabled?: boolean;
          hand_paper_enabled?: boolean;
          hand_paper_style?: string;
          hand_compose_font_size?: number;
          hand_viewer_font_size?: number;
          updated_at?: string;
        };
        Update: {
          signup_bonus_credits?: number;
          ai_suggestions_enabled?: boolean;
          announcement_enabled?: boolean;
          announcement_title?: string;
          announcement_message?: string;
          hand_font_round_enabled?: boolean;
          hand_font_brush_enabled?: boolean;
          hand_font_pen_enabled?: boolean;
          hand_paper_enabled?: boolean;
          hand_paper_style?: string;
          hand_compose_font_size?: number;
          hand_viewer_font_size?: number;
          updated_at?: string;
        };
      };
    };
  };
}
