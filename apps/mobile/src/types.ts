// Client-side DTOs mirroring the @ai-waiter/shared contracts served by the API.
// Kept as a local, type-only copy so the Expo app stays self-contained (no
// monorepo Metro config required). Shapes must match the API responses.

export interface Money {
  amount: number; // integer minor units
  currency: string;
}

export interface Branding {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  aiWaiterName: string;
  welcomeMessage: string;
}

export interface RestaurantSummary {
  id: string;
  name: string;
  currency: string;
  branding: Branding;
}

export interface RestaurantDetail {
  id: string;
  name: string;
  currency: string;
  taxRateBps: number;
  branding: Branding;
  policies: string;
}

export interface TableInfo {
  id: string;
  restaurantId: string;
  number: string;
  active: boolean;
}

export interface Modifier {
  id: string;
  name: string;
  priceDelta: Money;
  available: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number | null;
  modifiers: Modifier[];
}

export interface ProductSize {
  id: string;
  name: string;
  priceDelta: Money;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: Money;
  imageUrl: string | null;
  available: boolean;
  rating: number | null;
  dietaryTags: string[];
  allergenIds: string[];
  sizes: ProductSize[];
  modifierGroups: ModifierGroup[];
  popularityScore: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface Menu {
  restaurantId: string;
  currency: string;
  categories: Category[];
  products: Product[];
  updatedAt: string;
}

export interface SelectedModifier {
  modifierGroupId: string;
  modifierId: string;
  name: string;
  priceDelta: Money;
}

export interface CartItem {
  lineId: string;
  productId: string;
  name: string;
  quantity: number;
  sizeId: string | null;
  sizeName: string | null;
  unitBasePrice: Money;
  modifiers: SelectedModifier[];
  notes: string;
  unitPrice: Money;
  lineTotal: Money;
}

export interface CartTotals {
  subtotal: Money;
  tax: Money;
  discount: Money;
  total: Money;
}

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface Order {
  id: string;
  restaurantId: string;
  tableId: string | null;
  status: OrderStatus;
  items: CartItem[];
  totals: CartTotals;
  displayNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  intent: string;
  reply: string;
  recommendedProductIds: string[];
  resolvedItems: CartItem[];
  cartOps: Array<{ op: 'remove' | 'clear'; productId?: string }>;
  serviceRequests: Array<{ type: string; note: string }>;
  requiresConfirmation: boolean;
  upsell: { productId: string | null; modifierId: string | null; message: string } | null;
  deferredToStaff: boolean;
  provider: string;
}

export type ServiceRequestType =
  | 'call_waiter'
  | 'request_water'
  | 'request_bill'
  | 'request_assistance'
  | 'request_napkins'
  | 'other';
