import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

// Screens
import { CarDetailPage } from '../components/CarDetailPage';
import BiddingDetailScreen from '../screens/BiddingDetailScreen';
import BookCarScreen from '../screens/BookCarScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import LiveCarAuctionScreen from '../screens/LiveCarAuctionScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RegisterScreen from '../screens/RegisterScreen';
import { SplashScreenDark } from '../screens/SplashScreenDark';
// MyBookings is in Drawer now
import AppointmentInquiryScreen from '../screens/AppointmentInquiryScreen';
import ContactInquiryScreen from '../screens/ContactInquiryScreen';
import InquiryTypeScreen from '../screens/InquiryTypeScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import ManagePreferenceScreen from '../screens/ManagePreferenceScreen';
import MyBiddingsScreen from '../screens/MyBiddingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PaymentReceiptsScreen from '../screens/PaymentReceiptsScreen';
import PreferencesListScreen from '../screens/PreferencesListScreen';
import SellCarInquiryScreen from '../screens/SellCarInquiryScreen';
import ViewBookingScreen from '../screens/ViewBookingScreen';
// Auctions (HomescreenLight) is in Drawer now

// Navigator
import { DrawerNavigator } from './DrawerNavigator';
import VerifyScreen from '../screens/VerifyScreen';
// 🟢 NEW: Navigation Service Ref
import { navigationRef } from './NavigationService'; 

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  data?: any; // 🟢 Added to carry payload for navigation
  auctionState?: 'live' | 'upcoming' | 'ended' | 'unknown';
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Verify: undefined;
  DrawerRoot: undefined; // Contains ListedVehicles, Auctions, MyBookings
  FavoritesScreen: undefined;
  ProfileScreen: undefined;
  EditProfile: undefined;
  CarDetailPage: { carId: number };
  LiveAuction: { carId: number; viewType?: 'live' | 'negotiation' | 'upcoming' };
  // Auctions removed from stack
  BiddingDetail: { vehicleId: number };
  ChangePassword: undefined;
  BookCar: { vehicle: any };
  // MyBookings removed from stack
  ViewBooking: { vehicleId: number };
  MyBiddings: undefined;
  PreferencesList: undefined;
  ManagePreference: { preferenceId?: number; preferenceData?: any };
  Payments: undefined;
  InvoiceDetail: { invoice: any };
  InquiryType: undefined;
  SellCarInquiry: undefined;
  AppointmentInquiry: undefined;
  ContactInquiry: undefined;
  Notifications: { notifications: NotificationItem[] };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const MyDarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#000000',
    card: '#111',
    text: '#fff',
  },
};

const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#000' },
      animation: 'slide_from_right',
      gestureEnabled: true,
      gestureDirection: 'horizontal',
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="Verify" component={VerifyScreen} />
  </Stack.Navigator>
);

const MainAppStack = () => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
        paddingBottom: insets.bottom,
        paddingTop: insets.top
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
        }}
      >
        {/* 🟢 GROUP 1: Main Tabs / Drawer Root (Fade Animation) */}
        <Stack.Group screenOptions={{ animation: 'fade' }}>
          <Stack.Screen name="DrawerRoot" component={DrawerNavigator} />
          <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
        </Stack.Group>

        {/* 🟢 GROUP 2: Inner Screens / Details (Slide Animation) */}
        <Stack.Group
          screenOptions={{
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal'
          }}
        >
          {/* Drawer Items handled as stack for animation */}
          <Stack.Screen name="FavoritesScreen" component={FavoritesScreen} />
          <Stack.Screen name="MyBiddings" component={MyBiddingsScreen} />
          <Stack.Screen name="Payments" component={PaymentReceiptsScreen} />

          {/* Features */}
          <Stack.Screen name="InquiryType" component={InquiryTypeScreen} />
          <Stack.Screen name="SellCarInquiry" component={SellCarInquiryScreen} />
          <Stack.Screen name="AppointmentInquiry" component={AppointmentInquiryScreen} />
          <Stack.Screen name="ContactInquiry" component={ContactInquiryScreen} />

          {/* Details */}
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="CarDetailPage" component={CarDetailPage} />
          <Stack.Screen name="LiveAuction" component={LiveCarAuctionScreen} />
          <Stack.Screen name="BiddingDetail" component={BiddingDetailScreen} />
          <Stack.Screen name="BookCar" component={BookCarScreen} />
          <Stack.Screen name="ViewBooking" component={ViewBookingScreen} />
          <Stack.Screen name="PreferencesList" component={PreferencesListScreen} />
          <Stack.Screen name="ManagePreference" component={ManagePreferenceScreen} />
          <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />

          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        </Stack.Group>
      </Stack.Navigator>
    </View>
  );
};

const AppNavigator = () => {
  const { isLoading, userToken, isGuest, user } = useAuth();

  if (isLoading) {
    return <SplashScreenDark />;
  }

  return (
    // 🟢 Attach ref here for external navigation from PushNotificationRequester
    <NavigationContainer theme={MyDarkTheme} ref={navigationRef}>
      {
        (userToken && user?.id)
          ||
          isGuest ?
          <MainAppStack />
          :
          <AuthStack />
      }
    </NavigationContainer>
  );
};

export default AppNavigator;