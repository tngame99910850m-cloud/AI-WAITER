import {
  money,
  type Allergen,
  type Ingredient,
  type Menu,
  type Product,
  type Restaurant,
  type Table,
  type UpsellRule,
} from '@ai-waiter/shared';
import { store } from './store.js';

/**
 * Reference seed data. Two tenants demonstrate multi-tenancy: "Juniors" and
 * "Sarah's Kitchen", each with isolated menus, branding and AI persona.
 */

const CUR = 'QAR';

const allergens: Allergen[] = [
  { id: 'al_gluten', key: 'gluten', label: 'Gluten' },
  { id: 'al_dairy', key: 'dairy', label: 'Dairy' },
  { id: 'al_egg', key: 'egg', label: 'Egg' },
  { id: 'al_soy', key: 'soy', label: 'Soy' },
  { id: 'al_nuts', key: 'nuts', label: 'Nuts' },
];

const ingredients: Ingredient[] = [
  { id: 'in_chicken', name: 'Chicken', allergenIds: [] },
  { id: 'in_bun', name: 'Bun', allergenIds: ['al_gluten'] },
  { id: 'in_cheese', name: 'Cheese', allergenIds: ['al_dairy'] },
  { id: 'in_onion', name: 'Onion', allergenIds: [] },
  { id: 'in_pickle', name: 'Pickles', allergenIds: [] },
  { id: 'in_jalapeno', name: 'Jalapeño', allergenIds: [] },
  { id: 'in_lettuce', name: 'Lettuce', allergenIds: [] },
  { id: 'in_potato', name: 'Potato', allergenIds: [] },
];

function breadGroup() {
  return {
    id: 'g_bread',
    name: 'Bread',
    minSelect: 1,
    maxSelect: 1,
    modifiers: [
      { id: 'm_bread_regular', name: 'Regular Bun', priceDelta: money(0, CUR), available: true, addsIngredientIds: ['in_bun'], removesIngredientIds: [] },
      { id: 'm_bread_brioche', name: 'Brioche Bun', priceDelta: money(300, CUR), available: true, addsIngredientIds: ['in_bun'], removesIngredientIds: [] },
    ],
  };
}

function cheeseGroup() {
  return {
    id: 'g_cheese',
    name: 'Cheese',
    minSelect: 0,
    maxSelect: 1,
    modifiers: [
      { id: 'm_cheese_american', name: 'American Cheese', priceDelta: money(200, CUR), available: true, addsIngredientIds: ['in_cheese'], removesIngredientIds: [] },
      { id: 'm_cheese_cheddar', name: 'Cheddar Cheese', priceDelta: money(200, CUR), available: true, addsIngredientIds: ['in_cheese'], removesIngredientIds: [] },
    ],
  };
}

function extrasGroup() {
  return {
    id: 'g_extras',
    name: 'Extras',
    minSelect: 0,
    maxSelect: 4,
    modifiers: [
      { id: 'm_extra_chicken', name: 'Extra Chicken', priceDelta: money(500, CUR), available: true, addsIngredientIds: ['in_chicken'], removesIngredientIds: [] },
      { id: 'm_extra_jalapeno', name: 'Jalapeño', priceDelta: money(100, CUR), available: true, addsIngredientIds: ['in_jalapeno'], removesIngredientIds: [] },
    ],
  };
}

function removeGroup() {
  return {
    id: 'g_remove',
    name: 'Remove',
    minSelect: 0,
    maxSelect: 2,
    modifiers: [
      { id: 'm_no_onion', name: 'No Onion', priceDelta: money(0, CUR), available: true, addsIngredientIds: [], removesIngredientIds: ['in_onion'] },
      { id: 'm_no_pickles', name: 'No Pickles', priceDelta: money(0, CUR), available: true, addsIngredientIds: [], removesIngredientIds: ['in_pickle'] },
    ],
  };
}

