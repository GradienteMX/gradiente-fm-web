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
          card_name: string | null
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          folio: number | null
          folio_denominator: number
          intended_is_mod: boolean
          intended_partner_admin: boolean
          intended_partner_id: string | null
          intended_role: Database["public"]["Enums"]["user_role"]
          issued_label: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          card_name?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          folio?: number | null
          folio_denominator?: number
          intended_is_mod?: boolean
          intended_partner_admin?: boolean
          intended_partner_id?: string | null
          intended_role?: Database["public"]["Enums"]["user_role"]
          issued_label?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          card_name?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          folio?: number | null
          folio_denominator?: number
          intended_is_mod?: boolean
          intended_partner_admin?: boolean
          intended_partner_id?: string | null
          intended_role?: Database["public"]["Enums"]["user_role"]
          issued_label?: string | null
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
          format: Database["public"]["Enums"]["item_format"] | null
          genres: string[]
          harvested_amount: number | null
          harvested_at: string | null
          hero_caption: string | null
          hp: number | null
          hp_decay_multiplier: number
          hp_last_updated_at: string | null
          id: string
          image_url: string | null
          marketplace_currency: string | null
          marketplace_description: string | null
          marketplace_enabled: boolean
          marketplace_location: string | null
          mix_format: string | null
          mix_series: string | null
          mix_status: Database["public"]["Enums"]["mix_status"] | null
          mix_url: string | null
          musical_key: string | null
          partner_id: string | null
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
          vibe_max: number
          vibe_min: number
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
          format?: Database["public"]["Enums"]["item_format"] | null
          genres?: string[]
          harvested_amount?: number | null
          harvested_at?: string | null
          hero_caption?: string | null
          hp?: number | null
          hp_decay_multiplier?: number
          hp_last_updated_at?: string | null
          id: string
          image_url?: string | null
          marketplace_currency?: string | null
          marketplace_description?: string | null
          marketplace_enabled?: boolean
          marketplace_location?: string | null
          mix_format?: string | null
          mix_series?: string | null
          mix_status?: Database["public"]["Enums"]["mix_status"] | null
          mix_url?: string | null
          musical_key?: string | null
          partner_id?: string | null
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
          vibe_max: number
          vibe_min: number
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
          format?: Database["public"]["Enums"]["item_format"] | null
          genres?: string[]
          harvested_amount?: number | null
          harvested_at?: string | null
          hero_caption?: string | null
          hp?: number | null
          hp_decay_multiplier?: number
          hp_last_updated_at?: string | null
          id?: string
          image_url?: string | null
          marketplace_currency?: string | null
          marketplace_description?: string | null
          marketplace_enabled?: boolean
          marketplace_location?: string | null
          mix_format?: string | null
          mix_series?: string | null
          mix_status?: Database["public"]["Enums"]["mix_status"] | null
          mix_url?: string | null
          musical_key?: string | null
          partner_id?: string | null
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
          vibe_max?: number
          vibe_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category: string
          condition: string
          description: string | null
          embeds: Json
          id: string
          images: string[]
          partner_id: string
          price: number
          published_at: string
          shipping_mode: string | null
          status: string
          subcategory: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          condition: string
          description?: string | null
          embeds?: Json
          id: string
          images?: string[]
          partner_id: string
          price?: number
          published_at?: string
          shipping_mode?: string | null
          status?: string
          subcategory?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          condition?: string
          description?: string | null
          embeds?: Json
          id?: string
          images?: string[]
          partner_id?: string
          price?: number
          published_at?: string
          shipping_mode?: string | null
          status?: string
          subcategory?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "items"
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
      user_axis_affinity: {
        Row: {
          axis: string
          key: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          axis: string
          key: string
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          axis?: string
          key?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_axis_affinity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_hp_events: {
        Row: {
          attribution_key: string | null
          created_at: string
          id: number
          kind: string
          processed_at: string | null
          user_id: string
          weight: number
        }
        Insert: {
          attribution_key?: string | null
          created_at?: string
          id?: number
          kind: string
          processed_at?: string | null
          user_id: string
          weight?: number
        }
        Update: {
          attribution_key?: string | null
          created_at?: string
          id?: number
          kind?: string
          processed_at?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_hp_events_user_id_fkey"
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
      user_trophies: {
        Row: {
          earned_at: string
          trophy_key: string
          user_id: string
        }
        Insert: {
          earned_at?: string
          trophy_key: string
          user_id: string
        }
        Update: {
          earned_at?: string
          trophy_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trophies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string
          engagement_hp: number
          engagement_hp_last_updated_at: string | null
          firma: string | null
          id: string
          is_mod: boolean
          is_og: boolean
          joined_at: string
          location: string | null
          partner_admin: boolean
          partner_id: string | null
          profile_meta: Json
          role: Database["public"]["Enums"]["user_role"]
          seed: boolean
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name: string
          engagement_hp?: number
          engagement_hp_last_updated_at?: string | null
          firma?: string | null
          id: string
          is_mod?: boolean
          is_og?: boolean
          joined_at?: string
          location?: string | null
          partner_admin?: boolean
          partner_id?: string | null
          profile_meta?: Json
          role?: Database["public"]["Enums"]["user_role"]
          seed?: boolean
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string
          engagement_hp?: number
          engagement_hp_last_updated_at?: string | null
          firma?: string | null
          id?: string
          is_mod?: boolean
          is_og?: boolean
          joined_at?: string
          location?: string | null
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
      vibe_checks: {
        Row: {
          created_at: string
          hp_credited_at: string | null
          item_id: string
          updated_at: string
          user_id: string
          vibe_max: number
          vibe_min: number
        }
        Insert: {
          created_at?: string
          hp_credited_at?: string | null
          item_id: string
          updated_at?: string
          user_id: string
          vibe_max: number
          vibe_min: number
        }
        Update: {
          created_at?: string
          hp_credited_at?: string | null
          item_id?: string
          updated_at?: string
          user_id?: string
          vibe_max?: number
          vibe_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "vibe_checks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["entity_kind"]
          links: Json
          merged_into: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["entity_kind"]
          links?: Json
          merged_into?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["entity_kind"]
          links?: Json
          merged_into?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      item_entities: {
        Row: {
          created_at: string
          entity_id: string
          item_id: string
          relation: Database["public"]["Enums"]["entity_relation"]
        }
        Insert: {
          created_at?: string
          entity_id: string
          item_id: string
          relation?: Database["public"]["Enums"]["entity_relation"]
        }
        Update: {
          created_at?: string
          entity_id?: string
          item_id?: string
          relation?: Database["public"]["Enums"]["entity_relation"]
        }
        Relationships: [
          {
            foreignKeyName: "item_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_entities_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_rank_signals: {
        Row: {
          prov_count: number | null
          signal_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_check_aggregates: {
        Row: {
          check_count: number | null
          item_id: string | null
          median_max: number | null
          median_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vibe_checks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_hp_rollup: { Args: never; Returns: undefined }
      apply_trophy_unlocks: { Args: never; Returns: undefined }
      apply_user_hp_rollup: { Args: never; Returns: undefined }
      apply_vibe_check_bonuses: { Args: never; Returns: undefined }
      harvest_item: { Args: { p_item_id: string }; Returns: Json }
      ingest_scraped_event: {
        Args: {
          p_source: string
          p_external_id: string
          p_partner_id: string | null
          p_id: string
          p_slug: string
          p_title: string
          p_subtitle: string
          p_excerpt: string
          p_date: string
          p_end_date: string | null
          p_venue: string
          p_venue_city: string
          p_artists: string[]
          p_ticket_url: string
          p_price: string
          p_image_url: string
          p_genres: string[]
        }
        Returns: Json
      }
      peek_invite_card: {
        Args: { p_code: string }
        Returns: {
          card_name: string | null
          role: Database["public"]["Enums"]["user_role"]
          folio: number | null
          folio_denominator: number | null
          issued_label: string | null
          issued_at: string | null
          partner_title: string | null
          partner_logo_url: string | null
          status: string
        }[]
      }
      publish_partner_event: { Args: { p_item_id: string }; Returns: Json }
      discard_partner_event: { Args: { p_item_id: string }; Returns: Json }
      update_partner_event: {
        Args: {
          p_item_id: string
          p_title: string
          p_subtitle: string
          p_excerpt: string
          p_date: string
          p_end_date: string | null
          p_venue: string
          p_venue_city: string
          p_artists: string[]
          p_ticket_url: string
          p_price: string
          p_image_url: string
          p_genres: string[]
          p_vibe_min: number
          p_vibe_max: number
        }
        Returns: Json
      }
      record_hp_event: {
        Args: { p_base_weight: number; p_item_id: string; p_kind: string }
        Returns: number
      }
      sweep_old_foro_threads: { Args: never; Returns: undefined }
    }
    Enums: {
      content_source:
        | "scraper:ra"
        | "scraper:instagram"
        | "manual:editor"
        | "manual:partner"
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
      entity_kind: "artist" | "label" | "venue" | "promoter"
      entity_relation: "subject" | "mention"
      item_format: "vinyl" | "cassette" | "cd" | "digital" | "mix" | "other"
      mix_status: "disponible" | "exclusivo" | "archivo" | "proximamente"
      partner_kind:
        | "promo"
        | "label"
        | "promoter"
        | "venue"
        | "sponsored"
        | "dealer"
        | "colectivo"
        | "festival"
        | "club"
        | "medios"
        | "mix-series"
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
  public: {
    Enums: {
      content_source: ["scraper:ra", "scraper:instagram", "manual:editor", "manual:partner"],
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
      entity_kind: ["artist", "label", "venue", "promoter"],
      entity_relation: ["subject", "mention"],
      item_format: ["vinyl", "cassette", "cd", "digital", "mix", "other"],
      mix_status: ["disponible", "exclusivo", "archivo", "proximamente"],
      partner_kind: [
        "promo",
        "label",
        "promoter",
        "venue",
        "sponsored",
        "dealer",
        "colectivo",
        "festival",
        "club",
        "medios",
        "mix-series",
      ],
      poll_kind: ["from-list", "from-tracklist", "attendance", "freeform"],
      reaction_kind: ["provocative", "signal"],
      user_role: ["user", "curator", "guide", "insider", "admin"],
    },
  },
} as const
