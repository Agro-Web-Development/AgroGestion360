
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
            "activity_types": {
                  Row: {
                    "cost_category": Database["public"]['Enums']["budget_category"],"created_at": string,"created_by": string | null,"description": string | null,"id": string,"is_active": boolean,"name": string,"organization_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_category"?: Database["public"]['Enums']["budget_category"],"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cost_category"?: Database["public"]['Enums']["budget_category"],"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_types_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"advance_applications": {
                  Row: {
                    "amount": number,"application_date": string,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"id": string,"organization_id": string,"payment_id": string,"sale_id": string,"status": Database["public"]['Enums']["payment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"application_date": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id": string,"organization_id": string,"payment_id": string,"sale_id": string,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Update: {
                    "amount"?: number,"application_date"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id"?: string,"payment_id"?: string,"sale_id"?: string,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "advance_applications_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "advance_applications_organization_id_payment_id_fkey"
      columns: ["organization_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "advance_applications_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "advance_applications_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_balances"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "created_at": string,"created_by": string | null,"entity_id": string,"entity_type": string,"file_name": string,"id": string,"mime_type": string,"organization_id": string,"size_bytes": number,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"entity_id": string,"entity_type": string,"file_name": string,"id"?: string,"mime_type": string,"organization_id": string,"size_bytes": number,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"entity_id"?: string,"entity_type"?: string,"file_name"?: string,"id"?: string,"mime_type"?: string,"organization_id"?: string,"size_bytes"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_records": {
                  Row: {
                    "check_in": string | null,"check_out": string | null,"created_at": string,"created_by": string | null,"employee_id": string,"id": string,"notes": string | null,"organization_id": string,"status": Database["public"]['Enums']["attendance_status"],"updated_at": string,"updated_by": string | null,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "check_in"?: string | null,"check_out"?: string | null,"created_at"?: string,"created_by"?: string | null,"employee_id": string,"id"?: string,"notes"?: string | null,"organization_id": string,"status"?: Database["public"]['Enums']["attendance_status"],"updated_at"?: string,"updated_by"?: string | null,"work_date": string
                  }
                  Update: {
                    "check_in"?: string | null,"check_out"?: string | null,"created_at"?: string,"created_by"?: string | null,"employee_id"?: string,"id"?: string,"notes"?: string | null,"organization_id"?: string,"status"?: Database["public"]['Enums']["attendance_status"],"updated_at"?: string,"updated_by"?: string | null,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_records_organization_id_employee_id_fkey"
      columns: ["organization_id","employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "attendance_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
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
                },"cash_movements": {
                  Row: {
                    "amount": number,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"concept": string,"created_at": string,"created_by": string | null,"direction": string | null,"expense_id": string | null,"id": string,"kind": Database["public"]['Enums']["cash_kind"],"method": Database["public"]['Enums']["payment_method"],"movement_date": string,"notes": string | null,"organization_id": string,"project_id": string | null,"reference": string | null,"status": Database["public"]['Enums']["payment_status"],"supplier_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"concept": string,"created_at"?: string,"created_by"?: string | null,"direction"?: never,"expense_id"?: string | null,"id": string,"kind": Database["public"]['Enums']["cash_kind"],"method": Database["public"]['Enums']["payment_method"],"movement_date": string,"notes"?: string | null,"organization_id": string,"project_id"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"concept"?: string,"created_at"?: string,"created_by"?: string | null,"direction"?: never,"expense_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["cash_kind"],"method"?: Database["public"]['Enums']["payment_method"],"movement_date"?: string,"notes"?: string | null,"organization_id"?: string,"project_id"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_movements_organization_id_expense_id_fkey"
      columns: ["organization_id","expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "cash_movements_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cash_movements_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "cash_movements_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "cash_movements_organization_id_supplier_id_fkey"
      columns: ["organization_id","supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"chemical_applications": {
                  Row: {
                    "active_ingredient": string | null,"application_date": string,"application_time": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"equipment": string | null,"id": string,"inventory_movement_id": string | null,"lot_id": string | null,"lot_number": string | null,"machine_id": string | null,"notes": string | null,"organization_id": string,"plot_id": string,"preharvest_days": number | null,"product_id": string,"project_id": string,"quantity": number,"reentry_hours": number | null,"responsible_id": string | null,"status": Database["public"]['Enums']["log_status"],"treated_area_ha": number,"unit": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active_ingredient"?: string | null,"application_date": string,"application_time"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"equipment"?: string | null,"id": string,"inventory_movement_id"?: string | null,"lot_id"?: string | null,"lot_number"?: string | null,"machine_id"?: string | null,"notes"?: string | null,"organization_id": string,"plot_id": string,"preharvest_days"?: number | null,"product_id": string,"project_id": string,"quantity": number,"reentry_hours"?: number | null,"responsible_id"?: string | null,"status"?: Database["public"]['Enums']["log_status"],"treated_area_ha": number,"unit": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active_ingredient"?: string | null,"application_date"?: string,"application_time"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"equipment"?: string | null,"id"?: string,"inventory_movement_id"?: string | null,"lot_id"?: string | null,"lot_number"?: string | null,"machine_id"?: string | null,"notes"?: string | null,"organization_id"?: string,"plot_id"?: string,"preharvest_days"?: number | null,"product_id"?: string,"project_id"?: string,"quantity"?: number,"reentry_hours"?: number | null,"responsible_id"?: string | null,"status"?: Database["public"]['Enums']["log_status"],"treated_area_ha"?: number,"unit"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chemical_applications_inventory_movement_id_fkey"
      columns: ["inventory_movement_id"]
isOneToOne: true
      referencedRelation: "inventory_movements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chemical_applications_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chemical_applications_organization_id_machine_id_fkey"
      columns: ["organization_id","machine_id"]
isOneToOne: false
      referencedRelation: "machinery"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "chemical_applications_organization_id_machine_id_fkey"
      columns: ["organization_id","machine_id"]
isOneToOne: false
      referencedRelation: "v_machinery_status"
      referencedColumns: ["organization_id","machine_id"]
    },{
      foreignKeyName: "chemical_applications_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "inventory_products"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "chemical_applications_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "chemical_applications_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "chemical_applications_organization_id_responsible_id_fkey"
      columns: ["organization_id","responsible_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "chemical_applications_product_id_lot_id_fkey"
      columns: ["product_id","lot_id"]
isOneToOne: false
      referencedRelation: "inventory_lots"
      referencedColumns: ["product_id","id"]
    },{
      foreignKeyName: "chemical_applications_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
    }
                  ]
                },"crew_members": {
                  Row: {
                    "created_at": string,"created_by": string | null,"crew_id": string,"employee_id": string,"id": string,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"crew_id": string,"employee_id": string,"id"?: string,"organization_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"crew_id"?: string,"employee_id"?: string,"id"?: string,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crew_members_organization_id_crew_id_fkey"
      columns: ["organization_id","crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "crew_members_organization_id_employee_id_fkey"
      columns: ["organization_id","employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "crew_members_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"crews": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"leader_id": string | null,"name": string,"notes": string | null,"organization_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"leader_id"?: string | null,"name": string,"notes"?: string | null,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"leader_id"?: string | null,"name"?: string,"notes"?: string | null,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "crews_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crews_organization_id_leader_id_fkey"
      columns: ["organization_id","leader_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
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
                    "address": string | null,"contact_name": string | null,"created_at": string,"created_by": string | null,"credit_days": number,"customer_type": Database["public"]['Enums']["customer_type"],"email": string | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"organization_id": string,"phone": string | null,"rfc": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"credit_days"?: number,"customer_type"?: Database["public"]['Enums']["customer_type"],"email"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"organization_id": string,"phone"?: string | null,"rfc"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"credit_days"?: number,"customer_type"?: Database["public"]['Enums']["customer_type"],"email"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"organization_id"?: string,"phone"?: string | null,"rfc"?: string | null,"updated_at"?: string,"updated_by"?: string | null
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
                },"employee_assignments": {
                  Row: {
                    "created_at": string,"created_by": string | null,"crew_id": string | null,"employee_id": string,"end_date": string | null,"id": string,"notes": string | null,"organization_id": string,"plot_id": string | null,"project_id": string,"role": string | null,"start_date": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"crew_id"?: string | null,"employee_id": string,"end_date"?: string | null,"id"?: string,"notes"?: string | null,"organization_id": string,"plot_id"?: string | null,"project_id": string,"role"?: string | null,"start_date": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"crew_id"?: string | null,"employee_id"?: string,"end_date"?: string | null,"id"?: string,"notes"?: string | null,"organization_id"?: string,"plot_id"?: string | null,"project_id"?: string,"role"?: string | null,"start_date"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "employee_assignments_organization_id_crew_id_fkey"
      columns: ["organization_id","crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "employee_assignments_organization_id_employee_id_fkey"
      columns: ["organization_id","employee_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "employee_assignments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "employee_assignments_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "employee_assignments_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "employee_assignments_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
    }
                  ]
                },"employees": {
                  Row: {
                    "created_at": string,"created_by": string | null,"daily_wage": number,"full_name": string,"hire_date": string | null,"id": string,"is_active": boolean,"notes": string | null,"organization_id": string,"phone": string | null,"position": string | null,"updated_at": string,"updated_by": string | null,"worker_type": Database["public"]['Enums']["worker_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"daily_wage": number,"full_name": string,"hire_date"?: string | null,"id"?: string,"is_active"?: boolean,"notes"?: string | null,"organization_id": string,"phone"?: string | null,"position"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"worker_type"?: Database["public"]['Enums']["worker_type"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"daily_wage"?: number,"full_name"?: string,"hire_date"?: string | null,"id"?: string,"is_active"?: boolean,"notes"?: string | null,"organization_id"?: string,"phone"?: string | null,"position"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"worker_type"?: Database["public"]['Enums']["worker_type"]
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
                },"expenses": {
                  Row: {
                    "allocation_method": Database["public"]['Enums']["allocation_method"],"amount": number,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"category": Database["public"]['Enums']["expense_category"],"cost_category": Database["public"]['Enums']["budget_category"],"created_at": string,"created_by": string | null,"description": string,"expense_date": string,"id": string,"invoice_ref": string | null,"notes": string | null,"organization_id": string,"paid_amount": number,"payment_method": Database["public"]['Enums']["payment_method"] | null,"responsible_id": string | null,"status": Database["public"]['Enums']["log_status"],"supplier_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allocation_method"?: Database["public"]['Enums']["allocation_method"],"amount": number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"category": Database["public"]['Enums']["expense_category"],"cost_category": Database["public"]['Enums']["budget_category"],"created_at"?: string,"created_by"?: string | null,"description": string,"expense_date": string,"id": string,"invoice_ref"?: string | null,"notes"?: string | null,"organization_id": string,"paid_amount"?: number,"payment_method"?: Database["public"]['Enums']["payment_method"] | null,"responsible_id"?: string | null,"status"?: Database["public"]['Enums']["log_status"],"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "allocation_method"?: Database["public"]['Enums']["allocation_method"],"amount"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"category"?: Database["public"]['Enums']["expense_category"],"cost_category"?: Database["public"]['Enums']["budget_category"],"created_at"?: string,"created_by"?: string | null,"description"?: string,"expense_date"?: string,"id"?: string,"invoice_ref"?: string | null,"notes"?: string | null,"organization_id"?: string,"paid_amount"?: number,"payment_method"?: Database["public"]['Enums']["payment_method"] | null,"responsible_id"?: string | null,"status"?: Database["public"]['Enums']["log_status"],"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_organization_id_supplier_id_fkey"
      columns: ["organization_id","supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "expenses_responsible_id_fkey"
      columns: ["responsible_id"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"field_activities": {
                  Row: {
                    "activity_date": string,"activity_type_id": string,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"cost": number,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"notes": string | null,"organization_id": string,"plot_id": string | null,"project_id": string,"responsible_id": string | null,"status": Database["public"]['Enums']["log_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_date": string,"activity_type_id": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"cost"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id": string,"notes"?: string | null,"organization_id": string,"plot_id"?: string | null,"project_id": string,"responsible_id"?: string | null,"status"?: Database["public"]['Enums']["log_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "activity_date"?: string,"activity_type_id"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"cost"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"notes"?: string | null,"organization_id"?: string,"plot_id"?: string | null,"project_id"?: string,"responsible_id"?: string | null,"status"?: Database["public"]['Enums']["log_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "field_activities_organization_id_activity_type_id_fkey"
      columns: ["organization_id","activity_type_id"]
isOneToOne: false
      referencedRelation: "activity_types"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "field_activities_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "field_activities_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "field_activities_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "field_activities_organization_id_responsible_id_fkey"
      columns: ["organization_id","responsible_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "field_activities_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
    }
                  ]
                },"field_observations": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"category": Database["public"]['Enums']["observation_category"],"created_at": string,"created_by": string | null,"description": string | null,"id": string,"latitude": number | null,"longitude": number | null,"observation_date": string,"observation_time": string | null,"organization_id": string,"plot_id": string | null,"project_id": string,"responsible_id": string | null,"severity": Database["public"]['Enums']["observation_severity"],"status": Database["public"]['Enums']["log_status"],"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"category": Database["public"]['Enums']["observation_category"],"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id": string,"latitude"?: number | null,"longitude"?: number | null,"observation_date": string,"observation_time"?: string | null,"organization_id": string,"plot_id"?: string | null,"project_id": string,"responsible_id"?: string | null,"severity"?: Database["public"]['Enums']["observation_severity"],"status"?: Database["public"]['Enums']["log_status"],"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"category"?: Database["public"]['Enums']["observation_category"],"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"observation_date"?: string,"observation_time"?: string | null,"organization_id"?: string,"plot_id"?: string | null,"project_id"?: string,"responsible_id"?: string | null,"severity"?: Database["public"]['Enums']["observation_severity"],"status"?: Database["public"]['Enums']["log_status"],"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "field_observations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "field_observations_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "field_observations_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "field_observations_organization_id_responsible_id_fkey"
      columns: ["organization_id","responsible_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "field_observations_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
    }
                  ]
                },"finance_settings": {
                  Row: {
                    "created_at": string,"created_by": string | null,"critical_pct": number,"exhausted_pct": number,"id": string,"organization_id": string,"updated_at": string,"updated_by": string | null,"warning_pct": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"critical_pct"?: number,"exhausted_pct"?: number,"id"?: string,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null,"warning_pct"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"critical_pct"?: number,"exhausted_pct"?: number,"id"?: string,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"warning_pct"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "finance_settings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"harvests": {
                  Row: {
                    "adjusted_kg": number,"available_kg": number | null,"classification": string | null,"created_at": string,"created_by": string | null,"cut_number": number,"harvest_date": string,"id": string,"lot_code": string,"notes": string | null,"organization_id": string,"packages": number | null,"plot_id": string,"project_id": string,"quality": Database["public"]['Enums']["harvest_quality"],"quantity": number,"quantity_kg": number,"responsible_id": string | null,"sold_kg": number,"unit": Database["public"]['Enums']["produce_unit"],"unit_weight_kg": number | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adjusted_kg"?: number,"available_kg"?: never,"classification"?: string | null,"created_at"?: string,"created_by"?: string | null,"cut_number": number,"harvest_date": string,"id"?: string,"lot_code": string,"notes"?: string | null,"organization_id": string,"packages"?: number | null,"plot_id": string,"project_id": string,"quality"?: Database["public"]['Enums']["harvest_quality"],"quantity": number,"quantity_kg": number,"responsible_id"?: string | null,"sold_kg"?: number,"unit"?: Database["public"]['Enums']["produce_unit"],"unit_weight_kg"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "adjusted_kg"?: number,"available_kg"?: never,"classification"?: string | null,"created_at"?: string,"created_by"?: string | null,"cut_number"?: number,"harvest_date"?: string,"id"?: string,"lot_code"?: string,"notes"?: string | null,"organization_id"?: string,"packages"?: number | null,"plot_id"?: string,"project_id"?: string,"quality"?: Database["public"]['Enums']["harvest_quality"],"quantity"?: number,"quantity_kg"?: number,"responsible_id"?: string | null,"sold_kg"?: number,"unit"?: Database["public"]['Enums']["produce_unit"],"unit_weight_kg"?: number | null,"updated_at"?: string,"updated_by"?: string | null
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
    },{
      foreignKeyName: "harvests_responsible_fkey"
      columns: ["organization_id","responsible_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"inventory_balances": {
                  Row: {
                    "id": string,"lot_id": string | null,"organization_id": string,"product_id": string,"quantity": number,"updated_at": string,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"lot_id"?: string | null,"organization_id": string,"product_id": string,"quantity"?: number,"updated_at"?: string,"warehouse_id": string
                  }
                  Update: {
                    "id"?: string,"lot_id"?: string | null,"organization_id"?: string,"product_id"?: string,"quantity"?: number,"updated_at"?: string,"warehouse_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_balances_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_balances_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "inventory_products"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_balances_organization_id_warehouse_id_fkey"
      columns: ["organization_id","warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_balances_product_id_lot_id_fkey"
      columns: ["product_id","lot_id"]
isOneToOne: false
      referencedRelation: "inventory_lots"
      referencedColumns: ["product_id","id"]
    }
                  ]
                },"inventory_categories": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["input_kind"],"name": string,"organization_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["input_kind"],"name": string,"organization_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["input_kind"],"name"?: string,"organization_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_categories_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_lots": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expiry_date": string | null,"id": string,"lot_number": string,"notes": string | null,"organization_id": string,"product_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expiry_date"?: string | null,"id"?: string,"lot_number": string,"notes"?: string | null,"organization_id": string,"product_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expiry_date"?: string | null,"id"?: string,"lot_number"?: string,"notes"?: string | null,"organization_id"?: string,"product_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_lots_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_lots_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "inventory_products"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"lot_id": string | null,"movement_date": string,"movement_type": Database["public"]['Enums']["inventory_movement_type"],"notes": string | null,"organization_id": string,"plot_id": string | null,"product_id": string,"project_id": string | null,"quantity": number,"reference": string | null,"responsible_id": string | null,"reverses_id": string | null,"stock_after": number,"supplier_id": string | null,"to_warehouse_id": string | null,"total_cost": number,"unit": string,"unit_cost": number | null,"warehouse_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id": string,"lot_id"?: string | null,"movement_date": string,"movement_type": Database["public"]['Enums']["inventory_movement_type"],"notes"?: string | null,"organization_id": string,"plot_id"?: string | null,"product_id": string,"project_id"?: string | null,"quantity": number,"reference"?: string | null,"responsible_id"?: string | null,"reverses_id"?: string | null,"stock_after": number,"supplier_id"?: string | null,"to_warehouse_id"?: string | null,"total_cost": number,"unit": string,"unit_cost"?: never,"warehouse_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"lot_id"?: string | null,"movement_date"?: string,"movement_type"?: Database["public"]['Enums']["inventory_movement_type"],"notes"?: string | null,"organization_id"?: string,"plot_id"?: string | null,"product_id"?: string,"project_id"?: string | null,"quantity"?: number,"reference"?: string | null,"responsible_id"?: string | null,"reverses_id"?: string | null,"stock_after"?: number,"supplier_id"?: string | null,"to_warehouse_id"?: string | null,"total_cost"?: number,"unit"?: string,"unit_cost"?: never,"warehouse_id"?: string
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
      foreignKeyName: "inventory_movements_organization_id_responsible_id_fkey"
      columns: ["organization_id","responsible_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_movements_organization_id_supplier_id_fkey"
      columns: ["organization_id","supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_movements_organization_id_to_warehouse_id_fkey"
      columns: ["organization_id","to_warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_movements_organization_id_warehouse_id_fkey"
      columns: ["organization_id","warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_movements_product_id_lot_id_fkey"
      columns: ["product_id","lot_id"]
isOneToOne: false
      referencedRelation: "inventory_lots"
      referencedColumns: ["product_id","id"]
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
                    "avg_cost": number | null,"category_id": string,"created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"min_stock": number | null,"name": string,"notes": string | null,"organization_id": string,"sku": string | null,"stock": number,"stock_value": number,"track_lots": boolean,"unit": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_cost"?: never,"category_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"min_stock"?: number | null,"name": string,"notes"?: string | null,"organization_id": string,"sku"?: string | null,"stock"?: number,"stock_value"?: number,"track_lots"?: boolean,"unit": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "avg_cost"?: never,"category_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"min_stock"?: number | null,"name"?: string,"notes"?: string | null,"organization_id"?: string,"sku"?: string | null,"stock"?: number,"stock_value"?: number,"track_lots"?: boolean,"unit"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_products_organization_id_category_id_fkey"
      columns: ["organization_id","category_id"]
isOneToOne: false
      referencedRelation: "inventory_categories"
      referencedColumns: ["organization_id","id"]
    },{
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
                },"irrigation_logs": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"duration_minutes": number | null,"end_time": string,"id": string,"irrigation_system": Database["public"]['Enums']["irrigation_type"],"log_date": string,"notes": string | null,"organization_id": string,"plot_id": string,"project_id": string,"responsible_id": string | null,"start_time": string,"status": Database["public"]['Enums']["log_status"],"updated_at": string,"updated_by": string | null,"water_m3": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: never,"end_time": string,"id": string,"irrigation_system": Database["public"]['Enums']["irrigation_type"],"log_date": string,"notes"?: string | null,"organization_id": string,"plot_id": string,"project_id": string,"responsible_id"?: string | null,"start_time": string,"status"?: Database["public"]['Enums']["log_status"],"updated_at"?: string,"updated_by"?: string | null,"water_m3"?: number | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: never,"end_time"?: string,"id"?: string,"irrigation_system"?: Database["public"]['Enums']["irrigation_type"],"log_date"?: string,"notes"?: string | null,"organization_id"?: string,"plot_id"?: string,"project_id"?: string,"responsible_id"?: string | null,"start_time"?: string,"status"?: Database["public"]['Enums']["log_status"],"updated_at"?: string,"updated_by"?: string | null,"water_m3"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "irrigation_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "irrigation_logs_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "irrigation_logs_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    },{
      foreignKeyName: "irrigation_logs_organization_id_responsible_id_fkey"
      columns: ["organization_id","responsible_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "irrigation_logs_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
    }
                  ]
                },"labor_records": {
                  Row: {
                    "activity": string,"activity_type_id": string | null,"amount": number | null,"batch_id": string | null,"created_at": string,"created_by": string | null,"crew": string | null,"crew_id": string | null,"employee_id": string | null,"id": string,"notes": string | null,"organization_id": string,"pay_type": Database["public"]['Enums']["labor_pay_type"],"plot_id": string | null,"project_id": string,"quantity": number,"unit_label": string | null,"unit_rate": number,"updated_at": string,"updated_by": string | null,"work_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity": string,"activity_type_id"?: string | null,"amount"?: never,"batch_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"crew"?: string | null,"crew_id"?: string | null,"employee_id"?: string | null,"id"?: string,"notes"?: string | null,"organization_id": string,"pay_type"?: Database["public"]['Enums']["labor_pay_type"],"plot_id"?: string | null,"project_id": string,"quantity": number,"unit_label"?: string | null,"unit_rate": number,"updated_at"?: string,"updated_by"?: string | null,"work_date": string
                  }
                  Update: {
                    "activity"?: string,"activity_type_id"?: string | null,"amount"?: never,"batch_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"crew"?: string | null,"crew_id"?: string | null,"employee_id"?: string | null,"id"?: string,"notes"?: string | null,"organization_id"?: string,"pay_type"?: Database["public"]['Enums']["labor_pay_type"],"plot_id"?: string | null,"project_id"?: string,"quantity"?: number,"unit_label"?: string | null,"unit_rate"?: number,"updated_at"?: string,"updated_by"?: string | null,"work_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "labor_records_organization_id_activity_type_id_fkey"
      columns: ["organization_id","activity_type_id"]
isOneToOne: false
      referencedRelation: "activity_types"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "labor_records_organization_id_crew_id_fkey"
      columns: ["organization_id","crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["organization_id","id"]
    },{
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
                    "acquisition_cost": number | null,"acquisition_date": string | null,"brand": string | null,"code": string | null,"created_at": string,"created_by": string | null,"daily_rate": number | null,"hourly_cost": number,"id": string,"is_active": boolean | null,"kind": Database["public"]['Enums']["machine_kind"],"maintenance_interval_days": number | null,"maintenance_interval_hours": number | null,"model": string | null,"name": string,"notes": string | null,"organization_id": string,"rate_basis": Database["public"]['Enums']["machine_rate_basis"],"responsible_id": string | null,"serial_number": string | null,"status": Database["public"]['Enums']["machine_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acquisition_cost"?: number | null,"acquisition_date"?: string | null,"brand"?: string | null,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"daily_rate"?: number | null,"hourly_cost": number,"id"?: string,"is_active"?: never,"kind"?: Database["public"]['Enums']["machine_kind"],"maintenance_interval_days"?: number | null,"maintenance_interval_hours"?: number | null,"model"?: string | null,"name": string,"notes"?: string | null,"organization_id": string,"rate_basis"?: Database["public"]['Enums']["machine_rate_basis"],"responsible_id"?: string | null,"serial_number"?: string | null,"status"?: Database["public"]['Enums']["machine_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "acquisition_cost"?: number | null,"acquisition_date"?: string | null,"brand"?: string | null,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"daily_rate"?: number | null,"hourly_cost"?: number,"id"?: string,"is_active"?: never,"kind"?: Database["public"]['Enums']["machine_kind"],"maintenance_interval_days"?: number | null,"maintenance_interval_hours"?: number | null,"model"?: string | null,"name"?: string,"notes"?: string | null,"organization_id"?: string,"rate_basis"?: Database["public"]['Enums']["machine_rate_basis"],"responsible_id"?: string | null,"serial_number"?: string | null,"status"?: Database["public"]['Enums']["machine_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "machinery_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "machinery_organization_id_responsible_id_fkey"
      columns: ["organization_id","responsible_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"machinery_maintenance": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"cost": number,"created_at": string,"created_by": string | null,"description": string,"hour_meter": number | null,"id": string,"kind": Database["public"]['Enums']["maintenance_kind"],"machine_id": string,"maintenance_date": string,"notes": string | null,"organization_id": string,"provider": string | null,"responsible_id": string | null,"status": Database["public"]['Enums']["log_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"cost"?: number,"created_at"?: string,"created_by"?: string | null,"description": string,"hour_meter"?: number | null,"id": string,"kind"?: Database["public"]['Enums']["maintenance_kind"],"machine_id": string,"maintenance_date": string,"notes"?: string | null,"organization_id": string,"provider"?: string | null,"responsible_id"?: string | null,"status"?: Database["public"]['Enums']["log_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"cost"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string,"hour_meter"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["maintenance_kind"],"machine_id"?: string,"maintenance_date"?: string,"notes"?: string | null,"organization_id"?: string,"provider"?: string | null,"responsible_id"?: string | null,"status"?: Database["public"]['Enums']["log_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "machinery_maintenance_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "machinery_maintenance_organization_id_machine_id_fkey"
      columns: ["organization_id","machine_id"]
isOneToOne: false
      referencedRelation: "machinery"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "machinery_maintenance_organization_id_machine_id_fkey"
      columns: ["organization_id","machine_id"]
isOneToOne: false
      referencedRelation: "v_machinery_status"
      referencedColumns: ["organization_id","machine_id"]
    },{
      foreignKeyName: "machinery_maintenance_organization_id_responsible_id_fkey"
      columns: ["organization_id","responsible_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"machinery_usage": {
                  Row: {
                    "activity": string | null,"activity_type_id": string | null,"amount": number | null,"created_at": string,"created_by": string | null,"fuel_movement_id": string | null,"fuel_quantity": number | null,"hours": number,"id": string,"jornadas": number | null,"machine_id": string,"notes": string | null,"operator": string | null,"operator_id": string | null,"organization_id": string,"plot_id": string | null,"project_id": string,"rate": number,"rate_basis": Database["public"]['Enums']["machine_rate_basis"],"updated_at": string,"updated_by": string | null,"usage_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity"?: string | null,"activity_type_id"?: string | null,"amount"?: never,"created_at"?: string,"created_by"?: string | null,"fuel_movement_id"?: string | null,"fuel_quantity"?: number | null,"hours": number,"id"?: string,"jornadas"?: number | null,"machine_id": string,"notes"?: string | null,"operator"?: string | null,"operator_id"?: string | null,"organization_id": string,"plot_id"?: string | null,"project_id": string,"rate": number,"rate_basis"?: Database["public"]['Enums']["machine_rate_basis"],"updated_at"?: string,"updated_by"?: string | null,"usage_date": string
                  }
                  Update: {
                    "activity"?: string | null,"activity_type_id"?: string | null,"amount"?: never,"created_at"?: string,"created_by"?: string | null,"fuel_movement_id"?: string | null,"fuel_quantity"?: number | null,"hours"?: number,"id"?: string,"jornadas"?: number | null,"machine_id"?: string,"notes"?: string | null,"operator"?: string | null,"operator_id"?: string | null,"organization_id"?: string,"plot_id"?: string | null,"project_id"?: string,"rate"?: number,"rate_basis"?: Database["public"]['Enums']["machine_rate_basis"],"updated_at"?: string,"updated_by"?: string | null,"usage_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "machinery_usage_fuel_movement_id_fkey"
      columns: ["fuel_movement_id"]
isOneToOne: true
      referencedRelation: "inventory_movements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "machinery_usage_organization_id_activity_type_id_fkey"
      columns: ["organization_id","activity_type_id"]
isOneToOne: false
      referencedRelation: "activity_types"
      referencedColumns: ["organization_id","id"]
    },{
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
      foreignKeyName: "machinery_usage_organization_id_machine_id_fkey"
      columns: ["organization_id","machine_id"]
isOneToOne: false
      referencedRelation: "v_machinery_status"
      referencedColumns: ["organization_id","machine_id"]
    },{
      foreignKeyName: "machinery_usage_organization_id_operator_id_fkey"
      columns: ["organization_id","operator_id"]
isOneToOne: false
      referencedRelation: "employees"
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
                },"offline_submissions": {
                  Row: {
                    "attempts": number,"captured_at": string,"entity_id": string | null,"id": string,"last_error": string | null,"organization_id": string,"payload": NonNullable<Json>,"payload_hash": string,"received_at": string,"record_type": Database["public"]['Enums']["offline_record_type"],"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["offline_submission_status"],"synced_at": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"captured_at": string,"entity_id"?: string | null,"id": string,"last_error"?: string | null,"organization_id": string,"payload": NonNullable<Json>,"payload_hash": string,"received_at"?: string,"record_type": Database["public"]['Enums']["offline_record_type"],"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status": Database["public"]['Enums']["offline_submission_status"],"synced_at"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"captured_at"?: string,"entity_id"?: string | null,"id"?: string,"last_error"?: string | null,"organization_id"?: string,"payload"?: NonNullable<Json>,"payload_hash"?: string,"received_at"?: string,"record_type"?: Database["public"]['Enums']["offline_record_type"],"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["offline_submission_status"],"synced_at"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offline_submissions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
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
                    "address": string | null,"created_at": string,"created_by": string | null,"currency": string,"email": string | null,"id": string,"is_demo": boolean,"legal_name": string | null,"name": string,"phone": string | null,"plan": string,"plan_code": string,"plan_started_at": string,"rfc": string | null,"timezone": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"email"?: string | null,"id"?: string,"is_demo"?: boolean,"legal_name"?: string | null,"name": string,"phone"?: string | null,"plan"?: string,"plan_code"?: string,"plan_started_at"?: string,"rfc"?: string | null,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"email"?: string | null,"id"?: string,"is_demo"?: boolean,"legal_name"?: string | null,"name"?: string,"phone"?: string | null,"plan"?: string,"plan_code"?: string,"plan_started_at"?: string,"rfc"?: string | null,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"applied_amount": number,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"id": string,"kind": Database["public"]['Enums']["payment_kind"],"method": Database["public"]['Enums']["payment_method"],"notes": string | null,"organization_id": string,"payment_date": string,"reference": string | null,"sale_id": string,"status": Database["public"]['Enums']["payment_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"applied_amount"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id": string,"kind"?: Database["public"]['Enums']["payment_kind"],"method": Database["public"]['Enums']["payment_method"],"notes"?: string | null,"organization_id": string,"payment_date": string,"reference"?: string | null,"sale_id": string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"applied_amount"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["payment_kind"],"method"?: Database["public"]['Enums']["payment_method"],"notes"?: string | null,"organization_id"?: string,"payment_date"?: string,"reference"?: string | null,"sale_id"?: string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
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
                },"plans": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"features": (string)[],"is_active": boolean,"max_projects": number | null,"max_storage_mb": number | null,"max_users": number | null,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"features"?: (string)[],"is_active"?: boolean,"max_projects"?: number | null,"max_storage_mb"?: number | null,"max_users"?: number | null,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"features"?: (string)[],"is_active"?: boolean,"max_projects"?: number | null,"max_storage_mb"?: number | null,"max_users"?: number | null,"name"?: string,"sort_order"?: number
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
                },"production_movements": {
                  Row: {
                    "available_after": number,"created_at": string,"created_by": string | null,"harvest_id": string,"id": string,"movement_date": string,"movement_type": Database["public"]['Enums']["production_movement_type"],"organization_id": string,"quantity_kg": number,"reason": string | null,"reverses_id": string | null,"sale_id": string | null,"sale_item_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "available_after": number,"created_at"?: string,"created_by"?: string | null,"harvest_id": string,"id": string,"movement_date": string,"movement_type": Database["public"]['Enums']["production_movement_type"],"organization_id": string,"quantity_kg": number,"reason"?: string | null,"reverses_id"?: string | null,"sale_id"?: string | null,"sale_item_id"?: string | null
                  }
                  Update: {
                    "available_after"?: number,"created_at"?: string,"created_by"?: string | null,"harvest_id"?: string,"id"?: string,"movement_date"?: string,"movement_type"?: Database["public"]['Enums']["production_movement_type"],"organization_id"?: string,"quantity_kg"?: number,"reason"?: string | null,"reverses_id"?: string | null,"sale_id"?: string | null,"sale_item_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "production_movements_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "production_movements_organization_id_harvest_id_fkey"
      columns: ["organization_id","harvest_id"]
isOneToOne: false
      referencedRelation: "harvests"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "production_movements_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "production_movements_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_balances"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "production_movements_organization_id_sale_item_id_fkey"
      columns: ["organization_id","sale_item_id"]
isOneToOne: false
      referencedRelation: "sale_items"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "production_movements_reverses_id_fkey"
      columns: ["reverses_id"]
isOneToOne: true
      referencedRelation: "production_movements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "production_movements_reverses_id_fkey"
      columns: ["reverses_id"]
isOneToOne: true
      referencedRelation: "v_sale_lot_trace"
      referencedColumns: ["movement_id"]
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
                },"project_budget_lines": {
                  Row: {
                    "amount": number | null,"budget_id": string,"category": Database["public"]['Enums']["budget_category"],"concept": string,"id": string,"line_no": number,"organization_id": string,"quantity": number,"unit": string | null,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: never,"budget_id": string,"category": Database["public"]['Enums']["budget_category"],"concept": string,"id"?: string,"line_no": number,"organization_id": string,"quantity": number,"unit"?: string | null,"unit_cost": number
                  }
                  Update: {
                    "amount"?: never,"budget_id"?: string,"category"?: Database["public"]['Enums']["budget_category"],"concept"?: string,"id"?: string,"line_no"?: number,"organization_id"?: string,"quantity"?: number,"unit"?: string | null,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_budget_lines_organization_id_budget_id_fkey"
      columns: ["organization_id","budget_id"]
isOneToOne: false
      referencedRelation: "project_budgets"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"project_budgets": {
                  Row: {
                    "area_ha": number,"created_at": string,"created_by": string | null,"crop_id": string,"id": string,"is_current": boolean,"notes": string | null,"organization_id": string,"period_end": string,"period_start": string,"project_id": string,"revision_reason": string | null,"total": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "area_ha": number,"created_at"?: string,"created_by"?: string | null,"crop_id": string,"id": string,"is_current": boolean,"notes"?: string | null,"organization_id": string,"period_end": string,"period_start": string,"project_id": string,"revision_reason"?: string | null,"total": number,"version": number
                  }
                  Update: {
                    "area_ha"?: number,"created_at"?: string,"created_by"?: string | null,"crop_id"?: string,"id"?: string,"is_current"?: boolean,"notes"?: string | null,"organization_id"?: string,"period_end"?: string,"period_start"?: string,"project_id"?: string,"revision_reason"?: string | null,"total"?: number,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_budgets_organization_id_crop_id_fkey"
      columns: ["organization_id","crop_id"]
isOneToOne: false
      referencedRelation: "crops"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "project_budgets_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_budgets_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "project_budgets_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "v_project_costs"
      referencedColumns: ["organization_id","project_id"]
    }
                  ]
                },"project_expenses": {
                  Row: {
                    "allocation_basis": number,"allocation_share": number,"amount": number,"created_at": string,"created_by": string | null,"expense_date": string,"expense_id": string,"id": string,"organization_id": string,"plot_id": string | null,"project_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allocation_basis": number,"allocation_share": number,"amount": number,"created_at"?: string,"created_by"?: string | null,"expense_date": string,"expense_id": string,"id"?: string,"organization_id": string,"plot_id"?: string | null,"project_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "allocation_basis"?: number,"allocation_share"?: number,"amount"?: number,"created_at"?: string,"created_by"?: string | null,"expense_date"?: string,"expense_id"?: string,"id"?: string,"organization_id"?: string,"plot_id"?: string | null,"project_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_expenses_expense_fkey"
      columns: ["organization_id","expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["organization_id","id"]
    },{
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
                },"sale_deliveries": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"delivery_date": string,"id": string,"notes": string | null,"organization_id": string,"received_by": string | null,"sale_id": string,"status": Database["public"]['Enums']["log_status"],"transport": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"delivery_date": string,"id": string,"notes"?: string | null,"organization_id": string,"received_by"?: string | null,"sale_id": string,"status"?: Database["public"]['Enums']["log_status"],"transport"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"delivery_date"?: string,"id"?: string,"notes"?: string | null,"organization_id"?: string,"received_by"?: string | null,"sale_id"?: string,"status"?: Database["public"]['Enums']["log_status"],"transport"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_deliveries_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_deliveries_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "sale_deliveries_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_balances"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"sale_delivery_items": {
                  Row: {
                    "delivery_id": string,"id": string,"organization_id": string,"quantity": number,"sale_item_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "delivery_id": string,"id"?: string,"organization_id": string,"quantity": number,"sale_item_id": string
                  }
                  Update: {
                    "delivery_id"?: string,"id"?: string,"organization_id"?: string,"quantity"?: number,"sale_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_delivery_items_organization_id_delivery_id_fkey"
      columns: ["organization_id","delivery_id"]
isOneToOne: false
      referencedRelation: "sale_deliveries"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "sale_delivery_items_organization_id_sale_item_id_fkey"
      columns: ["organization_id","sale_item_id"]
isOneToOne: false
      referencedRelation: "sale_items"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"sale_items": {
                  Row: {
                    "amount": number | null,"delivered_quantity": number,"description": string,"discount": number,"gross_amount": number | null,"harvest_id": string | null,"id": string,"organization_id": string,"project_id": string,"quality": Database["public"]['Enums']["harvest_quality"] | null,"quantity": number,"quantity_kg": number,"sale_id": string,"unit": Database["public"]['Enums']["produce_unit"],"unit_price": number,"unit_weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: never,"delivered_quantity"?: number,"description": string,"discount"?: number,"gross_amount"?: never,"harvest_id"?: string | null,"id"?: string,"organization_id": string,"project_id": string,"quality"?: Database["public"]['Enums']["harvest_quality"] | null,"quantity": number,"quantity_kg": number,"sale_id": string,"unit"?: Database["public"]['Enums']["produce_unit"],"unit_price": number,"unit_weight_kg"?: number | null
                  }
                  Update: {
                    "amount"?: never,"delivered_quantity"?: number,"description"?: string,"discount"?: number,"gross_amount"?: never,"harvest_id"?: string | null,"id"?: string,"organization_id"?: string,"project_id"?: string,"quality"?: Database["public"]['Enums']["harvest_quality"] | null,"quantity"?: number,"quantity_kg"?: number,"sale_id"?: string,"unit"?: Database["public"]['Enums']["produce_unit"],"unit_price"?: number,"unit_weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_items_lot_fkey"
      columns: ["organization_id","harvest_id"]
isOneToOne: false
      referencedRelation: "harvests"
      referencedColumns: ["organization_id","id"]
    },{
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
                    "advance_balance": number,"amount_paid": number,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"created_by": string | null,"customer_id": string,"delivery_date": string | null,"discount": number,"due_date": string,"id": string,"notes": string | null,"organization_id": string,"sale_date": string,"status": Database["public"]['Enums']["sale_status"],"subtotal": number,"total": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "advance_balance"?: number,"amount_paid"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code": string,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"delivery_date"?: string | null,"discount"?: number,"due_date": string,"id": string,"notes"?: string | null,"organization_id": string,"sale_date": string,"status"?: Database["public"]['Enums']["sale_status"],"subtotal"?: number,"total"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "advance_balance"?: number,"amount_paid"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"delivery_date"?: string | null,"discount"?: number,"due_date"?: string,"id"?: string,"notes"?: string | null,"organization_id"?: string,"sale_date"?: string,"status"?: Database["public"]['Enums']["sale_status"],"subtotal"?: number,"total"?: number,"updated_at"?: string,"updated_by"?: string | null
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
                },"suppliers": {
                  Row: {
                    "address": string | null,"contact_name": string | null,"created_at": string,"created_by": string | null,"email": string | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"organization_id": string,"phone": string | null,"rfc": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"organization_id": string,"phone"?: string | null,"rfc"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"organization_id"?: string,"phone"?: string | null,"rfc"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"warehouses": {
                  Row: {
                    "code": string | null,"created_at": string,"created_by": string | null,"farm_id": string | null,"id": string,"is_active": boolean,"location": string | null,"name": string,"notes": string | null,"organization_id": string,"responsible_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"created_at"?: string,"created_by"?: string | null,"farm_id"?: string | null,"id"?: string,"is_active"?: boolean,"location"?: string | null,"name": string,"notes"?: string | null,"organization_id": string,"responsible_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "code"?: string | null,"created_at"?: string,"created_by"?: string | null,"farm_id"?: string | null,"id"?: string,"is_active"?: boolean,"location"?: string | null,"name"?: string,"notes"?: string | null,"organization_id"?: string,"responsible_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "warehouses_organization_id_farm_id_fkey"
      columns: ["organization_id","farm_id"]
isOneToOne: false
      referencedRelation: "farms"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "warehouses_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "warehouses_organization_id_responsible_id_fkey"
      columns: ["organization_id","responsible_id"]
isOneToOne: false
      referencedRelation: "employees"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                }
          }
          Views: {
            "v_budget_comparison": {
                  Row: {
                    "actual_amount": number | null,"budget_amount": number | null,"category": Database["public"]['Enums']["budget_category"] | null,"code": string,"difference": number | null,"name": string,"organization_id": string | null,"project_id": string | null,"project_status": Database["public"]['Enums']["project_status"],"status": string | null,"used_pct": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_inventory_stock": {
                  Row: {
                    "avg_cost": number | null,"category_id": string,"category_kind": Database["public"]['Enums']["input_kind"],"category_name": string,"days_to_expiry": number | null,"estimated_value": number | null,"expiry_date": string | null,"id": string,"lot_id": string | null,"lot_number": string | null,"organization_id": string,"product_active": boolean,"product_id": string,"product_name": string,"quantity": number,"sku": string | null,"unit": string,"updated_at": string,"warehouse_id": string,"warehouse_name": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "inventory_balances_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_balances_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "inventory_products"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_balances_organization_id_warehouse_id_fkey"
      columns: ["organization_id","warehouse_id"]
isOneToOne: false
      referencedRelation: "warehouses"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "inventory_balances_product_id_lot_id_fkey"
      columns: ["product_id","lot_id"]
isOneToOne: false
      referencedRelation: "inventory_lots"
      referencedColumns: ["product_id","id"]
    }
                  ]
                },"v_machinery_status": {
                  Row: {
                    "hours_since_service": number | null,"hours_to_service": number | null,"last_service_date": string | null,"last_usage_date": string | null,"machine_id": string,"maintenance_alert": string | null,"maintenance_cost": number | null,"maintenance_count": number | null,"maintenance_interval_days": number | null,"maintenance_interval_hours": number | null,"name": string,"next_service_date": string | null,"organization_id": string,"repair_cost": number | null,"status": Database["public"]['Enums']["machine_status"],"total_hours": number | null,"usage_amount": number | null,"usage_count": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "machinery_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"v_project_cost_entries": {
                  Row: {
                    "amount": number | null,"budget_category": Database["public"]['Enums']["budget_category"] | null,"concept": string | null,"cost_class": string | null,"created_at": string | null,"detail": string | null,"entry_date": string | null,"expense_category": Database["public"]['Enums']["expense_category"] | null,"organization_id": string | null,"origin_id": string | null,"origin_table": string | null,"plot_id": string | null,"project_id": string | null,"source": string | null,"source_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_project_costs": {
                  Row: {
                    "activities_cost": number | null,"area_ha": number | null,"available_kg": number | null,"budget_amount": number | null,"budget_id": string | null,"budget_remaining": number | null,"budget_status": string | null,"budget_used_pct": number | null,"budget_variance": number | null,"budget_version": number | null,"code": string,"collected_amount": number | null,"cost_per_ha": number | null,"cost_per_kg": number | null,"cost_per_ton": number | null,"crop_id": string,"crop_name": string | null,"cuts": number | null,"estimated_result": number | null,"expenses_cost": number | null,"fuel_cost": number | null,"gross_profit": number | null,"harvested_kg": number | null,"inputs_cost": number | null,"labor_cost": number | null,"lots": number | null,"machinery_cost": number | null,"maintenance_cost": number | null,"margin_pct": number | null,"materials_cost": number | null,"name": string,"organization_id": string,"other_cost": number | null,"project_id": string,"receivable_amount": number | null,"sales_amount": number | null,"services_cost": number | null,"shrinkage_kg": number | null,"sold_kg": number | null,"start_date": string,"status": Database["public"]['Enums']["project_status"],"stock_value_at_cost": number | null,"total_cost": number | null,"yield_kg_per_ha": number | null
                  }
                  ComputedFields: never
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
    }
                  ]
                },"v_project_timeline": {
                  Row: {
                    "amount": number | null,"cancelled": boolean | null,"created_at": string | null,"detail": string | null,"event_date": string | null,"event_time": string | null,"kind": string | null,"organization_id": string | null,"plot_id": string | null,"project_id": string | null,"responsible": string | null,"source_id": string | null,"title": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_sale_balances": {
                  Row: {
                    "advance_balance": number,"amount_paid": number,"balance": number | null,"code": string,"created_at": string,"customer_id": string,"customer_name": string,"days_overdue": number | null,"delivery_date": string | null,"delivery_status": string | null,"discount": number,"due_date": string,"id": string,"last_payment_date": string | null,"organization_id": string,"payment_status": string | null,"recovery_pct": number | null,"sale_date": string,"status": Database["public"]['Enums']["sale_status"],"subtotal": number,"total": number,"total_kg": number | null
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
                },"v_sale_lot_trace": {
                  Row: {
                    "amount": number | null,"customer_id": string,"customer_name": string,"cut_number": number,"description": string,"farm_name": string,"harvest_date": string,"harvest_id": string,"lot_code": string,"movement_id": string,"organization_id": string,"plot_id": string,"plot_name": string,"project_code": string,"project_id": string,"project_name": string,"quality": Database["public"]['Enums']["harvest_quality"],"quantity_kg": number | null,"reversed": boolean | null,"sale_code": string,"sale_date": string,"sale_id": string | null,"sale_item_id": string | null,"sale_status": Database["public"]['Enums']["sale_status"]
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "harvests_project_id_plot_id_fkey"
      columns: ["project_id","plot_id"]
isOneToOne: false
      referencedRelation: "project_plots"
      referencedColumns: ["project_id","plot_id"]
    },{
      foreignKeyName: "production_movements_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "production_movements_organization_id_harvest_id_fkey"
      columns: ["organization_id","harvest_id"]
isOneToOne: false
      referencedRelation: "harvests"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "production_movements_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "production_movements_organization_id_sale_id_fkey"
      columns: ["organization_id","sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_balances"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "production_movements_organization_id_sale_item_id_fkey"
      columns: ["organization_id","sale_item_id"]
isOneToOne: false
      referencedRelation: "sale_items"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "apply_advance":
{ Args: { "p_amount"?: number,"p_date"?: string,"p_id": string,"p_payment": string }; Returns: string
                           },
"apply_inventory_balance":
{ Args: { "p_delta": number,"p_lot": string,"p_product": Omit<Database["public"]['Tables']["inventory_products"]['Row'], Database["public"]['Tables']["inventory_products"]['ComputedFields']>,"p_warehouse": string }; Returns: undefined
                           },
"attachment_roles":
{ Args: { "p_entity": string,"p_write": boolean }; Returns: (Database["public"]['Enums']["app_role"])[]
                           },
"budget_status":
{ Args: { "p_actual": number,"p_budget": number,"p_critical": number,"p_exhausted": number,"p_warning": number }; Returns: string
                           },
"cancel_advance_application":
{ Args: { "p_application": string,"p_reason": string }; Returns: undefined
                           },
"cancel_cash_movement":
{ Args: { "p_movement": string,"p_reason": string }; Returns: undefined
                           },
"cancel_chemical_application":
{ Args: { "p_id": string,"p_reason": string }; Returns: undefined
                           },
"cancel_delivery":
{ Args: { "p_delivery": string,"p_reason": string }; Returns: undefined
                           },
"cancel_expense":
{ Args: { "p_expense": string,"p_reason": string }; Returns: undefined
                           },
"cancel_field_record":
{ Args: { "p_id": string,"p_kind": string,"p_reason": string }; Returns: undefined
                           },
"cancel_invitation":
{ Args: { "p_invitation": string }; Returns: undefined
                           },
"cancel_payment":
{ Args: { "p_payment": string,"p_reason": string }; Returns: undefined
                           },
"cancel_sale":
{ Args: { "p_reason": string,"p_sale": string }; Returns: undefined
                           },
"cash_flow_entries":
{ Args: { "p_from": string,"p_org": string,"p_project"?: string,"p_to": string }; Returns: {
              "amount": number,"concept": string,"counterparty": string,"direction": string,"entry_date": string,"entry_id": string,"kind": string,"method": Database["public"]['Enums']["payment_method"],"project_id": string,"reference": string,"source": string
            }[]
                           },
"change_project_status":
{ Args: { "p_note"?: string,"p_project": string,"p_status": Database["public"]['Enums']["project_status"] }; Returns: undefined
                           },
"commercial_summary":
{ Args: { "p_crop"?: string,"p_from": string,"p_org": string,"p_project"?: string,"p_to": string }; Returns: Json
                           },
"confirm_sale":
{ Args: { "p_sale": string }; Returns: undefined
                           },
"confirm_sale_internal":
{ Args: { "p_sale": string }; Returns: undefined
                           },
"create_organization":
{ Args: { "p_name": string }; Returns: string
                           },
"dashboard_summary":
{ Args: { "p_org": string }; Returns: Json
                           },
"discard_offline_submission":
{ Args: { "p_id": string,"p_note": string }; Returns: undefined
                           },
"expense_cost_class":
{ Args: { "p_category": Database["public"]['Enums']["expense_category"] }; Returns: string
                           },
"expense_default_budget_category":
{ Args: { "p_category": Database["public"]['Enums']["expense_category"] }; Returns: Database["public"]['Enums']["budget_category"]
                           },
"finance_summary":
{ Args: { "p_org": string }; Returns: Json
                           },
"financial_series":
{ Args: { "p_crop"?: string,"p_from": string,"p_org": string,"p_project"?: string,"p_to": string }; Returns: Json
                           },
"has_role":
{ Args: { "p_org": string,"p_roles": (Database["public"]['Enums']["app_role"])[] }; Returns: boolean
                           },
"input_budget_category":
{ Args: { "p_kind": Database["public"]['Enums']["input_kind"] }; Returns: Database["public"]['Enums']["budget_category"]
                           },
"input_cost_class":
{ Args: { "p_kind": Database["public"]['Enums']["input_kind"] }; Returns: string
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
"org_deleted":
{ Args: { "p_org": string }; Returns: boolean
                           },
"organization_usage":
{ Args: { "p_org": string }; Returns: Json
                           },
"parse_budget_lines":
{ Args: { "p_lines": Json }; Returns: {
              "category": Database["public"]['Enums']["budget_category"],"concept": string,"line_no": number,"quantity": number,"unit": string,"unit_cost": number
            }[]
                           },
"parse_sale_lines":
{ Args: { "p_items": Json }; Returns: {
              "description": string,"discount": number,"harvest_id": string,"line": number,"quantity": number,"unit": string,"unit_price": number,"unit_weight_kg": number
            }[]
                           },
"plot_assigned_area":
{ Args: { "p_exclude"?: string,"p_plot": string }; Returns: number
                           },
"post_inventory_movement":
{ Args: { "p_date": string,"p_id": string,"p_lot": string,"p_notes": string,"p_plot": string,"p_product": Omit<Database["public"]['Tables']["inventory_products"]['Row'], Database["public"]['Tables']["inventory_products"]['ComputedFields']>,"p_project": string,"p_quantity": number,"p_reference": string,"p_responsible": string,"p_reverses": string,"p_supplier": string,"p_to_warehouse": string,"p_total": number,"p_type": Database["public"]['Enums']["inventory_movement_type"],"p_warehouse": string }; Returns: string
                           },
"post_production_movement":
{ Args: { "p_date": string,"p_harvest": string,"p_id": string,"p_item"?: string,"p_quantity_kg": number,"p_reason"?: string,"p_reverses"?: string,"p_sale"?: string,"p_type": Database["public"]['Enums']["production_movement_type"] }; Returns: undefined
                           },
"process_inventory_movement":
{ Args: { "p_date": string,"p_id": string,"p_lot": string,"p_lot_expiry": string,"p_lot_number": string,"p_notes": string,"p_plot": string,"p_product": string,"p_project": string,"p_quantity": number,"p_reference": string,"p_responsible": string,"p_supplier": string,"p_to_warehouse": string,"p_type": Database["public"]['Enums']["inventory_movement_type"],"p_unit_cost": number,"p_warehouse": string }; Returns: string
                           },
"process_inventory_reversal":
{ Args: { "p_id": string,"p_movement": string,"p_reason": string }; Returns: string
                           },
"produce_unit_kg":
{ Args: { "p_unit": Database["public"]['Enums']["produce_unit"],"p_unit_weight": number }; Returns: number
                           },
"project_transition_allowed":
{ Args: { "p_from": Database["public"]['Enums']["project_status"],"p_to": Database["public"]['Enums']["project_status"] }; Returns: boolean
                           },
"refresh_sale_status":
{ Args: { "p_sale": string }; Returns: undefined
                           },
"register_cash_movement":
{ Args: { "p_amount": number,"p_concept"?: string,"p_date": string,"p_expense"?: string,"p_id": string,"p_kind": Database["public"]['Enums']["cash_kind"],"p_method": Database["public"]['Enums']["payment_method"],"p_notes"?: string,"p_org": string,"p_project"?: string,"p_reference"?: string,"p_supplier"?: string }; Returns: string
                           },
"register_chemical_application":
{ Args: { "p_active_ingredient"?: string,"p_date": string,"p_equipment"?: string,"p_id": string,"p_issue_from_stock"?: boolean,"p_lot"?: string,"p_lot_number"?: string,"p_machine"?: string,"p_notes"?: string,"p_plot": string,"p_preharvest_days"?: number,"p_product": string,"p_project": string,"p_quantity": number,"p_reentry_hours"?: number,"p_responsible"?: string,"p_time"?: string,"p_treated_area": number,"p_warehouse"?: string }; Returns: string
                           },
"register_crew_labor":
{ Args: { "p_activity": string,"p_activity_type"?: string,"p_crew": string,"p_date": string,"p_employees"?: (string)[],"p_id": string,"p_notes"?: string,"p_pay_type"?: Database["public"]['Enums']["labor_pay_type"],"p_plot"?: string,"p_project": string,"p_quantity": number,"p_unit_label"?: string,"p_unit_rate"?: number }; Returns: number
                           },
"register_delivery":
{ Args: { "p_date": string,"p_id": string,"p_items"?: Json,"p_notes"?: string,"p_received_by"?: string,"p_sale": string,"p_transport"?: string }; Returns: string
                           },
"register_expense":
{ Args: { "p_allocation_method": Database["public"]['Enums']["allocation_method"],"p_allocations": Json,"p_amount": number,"p_category": Database["public"]['Enums']["expense_category"],"p_cost_category": Database["public"]['Enums']["budget_category"],"p_date": string,"p_description": string,"p_id": string,"p_invoice_ref"?: string,"p_notes"?: string,"p_org": string,"p_payment"?: Json,"p_payment_method"?: Database["public"]['Enums']["payment_method"],"p_responsible"?: string,"p_supplier"?: string }; Returns: string
                           },
"register_inventory_movement":
{ Args: { "p_date": string,"p_id": string,"p_lot"?: string,"p_lot_expiry"?: string,"p_lot_number"?: string,"p_notes"?: string,"p_plot"?: string,"p_product": string,"p_project"?: string,"p_quantity": number,"p_reference"?: string,"p_responsible"?: string,"p_supplier"?: string,"p_to_warehouse"?: string,"p_type": Database["public"]['Enums']["inventory_movement_type"],"p_unit_cost"?: number,"p_warehouse"?: string }; Returns: string
                           },
"register_machinery_usage":
{ Args: { "p_activity"?: string,"p_activity_type"?: string,"p_date": string,"p_fuel_lot"?: string,"p_fuel_product"?: string,"p_fuel_quantity"?: number,"p_fuel_warehouse"?: string,"p_hours": number,"p_id": string,"p_jornadas"?: number,"p_machine": string,"p_notes"?: string,"p_operator"?: string,"p_operator_id"?: string,"p_plot"?: string,"p_project": string,"p_rate"?: number,"p_rate_basis"?: Database["public"]['Enums']["machine_rate_basis"] }; Returns: string
                           },
"register_payment":
{ Args: { "p_amount": number,"p_date": string,"p_id": string,"p_kind"?: Database["public"]['Enums']["payment_kind"],"p_method": Database["public"]['Enums']["payment_method"],"p_notes"?: string,"p_reference"?: string,"p_sale": string }; Returns: string
                           },
"register_production_adjustment":
{ Args: { "p_date": string,"p_harvest": string,"p_id": string,"p_quantity_kg": number,"p_reason": string,"p_type": Database["public"]['Enums']["production_movement_type"] }; Returns: string
                           },
"reverse_inventory_movement":
{ Args: { "p_id": string,"p_movement": string,"p_reason": string }; Returns: string
                           },
"reverse_production_adjustment":
{ Args: { "p_id": string,"p_movement": string,"p_reason": string }; Returns: string
                           },
"sale_is_active":
{ Args: { "p_status": Database["public"]['Enums']["sale_status"] }; Returns: boolean
                           },
"save_budget":
{ Args: { "p_area_ha"?: number,"p_base_version"?: number,"p_id": string,"p_lines": Json,"p_notes"?: string,"p_period_end": string,"p_period_start": string,"p_project": string,"p_reason"?: string }; Returns: string
                           },
"save_offline_submission":
{ Args: { "p_captured_at": string,"p_entity"?: string,"p_error"?: string,"p_hash": string,"p_id": string,"p_org": string,"p_payload": Json,"p_status": Database["public"]['Enums']["offline_submission_status"],"p_type": Database["public"]['Enums']["offline_record_type"] }; Returns: string
                           },
"save_sale":
{ Args: { "p_confirm"?: boolean,"p_customer": string,"p_delivery_date"?: string,"p_due_date"?: string,"p_id": string,"p_items": Json,"p_notes"?: string,"p_sale_date": string }; Returns: string
                           },
"seed_organization_catalogs":
{ Args: { "p_org": string }; Returns: undefined
                           },
"shares_organization":
{ Args: { "p_user": string }; Returns: boolean
                           },
"storage_object_org":
{ Args: { "p_name": string }; Returns: string
                           },
"update_member":
{ Args: { "p_membership": string,"p_role": Database["public"]['Enums']["app_role"],"p_status": Database["public"]['Enums']["membership_status"] }; Returns: undefined
                           },
"user_role":
{ Args: { "p_org": string }; Returns: Database["public"]['Enums']["app_role"]
                           }
          }
          Enums: {
            "allocation_method": "directo"|"superficie"|"partes_iguales"|"porcentaje"|"importe","app_role": "propietario"|"administrador"|"agronomo"|"supervisor"|"almacen"|"finanzas"|"consulta","attendance_status": "presente"|"falta"|"permiso"|"incapacidad"|"descanso","budget_category": "preparacion_terreno"|"semillas"|"fertilizantes"|"agroquimicos"|"riego"|"mano_obra"|"maquinaria"|"combustible"|"mantenimiento"|"cosecha"|"transporte"|"otros","cash_kind": "pago_gasto"|"pago_proveedor"|"otro_ingreso"|"otro_egreso","customer_type": "mayorista"|"minorista"|"empacadora"|"exportadora"|"industria"|"intermediario"|"otro","expense_category": "renta_tierra"|"agua_riego"|"energia"|"fletes"|"servicios_profesionales"|"maquila"|"seguros"|"financiamiento"|"derechos_impuestos"|"mantenimiento"|"otros","harvest_quality": "primera"|"segunda"|"tercera"|"unica","input_kind": "semilla"|"fertilizante"|"agroquimico"|"biologico"|"combustible"|"herramienta"|"material"|"otro","inventory_movement_type": "entrada"|"consumo"|"devolucion"|"ajuste_entrada"|"ajuste_salida"|"transferencia","invitation_status": "pendiente"|"aceptada"|"cancelada","irrigation_type": "temporal"|"goteo"|"aspersion"|"microaspersion"|"gravedad"|"pivote"|"otro","labor_pay_type": "jornal"|"destajo","log_status": "registrado"|"cancelado","machine_kind": "tractor"|"cosechadora"|"aspersora"|"implemento"|"vehiculo"|"bomba"|"otro","machine_rate_basis": "hora"|"jornada","machine_status": "operativa"|"en_mantenimiento"|"fuera_servicio"|"baja","maintenance_kind": "preventivo"|"correctivo","membership_status": "activo"|"inactivo","observation_category": "plaga"|"enfermedad"|"maleza"|"clima"|"riego"|"nutricion"|"fenologia"|"otro","observation_severity": "baja"|"media"|"alta","offline_record_type": "riego"|"actividad"|"aplicacion"|"observacion"|"cosecha","offline_submission_status": "sincronizado"|"requiere_revision"|"descartado","payment_kind": "pago"|"anticipo","payment_method": "efectivo"|"transferencia"|"cheque"|"deposito"|"otro","payment_status": "aplicado"|"cancelado","produce_unit": "kg"|"t"|"caja"|"saco"|"arpilla"|"reja","production_movement_type": "venta"|"cancelacion_venta"|"merma"|"perdida"|"ajuste_entrada"|"ajuste_salida"|"reverso_ajuste","project_status": "planeacion"|"preparacion"|"siembra"|"desarrollo"|"cosecha"|"comercializacion"|"cerrado"|"cancelado","sale_status": "borrador"|"confirmada"|"entregada"|"parcialmente_pagada"|"pagada"|"cancelada","worker_type": "planta"|"eventual"|"temporal"|"destajista"
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
            "allocation_method": ["directo", "superficie", "partes_iguales", "porcentaje", "importe"],"app_role": ["propietario", "administrador", "agronomo", "supervisor", "almacen", "finanzas", "consulta"],"attendance_status": ["presente", "falta", "permiso", "incapacidad", "descanso"],"budget_category": ["preparacion_terreno", "semillas", "fertilizantes", "agroquimicos", "riego", "mano_obra", "maquinaria", "combustible", "mantenimiento", "cosecha", "transporte", "otros"],"cash_kind": ["pago_gasto", "pago_proveedor", "otro_ingreso", "otro_egreso"],"customer_type": ["mayorista", "minorista", "empacadora", "exportadora", "industria", "intermediario", "otro"],"expense_category": ["renta_tierra", "agua_riego", "energia", "fletes", "servicios_profesionales", "maquila", "seguros", "financiamiento", "derechos_impuestos", "mantenimiento", "otros"],"harvest_quality": ["primera", "segunda", "tercera", "unica"],"input_kind": ["semilla", "fertilizante", "agroquimico", "biologico", "combustible", "herramienta", "material", "otro"],"inventory_movement_type": ["entrada", "consumo", "devolucion", "ajuste_entrada", "ajuste_salida", "transferencia"],"invitation_status": ["pendiente", "aceptada", "cancelada"],"irrigation_type": ["temporal", "goteo", "aspersion", "microaspersion", "gravedad", "pivote", "otro"],"labor_pay_type": ["jornal", "destajo"],"log_status": ["registrado", "cancelado"],"machine_kind": ["tractor", "cosechadora", "aspersora", "implemento", "vehiculo", "bomba", "otro"],"machine_rate_basis": ["hora", "jornada"],"machine_status": ["operativa", "en_mantenimiento", "fuera_servicio", "baja"],"maintenance_kind": ["preventivo", "correctivo"],"membership_status": ["activo", "inactivo"],"observation_category": ["plaga", "enfermedad", "maleza", "clima", "riego", "nutricion", "fenologia", "otro"],"observation_severity": ["baja", "media", "alta"],"offline_record_type": ["riego", "actividad", "aplicacion", "observacion", "cosecha"],"offline_submission_status": ["sincronizado", "requiere_revision", "descartado"],"payment_kind": ["pago", "anticipo"],"payment_method": ["efectivo", "transferencia", "cheque", "deposito", "otro"],"payment_status": ["aplicado", "cancelado"],"produce_unit": ["kg", "t", "caja", "saco", "arpilla", "reja"],"production_movement_type": ["venta", "cancelacion_venta", "merma", "perdida", "ajuste_entrada", "ajuste_salida", "reverso_ajuste"],"project_status": ["planeacion", "preparacion", "siembra", "desarrollo", "cosecha", "comercializacion", "cerrado", "cancelado"],"sale_status": ["borrador", "confirmada", "entregada", "parcialmente_pagada", "pagada", "cancelada"],"worker_type": ["planta", "eventual", "temporal", "destajista"]
          }
        }
} as const
