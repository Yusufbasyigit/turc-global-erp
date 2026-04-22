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
          created_by: string | null
          created_time: string | null
          detail_id: string
          edited_by: string | null
          edited_time: string | null
          est_purchase_unit_price: number | null
          label_generated_pdf: string | null
          line_cbm_total: number | null
          line_total_amount: number | null
          order_id: string | null
          package_barcode: string | null
          product_id: string | null
          quantity: number | null
          status: string | null
          supplier_proposal_doc: string | null
          target_supplier_id: string | null
          unit_sales_price: number | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          actual_purchase_price?: number | null
          created_by?: string | null
          created_time?: string | null
          detail_id?: string
          edited_by?: string | null
          edited_time?: string | null
          est_purchase_unit_price?: number | null
          label_generated_pdf?: string | null
          line_cbm_total?: number | null
          line_total_amount?: number | null
          order_id?: string | null
          package_barcode?: string | null
          product_id?: string | null
          quantity?: number | null
          status?: string | null
          supplier_proposal_doc?: string | null
          target_supplier_id?: string | null
          unit_sales_price?: number | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          actual_purchase_price?: number | null
          created_by?: string | null
          created_time?: string | null
          detail_id?: string
          edited_by?: string | null
          edited_time?: string | null
          est_purchase_unit_price?: number | null
          label_generated_pdf?: string | null
          line_cbm_total?: number | null
          line_total_amount?: number | null
          order_id?: string | null
          package_barcode?: string | null
          product_id?: string | null
          quantity?: number | null
          status?: string | null
          supplier_proposal_doc?: string | null
          target_supplier_id?: string | null
          unit_sales_price?: number | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_status: string | null
          old_status: string | null
          order_id: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["order_id"]
          },
        ]
      }
      orders: {
        Row: {
          created_by: string | null
          created_time: string | null
          customer_id: string | null
          customer_po_file: string | null
          edited_by: string | null
          edited_time: string | null
          exchange_rate_to_usd: number | null
          generated_proposal_pdf: string | null
          grand_total: number | null
          notes: string | null
          order_currency: string | null
          order_date: string | null
          order_id: string
          proposal_template_type: string | null
          shipment_id: string | null
          status: string | null
          target_delivery_date: string | null
          total_sales_amount_net: number | null
          total_vat_amount: number | null
        }
        Insert: {
          created_by?: string | null
          created_time?: string | null
          customer_id?: string | null
          customer_po_file?: string | null
          edited_by?: string | null
          edited_time?: string | null
          exchange_rate_to_usd?: number | null
          generated_proposal_pdf?: string | null
          grand_total?: number | null
          notes?: string | null
          order_currency?: string | null
          order_date?: string | null
          order_id?: string
          proposal_template_type?: string | null
          shipment_id?: string | null
          status?: string | null
          target_delivery_date?: string | null
          total_sales_amount_net?: number | null
          total_vat_amount?: number | null
        }
        Update: {
          created_by?: string | null
          created_time?: string | null
          customer_id?: string | null
          customer_po_file?: string | null
          edited_by?: string | null
          edited_time?: string | null
          exchange_rate_to_usd?: number | null
          generated_proposal_pdf?: string | null
          grand_total?: number | null
          notes?: string | null
          order_currency?: string | null
          order_date?: string | null
          order_id?: string
          proposal_template_type?: string | null
          shipment_id?: string | null
          status?: string | null
          target_delivery_date?: string | null
          total_sales_amount_net?: number | null
          total_vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["shipment_id"]
          },
        ]
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
      shipments: {
        Row: {
          capacity_percentage: number | null
          container_type: string | null
          created_by: string | null
          created_time: string | null
          documents_file: string | null
          edited_by: string | null
          edited_time: string | null
          eta_date: string | null
          etd_date: string | null
          freight_cost: number | null
          freight_currency: string | null
          shipment_id: string
          status: string | null
          total_cbm_loaded: number | null
          tracking_number: string | null
          transport_method: string | null
          vessel_name: string | null
        }
        Insert: {
          capacity_percentage?: number | null
          container_type?: string | null
          created_by?: string | null
          created_time?: string | null
          documents_file?: string | null
          edited_by?: string | null
          edited_time?: string | null
          eta_date?: string | null
          etd_date?: string | null
          freight_cost?: number | null
          freight_currency?: string | null
          shipment_id?: string
          status?: string | null
          total_cbm_loaded?: number | null
          tracking_number?: string | null
          transport_method?: string | null
          vessel_name?: string | null
        }
        Update: {
          capacity_percentage?: number | null
          container_type?: string | null
          created_by?: string | null
          created_time?: string | null
          documents_file?: string | null
          edited_by?: string | null
          edited_time?: string | null
          eta_date?: string | null
          etd_date?: string | null
          freight_cost?: number | null
          freight_currency?: string | null
          shipment_id?: string
          status?: string | null
          total_cbm_loaded?: number | null
          tracking_number?: string | null
          transport_method?: string | null
          vessel_name?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          base_currency_amount: number | null
          contact_currency_amount: number | null
          currency: string | null
          Date: string | null
          description: string | null
          exchange_rate: number | null
          expense_category: string | null
          from_account_id: string | null
          generated_receipt_pdf: string | null
          id: string
          net_amount: number | null
          paid_by_partner_id: string | null
          payer_signature: string | null
          receipt_image: string | null
          reference_document_number: string | null
          related_contact_id: string | null
          related_order_id: string | null
          related_payable_id: string | null
          timestamp: string | null
          to_account_id: string | null
          transaction_time: string | null
          type_category: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount: number
          base_currency_amount?: number | null
          contact_currency_amount?: number | null
          currency?: string | null
          Date?: string | null
          description?: string | null
          exchange_rate?: number | null
          expense_category?: string | null
          from_account_id?: string | null
          generated_receipt_pdf?: string | null
          id?: string
          net_amount?: number | null
          paid_by_partner_id?: string | null
          payer_signature?: string | null
          receipt_image?: string | null
          reference_document_number?: string | null
          related_contact_id?: string | null
          related_order_id?: string | null
          related_payable_id?: string | null
          timestamp?: string | null
          to_account_id?: string | null
          transaction_time?: string | null
          type_category: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number
          base_currency_amount?: number | null
          contact_currency_amount?: number | null
          currency?: string | null
          Date?: string | null
          description?: string | null
          exchange_rate?: number | null
          expense_category?: string | null
          from_account_id?: string | null
          generated_receipt_pdf?: string | null
          id?: string
          net_amount?: number | null
          paid_by_partner_id?: string | null
          payer_signature?: string | null
          receipt_image?: string | null
          reference_document_number?: string | null
          related_contact_id?: string | null
          related_order_id?: string | null
          related_payable_id?: string | null
          timestamp?: string | null
          to_account_id?: string | null
          transaction_time?: string | null
          type_category?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_paid_by_partner_id_fkey"
            columns: ["paid_by_partner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
