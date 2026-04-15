import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Models from '../data/modal';
import { RootStackParamList } from '../navigation/AppNavigator';
import apiService from '../services/ApiService';

type PaymentNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function PaymentReceiptsScreen() {
    const navigation = useNavigation<PaymentNavProp>();
    const insets = useSafeAreaInsets();

    const [invoices, setInvoices] = useState<Models.Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchInvoices = async () => {
        try {
            const result = await apiService.getInvoices();
            if (result.success && result.data.data) {
                setInvoices(result.data.data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchInvoices();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchInvoices();
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending': return '#ffaa00'; // Orange
            case 'paid': return '#2ecc71'; // Green
            case 'delivered': return '#2ecc71';
            case 'verified': return '#cadb2a'; // Brand Color
            case 'rejected': return '#ff4444'; // Red
            default: return '#888';
        }
    };

    const renderItem = ({ item }: { item: Models.Invoice }) => {
        // 🟢 FIX: Added optional chaining (?.)
        const brandName = item.booking?.vehicle?.brand?.name || 'Unknown Brand';
        const modelName = item.booking?.vehicle?.vehicle_model?.name || 'Vehicle';
        const packageInfo = (item.user as (Models.User & {
            package?: { name?: string; price?: string | number | null };
        }) | undefined)?.package;

        const title = item.type === 'booking' && item.booking?.vehicle
            ? `${brandName} ${modelName}`
            : item.type === 'package'
                ? `${packageInfo?.name || 'Package'} Invoice`
                : `Invoice #${item.id}`;

        const amount = item.type === 'booking'
            ? item.booking?.total_amount
            : item.type === 'package'
                ? packageInfo?.price
                : null;

        const parsedAmount = Number(amount ?? 0);

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('InvoiceDetail', { invoice: item })}
                activeOpacity={0.8}
            >
                <View style={styles.row}>
                    <View style={styles.iconContainer}>
                        <MaterialCommunityIcons name="file-document-outline" size={24} color="#cadb2a" />
                    </View>
                    <View style={styles.content}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.date}>{new Date(item.created_at).toDateString()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.amount}>AED {parsedAmount.toLocaleString()}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                {item.status.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#000000', '#1a1a00']} style={styles.container}>
                <View style={[styles.header, { paddingTop: 10 }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Payment Receipts</Text>
                    <View style={{ width: 40 }} />
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#cadb2a" />
                    </View>
                ) : (
                    <FlatList
                        data={invoices}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#cadb2a" />}
                        ListEmptyComponent={
                            <View style={styles.center}>
                                <Text style={styles.emptyText}>No invoices found.</Text>
                            </View>
                        }
                    />
                )}
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: 'rgba(0,0,0,0.8)' },
    backButton: { padding: 5 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', fontFamily: 'Poppins' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
    listContent: { padding: 20, paddingBottom: 50 },
    emptyText: { color: '#666', fontFamily: 'Poppins' },

    card: { backgroundColor: '#111', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    row: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(202, 219, 42, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    content: { flex: 1 },
    title: { color: '#fff', fontSize: 13, fontWeight: 'bold', fontFamily: 'Poppins' },
    date: { color: '#888', fontSize: 12, fontFamily: 'Poppins', marginTop: 2 },
    amount: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: 'Lato', marginBottom: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    statusText: { fontSize: 10, fontWeight: 'bold', fontFamily: 'Poppins' },
});