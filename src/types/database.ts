
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
                },"customers": {
                  Row: {
                    "address": string | null,"contact_name": string | null,"created_at": string,"created_by": string | null,"credit_days": number,"email": string | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"organization_id": string,"phone": string | null,"rfc": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"credit_days"?: number,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"organization_id": string,"phone"?: string | null,"rfc"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"credit_days"?: number,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"organization_id"?: string,"phone"?: string | null,"rfc"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"employees": {
                  Row: {
                    "created_at": string,"created_by": string | null,"daily_wage": number,"full_name": string,"id": string,"is_active": boolean,"notes": string | null,"organization_id": string,"phone": string | null,"position": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"daily_wage": number,"full_name": string,"id"?: string,"is_active"?: boolean,"notes"?: string | null,"organization_id": string,"phone"?: string | null,"position"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"daily_wage"?: number,"full_name"?: string,"id"?: string,"is_active"?: boolean,"notes"?: string | null,"organization_id"?: string,"phone"?: string | null,"position"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "employees_organization_id_fkey"
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
                },"harvests": {
                  Row: {
                    "created_at": string,"created_by": string | null,"harvest_date": string,"id": string,"notes": string | null,"organization_id": string,"packages": number | null,"plot_id": string,"project_id": string,"quality": Database["public"]['Enums']["harvest_quality"],"quantity_kg": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"harvest_date": string,"id"?: string,"notes"?: string | null,"organization_id": string,"packages"?: number | null,"plot_id": string,"project_id": string,"quality"?: Database["public"]['Enums']["harvest_quality"],"quantity_kg": number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"harvest_date"?: string,"id"?: string,"notes"?: string | null,"organization_id"?: string,"packages"?: number | null,"plot_id"?: string,"project_id"?: string,"quality"?: Database["public"]['Enums']["harvest_quality"],"quantity_kg"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "harvests_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "harvests_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "harvests_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "harvests_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"movement_date": string,"movement_type": Database["public"]['Enums']["inventory_movement_type"],"notes": string | null,"organization_id": string,"plot_id": string | null,"product_id": string,"project_id": string | null,"quantity": number,"reference": string | null,"reverses_id": string | null,"stock_after": number,"supplier": string | null,"total_cost": number,"unit_cost": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id": string,"movement_date": string,"movement_type": Database["public"]['Enums']["inventory_movement_type"],"notes"?: string | null,"organization_id": string,"plot_id"?: string | null,"product_id": string,"project_id"?: string | null,"quantity": number,"reference"?: string | null,"reverses_id"?: string | null,"stock_after": number,"supplier"?: string | null,"total_cost": number,"unit_cost"?: never
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"movement_date"?: string,"movement_type"?: Database["public"]['Enums']["inventory_movement_type"],"notes"?: string | null,"organization_id"?: string,"plot_id"?: string | null,"product_id"?: string,"project_id"?: string | null,"quantity"?: number,"reference"?: string | null,"reverses_id"?: string | null,"stock_after"?: number,"supplier"?: string | null,"total_cost"?: number,"unit_cost"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "inventory_products"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_movements_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_movements_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "inventory_movements_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
    },{
      foreignKeyName: "inventory_movements_reverses_id_fkey"
      columns: ["reverses_id"]
isOneToOne: true
      referencedRelation: "inventory_movements"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_products": {
                  Row: {
                    "avg_cost": number | null,"category": Database["public"]['Enums']["input_category"],"created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"min_stock": number | null,"name": string,"notes": string | null,"organization_id": string,"sku": string | null,"stock": number,"stock_value": number,"unit": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_cost"?: never,"category"?: Database["public"]['Enums']["input_category"],"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"min_stock"?: number | null,"name": string,"notes"?: string | null,"organization_id": string,"sku"?: string | null,"stock"?: number,"stock_value"?: number,"unit": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "avg_cost"?: never,"category"?: Database["public"]['Enums']["input_category"],"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"min_stock"?: number | null,"name"?: string,"notes"?: string | null,"organization_id"?: string,"sku"?: string | null,"stock"?: number,"stock_value"?: number,"unit"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_products_organization_id_fkey"
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
                },"labor_records": {
                  Row: {
                    "activity": string,"amount": number | null,"created_at": string,"created_by": string | null,"crew": string | null,"employee_id": string | null,"id": string,"notes": string | null,"organization_id": string,"pay_type": Database["public"]['Enums']["labor_pay_type"],"plot_id": string | null,"project_id": string,"quantity": number,"unit_label": string | null,"unit_rate": number,"updated_at": string,"updated_by": string | null,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity": string,"amount"?: never,"created_at"?: string,"created_by"?: string | null,"crew"?: string | null,"employee_id"?: string | null,"id"?: string,"notes"?: string | null,"organization_id": string,"pay_type"?: Database["public"]['Enums']["labor_pay_type"],"plot_id"?: string | null,"project_id": string,"quantity": number,"unit_label"?: string | null,"unit_rate": number,"updated_at"?: string,"updated_by"?: string | null,"work_date": string
                  }
                  Update: {
                    "activity"?: string,"amount"?: never,"created_at"?: string,"created_by"?: string | null,"crew"?: string | null,"employee_id"?: string | null,"id"?: string,"notes"?: string | null,"organization_id"?: string,"pay_type"?: Database["public"]['Enums']["labor_pay_type"],"plot_id"?: string | null,"project_id"?: string,"quantity"?: number,"unit_label"?: string | null,"unit_rate"?: number,"updated_at"?: string,"updated_by"?: string | null,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "labor_records_organization_id_employee_id_fkey"
      columns: ["organization_id","employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "labor_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "labor_records_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "labor_records_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "labor_records_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
    }
                  ]
                },"machinery": {
                  Row: {
                    "code": string | null,"created_at": string,"created_by": string | null,"hourly_cost": number,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["machine_kind"],"name": string,"notes": string | null,"organization_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"created_at"?: string,"created_by"?: string | null,"hourly_cost": number,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["machine_kind"],"name": string,"notes"?: string | null,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "code"?: string | null,"created_at"?: string,"created_by"?: string | null,"hourly_cost"?: number,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["machine_kind"],"name"?: string,"notes"?: string | null,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "machinery_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"machinery_usage": {
                  Row: {
                    "activity": string | null,"amount": number | null,"created_at": string,"created_by": string | null,"hourly_rate": number,"hours": number,"id": string,"machine_id": string,"notes": string | null,"operator": string | null,"organization_id": string,"plot_id": string | null,"project_id": string,"updated_at": string,"updated_by": string | null,"usage_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity"?: string | null,"amount"?: never,"created_at"?: string,"created_by"?: string | null,"hourly_rate": number,"hours": number,"id"?: string,"machine_id": string,"notes"?: string | null,"operator"?: string | null,"organization_id": string,"plot_id"?: string | null,"project_id": string,"updated_at"?: string,"updated_by"?: string | null,"usage_date": string
                  }
                  Update: {
                    "activity"?: string | null,"amount"?: never,"created_at"?: string,"created_by"?: string | null,"hourly_rate"?: number,"hours"?: number,"id"?: string,"machine_id"?: string,"notes"?: string | null,"operator"?: string | null,"organization_id"?: string,"plot_id"?: string | null,"project_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"usage_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "machinery_usage_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "machinery_usage_organization_id_machine_id_fkey"
      columns: ["organization_id","machine_id"]
isOneToOne: false
      referencedRelation: "machinery"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "machinery_usage_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "machinery_usage_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "machinery_usage_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
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
                },"payments": {
                  Row: {
                    "amount": number,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"id": string,"method": Database["public"]['Enums']["payment_method"],"notes": string | null,"organization_id": string,"payment_date": string,"reference": string | null,"sale_id": string,"status": Database["public"]['Enums']["payment_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id": string,"method": Database["public"]['Enums']["payment_method"],"notes"?: string | null,"organization_id": string,"payment_date": string,"reference"?: string | null,"sale_id": string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"notes"?: string | null,"organization_id"?: string,"payment_date"?: string,"reference"?: string | null,"sale_id"?: string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "payments_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_balances"
      referencedColumns: ["organization_id","id"]
    }
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
                },"project_expenses": {
                  Row: {
                    "amount": number,"category": Database["public"]['Enums']["expense_category"],"created_at": string,"created_by": string | null,"description": string,"expense_date": string,"id": string,"invoice_ref": string | null,"notes": string | null,"organization_id": string,"plot_id": string | null,"project_id": string,"supplier": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": Database["public"]['Enums']["expense_category"],"created_at"?: string,"created_by"?: string | null,"description": string,"expense_date": string,"id"?: string,"invoice_ref"?: string | null,"notes"?: string | null,"organization_id": string,"plot_id"?: string | null,"project_id": string,"supplier"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"category"?: Database["public"]['Enums']["expense_category"],"created_at"?: string,"created_by"?: string | null,"description"?: string,"expense_date"?: string,"id"?: string,"invoice_ref"?: string | null,"notes"?: string | null,"organization_id"?: string,"plot_id"?: string | null,"project_id"?: string,"supplier"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_expenses_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_expenses_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "project_expenses_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "project_expenses_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
    }
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
    },{
      foreignKeyName: "project_plots_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
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
    },{
      foreignKeyName: "project_status_history_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
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
                },"sale_items": {
                  Row: {
                    "amount": number | null,"description": string,"id": string,"organization_id": string,"project_id": string,"quality": Database["public"]['Enums']["harvest_quality"] | null,"quantity_kg": number,"sale_id": string,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: never,"description": string,"id"?: string,"organization_id": string,"project_id": string,"quality"?: Database["public"]['Enums']["harvest_quality"] | null,"quantity_kg": number,"sale_id": string,"unit_price": number
                  }
                  Update: {
                    "amount"?: never,"description"?: string,"id"?: string,"organization_id"?: string,"project_id"?: string,"quality"?: Database["public"]['Enums']["harvest_quality"] | null,"quantity_kg"?: number,"sale_id"?: string,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_items_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "sale_items_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "sale_items_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "sale_items_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_balances"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "amount_paid": number,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"created_at": string,"created_by": string | null,"customer_id": string,"due_date": string,"id": string,"notes": string | null,"organization_id": string,"sale_date": string,"status": Database["public"]['Enums']["sale_status"],"total": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paid"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"due_date": string,"id": string,"notes"?: string | null,"organization_id": string,"sale_date": string,"status"?: Database["public"]['Enums']["sale_status"],"total"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount_paid"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"due_date"?: string,"id"?: string,"notes"?: string | null,"organization_id"?: string,"sale_date"?: string,"status"?: Database["public"]['Enums']["sale_status"],"total"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_organization_id_customer_id_fkey"
      columns: ["organization_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "sales_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_project_cost_entries": {
                  Row: {
                    "amount": number | null,"concept": string | null,"created_at": string | null,"detail": string | null,"entry_date": string | null,"expense_category": Database["public"]['Enums']["expense_category"] | null,"organization_id": string | null,"plot_id": string | null,"project_id": string | null,"source": string | null,"source_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_project_costs": {
                  Row: {
                    "area_ha": number | null,"available_kg": number | null,"budget_amount": number | null,"budget_used_pct": number | null,"code": string,"collected_amount": number | null,"cost_per_ha": number | null,"cost_per_kg": number | null,"expenses_cost": number | null,"gross_profit": number | null,"harvested_kg": number | null,"inputs_cost": number | null,"labor_cost": number | null,"machinery_cost": number | null,"name": string,"organization_id": string,"project_id": string,"receivable_amount": number | null,"sales_amount": number | null,"sold_kg": number | null,"status": Database["public"]['Enums']["project_status"],"total_cost": number | null,"yield_kg_per_ha": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "projects_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"v_sale_balances": {
                  Row: {
                    "amount_paid": number,"balance": number | null,"code": string,"created_at": string,"customer_id": string,"customer_name": string,"days_overdue": number | null,"due_date": string,"id": string,"organization_id": string,"payment_status": string | null,"sale_date": string,"status": Database["public"]['Enums']["sale_status"],"total": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sales_organization_id_customer_id_fkey"
      columns: ["organization_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "sales_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "cancel_invitation":
{ Args: { "p_invitation": string }; Returns: undefined
                           },
"cancel_payment":
{ Args: { "p_payment": string,"p_reason": string }; Returns: undefined
                           },
"cancel_sale":
{ Args: { "p_reason": string,"p_sale": string }; Returns: undefined
                           },
"change_project_status":
{ Args: { "p_note"?: string,"p_project": string,"p_status": Database["public"]['Enums']["project_status"] }; Returns: undefined
                           },
"create_organization":
{ Args: { "p_name": string }; Returns: string
                           },
"create_sale":
{ Args: { "p_customer": string,"p_due_date"?: string,"p_id": string,"p_items": Json,"p_notes"?: string,"p_sale_date": string }; Returns: string
                           },
"dashboard_summary":
{ Args: { "p_org": string }; Returns: Json
                           },
"finance_summary":
{ Args: { "p_org": string }; Returns: Json
                           },
"has_role":
{ Args: { "p_org": string,"p_roles": (Database["public"]['Enums']["app_role"])[] }; Returns: boolean
                           },
"inventory_outflow_value":
{ Args: { "p_product": Omit<Database["public"]['Tables']["inventory_products"]['Row'], Database["public"]['Tables']["inventory_products"]['ComputedFields']>,"p_quantity": number }; Returns: number
                           },
"invite_member":
{ Args: { "p_email": string,"p_org": string,"p_role": Database["public"]['Enums']["app_role"] }; Returns: string
                           },
"is_member":
{ Args: { "p_org": string }; Returns: boolean
                           },
"lock_open_project":
{ Args: { "p_exclusive"?: boolean,"p_org": string,"p_project": string }; Returns: {
              "budget_amount": number | null,
"code": string,
"created_at": string,
"created_by": string | null,
"crop_id": string,
"description": string | null,
"end_date": string | null,
"expected_harvest_date": string | null,
"expected_yield": number | null,
"id": string,
"name": string,
"organization_id": string,
"planting_date": string | null,
"responsible_id": string | null,
"season": string | null,
"start_date": string,
"status": Database["public"]['Enums']["project_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "projects"
        isOneToOne: true
        isSetofReturn: false
      } },
"mx_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"next_folio":
{ Args: { "p_org": string,"p_prefix": string,"p_scope": string }; Returns: string
                           },
"parse_sale_items":
{ Args: { "p_items": Json }; Returns: {
              "description": string,"project_id": string,"quality": Database["public"]['Enums']["harvest_quality"],"quantity_kg": number,"unit_price": number
            }[]
                           },
"plot_assigned_area":
{ Args: { "p_exclude"?: string,"p_plot": string }; Returns: number
                           },
"post_inventory_movement":
{ Args: { "p_date": string,"p_id": string,"p_notes": string,"p_plot": string,"p_product": Omit<Database["public"]['Tables']["inventory_products"]['Row'], Database["public"]['Tables']["inventory_products"]['ComputedFields']>,"p_project": string,"p_quantity": number,"p_reference": string,"p_reverses": string,"p_supplier": string,"p_total": number,"p_type": Database["public"]['Enums']["inventory_movement_type"] }; Returns: string
                           },
"project_harvested_kg":
{ Args: { "p_project": string }; Returns: number
                           },
"project_sold_kg":
{ Args: { "p_project": string }; Returns: number
                           },
"project_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["project_status"],"p_to": Database["public"]['Enums']["project_status"] }; Returns: boolean
                           },
"register_inventory_movement":
{ Args: { "p_date": string,"p_id": string,"p_notes"?: string,"p_plot"?: string,"p_product": string,"p_project"?: string,"p_quantity": number,"p_reference"?: string,"p_supplier"?: string,"p_type": Database["public"]['Enums']["inventory_movement_type"],"p_unit_cost"?: number }; Returns: string
                           },
"register_payment":
{ Args: { "p_amount": number,"p_date": string,"p_id": string,"p_method": Database["public"]['Enums']["payment_method"],"p_notes"?: string,"p_reference"?: string,"p_sale": string }; Returns: string
                           },
"reverse_inventory_movement":
{ Args: { "p_id": string,"p_movement": string,"p_reason": string }; Returns: string
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
            "app_role": "propietario"|"administrador"|"agronomo"|"supervisor"|"almacen"|"finanzas"|"consulta","expense_category": "renta_tierra"|"agua_riego"|"energia"|"fletes"|"servicios_profesionales"|"maquila"|"seguros"|"financiamiento"|"derechos_impuestos"|"otros","harvest_quality": "primera"|"segunda"|"tercera"|"unica","input_category": "semilla"|"fertilizante"|"agroquimico"|"combustible"|"empaque"|"otro","inventory_movement_type": "entrada"|"consumo"|"devolucion"|"ajuste_entrada"|"ajuste_salida","invitation_status": "pendiente"|"aceptada"|"cancelada","irrigation_type": "temporal"|"goteo"|"aspersion"|"microaspersion"|"gravedad"|"pivote"|"otro","labor_pay_type": "jornal"|"destajo","machine_kind": "tractor"|"cosechadora"|"aspersora"|"implemento"|"vehiculo"|"bomba"|"otro","membership_status": "activo"|"inactivo","payment_method": "efectivo"|"transferencia"|"cheque"|"deposito"|"otro","payment_status": "aplicado"|"cancelado","project_status": "planeacion"|"preparacion"|"siembra"|"desarrollo"|"cosecha"|"comercializacion"|"cerrado"|"cancelado","sale_status": "vigente"|"cancelada"
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
            "app_role": ["propietario", "administrador", "agronomo", "supervisor", "almacen", "finanzas", "consulta"],"expense_category": ["renta_tierra", "agua_riego", "energia", "fletes", "servicios_profesionales", "maquila", "seguros", "financiamiento", "derechos_impuestos", "otros"],"harvest_quality": ["primera", "segunda", "tercera", "unica"],"input_category": ["semilla", "fertilizante", "agroquimico", "combustible", "empaque", "otro"],"inventory_movement_type": ["entrada", "consumo", "devolucion", "ajuste_entrada", "ajuste_salida"],"invitation_status": ["pendiente", "aceptada", "cancelada"],"irrigation_type": ["temporal", "goteo", "aspersion", "microaspersion", "gravedad", "pivote", "otro"],"labor_pay_type": ["jornal", "destajo"],"machine_kind": ["tractor", "cosechadora", "aspersora", "implemento", "vehiculo", "bomba", "otro"],"membership_status": ["activo", "inactivo"],"payment_method": ["efectivo", "transferencia", "cheque", "deposito", "otro"],"payment_status": ["aplicado", "cancelado"],"project_status": ["planeacion", "preparacion", "siembra", "desarrollo", "cosecha", "comercializacion", "cerrado", "cancelado"],"sale_status": ["vigente", "cancelada"]
          }
        }
} as const