function juniorsProducts(): Product[] {
  return [
    {
      id: 'p_nashville',
      categoryId: 'cat_chicken',
      name: 'Nashville Chicken Sandwich',
      description: 'Crispy fried chicken with a spicy Nashville glaze, pickles and slaw.',
      basePrice: money(2200, CUR),
      imageUrl: null,
      available: true,
      rating: 4.7,
      dietaryTags: ['spicy', 'popular'],
      allergenIds: ['al_gluten'],
      ingredientIds: ['in_chicken', 'in_bun', 'in_pickle', 'in_onion'],
      popularityScore: 98,
      sizes: [
        { id: 's_sandwich', name: 'Sandwich', priceDelta: money(0, CUR) },
        { id: 's_meal', name: 'Meal (fries + drink)', priceDelta: money(800, CUR) },
      ],
      modifierGroups: [breadGroup(), cheeseGroup(), extrasGroup(), removeGroup()],
    },
    {
      id: 'p_classic',
      categoryId: 'cat_chicken',
      name: 'Classic Chicken Sandwich',
      description: 'Buttermilk fried chicken, lettuce, and house sauce.',
      basePrice: money(1900, CUR),
      imageUrl: null,
      available: true,
      rating: 4.4,
      dietaryTags: ['popular'],
      allergenIds: ['al_gluten'],
      ingredientIds: ['in_chicken', 'in_bun', 'in_lettuce', 'in_onion'],
      popularityScore: 80,
      sizes: [
        { id: 's_sandwich', name: 'Sandwich', priceDelta: money(0, CUR) },
        { id: 's_meal', name: 'Meal (fries + drink)', priceDelta: money(800, CUR) },
      ],
      modifierGroups: [breadGroup(), cheeseGroup(), extrasGroup(), removeGroup()],
    },
    {
      id: 'p_salad',
      categoryId: 'cat_salads',
      name: 'Grilled Chicken Salad',
      description: 'Grilled chicken breast over crisp greens with a light vinaigrette.',
      basePrice: money(2400, CUR),
      imageUrl: null,
      available: true,
      rating: 4.5,
      dietaryTags: ['healthy', 'gluten_free'],
      allergenIds: [],
      ingredientIds: ['in_chicken', 'in_lettuce'],
      popularityScore: 60,
      sizes: [],
      modifierGroups: [
        {
          id: 'g_dressing',
          name: 'Dressing',
          minSelect: 1,
          maxSelect: 1,
          modifiers: [
            { id: 'm_vin', name: 'Vinaigrette', priceDelta: money(0, CUR), available: true, addsIngredientIds: [], removesIngredientIds: [] },
            { id: 'm_ranch', name: 'Ranch', priceDelta: money(0, CUR), available: true, addsIngredientIds: ['in_cheese'], removesIngredientIds: [] },
          ],
        },
      ],
    },
    {
      id: 'p_nuggets',
      categoryId: 'cat_kids',
      name: 'Kids Chicken Nuggets',
      description: 'Six crispy nuggets — a kids favorite. Mild, not spicy.',
      basePrice: money(1500, CUR),
      imageUrl: null,
      available: true,
      rating: 4.6,
      dietaryTags: ['kids', 'popular'],
      allergenIds: ['al_gluten'],
      ingredientIds: ['in_chicken'],
      popularityScore: 70,
      sizes: [],
      modifierGroups: [],
    },
    {
      id: 'p_fries',
      categoryId: 'cat_sides',
      name: 'Fries',
      description: 'Golden, crispy skin-on fries.',
      basePrice: money(900, CUR),
      imageUrl: null,
      available: true,
      rating: 4.3,
      dietaryTags: ['vegetarian', 'popular'],
      allergenIds: [],
      ingredientIds: ['in_potato'],
      popularityScore: 90,
      sizes: [
        { id: 's_reg', name: 'Regular', priceDelta: money(0, CUR) },
        { id: 's_large', name: 'Large', priceDelta: money(400, CUR) },
      ],
      modifierGroups: [
        {
          id: 'g_fries_sauce',
          name: 'Add Sauce',
          minSelect: 0,
          maxSelect: 2,
          modifiers: [
            { id: 'm_cheese_sauce', name: 'Cheese Sauce', priceDelta: money(200, CUR), available: true, addsIngredientIds: ['in_cheese'], removesIngredientIds: [] },
            { id: 'm_spicy_mayo', name: 'Spicy Mayo', priceDelta: money(200, CUR), available: true, addsIngredientIds: [], removesIngredientIds: [] },
          ],
        },
      ],
    },
    {
      id: 'p_cola',
      categoryId: 'cat_drinks',
      name: 'Cola',
      description: 'Ice-cold cola.',
      basePrice: money(700, CUR),
      imageUrl: null,
      available: true,
      rating: 4.2,
      dietaryTags: ['vegetarian'],
      allergenIds: [],
      ingredientIds: [],
      popularityScore: 65,
      sizes: [
        { id: 's_reg', name: 'Regular', priceDelta: money(0, CUR) },
        { id: 's_large', name: 'Large', priceDelta: money(300, CUR) },
      ],
      modifierGroups: [],
    },
  ];
}

