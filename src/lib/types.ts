import type { ColumnMapping } from "./import-column-mapper";

export type AiPriority =
  | "LIST NOW"
  | "HOLD"
  | "PRICE DROP"
  | "AUCTION"
  | "MONEY TRAP"
  | "URGENT"
  | "BUY"
  | "PASS";

export type FbListingStatus = "draft" | "published" | "sold";

export interface Vehicle {
  id: string;
  dealership_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  vin: string | null;
  my_cost: number | null;
  repair_cost: number | null;
  total_invested: number | null;
  retail_price: number | null;
  auction_price: number | null;
  gross_profit: number | null;
  net_profit: number | null;
  roi: number | null;
  listed_online: boolean;
  online_channel: string | null;
  status: string | null;
  bought_date: string | null;
  days_in_stock: number | null;
  market_low: number | null;
  market_avg: number | null;
  market_high: number | null;
  comp_count: number | null;
  ai_confidence: number | null;
  ai_priority: AiPriority | null;
  recommended_price: number | null;
  action_required: string | null;
  notes: string | null;
  fb_listing_url: string | null;
  fb_listed_at: string | null;
  fb_listing_status: FbListingStatus | null;
  image_url: string | null;
  image_urls: string[] | null;
  color: string | null;
  code: string | null;
  lot_location: string | null;
  sold_date: string | null;
  airtable_record_id: string | null;
  airtable_synced_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface MarketComp {
  id: string;
  dealership_id: string;
  vehicle_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  source: string | null;
  location: string | null;
  listing_price: number | null;
  url: string | null;
  source_notes: string | null;
  date_checked: string | null;
}

export interface VehicleFormData {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  mileage?: number | null;
  vin?: string | null;
  my_cost?: number | null;
  repair_cost?: number | null;
  retail_price?: number | null;
  auction_price?: number | null;
  listed_online?: boolean;
  online_channel?: string | null;
  status?: string | null;
  bought_date?: string | null;
  days_in_stock?: number | null;
  market_low?: number | null;
  market_avg?: number | null;
  market_high?: number | null;
  comp_count?: number | null;
  notes?: string | null;
  fb_listing_url?: string | null;
  fb_listed_at?: string | null;
  fb_listing_status?: FbListingStatus | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  color?: string | null;
  code?: string | null;
  lot_location?: string | null;
  sold_date?: string | null;
}

export interface AiExtractedVehicle {
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  my_cost: number | null;
  repair_cost: number | null;
  retail_price: number | null;
  notes: string | null;
  online_channel: string | null;
}

export type MessageDirection = "inbound" | "outbound";
export type CustomerSource = "messenger" | "manual";

export interface Tag {
  id: string;
  dealership_id: string;
  name: string;
  created_at: string;
}

export interface Customer {
  id: string;
  dealership_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  fb_profile_url: string | null;
  fb_messenger_id: string | null;
  fb_conversation_id: string | null;
  source: CustomerSource | null;
  notes: string | null;
  created_at: string;
  tags?: Tag[];
}

export interface Message {
  id: string;
  dealership_id: string;
  customer_id: string;
  message: string;
  direction: MessageDirection;
  timestamp: string;
  read: boolean;
  fb_message_id: string | null;
  created_at: string;
}

export interface CustomerInquiry {
  id: string;
  dealership_id: string;
  customer_id: string;
  vehicle_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ConversationSummary {
  customer: Customer;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export type CashflowType =
  | "vehicle_purchase"
  | "vehicle_sale"
  | "repair"
  | "transport"
  | "insurance"
  | "rent"
  | "payroll"
  | "advertising"
  | "auction_fee"
  | "misc";

export interface CashflowTransaction {
  id: string;
  dealership_id: string;
  vehicle_id: string | null;
  type: CashflowType;
  amount: number;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

export interface AcquisitionOpportunity {
  id: string;
  dealership_id: string;
  source: string;
  title: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  asking_price: number | null;
  location: string | null;
  url: string | null;
  recommendation: "BUY" | "WATCH" | "PASS" | "RUN";
  max_buy_price: number | null;
  expected_profit: number | null;
  expected_roi: number | null;
  notes: string | null;
  discovered_at: string;
  created_at: string;
}

export interface MarketplaceAccount {
  id: string;
  platform: string;
  label: string;
}

export interface AirtableConfig {
  enabled: boolean;
  personal_access_token: string;
  base_id: string;
  table_name: string;
  last_modified_field: string;
  column_mapping: ColumnMapping;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

export interface DealershipSettings {
  dealership_id: string;
  company: { name?: string; address?: string; phone?: string };
  inactivity_threshold_hours: number;
  ai_settings: { default_listing_template?: string };
  marketplace_accounts: MarketplaceAccount[];
  airtable_config: AirtableConfig;
  updated_at: string;
}

export type ProfileRole = "admin" | "staff";

export interface Dealership {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  dealership_id: string;
  role: ProfileRole;
  full_name: string | null;
  email: string;
  created_at: string;
}
