import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
import apiService from '../services/ApiService';

const SPECS_LIST = [
    'GCC Specs', 'European Specs', 'Japanese Specs', 'North American Specs', 'Others', 'Canadian Spec', 'Chinese Spec', 'Korean Spec'
];

// --- Reusable Searchable Dropdown ---
const SearchableDropdown = ({ data, onSelect, placeholder, labelField = 'name', imageField }: any) => {
    const [searchText, setSearchText] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState('');

    const filteredData = data.filter((item: any) => item[labelField].toLowerCase().includes(searchText.toLowerCase()));

    const handleSelect = (item: any) => {
        setSelectedLabel(item[labelField]);
        onSelect(item);
        setIsOpen(false);
        setSearchText('');
    };

    return (
        <View style={styles.dropdownContainer}>
            <TouchableOpacity style={styles.dropdownHeader} onPress={() => setIsOpen(true)}>
                <Text style={[styles.dropdownText, !selectedLabel && { color: '#666' }]}>
                    {selectedLabel || placeholder}
                </Text>
                <Feather name="chevron-down" size={20} color="#cadb2a" />
            </TouchableOpacity>

            <Modal visible={isOpen} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{placeholder}</Text>
                            <TouchableOpacity onPress={() => setIsOpen(false)}>
                                <Feather name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.searchRow}>
                            <Feather name="search" size={18} color="#666" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search..."
                                placeholderTextColor="#666"
                                value={searchText}
                                onChangeText={setSearchText}
                                autoFocus
                            />
                        </View>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {filteredData.map((item: any) => (
                                <TouchableOpacity key={item.id} style={styles.dropdownItem} onPress={() => handleSelect(item)}>
                                    {imageField && item[imageField] ? (
                                        <Image source={{ uri: item[imageField] }} style={styles.brandIcon} resizeMode="contain" />
                                    ) : null}
                                    <Text style={styles.dropdownItemText}>{item[labelField]}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default function SellCarInquiryScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { showAlert } = useAlert();
    const { user } = useAuth();

    const [loadingData, setLoadingData] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Dropdown Data
    const [brands, setBrands] = useState<Models.Brand[]>([]);
    const [models, setModels] = useState<Models.VehicleModel[]>([]);
    const [years, setYears] = useState<number[]>([]);

    // Form State
    const [name, setName] = useState(user?.name || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [email, setEmail] = useState(user?.email || '');
    const [brandId, setBrandId] = useState<number | null>(null);
    const [modelId, setModelId] = useState<number | null>(null);
    const [year, setYear] = useState<string>('');
    const [mileage, setMileage] = useState('');
    const [specification, setSpecification] = useState('');
    const [notes, setNotes] = useState('');
    const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoadingData(true);
            try {
                const [brandRes, yearRes] = await Promise.all([
                    apiService.getMakes(),
                    apiService.getYears()
                ]);
                if (brandRes.success) setBrands(brandRes.data.data);
                if (yearRes.success) setYears(yearRes.data.data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingData(false);
            }
        };
        loadInitialData();
    }, []);

    // Load Models when Brand selected
    const handleBrandSelect = async (brand: Models.Brand) => {
        setBrandId(brand.id);
        setModelId(null); // Reset model
        try {
            const res = await apiService.getModels(brand.id);
            if (res.success) setModels(res.data.data);
        } catch (e) { console.error(e); }
    };

    const pickImages = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setImages([...images, ...result.assets]);
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);
    };

    const handleSubmit = async () => {
        if (!name || !phone || !email || !brandId || !modelId || !year || !mileage || !specification) {
            showAlert("Error", "Please fill all required fields.");
            return;
        }

        setSubmitting(true);
        const formData = new FormData();
        formData.append('name', name);
        formData.append('phone', phone);
        formData.append('email', email);
        formData.append('brand_id', String(brandId));
        formData.append('make_id', String(modelId)); // API expects make_id for model
        formData.append('year', year);
        formData.append('mileage', mileage);
        formData.append('specification', specification);
        formData.append('notes', notes);

        images.forEach((img) => {
            let uri = Platform.OS === 'android' ? img.uri : img.uri.replace('file://', '');
            const filename = uri.split('/').pop() || 'upload.jpg';
            let ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
            if (ext === 'jpg') ext = 'jpeg';
            const type = ext === 'png' ? 'image/png' : 'image/jpeg';
            formData.append('images', {
                uri,
                name: filename,
                type,
            } as any);
        });

        try {
            const result = await apiService.sellCar(formData);
            if (result.success) {
                showAlert("Success", "Inquiry sent successfully!");
                navigation.goBack();
            } else {
                showAlert("Error", "Failed to send inquiry.");
            }
        } catch (e) {
            showAlert("Error", "Network error.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#000000', '#1a1a00']} style={styles.container}>
                <View style={[styles.header, { paddingTop: 10 }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Sell Your Car</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>

                    <Text style={styles.sectionTitle}>Car Details</Text>

                    {/* Brand */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Make (Brand)</Text>
                        <SearchableDropdown
                            data={brands}
                            onSelect={handleBrandSelect}
                            placeholder="Select Brand"
                            imageField="image_source"
                        />
                    </View>

                    {/* Model */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Model</Text>
                        <SearchableDropdown
                            data={models}
                            onSelect={(m: any) => setModelId(m.id)}
                            placeholder={brandId ? "Select Model" : "Select Brand First"}
                        />
                    </View>

                    {/* Year */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Year</Text>
                        <SearchableDropdown
                            data={years.map(y => ({ id: y, name: String(y) }))}
                            onSelect={(y: any) => setYear(y.name)}
                            placeholder="Select Year"
                        />
                    </View>

                    {/* Mileage */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mileage (KM)</Text>
                        <TextInput style={styles.input} value={mileage} onChangeText={setMileage} keyboardType="numeric" placeholder="e.g. 50000" placeholderTextColor="#666" />
                    </View>

                    {/* Specifications */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Specification</Text>
                        <SearchableDropdown
                            data={SPECS_LIST.map((s, i) => ({ id: i, name: s }))}
                            onSelect={(s: any) => setSpecification(s.name)}
                            placeholder="Select Specs"
                        />
                    </View>

                    {/* Notes */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Notes</Text>
                        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="Additional details..." placeholderTextColor="#666" />
                    </View>

                    {/* Images */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Images</Text>
                        <ScrollView horizontal style={{ marginBottom: 10 }}>
                            {images.map((img, i) => (
                                <View key={i} style={styles.imageThumbContainer}>
                                    <Image source={{ uri: img.uri }} style={styles.thumbImage} />
                                    <TouchableOpacity onPress={() => removeImage(i)} style={styles.removeIcon}>
                                        <Feather name="x" size={12} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImages}>
                                <Feather name="camera" size={24} color="#cadb2a" />
                                <Text style={styles.addPhotoText}>Add</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>

                    <View style={{ height: 20 }} />

                    <Text style={styles.sectionTitle}>Contact Details</Text>
                    <View style={styles.inputGroup}><Text style={styles.label}>Name</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#666" /></View>
                    <View style={styles.inputGroup}><Text style={styles.label}>Phone</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#666" /></View>
                    <View style={styles.inputGroup}><Text style={styles.label}>Email</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" placeholderTextColor="#666" /></View>

                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Submit Inquiry</Text>}
                    </TouchableOpacity>

                    <View style={{ height: 50 }} />
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
    sectionTitle: { color: '#cadb2a', fontSize: 18, fontWeight: 'bold', marginBottom: 15, fontFamily: 'Poppins' },

    inputGroup: { marginBottom: 15 },
    label: { color: '#ccc', fontSize: 14, marginBottom: 5, fontFamily: 'Poppins' },
    input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, fontFamily: 'Poppins' },

    dropdownContainer: {},
    dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 12 },
    dropdownText: { color: '#fff', fontSize: 14, fontFamily: 'Poppins' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#111', borderRadius: 12, padding: 15, maxHeight: '80%', borderWidth: 1, borderColor: '#cadb2a' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    modalTitle: { color: '#cadb2a', fontSize: 18, fontWeight: 'bold' },
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', borderRadius: 8, paddingHorizontal: 10, marginBottom: 10 },
    searchInput: { flex: 1, marginLeft: 10, color: '#fff', paddingVertical: 10 },
    dropdownItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222', flexDirection: 'row', alignItems: 'center' },
    dropdownItemText: { color: '#ccc', fontSize: 16 },
    brandIcon: { width: 24, height: 24, marginRight: 10 },

    imageThumbContainer: { marginRight: 10, position: 'relative' },
    thumbImage: { width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
    removeIcon: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ff4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
    addPhotoBtn: { width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: '#cadb2a', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    addPhotoText: { color: '#cadb2a', fontSize: 10, marginTop: 4 },

    submitBtn: { backgroundColor: '#cadb2a', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
    submitBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});