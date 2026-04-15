import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAlert } from '../context/AlertContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import apiService from '../services/ApiService';

type DetailRouteProp = RouteProp<RootStackParamList, 'InvoiceDetail'>;

export default function InvoiceDetailScreen() {
    const navigation = useNavigation();
    const route = useRoute<DetailRouteProp>();
    const insets = useSafeAreaInsets();
    const { showAlert } = useAlert();

    const { invoice } = route.params;
    const [paymentSlip, setPaymentSlip] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleOpenPdf = () => {
        if (invoice.pdf_link) {
            Linking.openURL(invoice.pdf_link);
        } else {
            showAlert("Error", "PDF link not available");
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0]) {
            setPaymentSlip(result.assets[0]);
        }
    };

    const handleUpload = async () => {
        if (!paymentSlip) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('invoice_id', String(invoice.id));

        const uri = paymentSlip.uri;
        const filename = uri.split('/').pop() || `slip_${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        if (Platform.OS === 'web') {
            const response = await fetch(uri);
            const blob = await response.blob();
            formData.append('payment_slip', blob, filename);
        } else {
            // @ts-ignore
            formData.append('payment_slip', { uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''), name: filename, type });
        }

        try {
            const result = await apiService.uploadPaymentSlip(formData);
            if (result.success) {
                showAlert("Success", "Payment slip uploaded successfully!");
                navigation.goBack();
            } else {
                showAlert("Error", result.data.message || "Upload failed.");
            }
        } catch (e) {
            console.error(e);
            showAlert("Error", "Network error.");
        } finally {
            setUploading(false);
        }
    };

    const packageInfo = invoice.user?.package as { name?: string; price?: string | number | null } | undefined;
    const vehicle = invoice.booking?.vehicle;
    const amount = invoice.type === 'package'
        ? packageInfo?.price
        : invoice.booking?.total_amount || '0.00';
    const isPackageInvoice = invoice.type === 'package';
    const isPackagePaid = invoice.status?.toLowerCase() === 'paid';
    const canDownloadPdf = !isPackageInvoice || isPackagePaid;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#000000', '#1a1a00']} style={styles.container}>
                <View style={[styles.header, { paddingTop: 10 }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Invoice Details</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* Invoice Info Card */}
                    <View style={styles.card}>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Invoice ID</Text>
                            <Text style={styles.value}>#{invoice.id}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Date</Text>
                            <Text style={styles.value}>{new Date(invoice.created_at).toDateString()}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Status</Text>
                            <Text style={[styles.value, { color: '#cadb2a', fontWeight: 'bold', textTransform: 'uppercase' }]}>{invoice.status}</Text>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.infoRow}>
                            <Text style={[styles.label, { fontSize: 16, color: '#fff' }]}>Total Amount</Text>
                            <Text style={[styles.value, { fontSize: 18, color: '#cadb2a' }]}>AED {Number(amount ?? 0).toLocaleString()}</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.pdfBtn, !canDownloadPdf && styles.pdfBtnDisabled]}
                            onPress={canDownloadPdf ? handleOpenPdf : undefined}
                            disabled={!canDownloadPdf}
                        >
                            <MaterialCommunityIcons name="file-pdf-box" size={24} color="#000" />
                            <Text style={styles.pdfBtnText}>Download Invoice PDF</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Vehicle Details */}
                    {vehicle && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Vehicle Details</Text>
                            <View style={styles.card}>
                                {/* 🟢 FIX: Added optional chaining to prevent crash */}
                                <Text style={styles.vehicleTitle}>
                                    {vehicle.brand?.name || 'Unknown'} {vehicle.vehicle_model?.name || 'Model'} {vehicle.year || ''}
                                </Text>
                                <Text style={styles.vehicleSub}>{vehicle.vin ? `VIN: ${vehicle.vin}` : 'VIN: N/A'}</Text>
                            </View>
                        </View>
                    )}

                    {/* Upload Section (Only if Pending) */}
                    {invoice.status === 'pending' && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Payment Confirmation</Text>
                            <View style={styles.uploadCard}>
                                {paymentSlip ? (
                                    <View style={{ width: '100%', alignItems: 'center' }}>
                                        <Image source={{ uri: paymentSlip.uri }} style={styles.uploadedImg} resizeMode="contain" />
                                        <TouchableOpacity onPress={() => setPaymentSlip(null)} style={styles.removeBtn}>
                                            <Feather name="trash-2" size={20} color="#ff4444" />
                                            <Text style={{ color: '#ff4444', marginLeft: 5 }}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                                        <View style={styles.iconCircle}>
                                            <Feather name="upload-cloud" size={24} color="#000" />
                                        </View>
                                        <Text style={styles.uploadText}>Upload Payment Slip</Text>
                                        <Text style={styles.uploadSub}>Supported: JPG, PNG</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[styles.submitBtn, (!paymentSlip || uploading) && { opacity: 0.5 }]}
                                onPress={handleUpload}
                                disabled={!paymentSlip || uploading}
                            >
                                {uploading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Submit Payment Slip</Text>}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Show already uploaded slip if exists */}
                    {invoice.payment_slip && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Uploaded Slip</Text>
                            <View style={styles.card}>
                                <Image source={{ uri: invoice.payment_slip }} style={{ width: '100%', height: 200, borderRadius: 8 }} resizeMode="contain" />
                            </View>
                        </View>
                    )}

                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', fontFamily: 'Poppins' },

    scrollContent: { padding: 20 },
    card: { backgroundColor: '#111', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    label: { color: '#888', fontFamily: 'Poppins', fontSize: 14 },
    value: { color: '#fff', fontFamily: 'Poppins', fontSize: 14, fontWeight: '600' },
    divider: { height: 1, backgroundColor: '#333', marginVertical: 10 },

    pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#cadb2a', borderRadius: 8, padding: 12, marginTop: 10 },
    pdfBtnDisabled: { opacity: 0.45 },
    pdfBtnText: { color: '#000', fontWeight: 'bold', marginLeft: 8, fontFamily: 'Poppins' },

    section: { marginTop: 10 },
    sectionTitle: { color: '#cadb2a', fontSize: 16, fontWeight: 'bold', marginBottom: 10, fontFamily: 'Poppins' },
    vehicleTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    vehicleSub: { color: '#888', fontSize: 13, marginTop: 4 },

    uploadCard: { backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#666', borderStyle: 'dashed', padding: 20, alignItems: 'center', marginBottom: 20 },
    uploadBtn: { alignItems: 'center', width: '100%' },
    iconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#cadb2a', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    uploadText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    uploadSub: { color: '#666', fontSize: 12, marginTop: 5 },
    uploadedImg: { width: '100%', height: 200, borderRadius: 8, marginBottom: 10 },
    removeBtn: { flexDirection: 'row', alignItems: 'center', padding: 10 },

    submitBtn: { backgroundColor: '#cadb2a', borderRadius: 12, padding: 15, alignItems: 'center' },
    submitBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16, fontFamily: 'Poppins' },
});