function buildMenu(restaurantId: string, products: Product[]): Menu {
  return {
    restaurantId,
    currency: CUR,
    updatedAt: new Date().toISOString(),
    categories: [
      { id: 'cat_chicken', name: 'Chicken', description: 'Our famous fried chicken', sortOrder: 0 },
      { id: 'cat_salads', name: 'Salads', description: 'Lighter options', sortOrder: 1 },
      { id: 'cat_sides', name: 'Sides', description: '', sortOrder: 2 },
      { id: 'cat_kids', name: 'Kids', description: 'For younger guests', sortOrder: 3 },
      { id: 'cat_drinks', name: 'Drinks', description: '', sortOrder: 4 },
    ],
    products,
    modifierGroups: [breadGroup(), cheeseGroup(), extrasGroup(), removeGroup()],
    ingredients,
    allergens,
    promotions: [
      {
        id: 'promo_meal',
        title: 'Make it a Meal',
        description: 'Add fries and a drink to any sandwich for +8 QAR.',
        productIds: ['p_nashville', 'p_classic'],
        active: true,
      },
    ],
  };
}

const upsellRules: UpsellRule[] = [
  {
    id: 'up_meal',
    whenProductIds: ['p_nashville', 'p_classic'],
    whenCategoryIds: [],
    suggestProductId: null,
    suggestModifierId: null,
    message: 'Would you like to make it a meal with fries and a drink for +8 QAR?',
    priority: 10,
  },
  {
    id: 'up_cheese_sauce',
    whenProductIds: ['p_fries'],
    whenCategoryIds: [],
    suggestProductId: null,
    suggestModifierId: 'm_cheese_sauce',
    message: 'Would you like to add cheese sauce for +2 QAR?',
    priority: 5,
  },
];

export function seed(): void {
  store.reset();

  const juniors: Restaurant = {
    id: 'juniors',
    name: 'Juniors',
    currency: CUR,
    timezone: 'Asia/Qatar',
    taxRateBps: 0,
    branding: {
      logoUrl: null,
      primaryColor: '#E8552B',
      accentColor: '#111827',
      aiWaiterName: 'Juniors AI Waiter',
      welcomeMessage: 'Welcome to Juniors! How can I help you today?',
    },
    aiConfig: {
      personality:
        'You are a warm, upbeat waiter at Juniors, a fried-chicken spot. Concise, friendly, never pushy.',
      upsellEnabled: true,
      maxUpsellsPerConversation: 3,
      faqs: [
        { question: 'Do you have vegetarian options?', answer: 'We have fries and salads that can be made vegetarian.' },
      ],
    },
    openingHours: [],
    policies: 'Dine-in table service. Prices include applicable charges.',
  };

  const juniorsTables: Table[] = Array.from({ length: 20 }, (_, i) => ({
    id: `t${i + 1}`,
    restaurantId: 'juniors',
    number: String(i + 1),
    active: true,
  }));

  store.createTenant({
    restaurant: juniors,
    tables: juniorsTables,
    menu: buildMenu('juniors', juniorsProducts()),
    upsellRules,
  });

  // Second tenant to prove isolation & per-brand AI persona.
  const sarah: Restaurant = {
    ...juniors,
    id: 'sarahs',
    name: "Sarah's Kitchen",
    branding: {
      ...juniors.branding,
      primaryColor: '#0EA5E9',
      aiWaiterName: 'Sarah — Your AI Waiter',
      welcomeMessage: 'Hi, I’m Sarah. What are you in the mood for today?',
    },
    aiConfig: {
      ...juniors.aiConfig,
      personality: 'You are Sarah, a calm and caring waiter. Warm, concise, health-conscious.',
    },
  };
  store.createTenant({
    restaurant: sarah,
    tables: Array.from({ length: 10 }, (_, i) => ({
      id: `t${i + 1}`,
      restaurantId: 'sarahs',
      number: String(i + 1),
      active: true,
    })),
    menu: buildMenu('sarahs', juniorsProducts()),
    upsellRules,
  });
}
