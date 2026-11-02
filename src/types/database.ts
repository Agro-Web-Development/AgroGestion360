
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"organization_id": string | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"organization_id"?: string | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"organization_id"?: string | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"crops": {
                  Row: {
                    "created_at": string,"created_by": string | null,"cycle_days": number | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"organization_id": string,"scientific_name": string | null,"updated_at": string,"updated_by": string | null,"variety": string | null,"yield_unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"cycle_days"?: number | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"organization_id": string,"scientific_name"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"variety"?: string | null,"yield_unit"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"cycle_days"?: number | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"organization_id"?: string,"scientific_name"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"variety"?: string | null,"yield_unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crops_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"farms": {
                  Row: {
                    "address": string | null,"code": string | null,"created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"latitude": number | null,"longitude": number | null,"municipality": string | null,"name": string,"notes": string | null,"organization_id": string,"state": string | null,"total_area_ha": number | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"municipality"?: string | null,"name": string,"notes"?: string | null,"organization_id": string,"state"?: string | null,"total_area_ha"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"latitude"?: number | null,"longitude"?: number | null,"municipality"?: string | null,"name"?: string,"notes"?: string | null,"organization_id"?: string,"state"?: string | null,"total_area_ha"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "farms_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"created_by": string | null,"email": string,"expires_at": string,"id": string,"organization_id": string,"role": Database["public"]['Enums']["app_role"],"status": Database["public"]['Enums']["invitation_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"email": string,"expires_at"?: string,"id"?: string,"organization_id": string,"role": Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["invitation_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string,"expires_at"?: string,"id"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["invitation_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"organization_id": string,"role": Database["public"]['Enums']["app_role"],"status": Database["public"]['Enums']["membership_status"],"updated_at": string,"updated_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id": string,"role"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["membership_status"],"updated_at"?: string,"updated_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["app_role"],"status"?: Database["public"]['Enums']["membership_status"],"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_counters": {
                  Row: {
                    "organization_id": string,"scope": string,"value": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "organization_id": string,"scope": string,"value"?: number,"year": number
                  }
                  Update: {
                    "organization_id"?: string,"scope"?: string,"value"?: number,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_counters_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "address": string | null,"created_at": string,"created_by": string | null,"currency": string,"email": string | null,"id": string,"is_demo": boolean,"legal_name": string | null,"name": string,"phone": string | null,"plan": string,"rfc": string | null,"timezone": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"email"?: string | null,"id"?: string,"is_demo"?: boolean,"legal_name"?: string | null,"name": string,"phone"?: string | null,"plan"?: string,"rfc"?: string | null,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"email"?: string | null,"id"?: string,"is_demo"?: boolean,"legal_name"?: string | null,"name"?: string,"phone"?: string | null,"plan"?: string,"rfc"?: string | null,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"plots": {
                  Row: {
                    "area_ha": number,"code": string | null,"created_at": string,"created_by": string | null,"farm_id": string,"id": string,"irrigation_type": Database["public"]['Enums']["irrigation_type"],"is_active": boolean,"name": string,"notes": string | null,"organization_id": string,"soil_type": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area_ha": number,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"farm_id": string,"id"?: string,"irrigation_type"?: Database["public"]['Enums']["irrigation_type"],"is_active"?: boolean,"name": string,"notes"?: string | null,"organization_id": string,"soil_type"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "area_ha"?: number,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"farm_id"?: string,"id"?: string,"irrigation_type"?: Database["public"]['Enums']["irrigation_type"],"is_active"?: boolean,"name"?: string,"notes"?: string | null,"organization_id"?: string,"soil_type"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "plots_organization_id_farm_id_fkey"
      columns: ["organization_id","farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "plots_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"phone": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"phone"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"project_plots": {
                  Row: {
                    "assigned_area_ha": number,"created_at": string,"created_by": string | null,"id": string,"organization_id": string,"plot_id": string,"project_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_area_ha": number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id": string,"plot_id": string,"project_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "assigned_area_ha"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id"?: string,"plot_id"?: string,"project_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_plots_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_plots_organization_id_plot_id_fkey"
      columns: ["organization_id","plot_id"]
isOneToOne: false
      referencedRelation: "plots"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "project_plots_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"project_status_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"from_status": Database["public"]['Enums']["project_status"] | null,"id": number,"note": string | null,"organization_id": string,"project_id": string,"to_status": Database["public"]['Enums']["project_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"from_status"?: Database["public"]['Enums']["project_status"] | null,"id"?: never,"note"?: string | null,"organization_id": string,"project_id": string,"to_status": Database["public"]['Enums']["project_status"]
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"from_status"?: Database["public"]['Enums']["project_status"] | null,"id"?: never,"note"?: string | null,"organization_id"?: string,"project_id"?: string,"to_status"?: Database["public"]['Enums']["project_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_status_history_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "budget_amount": number | null,"code": string,"created_at": string,"created_by": string | null,"crop_id": string,"description": string | null,"end_date": string | null,"expected_harvest_date": string | null,"expected_yield": number | null,"id": string,"name": string,"organization_id": string,"planting_date": string | null,"responsible_id": string | null,"season": string | null,"start_date": string,"status": Database["public"]['Enums']["project_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_amount"?: number | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"crop_id": string,"description"?: string | null,"end_date"?: string | null,"expected_harvest_date"?: string | null,"expected_yield"?: number | null,"id"?: string,"name": string,"organization_id": string,"planting_date"?: string | null,"responsible_id"?: string | null,"season"?: string | null,"start_date": string,"status"?: Database["public"]['Enums']["project_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "budget_amount"?: number | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"crop_id"?: string,"description"?: string | null,"end_date"?: string | null,"expected_harvest_date"?: string | null,"expected_yield"?: number | null,"id"?: string,"name"?: string,"organization_id"?: string,"planting_date"?: string | null,"responsible_id"?: string | null,"season"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["project_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_organization_id_crop_id_fkey"
      columns: ["organization_id","crop_id"]
isOneToOne: false
      referencedRelation: "crops"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "projects_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_responsible_id_fkey"
      columns: ["responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "cancel_invitation":
{ Args: { "p_invitation": string }; Returns: undefined
                           },
"change_project_status":
{ Args: { "p_note"?: string,"p_project": string,"p_status": Database["public"]['Enums']["project_status"] }; Returns: undefined
                           },
"create_organization":
{ Args: { "p_name": string }; Returns: string
                           },
"dashboard_summary":
{ Args: { "p_org": string }; Returns: Json
                           },
"has_role":
{ Args: { "p_org": string,"p_roles": (Database["public"]['Enums']["app_role"])[] }; Returns: boolean
                           },
"invite_member":
{ Args: { "p_email": string,"p_org": string,"p_role": Database["public"]['Enums']["app_role"] }; Returns: string
                           },
"is_member":
{ Args: { "p_org": string }; Returns: boolean
                           },
"next_folio":
{ Args: { "p_org": string,"p_prefix": string,"p_scope": string }; Returns: string
                           },
"plot_assigned_area":
{ Args: { "p_exclude"?: string,"p_plot": string }; Returns: number
                           },
"project_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["project_status"],"p_to": Database["public"]['Enums']["project_status"] }; Returns: boolean
                           },
"shares_organization":
{ Args: { "p_user": string }; Returns: boolean
                           },
"update_member":
{ Args: { "p_membership": string,"p_role": Database["public"]['Enums']["app_role"],"p_status": Database["public"]['Enums']["membership_status"] }; Returns: undefined
                           },
"user_role":
{ Args: { "p_org": string }; Returns: Database["public"]['Enums']["app_role"]
                           }
          }
          Enums: {
            "app_role": "propietario"|"administrador"|"agronomo"|"supervisor"|"almacen"|"finanzas"|"consulta","invitation_status": "pendiente"|"aceptada"|"cancelada","irrigation_type": "temporal"|"goteo"|"aspersion"|"microaspersion"|"gravedad"|"pivote"|"otro","membership_status": "activo"|"inactivo","project_status": "planeacion"|"preparacion"|"siembra"|"desarrollo"|"cosecha"|"comercializacion"|"cerrado"|"cancelado"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["propietario", "administrador", "agronomo", "supervisor", "almacen", "finanzas", "consulta"],"invitation_status": ["pendiente", "aceptada", "cancelada"],"irrigation_type": ["temporal", "goteo", "aspersion", "microaspersion", "gravedad", "pivote", "otro"],"membership_status": ["activo", "inactivo"],"project_status": ["planeacion", "preparacion", "siembra", "desarrollo", "cosecha", "comercializacion", "cerrado", "cancelado"]
          }
        }
} as const
