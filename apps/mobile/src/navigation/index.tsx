import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { palette } from '../theme';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { RestaurantScreen } from '../screens/RestaurantScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { ServiceScreen } from '../screens/ServiceScreen';
import { ProductScreen } from '../screens/ProductScreen';
import { CartScreen } from '../screens/CartScreen';
import { ConfirmationScreen } from '../screens/ConfirmationScreen';
import { OrderStatusScreen } from '../screens/OrderStatusScreen';

export type RootStackParamList = {
  Welcome: undefined;
  Restaurant: undefined;
  Main: undefined;
  Product: { productId: string };
  Cart: undefined;
  Confirmation: undefined;
  OrderStatus: { orderId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function tabIcon(label: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{label}</Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.bg },
        headerTitleStyle: { color: palette.text },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
        tabBarActiveTintColor: palette.text,
        tabBarInactiveTintColor: palette.textMuted,
      }}
    >
      <Tab.Screen name="AI Waiter" component={ChatScreen} options={{ tabBarIcon: tabIcon('💬') }} />
      <Tab.Screen name="Menu" component={MenuScreen} options={{ tabBarIcon: tabIcon('📋') }} />
      <Tab.Screen name="Service" component={ServiceScreen} options={{ tabBarIcon: tabIcon('🔔') }} />
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: palette.bg, card: palette.bg, text: palette.text, border: palette.border },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: palette.bg },
          headerTitleStyle: { color: palette.text },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.bg },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Restaurant" component={RestaurantScreen} options={{ title: '' }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Customize' }} />
        <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Your Order' }} />
        <Stack.Screen name="Confirmation" component={ConfirmationScreen} options={{ title: 'Confirm Order' }} />
        <Stack.Screen name="OrderStatus" component={OrderStatusScreen} options={{ title: 'Order Status' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
