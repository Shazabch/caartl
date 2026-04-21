import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import * as Models from '../data/modal';
import { RootStackParamList } from '../navigation/AppNavigator';
import apiService from '../services/ApiService';

type BookCarRouteProp = RouteProp<RootStackParamList, 'BookCar'>;
const { width } = Dimensions.get('window');

const DEALER_ADMIN_FEE = 1500;

export default function BookCarScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<BookCarRouteProp>();
    const insets = useSafeAreaInsets();

    const { user } = useAuth();

    const vehicle = route.params?.vehicle || null;
    const { showAlert } = useAlert();

    // Data State
    const [locations, setLocations] = useState<Models.ServiceLocation[]>([]);
    const [fixedServices, setFixedServices] = useState<Models.ServiceLocation[]>([]);
    const [valueAddedServices, setValueAddedServices] = useState<Models.ServiceLocation[]>([]);

    const [loadingData, setLoadingData] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedServices, setSelectedServices] = useState<number[]>([]);

    // Delivery State
    const [deliveryType, setDeliveryType] = useState<'door_delivery' | 'pickup'>('door_delivery');
    const [selectedCity, setSelectedCity] = useState<Models.ServiceLocation | null>(null);
    const [address, setAddress] = useState('');

    // Contact Inputs - Prefilled
    const [receiverName, setReceiverName] = useState(user?.name || '');
    const [receiverEmail, setReceiverEmail] = useState(user?.email || '');
    const [receiverPhone, setReceiverPhone] = useState(user?.phone || '');

    // Validation State
    const [errors, setErrors] = useState({
        city: '',
        name: '',
        email: '',
        phone: '',
        ids: '',
        payment: ''
    });

    // Files
    const [frontIdInfo, setFrontIdInfo] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [backIdInfo, setBackIdInfo] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [paymentScreenshot, setPaymentScreenshot] = useState<ImagePicker.ImagePickerAsset | null>(null);

    const [isCityModalVisible, setCityModalVisible] = useState(false);

    useEffect(() => {
        const loadResources = async () => {
            try {
                const [locRes, servRes] = await Promise.all([
                    apiService.getLocations(),
                    apiService.getServices()
                ]);

                if (locRes.success) setLocations(locRes.data.data);

                if (servRes.success) {
                    const allServices = servRes.data.data;
                    const fixed = allServices.filter(s => s.service_type === "1");
                    const optional = allServices.filter(s => s.service_type !== "1");
                    setFixedServices(fixed);
                    setValueAddedServices(optional);
                }
            } catch (error) {
                console.error("Error loading resources", error);
            } finally {
                setLoadingData(false);
            }
        };
        loadResources();
    }, []);

    // --- Calculations ---
    const basePrice = vehicle ? (Number(vehicle.current_bid) || Number(vehicle.price) || 0) : 0;

    const fixedFeesTotal = useMemo(() => {
        return fixedServices.reduce((sum, s) => {
            if (s.paid_check === "1") return sum;
            return sum + Number(s.service_amount || 0);
        }, 0);
    }, [fixedServices]);

    const valueAddedTotal = useMemo(() => {
        return valueAddedServices
            .filter(s => selectedServices.includes(s.id))
            .reduce((sum, s) => sum + Number(s.service_amount || 0), 0);
    }, [selectedServices, valueAddedServices]);

    // Delivery Charge Calculation
    const deliveryCharge = useMemo(() => {
        if (deliveryType === 'pickup') return 0;
        return selectedCity ? Number(selectedCity.service_amount || 0) : 0;
    }, [deliveryType, selectedCity]);

    const grandTotal = basePrice + fixedFeesTotal + valueAddedTotal + deliveryCharge;

    const toggleService = (id: number) => {
        setSelectedServices(prev => prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]);
    };

    const pickImage = async (type: 'front' | 'back' | 'payment') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
        });

        if (!result.canceled && result.assets[0]) {
            if (type === 'front') { setFrontIdInfo(result.assets[0]); setErrors(prev => ({ ...prev, ids: '' })); }
            else if (type === 'back') { setBackIdInfo(result.assets[0]); setErrors(prev => ({ ...prev, ids: '' })); }
            else { setPaymentScreenshot(result.assets[0]); setErrors(prev => ({ ...prev, payment: '' })); }
        }
    };

    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isValidPhone = (phone: string) => /^[0-9+\-\s]{7,15}$/.test(phone);

    const handleNext = () => {
        let valid = true;
        let newErrors = { city: '', name: '', email: '', phone: '', ids: '', payment: '' };

        if (currentStep === 1) {
            setCurrentStep(2);
        } else if (currentStep === 2) {
            if (deliveryType === 'door_delivery' && !selectedCity) {
                newErrors.city = "Please select a delivery city.";
                valid = false;
            }
            if (!receiverName.trim()) { newErrors.name = "Receiver name is required."; valid = false; }
            if (!receiverEmail.trim() || !isValidEmail(receiverEmail)) { newErrors.email = "Valid email is required."; valid = false; }
            if (!receiverPhone.trim() || !isValidPhone(receiverPhone)) { newErrors.phone = "Valid phone is required."; valid = false; }
            if (!frontIdInfo || !backIdInfo) { newErrors.ids = "Both ID sides required."; valid = false; }

            setErrors(newErrors);
            if (valid) setCurrentStep(3);
        } else {
            if (!paymentScreenshot) {
                setErrors(prev => ({ ...prev, payment: "Payment screenshot required." }));
                return;
            }
            submitBooking();
        }
    };

    const submitBooking = async () => {
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('vehicle_id', String(vehicle.id));

            formData.append('delivery_type', deliveryType === 'door_delivery' ? 'door_delivery' : 'self_pickup');
            formData.append('delivery_charges', String(deliveryCharge));

            formData.append('receiver_name', receiverName);
            formData.append('receiver_email', receiverEmail);
            formData.append('receiver_phone', receiverPhone);

            if (selectedCity) formData.append('current_location', selectedCity.location || '');
            else formData.append('current_location', 'Self Pickup');

            formData.append('delivery_location', address || 'Self Pickup');

            let serviceIndex = 0;

            valueAddedServices.filter(s => selectedServices.includes(s.id)).forEach((s) => {
                formData.append(`services[${serviceIndex}][name]`, s.service_name || '');
                formData.append(`services[${serviceIndex}][price]`, s.service_amount || '0');
                serviceIndex++;
            });

            fixedServices.forEach((s) => {
                const price = s.paid_check === "1" ? "0" : (s.service_amount || "0");
                formData.append(`services[${serviceIndex}][name]`, s.service_name || '');
                formData.append(`services[${serviceIndex}][price]`, price);
                serviceIndex++;
            });

            const appendFile = async (key: string, asset: ImagePicker.ImagePickerAsset) => {
                const uri = asset.uri;
                const fallbackName = uri.split('/').pop() || `upload_${Date.now()}.jpg`;
                const filename = asset.fileName || fallbackName;
                const type = asset.mimeType || 'image/jpeg';

                if (Platform.OS === 'web') {
                    // Web FormData requires a Blob/File, not a React Native file descriptor object.
                    const fileResponse = await fetch(uri);
                    const blob = await fileResponse.blob();
                    formData.append(key, blob, filename);
                    return;
                }

                // @ts-ignore React Native FormData accepts { uri, name, type } for file uploads.
                formData.append(key, {
                    uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
                    name: filename,
                    type,
                });
            };

            if (paymentScreenshot) await appendFile('payment_screenshot', paymentScreenshot);
            if (frontIdInfo) await appendFile('emirate_id_front', frontIdInfo);
            if (backIdInfo) await appendFile('emirate_id_back', backIdInfo);

            const result = await apiService.bookNow(formData);

            if (result.success) {
                showAlert("Success", "Booking submitted successfully!");
                navigation.reset({
                    index: 1,
                    routes: [
                        { name: 'DrawerRoot' },
                        {
                            name: 'LiveAuction',
                            params: {
                                carId: vehicle.id,
                                viewType: 'negotiation'
                            }
                        },
                    ],
                });
            } else {
                let msg = result.data?.message || "Booking failed.";
                // @ts-ignore
                if (result.data?.errors) {
                    // @ts-ignore
                    const errors = result.data.errors;
                    const key = Object.keys(errors)[0];
                    msg = Array.isArray(errors[key]) ? errors[key][0] : errors[key];
                }
                showAlert("Error", msg);
            }
        } catch (error) {
            console.error(error);
            showAlert("Error", "Network error.");
        } finally {
            setSubmitting(false);
        }
    };

    const getImageUrl = (img: any) => {
        if (!img) return 'https://via.placeholder.com/300x200';
        if (typeof img === 'string') return img;
        return img.path;
    };

    const StepIndicator = () => (
        <View style={styles.stepContainer}>
            <View style={styles.stepLineBase}>
                <View style={[styles.stepLineProgress, { width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%' }]} />
            </View>
            <View style={styles.stepIconsContainer}>
                {['Book Car', 'Delivery', 'Payment'].map((label, index) => {
                    const stepNum = index + 1;
                    const isActive = currentStep >= stepNum;
                    return (
                        <View key={index} style={styles.stepWrapper}>
                            <View style={[styles.stepCircle, isActive && styles.stepCircleActive]}>
                                <Text style={[styles.stepNumber, isActive && styles.stepNumberActive]}>{stepNum}</Text>
                            </View>
                            <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{label}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );

    const CityModal = () => (
        <Modal visible={isCityModalVisible} transparent animationType="fade" onRequestClose={() => setCityModalVisible(false)}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select Delivery Location</Text>
                        <TouchableOpacity onPress={() => setCityModalVisible(false)}><Feather name="x" size={24} color="#fff" /></TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                        {locations.map((loc) => (
                            <TouchableOpacity
                                key={loc.id}
                                style={styles.modalItem}
                                onPress={() => {
                                    setSelectedCity(loc);
                                    setErrors(prev => ({ ...prev, city: '' }));
                                    setCityModalVisible(false);
                                }}
                            >
                                <View>
                                    <Text style={[styles.modalItemText, selectedCity?.id === loc.id && styles.modalItemTextSelected]}>{loc.location}</Text>
                                    <Text style={styles.modalItemSub}>Delivery Charge: AED {Number(loc.service_amount).toLocaleString()}</Text>
                                </View>
                                {selectedCity?.id === loc.id && <Feather name="check" size={20} color="#cadb2a" />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#000000', '#1a1a00', '#26270c']} style={styles.container}>
                <View style={[styles.header, { paddingTop: 20 }]}>
                    <TouchableOpacity onPress={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigation.goBack()} style={styles.backBtn}>
                        <Feather name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Car Booking</Text>
                    <View style={{ width: 28 }} />
                </View>

                <StepIndicator />

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {vehicle && (
                        <View style={styles.vehicleCard}>
                            <Image source={{ uri: getImageUrl(vehicle.cover_image) }} style={styles.vehicleImage} />
                            <View style={styles.vehicleInfo}>
                                <Text style={styles.vehicleTitle} numberOfLines={1}>{vehicle.title}</Text>
                                <Text style={styles.vehicleSub}>{vehicle.register_emirates} | {vehicle.year} | {vehicle.mileage} KM</Text>
                                <Text style={[styles.vehicleSub, { color: '#cadb2a', fontWeight: 'bold' }]}>AED {Number(vehicle.current_bid || vehicle.price).toLocaleString()}</Text>
                            </View>
                        </View>
                    )}

                    {currentStep === 1 && (
                        <>
                            <View style={styles.sectionHeaderRow}><Feather name="box" size={18} color="#cadb2a" /><Text style={styles.sectionTitle}>Fixed Fees</Text></View>
                            <View style={styles.card}>
                                {loadingData ? <ActivityIndicator color="#cadb2a" /> : (fixedServices.length > 0 ? fixedServices.map((s) => {
                                    const isFree = s.paid_check === "1";
                                    return (
                                        <View key={s.id} style={styles.rowBetween}>
                                            <Text style={styles.textLabel}>{s.service_name}</Text>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.textValue}>AED {isFree ? "0" : Number(s.service_amount).toLocaleString()}</Text>
                                                {isFree && <Text style={[styles.textValue, { color: '#666', textDecorationLine: 'line-through', fontSize: 12 }]}>AED {Number(s.service_amount).toLocaleString()}</Text>}
                                            </View>
                                        </View>
                                    )
                                }) : <Text style={{ color: '#666' }}>No fixed fees.</Text>)}
                            </View>

                            <View style={styles.sectionHeaderRow}><Feather name="plus-circle" size={18} color="#cadb2a" /><Text style={styles.sectionTitle}>Value Added Services</Text></View>
                            <View style={styles.card}>
                                {loadingData ? <ActivityIndicator color="#cadb2a" /> : (valueAddedServices.length > 0 ? valueAddedServices.map((s) => (
                                    <TouchableOpacity key={s.id} style={styles.serviceRow} onPress={() => toggleService(s.id)}>
                                        <Text style={styles.serviceName}>{s.service_name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={styles.servicePrice}>AED {Number(s.service_amount).toLocaleString()}</Text>
                                            <View style={[styles.checkbox, selectedServices.includes(s.id) && styles.checkboxSelected]}>{selectedServices.includes(s.id) && <Feather name="check" size={14} color="#000" />}</View>
                                        </View>
                                    </TouchableOpacity>
                                )) : <Text style={{ color: '#666' }}>No extra services available.</Text>)}
                            </View>
                        </>
                    )}

                    {currentStep === 2 && (
                        <>
                            <TouchableOpacity style={styles.radioCard} onPress={() => { setDeliveryType('door_delivery'); setErrors(prev => ({ ...prev, city: '' })); }}>
                                <View style={[styles.radioCircle, deliveryType === 'door_delivery' && styles.radioCircleSelected]}>{deliveryType === 'door_delivery' && <View style={styles.radioDot} />}</View>
                                <Text style={styles.radioText}>Door Step Delivery</Text>
                                <View>
                                    <Text style={[styles.radioPrice, { color: '#cadb2a' }]}>Charges</Text>
                                    <Text style={styles.radioSub}>{deliveryType === 'door_delivery' && selectedCity ? `AED ${Number(selectedCity.service_amount).toLocaleString()}` : "Apply"}</Text>
                                </View>
                            </TouchableOpacity>

                            {deliveryType === 'door_delivery' && (
                                <View style={{ marginBottom: 15 }}>
                                    <Text style={styles.inputLabel}>Current Location</Text>
                                    <TouchableOpacity style={styles.inputBox} onPress={() => setCityModalVisible(true)}>
                                        <Text style={{ color: selectedCity ? '#fff' : '#666', fontFamily: 'Poppins' }}>{selectedCity ? selectedCity.location : 'Select City'}</Text>
                                        <Feather name="chevron-down" size={20} color="#cadb2a" />
                                    </TouchableOpacity>
                                    {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
                                    <Text style={styles.inputLabel}>Delivery Location / Address</Text>
                                    <View style={styles.inputBox}><TextInput style={styles.textInput} placeholder="Full Address" placeholderTextColor="#666" value={address} onChangeText={setAddress} /></View>
                                </View>
                            )}

                            <TouchableOpacity style={styles.radioCard} onPress={() => { setDeliveryType('pickup'); setErrors(prev => ({ ...prev, city: '' })); setSelectedCity(null); }}>
                                <View style={[styles.radioCircle, deliveryType === 'pickup' && styles.radioCircleSelected]}>{deliveryType === 'pickup' && <View style={styles.radioDot} />}</View>
                                <Text style={styles.radioText}>Self Pick Up</Text>
                                <View><Text style={styles.radioPrice}>AED 0</Text><Text style={styles.radioSub}>Total Charges</Text></View>
                            </TouchableOpacity>

                            {/* 🟢 NEW: Show Pickup Location if available */}
                            {deliveryType === 'pickup' && vehicle?.pickup_location && (
                                <View style={{ marginBottom: 15 }}>
                                    <Text style={styles.inputLabel}>Pickup Location</Text>
                                    <View style={styles.readOnlyBox}>
                                        <Feather name="map-pin" size={20} color="#cadb2a" style={{ marginRight: 10 }} />
                                        <Text style={styles.readOnlyText}>{vehicle.pickup_location}</Text>
                                    </View>
                                </View>
                            )}

                            <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10, color: '#fff' }]}>Contact Info</Text>
                            <View style={styles.inputGroup}><Text style={styles.inputLabel}>Receiver Name</Text><View style={styles.inputBox}><TextInput style={styles.textInput} placeholder="Enter Receiver Name" placeholderTextColor="#666" value={receiverName} onChangeText={(text) => { setReceiverName(text); if (text.trim()) setErrors(prev => ({ ...prev, name: '' })); }} /></View>{errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}</View>
                            <View style={styles.inputGroup}><Text style={styles.inputLabel}>Receiver Email</Text><View style={styles.inputBox}><TextInput style={styles.textInput} placeholder="Enter Receiver Email" placeholderTextColor="#666" keyboardType="email-address" value={receiverEmail} onChangeText={(text) => { setReceiverEmail(text); if (isValidEmail(text)) setErrors(prev => ({ ...prev, email: '' })); }} autoCapitalize="none" /></View>{errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}</View>
                            <View style={styles.inputGroup}><Text style={styles.inputLabel}>Receiver Ph#</Text><View style={styles.inputBox}><TextInput style={styles.textInput} placeholder="Enter Receiver Phone No" placeholderTextColor="#666" keyboardType="phone-pad" value={receiverPhone} onChangeText={(text) => { setReceiverPhone(text); if (isValidPhone(text)) setErrors(prev => ({ ...prev, phone: '' })); }} /></View>{errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}</View>

                            <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10, color: '#fff' }]}>Emirates Id</Text>
                            <View style={styles.uploadCard}><TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('front')}>{frontIdInfo ? <Image source={{ uri: frontIdInfo.uri }} style={styles.uploadedImg} /> : <><View style={styles.iconCircle}><MaterialCommunityIcons name="card-account-details-outline" size={24} color="#000" /></View><Text style={styles.uploadText}>Upload Front</Text></>}</TouchableOpacity></View>
                            <View style={styles.uploadCard}><TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('back')}>{backIdInfo ? <Image source={{ uri: backIdInfo.uri }} style={styles.uploadedImg} /> : <><View style={styles.iconCircle}><MaterialCommunityIcons name="card-account-details" size={24} color="#000" /></View><Text style={styles.uploadText}>Upload Back</Text></>}</TouchableOpacity></View>
                            {errors.ids ? <Text style={styles.errorText}>{errors.ids}</Text> : null}
                        </>
                    )}

                    {currentStep === 3 && (
                        <>
                            <View style={styles.card}>
                                <Text style={[styles.sectionTitle, { marginBottom: 15, color: '#fff' }]}>Booking Summary</Text>
                                <View style={styles.rowBetween}><Text style={styles.textLabel}>Vehicle Price</Text><Text style={styles.textValue}>AED {basePrice.toLocaleString()}</Text></View>

                                {fixedServices.map(s => {
                                    const isFree = s.paid_check === "1";
                                    return <View key={s.id} style={[styles.rowBetween, { marginTop: 10 }]}><Text style={styles.textLabel}>{s.service_name}</Text><Text style={styles.textValue}>{isFree ? "AED 0" : `AED ${Number(s.service_amount).toLocaleString()}`}</Text></View>;
                                })}

                                {selectedServices.length > 0 && <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#333' }}><Text style={[styles.textLabel, { fontWeight: 'bold', marginBottom: 5, color: '#cadb2a' }]}>Services:</Text>{valueAddedServices.filter(s => selectedServices.includes(s.id)).map(s => (<View key={s.id} style={[styles.rowBetween, { marginBottom: 5 }]}><Text style={[styles.textLabel, { fontSize: 13 }]}>{s.service_name}</Text><Text style={[styles.textValue, { fontSize: 13 }]}>AED {Number(s.service_amount).toLocaleString()}</Text></View>))}</View>}

                                {deliveryType === 'door_delivery' && <View style={[styles.rowBetween, { marginTop: 10 }]}><Text style={styles.textLabel}>Delivery Charges</Text><Text style={styles.textValue}>AED {deliveryCharge.toLocaleString()}</Text></View>}

                                <View style={[styles.rowBetween, { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#333' }]}><Text style={[styles.sectionTitle, { fontSize: 18, color: '#fff' }]}>Grand Total</Text><Text style={[styles.sectionTitle, { fontSize: 18, color: '#cadb2a' }]}>AED {grandTotal.toLocaleString()}</Text></View>
                            </View>
                            <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10, color: '#fff' }]}>Payment Proof</Text>
                            <View style={styles.uploadCard}><TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('payment')}>{paymentScreenshot ? <Image source={{ uri: paymentScreenshot.uri }} style={styles.uploadedImg} /> : <><View style={styles.iconCircle}><Feather name="upload-cloud" size={24} color="#000" /></View><Text style={styles.uploadText}>Upload Payment Slip</Text></>}</TouchableOpacity></View>
                            {errors.payment ? <Text style={styles.errorText}>{errors.payment}</Text> : null}
                        </>
                    )}
                    <View style={{ height: 120 }} />
                </ScrollView>

                <View style={[styles.footer, { paddingBottom: 12 }]}>
                    <View><Text style={styles.footerLabel}>Total</Text><Text style={styles.footerAmount}>AED {grandTotal.toLocaleString()}</Text></View>
                    <TouchableOpacity style={[styles.proceedBtn, submitting && { opacity: 0.7 }]} onPress={handleNext} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.proceedText}>{currentStep === 3 ? 'Confirm Payment' : 'Proceed'}</Text>}
                    </TouchableOpacity>
                </View>
                <CityModal />
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 15, zIndex: 10 },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', fontFamily: 'Poppins' },
    stepContainer: { paddingVertical: 15, paddingHorizontal: 20, marginBottom: 10 },
    stepLineBase: { position: 'absolute', top: 30, left: 50, right: 50, height: 2, backgroundColor: '#333', zIndex: 0 },
    stepLineProgress: { height: 2, backgroundColor: '#cadb2a' },
    stepIconsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
    stepWrapper: { alignItems: 'center', width: 90 },
    stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginBottom: 5, zIndex: 1, borderWidth: 1, borderColor: '#333' },
    stepCircleActive: { backgroundColor: '#cadb2a', borderColor: '#cadb2a' },
    stepNumber: { color: '#888', fontWeight: 'bold' },
    stepNumberActive: { color: '#000' },
    stepLabel: { fontSize: 11, color: '#888', fontFamily: 'Poppins' },
    stepLabelActive: { color: '#cadb2a', fontWeight: 'bold' },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
    vehicleCard: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 12, padding: 10, marginVertical: 10, borderWidth: 1, borderColor: '#222' },
    vehicleImage: { width: 90, height: 70, borderRadius: 8, marginRight: 15, resizeMode: 'cover', borderWidth: 1, borderColor: '#333' },
    vehicleInfo: { flex: 1, justifyContent: 'center' },
    vehicleTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', fontFamily: 'Poppins' },
    vehicleSub: { fontSize: 12, color: '#888', marginTop: 2, fontFamily: 'Poppins' },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#cadb2a', marginLeft: 8, fontFamily: 'Poppins' },
    card: { backgroundColor: '#111', borderRadius: 12, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    textLabel: { fontSize: 14, color: '#ccc', fontFamily: 'Poppins' },
    textValue: { fontSize: 14, fontWeight: '700', color: '#fff', fontFamily: 'Lato' },
    serviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
    serviceName: { fontSize: 14, color: '#ccc', fontFamily: 'Poppins' },
    servicePrice: { fontSize: 14, fontWeight: '700', color: '#fff', marginRight: 10, fontFamily: 'Lato' },
    checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: '#666', borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
    checkboxSelected: { backgroundColor: '#cadb2a', borderColor: '#cadb2a' },
    radioCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
    radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#666', marginRight: 15, justifyContent: 'center', alignItems: 'center' },
    radioCircleSelected: { borderColor: '#cadb2a' },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#cadb2a' },
    radioText: { flex: 1, fontSize: 15, color: '#fff', fontFamily: 'Poppins' },
    radioPrice: { fontSize: 14, fontWeight: 'bold', color: '#cadb2a', textAlign: 'right', fontFamily: 'Lato' },
    radioSub: { fontSize: 10, color: '#888', textAlign: 'right', fontFamily: 'Poppins' },
    inputLabel: { fontSize: 14, color: '#cadb2a', marginBottom: 8, marginTop: 10, fontFamily: 'Poppins' },
    inputBox: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 8, paddingHorizontal: 15, height: 50, flexDirection: 'row', alignItems: 'center' },
    textInput: { flex: 1, color: '#fff', fontFamily: 'Poppins', height: '100%' },

    // 🟢 New ReadOnly Styles for Pickup
    readOnlyBox: { backgroundColor: '#181818', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 15, height: 50, flexDirection: 'row', alignItems: 'center' },
    readOnlyText: { color: '#ccc', fontFamily: 'Poppins', fontSize: 14, marginLeft: 10 },

    inputGroup: { marginBottom: 5 },
    errorText: { color: '#ff4444', fontSize: 12, marginTop: 5, marginLeft: 5, fontFamily: 'Poppins' },
    uploadCard: { marginBottom: 15, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#666', borderStyle: 'dashed' },
    uploadBtn: { alignItems: 'center', padding: 30 },
    iconCircle: { width: 45, height: 45, borderRadius: 25, backgroundColor: '#cadb2a', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    uploadText: { fontSize: 14, fontWeight: 'bold', color: '#fff', fontFamily: 'Poppins' },
    uploadSub: { fontSize: 11, color: '#888', marginTop: 5, fontFamily: 'Poppins' },
    uploadedImg: { width: '100%', height: 150, resizeMode: 'cover', borderRadius: 8 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222', paddingHorizontal: 20, paddingTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerLabel: { fontSize: 12, color: '#888', fontFamily: 'Poppins' },
    footerAmount: { fontSize: 20, fontWeight: 'bold', color: '#cadb2a', fontFamily: 'Lato' },
    proceedBtn: { backgroundColor: '#cadb2a', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 },
    proceedText: { color: '#000', fontWeight: 'bold', fontFamily: 'Poppins', fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#111', borderRadius: 16, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: '#222' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', fontFamily: 'Poppins' },
    modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222', flexDirection: 'row', justifyContent: 'space-between' },
    modalItemText: { fontSize: 16, color: '#ccc', fontFamily: 'Poppins' },
    modalItemSub: { fontSize: 12, color: '#888', fontFamily: 'Poppins', marginTop: 4 },
    modalItemTextSelected: { color: '#cadb2a', fontWeight: 'bold' },
});