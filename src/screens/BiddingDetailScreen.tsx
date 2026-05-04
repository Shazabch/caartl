import { Feather } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAlert } from '../context/AlertContext';
import * as Models from '../data/modal';
import { RootStackParamList } from '../navigation/AppNavigator';
import apiService from '../services/ApiService';

type BiddingDetailRouteProp = RouteProp<RootStackParamList, 'BiddingDetail'>;
type BiddingDetailNavProp = NativeStackNavigationProp<RootStackParamList, 'BiddingDetail'>;

const { width } = Dimensions.get('window');

const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

export default function BiddingDetailScreen() {
    const navigation = useNavigation<BiddingDetailNavProp>();
    const route = useRoute<BiddingDetailRouteProp>();
    const { vehicleId } = route.params;
    const insets = useSafeAreaInsets();

    const { showAlert } = useAlert();
    const [loading, setLoading] = useState(true);
    const [bids, setBids] = useState<any[]>([]);
    const [vehicle, setVehicle] = useState<Models.Vehicle | null>(null);
    const [acceptedBid, setAcceptedBid] = useState<any | null>(null);

    // 🟢 New State for Booking Status
    const [hasBooking, setHasBooking] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            // 1. Fetch Bidding History
            const bidResult = await apiService.getUserBiddingHistory(vehicleId);
            if (bidResult.success && Array.isArray(bidResult.data.data)) {
                const sortedBids = bidResult.data.data.sort((a: any, b: any) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setBids(sortedBids);
                const accepted = sortedBids.find((b: any) => b.status === 'accepted');
                setAcceptedBid(accepted);

                if (sortedBids.length > 0 && sortedBids[0].vehicle) {
                    setVehicle(sortedBids[0].vehicle);
                }
            }

            // 2. Fetch Booking Status
            const bookResult = await apiService.getBookingByVehicle(vehicleId);
            if (bookResult.success && bookResult.data.data && bookResult.data.data.data.length > 0) {
                setHasBooking(true);
            }

        } catch (error) {
            console.error(error);
            showAlert('Error', 'Failed to load details.');
        } finally {
            setLoading(false);
        }
    };

    // 🟢 Determine Action based on Booking Status
    const handleFooterAction = () => {
        if (hasBooking) {
            // If booked -> Go to View Booking
            navigation.navigate('ViewBooking', { vehicleId });
        } else {
            // If not booked -> Go to Book Car
            if (vehicle) {
                navigation.navigate('BookCar', { vehicle });
            } else {
                showAlert("Error", "Vehicle details missing.");
            }
        }
    };

    const renderBidItem = ({ item }: { item: any }) => {
        const isAccepted = item.status === 'accepted';
        return (
            <View style={[styles.bidCard, isAccepted && styles.acceptedCard]}>
                <View style={styles.bidHeader}>
                    <Text style={styles.bidUser}>Me</Text>
                    {isAccepted && (
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>Accepted</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.bidAmount}>AED {Number(item.bid_amount).toLocaleString()}</Text>
                <Text style={styles.bidTime}>{formatDateTime(item.created_at)}</Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#cadb2a" />
            </View>
        );
    }

    let vehicleImage = 'https://via.placeholder.com/400';
    if (vehicle) {
        if (vehicle.cover_image) {
            vehicleImage = typeof vehicle.cover_image === 'string' ? vehicle.cover_image : vehicle.cover_image.path;
        } else if (vehicle.images && vehicle.images.length > 0) {
            vehicleImage = vehicle.images[0].path;
        } else if (vehicle.brand?.image_source) {
            vehicleImage = vehicle.brand.image_source;
        }
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#000000', '#1a1a00']} style={styles.gradient}>

                {/* Header */}
                <View style={[styles.header, { paddingTop: 20 }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Feather name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Negotiation</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: 220 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Banner Image */}
                    <View style={styles.bannerContainer}>
                        <Image source={{ uri: vehicleImage }} style={styles.bannerImage} resizeMode="cover" />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.bannerOverlay} />
                    </View>

                    {/* Vehicle Info */}
                    {vehicle && (
                        <View style={styles.vehicleInfoContainer}>
                            <Text style={styles.vehicleTitle}>{vehicle.title}</Text>
                            <Text style={styles.vehicleSub}>
                                {vehicle.mileage ? `${vehicle.mileage} km | ` : ''}
                                {vehicle.register_emirates || 'GCC Specs'} |
                                {vehicle.transmission_id === 1 ? ' Manual' : vehicle.transmission_id === 2 ? ' Auto' : vehicle.transmission_id === 3 ? ' CVT' : ''}
                            </Text>
                        </View>
                    )}

                    {/* Seller Expectation Bar */}
                    <View style={styles.expectationBar}>
                        <Text style={styles.expectationLabel}>Seller Expectation</Text>
                        <Text style={styles.expectationValue}>
                            AED {vehicle ? Number(vehicle.price).toLocaleString() : '---'}
                        </Text>
                    </View>

                    {/* Bids List */}
                    <View style={styles.bidsContainer}>
                        <Text style={styles.historyTitle}>Bid History</Text>
                        {bids.map((bid) => (
                            <View key={bid.id} style={{ marginBottom: 12 }}>
                                {renderBidItem({ item: bid })}
                            </View>
                        ))}
                    </View>

                </ScrollView>

                {/* Footer */}
                {acceptedBid && (
                    <View style={[styles.footer, { paddingBottom: 12 }]}>
                        <View style={styles.footerRow}>
                            <Text style={styles.footerLabel}>ACCEPTED OFFER</Text>
                            <Text style={styles.footerPrice}>AED {Number(acceptedBid.bid_amount).toLocaleString()}</Text>
                        </View>

                        {/* 🟢 CONDITIONAL BUTTON */}
                        <TouchableOpacity
                            style={[styles.bookBtn, hasBooking && { backgroundColor: '#cadb2a' }]}
                            onPress={handleFooterAction}
                        >
                            <Text style={[styles.bookBtnText, hasBooking && { color: '#000' }]}>
                                {hasBooking ? "View Booking" : "Book Car Now"}
                            </Text>
                        </TouchableOpacity>

                        {!hasBooking && (
                            <Text style={styles.disclaimer}>*Admin fee AED 1,499 will be charged</Text>
                        )}
                    </View>
                )}
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    gradient: { flex: 1 },
    loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 15, zIndex: 10, backgroundColor: 'transparent' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', fontFamily: 'Poppins' },
    backBtn: { padding: 5 },
    scrollContent: { flexGrow: 1 },
    bannerContainer: { width: width, height: 220, position: 'relative' },
    bannerImage: { width: '100%', height: '100%' },
    bannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
    vehicleInfoContainer: { padding: 16, marginTop: -30 },
    vehicleTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', fontFamily: 'Poppins', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    vehicleSub: { color: '#ccc', fontSize: 14, marginTop: 4, fontFamily: 'Poppins' },
    expectationBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', marginHorizontal: 16, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10, elevation: 3 },
    expectationLabel: { color: '#000', fontSize: 14, fontFamily: 'Poppins' },
    expectationValue: { color: '#000', fontSize: 16, fontWeight: 'bold', fontFamily: 'Lato' },
    bidsContainer: { paddingHorizontal: 16, marginTop: 25 },
    historyTitle: { color: '#888', fontSize: 14, marginBottom: 15, fontFamily: 'Poppins', fontWeight: '600' },
    bidCard: { backgroundColor: '#181818', borderRadius: 12, padding: 15, width: '100%', borderWidth: 1, borderColor: '#333' },
    acceptedCard: { borderColor: '#cadb2a', backgroundColor: 'rgba(202, 219, 42, 0.05)' },
    bidHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' },
    bidUser: { color: '#888', fontSize: 12, fontFamily: 'Poppins' },
    statusBadge: { backgroundColor: '#cadb2a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    statusText: { color: '#000', fontSize: 10, fontWeight: 'bold', fontFamily: 'Poppins' },
    bidAmount: { color: '#fff', fontSize: 20, fontWeight: 'bold', fontFamily: 'Lato', marginBottom: 5 },
    bidTime: { color: '#666', fontSize: 11, alignSelf: 'flex-end', fontFamily: 'Poppins' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#000', padding: 20, borderTopWidth: 1, borderTopColor: '#222' },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' },
    footerLabel: { color: '#888', fontSize: 12, fontFamily: 'Poppins' },
    footerPrice: { color: '#fff', fontSize: 20, fontWeight: 'bold', fontFamily: 'Lato' },
    bookBtn: { backgroundColor: '#ff4444', borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
    bookBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: 'Poppins' },
    disclaimer: { color: '#666', fontSize: 10, textAlign: 'center', fontFamily: 'Poppins' },
});