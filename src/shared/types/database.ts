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
      comments: {
        Row: {
          author_name: string
          author_user_id: string | null
          body: string
          created_at: string
          group_id: string
          id: string
          task_id: string
        }
        Insert: {
          author_name: string
          author_user_id?: string | null
          body: string
          created_at?: string
          group_id: string
          id?: string
          task_id: string
        }
        Update: {
          author_name?: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_task_fkey"
            columns: ["group_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["group_id", "id"]
          },
        ]
      }
      group_invitations: {
        Row: {
          created_at: string
          expires_at: string
          group_id: string
          id: string
          inviter_name: string
          inviter_user_id: string | null
          recipient_user_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          group_id: string
          id?: string
          inviter_name: string
          inviter_user_id?: string | null
          recipient_user_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          group_id?: string
          id?: string
          inviter_name?: string
          inviter_user_id?: string | null
          recipient_user_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_sender_fkey"
            columns: ["group_id", "inviter_user_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["group_id", "user_id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          invited_by_user_id: string | null
          is_active: boolean
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          invited_by_user_id?: string | null
          is_active?: boolean
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          invited_by_user_id?: string | null
          is_active?: boolean
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by_name: string
          created_by_user_id: string | null
          id: string
          name: string
          owner_membership_active: boolean
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_name: string
          created_by_user_id?: string | null
          id?: string
          name: string
          owner_membership_active?: boolean
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_name?: string
          created_by_user_id?: string | null
          id?: string
          name?: string
          owner_membership_active?: boolean
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_active_owner_fkey"
            columns: ["id", "owner_user_id", "owner_membership_active"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["group_id", "user_id", "is_active"]
          },
          {
            foreignKeyName: "groups_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          created_by_user_id: string | null
          group_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by_user_id?: string | null
          group_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by_user_id?: string | null
          group_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labels_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_color?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      task_activity: {
        Row: {
          actor_name: string
          actor_user_id: string | null
          created_at: string
          event_type: string
          group_id: string
          id: string
          payload: Json
          task_id: string
        }
        Insert: {
          actor_name: string
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          group_id: string
          id?: string
          payload: Json
          task_id: string
        }
        Update: {
          actor_name?: string
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          group_id?: string
          id?: string
          payload?: Json
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_fkey"
            columns: ["group_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["group_id", "id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_by_user_id: string | null
          assignee_avatar_color: string | null
          assignee_name: string
          assignee_user_id: string
          created_at: string
          group_id: string
          membership_active: boolean
          task_id: string
        }
        Insert: {
          assigned_by_user_id?: string | null
          assignee_avatar_color?: string | null
          assignee_name: string
          assignee_user_id: string
          created_at?: string
          group_id: string
          membership_active?: boolean
          task_id: string
        }
        Update: {
          assigned_by_user_id?: string | null
          assignee_avatar_color?: string | null
          assignee_name?: string
          assignee_user_id?: string
          created_at?: string
          group_id?: string
          membership_active?: boolean
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_active_member_fkey"
            columns: ["group_id", "assignee_user_id", "membership_active"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["group_id", "user_id", "is_active"]
          },
          {
            foreignKeyName: "task_assignments_assigned_by_user_id_fkey"
            columns: ["assigned_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_task_fkey"
            columns: ["group_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["group_id", "id"]
          },
        ]
      }
      task_labels: {
        Row: {
          created_at: string
          group_id: string
          label_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          label_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_label_fkey"
            columns: ["group_id", "label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["group_id", "id"]
          },
          {
            foreignKeyName: "task_labels_task_fkey"
            columns: ["group_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["group_id", "id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          created_by_name: string
          created_by_user_id: string | null
          description: string | null
          due_date: string | null
          group_id: string
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_name: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          group_id: string
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_name?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          group_id?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_group: {
        Args: { p_group_id?: string; p_name: string }
        Returns: Json
      }
      delete_group: { Args: { p_group_id: string }; Returns: Json }
      delete_task: {
        Args: {
          p_expected_updated_at: string
          p_group_id: string
          p_task_id: string
        }
        Returns: Json
      }
      leave_group: { Args: { p_group_id: string }; Returns: Json }
      list_group_invitations: {
        Args: { p_before_id?: string; p_before_time?: string; p_limit?: number }
        Returns: Json
      }
      lookup_invitation_target: {
        Args: { p_group_id: string; p_query: string }
        Returns: Json
      }
      post_comment: {
        Args: {
          p_body: string
          p_comment_id?: string
          p_group_id: string
          p_task_id: string
        }
        Returns: Json
      }
      remove_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: Json
      }
      rename_group: {
        Args: { p_group_id: string; p_name: string }
        Returns: Json
      }
      respond_group_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: Json
      }
      revoke_group_invitation: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      save_label: {
        Args: {
          p_archived?: boolean
          p_color?: string
          p_expected_updated_at?: string
          p_group_id: string
          p_label_id: string
          p_name?: string
        }
        Returns: Json
      }
      save_task: {
        Args: {
          p_assignee_ids?: string[]
          p_changes?: Json
          p_expected_updated_at?: string
          p_group_id: string
          p_label_ids?: string[]
          p_task_id: string
        }
        Returns: Json
      }
      send_group_invitation: {
        Args: {
          p_group_id: string
          p_invitation_id?: string
          p_recipient_user_id: string
        }
        Returns: Json
      }
      transfer_group_ownership: {
        Args: { p_group_id: string; p_user_id: string }
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
    Enums: {},
  },
} as const
