import { api } from '../api/client';
import { useApp } from './appStore';

/** Load a restaurant's config + menu into the store. Throws ApiError on failure. */
export async function loadRestaurant(restaurantId: string): Promise<void> {
  const [{ restaurant, tables }, menu] = await Promise.all([
    api.getRestaurant(restaurantId),
    api.getMenu(restaurantId),
  ]);
  const s = useApp.getState();
  s.setRestaurant(restaurant, tables);
  s.setMenu(menu);
  api.track({ restaurantId, name: 'menu_viewed' });
}
