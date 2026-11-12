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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      blocked_clients: {
        Row: {
          created_at: string
          id: string
          kind: string
          reason: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          reason?: string | null
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          reason?: string | null
          value?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          created_at: string
          end_at: string
          id: string
          reason: string | null
          start_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          reason?: string | null
          start_at: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          reason?: string | null
          start_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          admin_note: string | null
          created_at: string
          customer_name: string
          decided_at: string | null
          device_id: string | null
          end_at: string
          id: string
          ip_hash: string | null
          notified_at: string | null
          party_names: string[] | null
          party_size: number
          phone: string | null
          phone_norm: string | null
          public_token: string
          reject_reason: string | null
          start_at: string
          status: string
          walk_in: boolean
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          customer_name: string
          decided_at?: string | null
          device_id?: string | null
          end_at: string
          id?: string
          ip_hash?: string | null
          notified_at?: string | null
          party_names?: string[] | null
          party_size?: number
          phone?: string | null
          phone_norm?: string | null
          public_token?: string
          reject_reason?: string | null
          start_at: string
          status?: string
          walk_in?: boolean
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          customer_name?: string
          decided_at?: string | null
          device_id?: string | null
          end_at?: string
          id?: string
          ip_hash?: string | null
          notified_at?: string | null
          party_names?: string[] | null
          party_size?: number
          phone?: string | null
          phone_norm?: string | null
          public_token?: string
          reject_reason?: string | null
          start_at?: string
          status?: string
          walk_in?: boolean
        }
        Relationships: []
      }
      settings: {
        Row: {
          auto_approve: boolean
          booking_enabled: boolean
          booking_window_days: number
          buffer_minutes: number
          close_min: number
          days_off: number[]
          id: number
          max_bookings_per_device_24h: number
          max_party_size: number
          min_notice_minutes: number
          open_min: number
          pause_reason: string | null
          pause_until: string | null
          service_minutes: number
          updated_at: string
        }
        Insert: {
          auto_approve?: boolean
          booking_enabled?: boolean
          booking_window_days?: number
          buffer_minutes?: number
          close_min?: number
          days_off?: number[]
          id?: number
          max_bookings_per_device_24h?: number
          max_party_size?: number
          min_notice_minutes?: number
          open_min?: number
          pause_reason?: string | null
          pause_until?: string | null
          service_minutes?: number
          updated_at?: string
        }
        Update: {
          auto_approve?: boolean
          booking_enabled?: boolean
          booking_window_days?: number
          buffer_minutes?: number
          close_min?: number
          days_off?: number[]
          id?: number
          max_bookings_per_device_24h?: number
          max_party_size?: number
          min_notice_minutes?: number
          open_min?: number
          pause_reason?: string | null
          pause_until?: string | null
          service_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_my_booking: { Args: { _token: string }; Returns: boolean }
      create_booking: {
        Args: {
          _device_id?: string
          _name: string
          _party_names?: string[]
          _party_size?: number
          _phone: string
          _start: string
        }
        Returns: Json
      }
      get_booking_status: { Args: { _token: string }; Returns: Json }
      get_public_state: { Args: { _day: string }; Returns: Json }
      get_stats: { Args: { _from: string; _to: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
    },
  },
} as const
