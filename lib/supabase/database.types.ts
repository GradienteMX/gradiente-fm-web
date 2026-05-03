export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          payload: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: number
          payload?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: number
          payload?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          kind: Database["public"]["Enums"]["reaction_kind"]
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          kind: Database["public"]["Enums"]["reaction_kind"]
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          kind?: Database["public"]["Enums"]["reaction_kind"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deletion_at: string | null
          deletion_moderator_id: string | null
          deletion_reason: string | null
          edited_at: string | null
          id: string
          item_id: string
          parent_id: string | null
          seed: boolean
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deletion_at?: string | null
          deletion_moderator_id?: string | null
          deletion_reason?: string | null
          edited_at?: string | null
          id?: string
          item_id: string
          parent_id?: string | null
          seed?: boolean
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deletion_at?: string | null
          deletion_moderator_id?: string | null
          deletion_reason?: string | null
          edited_at?: string | null
          id?: string
          item_id?: string
          parent_id?: string | null
          seed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_deletion_moderator_id_fkey"
            columns: ["deletion_moderator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          author_id: string
          created_at: string
          id: string
          item_payload: Json
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          item_payload: Json
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          item_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      foro_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deletion_at: string | null
          deletion_moderator_id: string | null
          deletion_reason: string | null
          id: string
          image_url: string | null
          quoted_reply_ids: string[]
          thread_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deletion_at?: string | null
          deletion_moderator_id?: string | null
          deletion_reason?: string | null
          id?: string
          image_url?: string | null
          quoted_reply_ids?: string[]
          thread_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deletion_at?: string | null
          deletion_moderator_id?: string | null
          deletion_reason?: string | null
          id?: string
          image_url?: string | null
          quoted_reply_ids?: string[]
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foro_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foro_replies_deletion_moderator_id_fkey"
            columns: ["deletion_moderator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foro_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "foro_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      foro_threads: {
        Row: {
          archived: boolean
          author_id: string
          body: string
          bumped_at: string
          created_at: string
          deletion_at: string | null
          deletion_moderator_id: string | null
          deletion_reason: string | null
          genres: string[]
          id: string
          image_url: string
          seed: boolean
          subject: string
        }
        Insert: {
          archived?: boolean
          author_id: string
          body: string
          bumped_at?: string
          created_at?: string
          deletion_at?: string | null
          deletion_moderator_id?: string | null
          deletion_reason?: string | null
          genres: string[]
          id?: string
          image_url: string
          seed?: boolean
          subject: string
        }
        Update: {
          archived?: boolean
          author_id?: string
          body?: string
          bumped_at?: string
          created_at?: string
          deletion_at?: string | null
          deletion_moderator_id?: string | null
          deletion_reason?: string | null
          genres?: string[]
          id?: string
          image_url?: string
          seed?: boolean
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "foro_threads_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foro_threads_deletion_moderator_id_fkey"
            columns: ["deletion_moderator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hp_events: {
        Row: {
          created_at: string
          id: number
          item_id: string
          kind: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: number
          item_id: string
          kind: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: number
          item_id?: string
          kind?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "hp_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          intended_is_mod: boolean
          intended_partner_admin: boolean
          intended_partner_id: string | null
          intended_role: Database["public"]["Enums"]["user_role"]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          intended_is_mod?: boolean
          intended_partner_admin?: boolean
          intended_partner_id?: string | null
          intended_role?: Database["public"]["Enums"]["user_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          intended_is_mod?: boolean
          intended_partner_admin?: boolean
          intended_partner_id?: string | null
          intended_role?: Database["public"]["Enums"]["user_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_intended_partner_id_fkey"
            columns: ["intended_partner_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          article_body: Json
          artists: string[] | null
          author: string | null
          body_preview: string | null
          bpm_range: string | null
          created_at: string
          created_by: string | null
          date: string | null
          duration: string | null
          editorial: boolean
          elevated: boolean
          embeds: Json
          end_date: string | null
          excerpt: string | null
          expires_at: string | null
          external_id: string | null
          footnotes: Json
          genres: string[]
          hero_caption: string | null
          hp: number | null
          hp_last_updated_at: string | null
          id: string
          image_url: string | null
          marketplace_currency: string | null
          marketplace_description: string | null
          marketplace_enabled: boolean
          marketplace_listings: Json
          marketplace_location: string | null
          mix_format: string | null
          mix_series: string | null
          mix_status: Database["public"]["Enums"]["mix_status"] | null
          mix_url: string | null
          musical_key: string | null
          partner_kind: Database["public"]["Enums"]["partner_kind"] | null
          partner_last_updated: string | null
          partner_url: string | null
          pinned: boolean
          price: string | null
          published: boolean
          published_at: string
          ra_last_seen_at: string | null
          read_time: number | null
          recorded_in: string | null
          search_tsv: unknown
          seed: boolean
          slug: string
          source: Database["public"]["Enums"]["content_source"] | null
          subtitle: string | null
          tags: string[]
          ticket_url: string | null
          title: string
          tracklist: Json
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
          venue: string | null
          venue_city: string | null
          vibe: number
        }
        Insert: {
          article_body?: Json
          artists?: string[] | null
          author?: string | null
          body_preview?: string | null
          bpm_range?: string | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          duration?: string | null
          editorial?: boolean
          elevated?: boolean
          embeds?: Json
          end_date?: string | null
          excerpt?: string | null
          expires_at?: string | null
          external_id?: string | null
          footnotes?: Json
          genres?: string[]
          hero_caption?: string | null
          hp?: number | null
          hp_last_updated_at?: string | null
          id: string
          image_url?: string | null
          marketplace_currency?: string | null
          marketplace_description?: string | null
          marketplace_enabled?: boolean
          marketplace_listings?: Json
          marketplace_location?: string | null
          mix_format?: string | null
          mix_series?: string | null
          mix_status?: Database["public"]["Enums"]["mix_status"] | null
          mix_url?: string | null
          musical_key?: string | null
          partner_kind?: Database["public"]["Enums"]["partner_kind"] | null
          partner_last_updated?: string | null
          partner_url?: string | null
          pinned?: boolean
          price?: string | null
          published?: boolean
          published_at: string
          ra_last_seen_at?: string | null
          read_time?: number | null
          recorded_in?: string | null
          search_tsv?: unknown
          seed?: boolean
          slug: string
          source?: Database["public"]["Enums"]["content_source"] | null
          subtitle?: string | null
          tags?: string[]
          ticket_url?: string | null
          title: string
          tracklist?: Json
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          venue?: string | null
          venue_city?: string | null
          vibe: number
        }
        Update: {
          article_body?: Json
          artists?: string[] | null
          author?: string | null
          body_preview?: string | null
          bpm_range?: string | null
          created_at?: string
          created_by?: string | null
          date?: string | null
          duration?: string | null
          editorial?: boolean
          elevated?: boolean
          embeds?: Json
          end_date?: string | null
          excerpt?: string | null
          expires_at?: string | null
          external_id?: string | null
          footnotes?: Json
          genres?: string[]
          hero_caption?: string | null
          hp?: number | null
          hp_last_updated_at?: string | null
          id?: string
          image_url?: string | null
          marketplace_currency?: string | null
          marketplace_description?: string | null
          marketplace_enabled?: boolean
          marketplace_listings?: Json
          marketplace_location?: string | null
          mix_format?: string | null
          mix_series?: string | null
          mix_status?: Database["public"]["Enums"]["mix_status"] | null
          mix_url?: string | null
          musical_key?: string | null
          partner_kind?: Database["public"]["Enums"]["partner_kind"] | null
          partner_last_updated?: string | null
          partner_url?: string | null
          pinned?: boolean
          price?: string | null
          published?: boolean
          published_at?: string
          ra_last_seen_at?: string | null
          read_time?: number | null
          recorded_in?: string | null
          search_tsv?: unknown
          seed?: boolean
          slug?: string
          source?: Database["public"]["Enums"]["content_source"] | null
          subtitle?: string | null
          tags?: string[]
          ticket_url?: string | null
          title?: string
          tracklist?: Json
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          venue?: string | null
          venue_city?: string | null
          vibe?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          choice_ids: string[]
          poll_id: string
          user_id: string
          voted_at: string
        }
        Insert: {
          choice_ids: string[]
          poll_id: string
          user_id: string
          voted_at?: string
        }
        Update: {
          choice_ids?: string[]
          poll_id?: string
          user_id?: string
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          choices: Json
          closes_at: string | null
          created_at: string
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["poll_kind"]
          multi_choice: boolean
          prompt: string
        }
        Insert: {
          choices?: Json
          closes_at?: string | null
          created_at?: string
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["poll_kind"]
          multi_choice?: boolean
          prompt: string
        }
        Update: {
          choices?: Json
          closes_at?: string | null
          created_at?: string
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["poll_kind"]
          multi_choice?: boolean
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_comments: {
        Row: {
          comment_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_comments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saves: {
        Row: {
          item_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          item_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          item_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saves_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          display_name: string
          id: string
          is_mod: boolean
          is_og: boolean
          joined_at: string
          partner_admin: boolean
          partner_id: string | null
          profile_meta: Json
          role: Database["public"]["Enums"]["user_role"]
          seed: boolean
          username: string
        }
        Insert: {
          display_name: string
          id: string
          is_mod?: boolean
          is_og?: boolean
          joined_at?: string
          partner_admin?: boolean
          partner_id?: string | null
          profile_meta?: Json
          role?: Database["public"]["Enums"]["user_role"]
          seed?: boolean
          username: string
        }
        Update: {
          display_name?: string
          id?: string
          is_mod?: boolean
          is_og?: boolean
          joined_at?: string
          partner_admin?: boolean
          partner_id?: string | null
          profile_meta?: Json
          role?: Database["public"]["Enums"]["user_role"]
          seed?: boolean
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      content_source: "scraper:ra" | "manual:editor" | "manual:partner"
      content_type:
        | "evento"
        | "mix"
        | "noticia"
        | "review"
        | "editorial"
        | "opinion"
        | "articulo"
        | "listicle"
        | "partner"
      mix_status: "disponible" | "exclusivo" | "archivo" | "proximamente"
      partner_kind: "promo" | "label" | "promoter" | "venue" | "sponsored"
      poll_kind: "from-list" | "from-tracklist" | "attendance" | "freeform"
      reaction_kind: "provocative" | "signal"
      user_role: "user" | "curator" | "guide" | "insider" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      content_source: ["scraper:ra", "manual:editor", "manual:partner"],
      content_type: [
        "evento",
        "mix",
        "noticia",
        "review",
        "editorial",
        "opinion",
        "articulo",
        "listicle",
        "partner",
      ],
      mix_status: ["disponible", "exclusivo", "archivo", "proximamente"],
      partner_kind: ["promo", "label", "promoter", "venue", "sponsored"],
      poll_kind: ["from-list", "from-tracklist", "attendance", "freeform"],
      reaction_kind: ["provocative", "signal"],
      user_role: ["user", "curator", "guide", "insider", "admin"],
    },
  },
} as const
