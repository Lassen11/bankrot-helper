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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          agent_full_name: string
          agent_phone: string
          client_category: string | null
          created_at: string
          employee_id: string
          first_payment_amount: number | null
          first_payment_date: string | null
          id: string
          lead_link: string | null
          mop_name: string | null
          payment_month_1: number | null
          payment_month_1_completed: boolean
          payment_month_1_date: string | null
          payment_month_2: number | null
          payment_month_2_completed: boolean
          payment_month_2_date: string | null
          payment_month_3: number | null
          payment_month_3_completed: boolean
          payment_month_3_date: string | null
          payout_1: number | null
          payout_1_completed: boolean
          payout_1_date: string | null
          payout_2: number | null
          payout_2_completed: boolean
          payout_2_date: string | null
          payout_3: number | null
          payout_3_completed: boolean
          payout_3_date: string | null
          recommendation_name: string | null
          remaining_payment: number | null
          reward_amount: number | null
          updated_at: string
        }
        Insert: {
          agent_full_name: string
          agent_phone: string
          client_category?: string | null
          created_at?: string
          employee_id: string
          first_payment_amount?: number | null
          first_payment_date?: string | null
          id?: string
          lead_link?: string | null
          mop_name?: string | null
          payment_month_1?: number | null
          payment_month_1_completed?: boolean
          payment_month_1_date?: string | null
          payment_month_2?: number | null
          payment_month_2_completed?: boolean
          payment_month_2_date?: string | null
          payment_month_3?: number | null
          payment_month_3_completed?: boolean
          payment_month_3_date?: string | null
          payout_1?: number | null
          payout_1_completed?: boolean
          payout_1_date?: string | null
          payout_2?: number | null
          payout_2_completed?: boolean
          payout_2_date?: string | null
          payout_3?: number | null
          payout_3_completed?: boolean
          payout_3_date?: string | null
          recommendation_name?: string | null
          remaining_payment?: number | null
          reward_amount?: number | null
          updated_at?: string
        }
        Update: {
          agent_full_name?: string
          agent_phone?: string
          client_category?: string | null
          created_at?: string
          employee_id?: string
          first_payment_amount?: number | null
          first_payment_date?: string | null
          id?: string
          lead_link?: string | null
          mop_name?: string | null
          payment_month_1?: number | null
          payment_month_1_completed?: boolean
          payment_month_1_date?: string | null
          payment_month_2?: number | null
          payment_month_2_completed?: boolean
          payment_month_2_date?: string | null
          payment_month_3?: number | null
          payment_month_3_completed?: boolean
          payment_month_3_date?: string | null
          payout_1?: number | null
          payout_1_completed?: boolean
          payout_1_date?: string | null
          payout_2?: number | null
          payout_2_completed?: boolean
          payout_2_date?: string | null
          payout_3?: number | null
          payout_3_completed?: boolean
          payout_3_date?: string | null
          recommendation_name?: string | null
          remaining_payment?: number | null
          reward_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          city: string | null
          contract_amount: number
          contract_date: string
          created_at: string | null
          deposit_paid: number | null
          deposit_target: number | null
          employee_id: string | null
          first_payment: number
          full_name: string
          id: string
          installment_period: number
          is_suspended: boolean
          is_terminated: boolean
          manager: string | null
          monthly_payment: number
          payment_day: number
          remaining_amount: number
          source: string | null
          suspended_at: string | null
          suspension_reason: string | null
          terminated_at: string | null
          termination_reason: string | null
          total_paid: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          contract_amount: number
          contract_date?: string
          created_at?: string | null
          deposit_paid?: number | null
          deposit_target?: number | null
          employee_id?: string | null
          first_payment: number
          full_name: string
          id?: string
          installment_period: number
          is_suspended?: boolean
          is_terminated?: boolean
          manager?: string | null
          monthly_payment: number
          payment_day?: number
          remaining_amount?: number
          source?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          terminated_at?: string | null
          termination_reason?: string | null
          total_paid?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          contract_amount?: number
          contract_date?: string
          created_at?: string | null
          deposit_paid?: number | null
          deposit_target?: number | null
          employee_id?: string | null
          first_payment?: number
          full_name?: string
          id?: string
          installment_period?: number
          is_suspended?: boolean
          is_terminated?: boolean
          manager?: string | null
          monthly_payment?: number
          payment_day?: number
          remaining_amount?: number
          source?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          terminated_at?: string | null
          termination_reason?: string | null
          total_paid?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      employee_bonuses: {
        Row: {
          agents_count: number | null
          created_at: string
          employee_id: string
          id: string
          month: number
          reviews_count: number | null
          updated_at: string
          year: number
        }
        Insert: {
          agents_count?: number | null
          created_at?: string
          employee_id: string
          id?: string
          month: number
          reviews_count?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          agents_count?: number | null
          created_at?: string
          employee_id?: string
          id?: string
          month?: number
          reviews_count?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          changed_at: string
          changed_by: string
          client_id: string
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          payment_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          client_id: string
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          payment_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          client_id?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_receipts: {
        Row: {
          client_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          payment_id: string | null
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          payment_id?: string | null
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          payment_id?: string | null
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          custom_amount: number | null
          due_date: string
          id: string
          is_completed: boolean
          original_amount: number
          payment_number: number
          payment_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          custom_amount?: number | null
          due_date: string
          id?: string
          is_completed?: boolean
          original_amount: number
          payment_number: number
          payment_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          custom_amount?: number | null
          due_date?: string
          id?: string
          is_completed?: boolean
          original_amount?: number
          payment_number?: number
          payment_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_first_admin: { Args: never; Returns: undefined }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin: { Args: { user_uuid?: string }; Returns: boolean }
      recalculate_remaining_amounts: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "employee"
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
      app_role: ["admin", "employee"],
    },
  },
} as const
