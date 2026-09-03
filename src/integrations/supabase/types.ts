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
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          client_request_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          language: string
          role: string
        }
        Insert: {
          client_request_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          language?: string
          role: string
        }
        Update: {
          client_request_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          language?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_reserves: {
        Row: {
          auction_id: string
          created_at: string
          reserve_price: number
          updated_at: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          reserve_price: number
          updated_at?: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          reserve_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_reserves_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_reserves_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "public_auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          anti_sniping_minutes: number
          bid_count: number
          created_at: string
          ends_at: string
          final_price: number | null
          finalized_at: string | null
          has_reserve: boolean
          highest_bid_amount: number | null
          highest_bidder_id: string | null
          id: string
          minimum_increment: number
          original_ends_at: string
          product_id: string
          reserve_met: boolean
          seller_id: string
          start_price: number
          starts_at: string
          status: Database["public"]["Enums"]["auction_status"]
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          anti_sniping_minutes?: number
          bid_count?: number
          created_at?: string
          ends_at: string
          final_price?: number | null
          finalized_at?: string | null
          has_reserve?: boolean
          highest_bid_amount?: number | null
          highest_bidder_id?: string | null
          id?: string
          minimum_increment?: number
          original_ends_at: string
          product_id: string
          reserve_met?: boolean
          seller_id: string
          start_price: number
          starts_at: string
          status?: Database["public"]["Enums"]["auction_status"]
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          anti_sniping_minutes?: number
          bid_count?: number
          created_at?: string
          ends_at?: string
          final_price?: number | null
          finalized_at?: string | null
          has_reserve?: boolean
          highest_bid_amount?: number | null
          highest_bidder_id?: string | null
          id?: string
          minimum_increment?: number
          original_ends_at?: string
          product_id?: string
          reserve_met?: boolean
          seller_id?: string
          start_price?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["auction_status"]
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at: string
          id: string
        }
        Insert: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at?: string
          id?: string
        }
        Update: {
          amount?: number
          auction_id?: string
          bidder_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "public_auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      blockchain_certificates: {
        Row: {
          contract_address: string | null
          created_at: string
          current_owner_wallet: string | null
          id: string
          last_error_code: string | null
          last_error_message: string | null
          manifest: Json | null
          metadata_hash: string | null
          metadata_uri: string | null
          mint_block_number: number | null
          mint_tx_hash: string | null
          minted_at: string | null
          network: string
          product_id: string
          product_ref: string
          retry_count: number
          seller_id: string
          seller_wallet: string | null
          snapshot_at: string | null
          status: Database["public"]["Enums"]["certificate_status"]
          token_id: string | null
          updated_at: string
        }
        Insert: {
          contract_address?: string | null
          created_at?: string
          current_owner_wallet?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          manifest?: Json | null
          metadata_hash?: string | null
          metadata_uri?: string | null
          mint_block_number?: number | null
          mint_tx_hash?: string | null
          minted_at?: string | null
          network?: string
          product_id: string
          product_ref: string
          retry_count?: number
          seller_id: string
          seller_wallet?: string | null
          snapshot_at?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          token_id?: string | null
          updated_at?: string
        }
        Update: {
          contract_address?: string | null
          created_at?: string
          current_owner_wallet?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          manifest?: Json | null
          metadata_hash?: string | null
          metadata_uri?: string | null
          mint_block_number?: number | null
          mint_tx_hash?: string | null
          minted_at?: string | null
          network?: string
          product_id?: string
          product_ref?: string
          retry_count?: number
          seller_id?: string
          seller_wallet?: string | null
          snapshot_at?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          token_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blockchain_certificates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name_en: string
          name_sr: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_en: string
          name_sr: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_en?: string
          name_sr?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ownership_transfers: {
        Row: {
          auction_id: string
          block_number: number | null
          buyer_wallet: string
          certificate_id: string
          completed_at: string | null
          created_at: string
          id: string
          last_error_code: string | null
          last_error_message: string | null
          previous_owner_wallet: string
          product_id: string
          retry_count: number
          sale_data_hash: string
          sale_ref: string
          sale_snapshot: Json
          status: Database["public"]["Enums"]["ownership_transfer_status"]
          submitted_at: string | null
          token_id: string
          transaction_id: string
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          auction_id: string
          block_number?: number | null
          buyer_wallet: string
          certificate_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          previous_owner_wallet: string
          product_id: string
          retry_count?: number
          sale_data_hash: string
          sale_ref: string
          sale_snapshot: Json
          status?: Database["public"]["Enums"]["ownership_transfer_status"]
          submitted_at?: string | null
          token_id: string
          transaction_id: string
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          auction_id?: string
          block_number?: number | null
          buyer_wallet?: string
          certificate_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          previous_owner_wallet?: string
          product_id?: string
          retry_count?: number
          sale_data_hash?: string
          sale_ref?: string
          sale_snapshot?: Json
          status?: Database["public"]["Enums"]["ownership_transfer_status"]
          submitted_at?: string | null
          token_id?: string
          transaction_id?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_transfers_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_transfers_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "public_auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_transfers_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "blockchain_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ownership_transfers_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_cover: boolean
          product_id: string
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          category_id: string | null
          condition: string | null
          country_of_origin: string | null
          created_at: string
          description: string | null
          has_documents: boolean
          has_original_box: boolean
          id: string
          material: string | null
          model: string | null
          production_year: number | null
          provenance_document_name: string | null
          provenance_document_path: string | null
          provenance_notes: string | null
          seller_id: string
          serial_number: string | null
          status: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          condition?: string | null
          country_of_origin?: string | null
          created_at?: string
          description?: string | null
          has_documents?: boolean
          has_original_box?: boolean
          id?: string
          material?: string | null
          model?: string | null
          production_year?: number | null
          provenance_document_name?: string | null
          provenance_document_path?: string | null
          provenance_notes?: string | null
          seller_id: string
          serial_number?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          condition?: string | null
          country_of_origin?: string | null
          created_at?: string
          description?: string | null
          has_documents?: boolean
          has_original_box?: boolean
          id?: string
          material?: string | null
          model?: string | null
          production_year?: number | null
          provenance_document_name?: string | null
          provenance_document_path?: string | null
          provenance_notes?: string | null
          seller_id?: string
          serial_number?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          avatar_url: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          seller_request_status: Database["public"]["Enums"]["seller_request_status"]
          updated_at: string
          wallet_address: string | null
          wallet_network: string | null
          wallet_verified_at: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          seller_request_status?: Database["public"]["Enums"]["seller_request_status"]
          updated_at?: string
          wallet_address?: string | null
          wallet_network?: string | null
          wallet_verified_at?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          seller_request_status?: Database["public"]["Enums"]["seller_request_status"]
          updated_at?: string
          wallet_address?: string | null
          wallet_network?: string | null
          wallet_verified_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          auction_id: string
          bid_history_hash: string
          buyer_confirmed_at: string | null
          buyer_confirmed_by: string | null
          buyer_id: string
          created_at: string
          dispute_opened_at: string | null
          dispute_opened_by: string | null
          dispute_reason: string | null
          final_price: number
          id: string
          product_id: string
          seller_confirmed_at: string | null
          seller_confirmed_by: string | null
          seller_id: string
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
        }
        Insert: {
          auction_id: string
          bid_history_hash: string
          buyer_confirmed_at?: string | null
          buyer_confirmed_by?: string | null
          buyer_id: string
          created_at?: string
          dispute_opened_at?: string | null
          dispute_opened_by?: string | null
          dispute_reason?: string | null
          final_price: number
          id?: string
          product_id: string
          seller_confirmed_at?: string | null
          seller_confirmed_by?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
        }
        Update: {
          auction_id?: string
          bid_history_hash?: string
          buyer_confirmed_at?: string | null
          buyer_confirmed_by?: string | null
          buyer_id?: string
          created_at?: string
          dispute_opened_at?: string | null
          dispute_opened_by?: string | null
          dispute_reason?: string | null
          final_price?: number
          id?: string
          product_id?: string
          seller_confirmed_at?: string | null
          seller_confirmed_by?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: true
            referencedRelation: "public_auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_verification_nonces: {
        Row: {
          address: string
          created_at: string
          expires_at: string
          id: string
          nonce: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          expires_at: string
          id?: string
          nonce: string
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_auctions: {
        Row: {
          anti_sniping_minutes: number | null
          bid_count: number | null
          created_at: string | null
          current_price: number | null
          ends_at: string | null
          final_price: number | null
          finalized_at: string | null
          has_reserve: boolean | null
          highest_bid_amount: number | null
          id: string | null
          minimum_increment: number | null
          minimum_next_bid: number | null
          original_ends_at: string | null
          product_id: string | null
          reserve_met: boolean | null
          seller_id: string | null
          start_price: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["auction_status"] | null
        }
        Insert: {
          anti_sniping_minutes?: number | null
          bid_count?: number | null
          created_at?: string | null
          current_price?: never
          ends_at?: string | null
          final_price?: number | null
          finalized_at?: string | null
          has_reserve?: boolean | null
          highest_bid_amount?: number | null
          id?: string | null
          minimum_increment?: number | null
          minimum_next_bid?: never
          original_ends_at?: string | null
          product_id?: string | null
          reserve_met?: boolean | null
          seller_id?: string | null
          start_price?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["auction_status"] | null
        }
        Update: {
          anti_sniping_minutes?: number | null
          bid_count?: number | null
          created_at?: string | null
          current_price?: never
          ends_at?: string | null
          final_price?: number | null
          finalized_at?: string | null
          has_reserve?: boolean | null
          highest_bid_amount?: number | null
          id?: string | null
          minimum_increment?: number | null
          minimum_next_bid?: never
          original_ends_at?: string | null
          product_id?: string | null
          reserve_met?: boolean | null
          seller_id?: string | null
          start_price?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["auction_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"]
          country: string
          created_at: string
          email: string
          full_name: string
          id: string
          roles: Database["public"]["Enums"]["app_role"][]
          seller_request_status: Database["public"]["Enums"]["seller_request_status"]
        }[]
      }
      auction_bid_history: {
        Args: { _auction_id: string }
        Returns: {
          amount: number
          bid_id: string
          bidder_label: string
          created_at: string
          is_own: boolean
        }[]
      }
      bidder_mask: {
        Args: { _auction_id: string; _bidder_id: string }
        Returns: string
      }
      cancel_auction: { Args: { _auction_id: string }; Returns: undefined }
      claim_certificate_transfer: {
        Args: {
          _auction_id: string
          _buyer_wallet: string
          _certificate_id: string
          _previous_owner_wallet: string
          _product_id: string
          _sale_data_hash: string
          _sale_ref: string
          _sale_snapshot: Json
          _token_id: string
          _transaction_id: string
        }
        Returns: {
          auction_id: string
          block_number: number | null
          buyer_wallet: string
          certificate_id: string
          completed_at: string | null
          created_at: string
          id: string
          last_error_code: string | null
          last_error_message: string | null
          previous_owner_wallet: string
          product_id: string
          retry_count: number
          sale_data_hash: string
          sale_ref: string
          sale_snapshot: Json
          status: Database["public"]["Enums"]["ownership_transfer_status"]
          submitted_at: string | null
          token_id: string
          transaction_id: string
          tx_hash: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ownership_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_transaction_buyer: {
        Args: { _transaction_id: string }
        Returns: {
          auction_id: string
          bid_history_hash: string
          buyer_confirmed_at: string | null
          buyer_confirmed_by: string | null
          buyer_id: string
          created_at: string
          dispute_opened_at: string | null
          dispute_opened_by: string | null
          dispute_reason: string | null
          final_price: number
          id: string
          product_id: string
          seller_confirmed_at: string | null
          seller_confirmed_by: string | null
          seller_id: string
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_transaction_seller: {
        Args: { _transaction_id: string }
        Returns: {
          auction_id: string
          bid_history_hash: string
          buyer_confirmed_at: string | null
          buyer_confirmed_by: string | null
          buyer_id: string
          created_at: string
          dispute_opened_at: string | null
          dispute_opened_by: string | null
          dispute_reason: string | null
          final_price: number
          id: string
          product_id: string
          seller_confirmed_at: string | null
          seller_confirmed_by: string | null
          seller_id: string
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_wallet_nonce: {
        Args: { _nonce: string; _user_id: string }
        Returns: {
          address: string
          expires_at: string
        }[]
      }
      finalize_auctions: { Args: never; Returns: undefined }
      finalize_certificate_transfer: {
        Args: {
          _block_number: number
          _owner_wallet: string
          _transaction_id: string
          _tx_hash: string
        }
        Returns: {
          auction_id: string
          block_number: number | null
          buyer_wallet: string
          certificate_id: string
          completed_at: string | null
          created_at: string
          id: string
          last_error_code: string | null
          last_error_message: string | null
          previous_owner_wallet: string
          product_id: string
          retry_count: number
          sale_data_hash: string
          sale_ref: string
          sale_snapshot: Json
          status: Database["public"]["Enums"]["ownership_transfer_status"]
          submitted_at: string | null
          token_id: string
          transaction_id: string
          tx_hash: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "ownership_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      issue_wallet_nonce: {
        Args: {
          _address: string
          _expires_at: string
          _nonce: string
          _user_id: string
        }
        Returns: undefined
      }
      link_verified_wallet: {
        Args: { _address: string; _user_id: string }
        Returns: undefined
      }
      mark_certificate_transfer_submitted: {
        Args: { _transaction_id: string; _tx_hash: string }
        Returns: undefined
      }
      open_transaction_dispute: {
        Args: { _reason: string; _transaction_id: string }
        Returns: {
          auction_id: string
          bid_history_hash: string
          buyer_confirmed_at: string | null
          buyer_confirmed_by: string | null
          buyer_id: string
          created_at: string
          dispute_opened_at: string | null
          dispute_opened_by: string | null
          dispute_reason: string | null
          final_price: number
          id: string
          product_id: string
          seller_confirmed_at: string | null
          seller_confirmed_by: string | null
          seller_id: string
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      place_bid: {
        Args: { _amount: number; _auction_id: string }
        Returns: {
          amount: number
          bid_count: number
          ends_at: string
        }[]
      }
      public_certificate_transfer: {
        Args: { _product_id: string }
        Returns: {
          block_number: number
          buyer_wallet: string
          completed_at: string
          previous_owner_wallet: string
          tx_hash: string
        }[]
      }
      public_seller_summary: {
        Args: { _seller_id: string }
        Returns: {
          country: string
          full_name: string
          id: string
          member_since: string
        }[]
      }
      release_certificate_transfer: {
        Args: { _code: string; _message: string; _transaction_id: string }
        Returns: undefined
      }
      transaction_next_status: {
        Args: { _buyer_at: string; _seller_at: string }
        Returns: Database["public"]["Enums"]["transaction_status"]
      }
    }
    Enums: {
      account_status: "active" | "pending" | "suspended"
      app_role: "buyer" | "seller" | "admin"
      auction_status: "draft" | "scheduled" | "live" | "ended" | "cancelled"
      certificate_status: "pending" | "minting" | "minted" | "failed"
      ownership_transfer_status:
        | "pending"
        | "submitted"
        | "completed"
        | "failed"
      product_status: "draft" | "published" | "archived"
      seller_request_status: "none" | "pending" | "approved" | "rejected"
      transaction_status:
        | "awaiting_buyer"
        | "awaiting_seller"
        | "ready_for_transfer"
        | "disputed"
        | "transferring_certificate"
        | "completed"
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
      account_status: ["active", "pending", "suspended"],
      app_role: ["buyer", "seller", "admin"],
      auction_status: ["draft", "scheduled", "live", "ended", "cancelled"],
      certificate_status: ["pending", "minting", "minted", "failed"],
      ownership_transfer_status: [
        "pending",
        "submitted",
        "completed",
        "failed",
      ],
      product_status: ["draft", "published", "archived"],
      seller_request_status: ["none", "pending", "approved", "rejected"],
      transaction_status: [
        "awaiting_buyer",
        "awaiting_seller",
        "ready_for_transfer",
        "disputed",
        "transferring_certificate",
        "completed",
      ],
    },
  },
} as const
