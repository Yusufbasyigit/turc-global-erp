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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_name: string
          account_type: string | null
          asset_code: string | null
          asset_type: string | null
          bank_name: string | null
          created_by: string | null
          created_time: string | null
          custody_location_id: string | null
          edited_by: string | null
          edited_time: string | null
          iban: string | null
          id: string
          shares: number | null
          subtype: string | null
        }
        Insert: {
          account_name: string
          account_type?: string | null
          asset_code?: string | null
          asset_type?: string | null
          bank_name?: string | null
          created_by?: string | null
          created_time?: string | null
          custody_location_id?: string | null
          edited_by?: string | null
          edited_time?: string | null
          iban?: string | null
          id?: string
          shares?: number | null
          subtype?: string | null
        }
        Update: {
          account_name?: string
          account_type?: string | null
          asset_code?: string | null
          asset_type?: string | null
          bank_name?: string | null
          created_by?: string | null
          created_time?: string | null
          custody_location_id?: string | null
          edited_by?: string | null
          edited_time?: string | null
          iban?: string | null
          id?: string
          shares?: number | null
          subtype?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_custody_location_id_fkey"
            columns: ["custody_location_id"]
            isOneToOne: false
            referencedRelation: "custody_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_notes: {
        Row: {
          body: string
          contact_id: string
          created_by: string | null
          created_time: string | null
          id: string
          note_date: string
        }
        Insert: {
          body: string
          contact_id: string
          created_by?: string | null
          created_time?: string | null
          id?: string
          note_date?: string
        }
        Update: {
          body?: string
          contact_id?: string
          created_by?: string | null
          created_time?: string | null
          id?: string
          note_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          balance_currency: string | null
          city: string | null
          company_name: string
          contact_person: string | null
          country_code: string | null
          created_by: string | null
          created_time: string | null
          deleted_at: string | null
          edited_by: string | null
          edited_time: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          tax_office: string | null
          type: string | null
        }
        Insert: {
          address?: string | null
          balance_currency?: string | null
          city?: string | null
          company_name: string
          contact_person?: string | null
          country_code?: string | null
          created_by?: string | null
          created_time?: string | null
          deleted_at?: string | null
          edited_by?: string | null
          edited_time?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          tax_office?: string | null
          type?: string | null
        }
        Update: {
          address?: string | null
          balance_currency?: string | null
          city?: string | null
          company_name?: string
          contact_person?: string | null
          country_code?: string | null
          created_by?: string | null
          created_time?: string | null
          deleted_at?: string | null
          edited_by?: string | null
          edited_time?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          tax_office?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          flag_emoji: string | null
          name_en: string
          name_tr: string | null
        }
        Insert: {
          code: string
          flag_emoji?: string | null
          name_en: string
          name_tr?: string | null
        }
        Update: {
          code?: string
          flag_emoji?: string | null
          name_en?: string
          name_tr?: string | null
        }
        Relationships: []
      }
      custody_locations: {
        Row: {
          created_by: string | null
          created_time: string | null
          edited_by: string | null
          edited_time: string | null
          id: string
          is_active: boolean | null
          location_type: string
          name: string
          requires_movement_type: boolean
        }
        Insert: {
          created_by?: string | null
          created_time?: string | null
          edited_by?: string | null
          edited_time?: string | null
          id?: string
          is_active?: boolean | null
          location_type: string
          name: string
          requires_movement_type?: boolean
        }
        Update: {
          created_by?: string | null
          created_time?: string | null
          edited_by?: string | null
          edited_time?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string
          name?: string
          requires_movement_type?: boolean
        }
        Relationships: []
      }
      expense_types: {
        Row: {
          category_group: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          category_group?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          category_group?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      fx_snapshots: {
        Row: {
          currency_code: string
          fetched_at: string
          id: string
          rate_to_usd: number
          snapshot_date: string
          source: string | null
        }
        Insert: {
          currency_code: string
          fetched_at?: string
          id?: string
          rate_to_usd: number
          snapshot_date: string
          source?: string | null
        }
        Update: {
          currency_code?: string
          fetched_at?: string
          id?: string
          rate_to_usd?: number
          snapshot_date?: string
          source?: string | null
        }
        Relationships: []
      }
      order_details: {
        Row: {
          actual_purchase_price: number | null
          cbm_per_unit_snapshot: number | null
          created_by: string | null
          created_time: string
          edited_by: string | null
          edited_time: string | null
          est_purchase_unit_price: number | null
          id: string
          line_number: number
          notes: string | null
          order_id: string
          package_height_cm: number | null
          package_length_cm: number | null
          package_width_cm: number | null
          packaging_type: string | null
          product_description_snapshot: string | null
          product_id: string
          product_name_snapshot: string
          product_photo_snapshot: string | null
          quantity: number
          supplier_id: string | null
          unit_sales_price: number | null
          unit_snapshot: string
          units_per_package: number | null
          vat_rate: number | null
          weight_kg_per_unit_snapshot: number | null
        }
        Insert: {
          actual_purchase_price?: number | null
          cbm_per_unit_snapshot?: number | null
          created_by?: string | null
          created_time?: string
          edited_by?: string | null
          edited_time?: string | null
          est_purchase_unit_price?: number | null
          id?: string
          line_number: number
          notes?: string | null
          order_id: string
          package_height_cm?: number | null
          package_length_cm?: number | null
          package_width_cm?: number | null
          packaging_type?: string | null
          product_description_snapshot?: string | null
          product_id: string
          product_name_snapshot: string
          product_photo_snapshot?: string | null
          quantity: number
          supplier_id?: string | null
          unit_sales_price?: number | null
          unit_snapshot: string
          units_per_package?: number | null
          vat_rate?: number | null
          weight_kg_per_unit_snapshot?: number | null
        }
        Update: {
          actual_purchase_price?: number | null
          cbm_per_unit_snapshot?: number | null
          created_by?: string | null
          created_time?: string
          edited_by?: string | null
          edited_time?: string | null
          est_purchase_unit_price?: number | null
          id?: string
          line_number?: number
          notes?: string | null
          order_id?: string
          package_height_cm?: number | null
          package_length_cm?: number | null
          package_width_cm?: number | null
          packaging_type?: string | null
          product_description_snapshot?: string | null
          product_id?: string
          product_name_snapshot?: string
          product_photo_snapshot?: string | null
          quantity?: number
          supplier_id?: string | null
          unit_sales_price?: number | null
          unit_snapshot?: string
          units_per_package?: number | null
          vat_rate?: number | null
          weight_kg_per_unit_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_details_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_shipment_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_by: string | null
          created_time: string
          customer_id: string
          customer_po_file: string | null
          delivery_timeline: string | null
          edited_by: string | null
          edited_time: string | null
          id: string
          incoterm: string | null
          notes: string | null
          offer_date: string | null
          offer_number: string | null
          offer_valid_until: string | null
          order_currency: string
          order_date: string
          payment_terms: string | null
          proforma_notes_delivery_location: string | null
          proforma_notes_length_tolerance: string | null
          proforma_notes_production_time: string | null
          proforma_notes_remark: string | null
          proforma_notes_total_weight: string | null
          proforma_notes_validity: string | null
          proposal_pdf: string | null
          shipment_id: string | null
          status: string
        }
        Insert: {
          billing_shipment_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_by?: string | null
          created_time?: string
          customer_id: string
          customer_po_file?: string | null
          delivery_timeline?: string | null
          edited_by?: string | null
          edited_time?: string | null
          id?: string
          incoterm?: string | null
          notes?: string | null
          offer_date?: string | null
          offer_number?: string | null
          offer_valid_until?: string | null
          order_currency: string
          order_date?: string
          payment_terms?: string | null
          proforma_notes_delivery_location?: string | null
          proforma_notes_length_tolerance?: string | null
          proforma_notes_production_time?: string | null
          proforma_notes_remark?: string | null
          proforma_notes_total_weight?: string | null
          proforma_notes_validity?: string | null
          proposal_pdf?: string | null
          shipment_id?: string | null
          status?: string
        }
        Update: {
          billing_shipment_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_by?: string | null
          created_time?: string
          customer_id?: string
          customer_po_file?: string | null
          delivery_timeline?: string | null
          edited_by?: string | null
          edited_time?: string | null
          id?: string
          incoterm?: string | null
          notes?: string | null
          offer_date?: string | null
          offer_number?: string | null
          offer_valid_until?: string | null
          order_currency?: string
          order_date?: string
          payment_terms?: string | null
          proforma_notes_delivery_location?: string | null
          proforma_notes_length_tolerance?: string | null
          proforma_notes_production_time?: string | null
          proforma_notes_remark?: string | null
          proforma_notes_total_weight?: string | null
          proforma_notes_validity?: string | null
          proposal_pdf?: string | null
          shipment_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_billing_shipment_id_fkey"
            columns: ["billing_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          created_by: string | null
          created_time: string
          deleted_at: string | null
          edited_by: string | null
          edited_time: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_by?: string | null
          created_time?: string
          deleted_at?: string | null
          edited_by?: string | null
          edited_time?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_by?: string | null
          created_time?: string
          deleted_at?: string | null
          edited_by?: string | null
          edited_time?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      price_snapshots: {
        Row: {
          asset_code: string
          created_at: string | null
          id: string
          price: number
          price_currency: string
          snapshot_date: string
          source: string | null
        }
        Insert: {
          asset_code: string
          created_at?: string | null
          id?: string
          price: number
          price_currency: string
          snapshot_date: string
          source?: string | null
        }
        Update: {
          asset_code?: string
          created_at?: string | null
          id?: string
          price?: number
          price_currency?: string
          snapshot_date?: string
          source?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_by: string | null
          created_time: string | null
          edited_by: string | null
          edited_time: string | null
          id: string
          name: string
        }
        Insert: {
          created_by?: string | null
          created_time?: string | null
          edited_by?: string | null
          edited_time?: string | null
          id?: string
          name: string
        }
        Update: {
          created_by?: string | null
          created_time?: string | null
          edited_by?: string | null
          edited_time?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode_value: string | null
          category_id: string | null
          cbm_per_unit: number | null
          client_description: string | null
          client_product_name: string | null
          created_by: string | null
          created_time: string | null
          default_sales_price: number | null
          default_supplier: string | null
          deleted_at: string | null
          edited_by: string | null
          edited_time: string | null
          est_currency: string | null
          est_purchase_price: number | null
          hs_code: string | null
          is_active: boolean | null
          kdv_rate: number | null
          package_height_cm: number | null
          package_length_cm: number | null
          package_width_cm: number | null
          packaging_type: string | null
          product_id: string
          product_image: string | null
          product_name: string | null
          sales_currency: string | null
          unit: string | null
          units_per_package: number | null
          weight_kg_per_unit: number | null
        }
        Insert: {
          barcode_value?: string | null
          category_id?: string | null
          cbm_per_unit?: number | null
          client_description?: string | null
          client_product_name?: string | null
          created_by?: string | null
          created_time?: string | null
          default_sales_price?: number | null
          default_supplier?: string | null
          deleted_at?: string | null
          edited_by?: string | null
          edited_time?: string | null
          est_currency?: string | null
          est_purchase_price?: number | null
          hs_code?: string | null
          is_active?: boolean | null
          kdv_rate?: number | null
          package_height_cm?: number | null
          package_length_cm?: number | null
          package_width_cm?: number | null
          packaging_type?: string | null
          product_id?: string
          product_image?: string | null
          product_name?: string | null
          sales_currency?: string | null
          unit?: string | null
          units_per_package?: number | null
          weight_kg_per_unit?: number | null
        }
        Update: {
          barcode_value?: string | null
          category_id?: string | null
          cbm_per_unit?: number | null
          client_description?: string | null
          client_product_name?: string | null
          created_by?: string | null
          created_time?: string | null
          default_sales_price?: number | null
          default_supplier?: string | null
          deleted_at?: string | null
          edited_by?: string | null
          edited_time?: string | null
          est_currency?: string | null
          est_purchase_price?: number | null
          hs_code?: string | null
          is_active?: boolean | null
          kdv_rate?: number | null
          package_height_cm?: number | null
          package_length_cm?: number | null
          package_width_cm?: number | null
          packaging_type?: string | null
          product_id?: string
          product_image?: string | null
          product_name?: string | null
          sales_currency?: string | null
          unit?: string | null
          units_per_package?: number | null
          weight_kg_per_unit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_default_supplier_fkey"
            columns: ["default_supplier"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_refresh_runs: {
        Row: {
          error_message: string | null
          fx_outcome: Json | null
          id: string
          price_outcome: Json | null
          ran_at: string
          triggered_by: string
        }
        Insert: {
          error_message?: string | null
          fx_outcome?: Json | null
          id?: string
          price_outcome?: Json | null
          ran_at?: string
          triggered_by: string
        }
        Update: {
          error_message?: string | null
          fx_outcome?: Json | null
          id?: string
          price_outcome?: Json | null
          ran_at?: string
          triggered_by?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          container_type: string | null
          created_by: string | null
          created_time: string
          customer_id: string
          documents_file: string | null
          edited_by: string | null
          edited_time: string | null
          eta_date: string | null
          etd_date: string | null
          freight_cost: number | null
          freight_currency: string | null
          generated_statement_pdf: string | null
          id: string
          invoice_currency: string
          name: string
          notes: string | null
          status: string
          tracking_number: string | null
          transport_method: string | null
          vessel_name: string | null
        }
        Insert: {
          container_type?: string | null
          created_by?: string | null
          created_time?: string
          customer_id: string
          documents_file?: string | null
          edited_by?: string | null
          edited_time?: string | null
          eta_date?: string | null
          etd_date?: string | null
          freight_cost?: number | null
          freight_currency?: string | null
          generated_statement_pdf?: string | null
          id?: string
          invoice_currency: string
          name: string
          notes?: string | null
          status?: string
          tracking_number?: string | null
          transport_method?: string | null
          vessel_name?: string | null
        }
        Update: {
          container_type?: string | null
          created_by?: string | null
          created_time?: string
          customer_id?: string
          documents_file?: string | null
          edited_by?: string | null
          edited_time?: string | null
          eta_date?: string | null
          etd_date?: string | null
          freight_cost?: number | null
          freight_currency?: string | null
          generated_statement_pdf?: string | null
          id?: string
          invoice_currency?: string
          name?: string
          notes?: string | null
          status?: string
          tracking_number?: string | null
          transport_method?: string | null
          vessel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          attachment_path: string | null
          contact_id: string | null
          created_by: string | null
          created_time: string
          currency: string
          description: string | null
          edited_by: string | null
          edited_time: string | null
          expense_type_id: string | null
          from_account_id: string | null
          fx_converted_amount: number | null
          fx_rate_applied: number | null
          fx_target_currency: string | null
          id: string
          kdv_period: string | null
          kind: string
          net_amount: number | null
          partner_id: string | null
          reference_number: string | null
          related_order_id: string | null
          related_payable_id: string | null
          related_shipment_id: string | null
          to_account_id: string | null
          transaction_date: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount: number
          attachment_path?: string | null
          contact_id?: string | null
          created_by?: string | null
          created_time?: string
          currency: string
          description?: string | null
          edited_by?: string | null
          edited_time?: string | null
          expense_type_id?: string | null
          from_account_id?: string | null
          fx_converted_amount?: number | null
          fx_rate_applied?: number | null
          fx_target_currency?: string | null
          id?: string
          kdv_period?: string | null
          kind: string
          net_amount?: number | null
          partner_id?: string | null
          reference_number?: string | null
          related_order_id?: string | null
          related_payable_id?: string | null
          related_shipment_id?: string | null
          to_account_id?: string | null
          transaction_date: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number
          attachment_path?: string | null
          contact_id?: string | null
          created_by?: string | null
          created_time?: string
          currency?: string
          description?: string | null
          edited_by?: string | null
          edited_time?: string | null
          expense_type_id?: string | null
          from_account_id?: string | null
          fx_converted_amount?: number | null
          fx_rate_applied?: number | null
          fx_target_currency?: string | null
          id?: string
          kdv_period?: string | null
          kind?: string
          net_amount?: number | null
          partner_id?: string | null
          reference_number?: string | null
          related_order_id?: string | null
          related_payable_id?: string | null
          related_shipment_id?: string | null
          to_account_id?: string | null
          transaction_date?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_expense_type_id_fkey"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_related_payable_id_fkey"
            columns: ["related_payable_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_movements: {
        Row: {
          account_id: string
          created_by: string | null
          created_time: string
          edited_by: string | null
          edited_time: string | null
          group_id: string | null
          id: string
          kind: string
          movement_date: string
          notes: string | null
          ortak_movement_type: string | null
          quantity: number
          source_transaction_id: string | null
        }
        Insert: {
          account_id: string
          created_by?: string | null
          created_time?: string
          edited_by?: string | null
          edited_time?: string | null
          group_id?: string | null
          id?: string
          kind: string
          movement_date: string
          notes?: string | null
          ortak_movement_type?: string | null
          quantity: number
          source_transaction_id?: string | null
        }
        Update: {
          account_id?: string
          created_by?: string | null
          created_time?: string
          edited_by?: string | null
          edited_time?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          movement_date?: string
          notes?: string | null
          ortak_movement_type?: string | null
          quantity?: number
          source_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treasury_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasury_movements_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
    Enums: {},
  },
} as const
