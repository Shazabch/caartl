import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { createDrawerNavigator, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomAlert from '../components/ui/CustomAlert';
import { useAuth } from '../context/AuthContext';

// Import Screens
import { HomescreenLight } from '../screens/Caartl/homescreen'; // Auctions
import ListedVehiclesScreen from '../screens/ListedVehiclesScreen';
import MyBookingsScreen from '../screens/MyBookingsScreen';

const Drawer = createDrawerNavigator();

// --- Custom Drawer Content ---
const CustomDrawerContent = (props: DrawerContentComponentProps) => {
    const { user, logout, isGuest, isUnapproved } = useAuth();
    const navigation = useNavigation();
    const [showLoginAlert, setShowLoginAlert] = React.useState(false);
    const [showApprovalAlert, setShowApprovalAlert] = React.useState(false);

    // 🟢 Drawer items with access control:
    // - public: true = accessible to everyone
    // - public: false = requires login
    // - allowUnapproved: true = unapproved users can access (e.g., Payment Receipts)
    const drawerItems = [
        { label: 'Buy', icon: 'shopping-bag', screen: 'ListedVehicles', type: 'Feather', public: true, allowUnapproved: true },
        { label: 'My Bids', icon: 'gavel', screen: 'MyBiddings', type: 'FontAwesome5', public: false, allowUnapproved: false },
        { label: 'Favorites', icon: 'heart', screen: 'FavoritesScreen', type: 'Feather', public: false, allowUnapproved: false },
        { label: 'Payment Receipts', icon: 'file-text', screen: 'Payments', type: 'Feather', public: false, allowUnapproved: true }, // 🟢 Unapproved can access
    ];

    const handleItemPress = (screen: string, isPublic: boolean, allowUnapproved: boolean = false) => {
        // Guest trying to access private feature
        if (isGuest && !isPublic && screen !== 'InquiryType') {
            setShowLoginAlert(true);
            return;
        }

        // 🟢 Unapproved user trying to access restricted feature (not allowed for unapproved)
        if (isUnapproved && !isPublic && !allowUnapproved) {
            setShowApprovalAlert(true);
            return;
        }

        // @ts-ignore
        props.navigation.navigate(screen);
    };

    const handleAuthAction = () => {
        if (isGuest) {
            // @ts-ignore
            logout();
            // navigation.navigate('Login');
        } else {
            logout();
        }
    };

    return (
        <LinearGradient colors={['#000000', '#111111']} style={styles.drawerContainer}>
            <SafeAreaView style={{ flex: 1 }}>

                <View style={styles.drawerHeader}>
                    <Image source={{ uri: 'https://static.codia.ai/image/2025-10-20/2s2Butmi2c.png' }} style={styles.drawerLogo} resizeMode="contain" />
                    <Text style={styles.welcomeText}>
                        {isGuest ? 'Welcome Guest' : `Hello, ${user?.name}`}
                    </Text>
                </View>

                <View style={styles.drawerItemsContainer}>
                    {/* Map Menu Items - filter based on approval status */}
                    {drawerItems
                        .filter(item => {
                            // 🟢 Hide items that unapproved users can't access
                            if (isUnapproved && !item.public && !item.allowUnapproved) {
                                return false;
                            }
                            // 🟢 Hide private items for guests (except show them disabled)
                            if (isGuest && !item.public) {
                                return false;
                            }
                            return true;
                        })
                        .map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.drawerItem}
                                onPress={() => handleItemPress(item.screen, item.public, item.allowUnapproved)}
                            >
                                <View style={styles.iconBox}>
                                    {item.type === 'MaterialCommunityIcons' ? (
                                        <MaterialCommunityIcons name={item.icon as any} size={18} color="#000" />
                                    ) : item.type === 'FontAwesome5' ? (
                                        <FontAwesome5 name={item.icon as any} size={16} color="#000" solid />
                                    ) : (
                                        <Feather name={item.icon as any} size={18} color="#000" />
                                    )}
                                </View>
                                <Text style={styles.drawerLabel}>{item.label}</Text>
                                <Feather name="chevron-right" size={18} color="#444" />
                            </TouchableOpacity>
                        ))}

                    {/* Inquiry Button */}
                    <TouchableOpacity
                        style={[styles.drawerItem, styles.inquiryItem]}
                        onPress={() => handleItemPress('InquiryType', true)}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#cadb2a' }]}>
                            <Feather name="help-circle" size={18} color="#000" />
                        </View>
                        <Text style={[styles.drawerLabel, { color: '#cadb2a', fontWeight: 'bold' }]}>Inquiries</Text>
                        <Feather name="chevron-right" size={18} color="#cadb2a" />
                    </TouchableOpacity>
                </View>

                <View style={styles.drawerFooter}>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleAuthAction}>
                        <Text style={[styles.logoutText, isGuest && { color: '#cadb2a' }]}>
                            {isGuest ? 'Log In' : 'Log Out'}
                        </Text>
                        <MaterialCommunityIcons
                            name={isGuest ? "login" : "logout"}
                            size={18}
                            color={isGuest ? "#cadb2a" : "#FF4444"}
                        />
                    </TouchableOpacity>
                    <Text style={styles.versionText}>App Version 1.0.2</Text>
                </View>

            </SafeAreaView>

            <CustomAlert
                visible={showLoginAlert}
                title="Please Login"
                message="You need to be logged in to access this feature."
                onClose={() => setShowLoginAlert(false)}
            />

            {/* 🟢 ADD: Alert for unapproved users */}
            <CustomAlert
                visible={showApprovalAlert}
                title="Account Pending Approval"
                message="Your account is pending approval. Please complete your payment to activate your account and access all features."
                onClose={() => setShowApprovalAlert(false)}
            />
        </LinearGradient>
    );
};

export const DrawerNavigator = () => {
    return (
        <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerType: 'slide',
                overlayColor: 'rgba(0,0,0,0.8)',
                drawerStyle: { width: '80%', backgroundColor: '#000' },
            }}
            initialRouteName="ListedVehicles"
        >
            {/* 🟢 Top-level "Tab" screens that need Drawer access */}
            <Drawer.Screen name="ListedVehicles" component={ListedVehiclesScreen} />
            <Drawer.Screen name="Auctions" component={HomescreenLight} />
            <Drawer.Screen name="MyBookings" component={MyBookingsScreen} />

            {/* Note: Other screens like Favorites, Biddings remain in AppNavigator Stack to preserve slide animations */}
        </Drawer.Navigator>
    );
};

const styles = StyleSheet.create({
    drawerContainer: { flex: 1, paddingHorizontal: 20 },
    drawerHeader: { marginTop: 20, marginBottom: 30, alignItems: 'flex-start' },
    drawerLogo: { width: 140, height: 60, marginBottom: 10 },
    welcomeText: { color: '#888', fontSize: 14, fontFamily: 'Poppins', marginLeft: 5 },

    drawerItemsContainer: { flex: 1, gap: 5 },
    drawerItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: 12, borderWidth: 1, borderColor: '#222' },
    inquiryItem: { borderColor: '#cadb2a', borderWidth: 1, backgroundColor: 'rgba(202, 219, 42, 0.1)' },

    iconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#cadb2a', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    drawerLabel: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500', fontFamily: 'Poppins' },

    drawerFooter: { paddingVertical: 30, borderTopWidth: 1, borderTopColor: '#222' },
    logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
    logoutText: { color: '#FF4444', fontSize: 16, fontFamily: 'Poppins', fontWeight: '600', marginRight: 10 },
    versionText: { color: '#444', fontSize: 12, fontFamily: 'Poppins', textAlign: 'center' },
});