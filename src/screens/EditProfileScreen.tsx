import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/ApiService';

export default function EditProfileScreen() {
    const navigation = useNavigation();
    const { user, updateUser } = useAuth();
    const { showAlert } = useAlert();

    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [profileImageUri, setProfileImageUri] = useState<string | null>(user?.photo || null);
    const [pickedImage, setPickedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [loading, setLoading] = useState(false);

    const handlePickProfileImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setPickedImage(result.assets[0]);
            setProfileImageUri(result.assets[0].uri);
        }
    };

    const handleUpdate = async () => {
        if (!name || !email) {
            return showAlert('Error', 'Name and Email are required.');
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('phone', phone || '');
            formData.append('bio', bio || '');

            if (pickedImage?.uri) {
                const sourceUri = pickedImage.uri;
                const filename = sourceUri.split('/').pop() || `profile_${Date.now()}.jpg`;
                const match = /\.(\w+)$/.exec(filename);
                const mimeType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
                if (Platform.OS === 'web') {
                    try {
                        const fileResponse = await fetch(sourceUri);
                        const fileBlob = await fileResponse.blob();
                        const typedBlob = fileBlob.type ? fileBlob : new Blob([fileBlob], { type: mimeType });
                        formData.append('photo', typedBlob, filename);
                    } catch {
                        showAlert('Error', 'Failed to read selected image file. Please try another image.');
                        setLoading(false);
                        return;
                    }
                } else {
                    // Native (Android/iOS) multipart upload format.
                    const uri = Platform.OS === 'android' ? sourceUri : sourceUri.replace('file://', '');
                    formData.append('photo', {
                        uri,
                        name: filename,
                        type: mimeType,
                    } as any);
                }
            }

            const result = await apiService.updateUserProfile(formData);

            if (result.success && result.data.data) {
                updateUser(result.data.data); // Update global context
                showAlert('Success', 'Profile updated successfully.');
                navigation.goBack();
            } else {
                showAlert('Error', result.data.message || 'Failed to update profile.');
            }
        } catch (error) {
            console.error(error);
            showAlert('Error', 'Network error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <LinearGradient colors={['rgba(202, 219, 42, 0)', 'rgba(202, 219, 42, 0.2)']} style={styles.container}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Feather name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.form}>
                        <View style={styles.imageSection}>
                            <Image
                                source={{ uri: profileImageUri || 'https://i.pravatar.cc/150?img=12' }}
                                style={styles.profileImage}
                            />
                            <TouchableOpacity style={styles.imageButton} onPress={handlePickProfileImage}>
                                <Feather name="camera" size={16} color="#000" />
                                <Text style={styles.imageButtonText}>Choose Profile Image</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your name"
                                placeholderTextColor="#666"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email Address</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter email"
                                placeholderTextColor="#666"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter phone number"
                                placeholderTextColor="#666"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Bio</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Tell us about yourself"
                                placeholderTextColor="#666"
                                value={bio}
                                onChangeText={setBio}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleUpdate}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitText}>Save Changes</Text>}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, paddingTop: 10 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff', fontFamily: 'Poppins' },
    form: { flex: 1 },
    imageSection: { alignItems: 'center', marginBottom: 24 },
    profileImage: { width: 90, height: 90, borderRadius: 45, borderWidth: 1, borderColor: '#cadb2a', marginBottom: 12, backgroundColor: '#111' },
    imageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#cadb2a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
    imageButtonText: { color: '#000', fontWeight: '700', fontSize: 13, fontFamily: 'Poppins', marginLeft: 8 },
    inputGroup: { marginBottom: 20 },
    label: { color: '#cadb2a', marginBottom: 8, fontSize: 14, fontFamily: 'Poppins' },
    input: { backgroundColor: '#111', borderRadius: 12, padding: 15, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#333' },
    textArea: { height: 100 },
    submitButton: { backgroundColor: '#cadb2a', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 20, marginBottom: 40 },
    submitText: { color: '#000', fontWeight: '700', fontSize: 16, fontFamily: 'Poppins' },
});