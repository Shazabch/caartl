import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import apiService from "../services/ApiService";
import * as Models from "../data/modal";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

// --- 1. Shimmer Effect Component ---
const ShimmerPlaceholder = ({ style }: { style: any }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startShimmer = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    startShimmer();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return <Animated.View style={[style, { opacity, backgroundColor: '#333' }]} />;
};

// --- 2. Package Skeleton Card ---
const PackageSkeletonCard = ({ isLast }: { isLast: boolean }) => (
  <View style={[styles.planCard, !isLast && { marginRight: 10 }, { borderColor: '#333' }]}>
    <View style={{ width: '100%', alignItems: 'center', marginBottom: 10 }}>
      <ShimmerPlaceholder style={{ width: 60, height: 15, borderRadius: 4, marginBottom: 5 }} />
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <ShimmerPlaceholder style={{ width: 40, height: 20, borderRadius: 4, marginRight: 5 }} />
      <ShimmerPlaceholder style={{ width: 20, height: 12, borderRadius: 4 }} />
    </View>
  </View>
);

// --- Interfaces & Sub-Components ---

interface PlanDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  plan: Models.Package | null;
}

const PlanDetailsModal: React.FC<PlanDetailsModalProps> = ({ visible, onClose, plan }) => {
  if (!plan) return null;
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent={true} // 👈 important for Android
    >
      <View style={modalStyles.centeredView}>
        <View style={modalStyles.modalView}>
          <TouchableOpacity
            style={modalStyles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#CADB2A" />
          </TouchableOpacity>
          <Text style={modalStyles.planName}>{plan.name} Package</Text>
          <View style={modalStyles.priceBannerContainer}>
            <LinearGradient colors={["#CADB2A", "#CADB2A", "#000000"]} start={{ x: 0, y: 0.5 }} end={{ x: 0.8, y: 0.5 }} style={modalStyles.priceBannerGradient}></LinearGradient>
            <Text style={modalStyles.priceBannerText}>{parseInt(plan.price)}</Text>
            <Text style={modalStyles.priceBannerCurrency}>AED</Text>
          </View>
          <Text style={modalStyles.description}>{plan.description}</Text>
          <View style={modalStyles.featuresContainer}>
            {plan.features?.map((feature, index) => (
              <View key={index} style={modalStyles.featureItem}>
                <View style={modalStyles.bullet} /><Text style={modalStyles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

type SignUpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

interface SignUpErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  package?: string;
  phone?: string;
}

const SignUpScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { register } = useAuth();
  const { showAlert } = useAlert();

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  // Toggle states for password visibility
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [errors, setErrors] = useState<SignUpErrors>({});
  const [packages, setPackages] = useState<Models.Package[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState<boolean>(false);
  const [currentPlanDetails, setCurrentPlanDetails] = useState<Models.Package | null>(null);

  useEffect(() => {
    const fetchPackages = async () => {
      setPackagesLoading(true);
      try {
        const result = await apiService.getPackages();
        if (result.success && result.data.data.data.length > 0) {
          setPackages(result.data.data.data);
          setSelectedPackageId(result.data.data.data[0].id);
        } else {
          showAlert("Error", "Could not fetch subscription packages.");
        }
      } catch (error) {
        console.error("Failed to fetch packages:", error);
        showAlert("Network Error", "An error occurred while fetching packages.");
      } finally {
        setPackagesLoading(false);
      }
    };
    fetchPackages();
  }, []);

  const validateFields = (): boolean => {
    const newErrors: SignUpErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name) newErrors.name = "Name is required.";
    if (!email) newErrors.email = "Email is required.";
    else if (!emailRegex.test(email)) newErrors.email = "Please enter a valid email address.";
    if (!password) newErrors.password = "Password is required.";
    else if (password.length < 8) newErrors.password = "Password must be at least 8 characters.";
    if (!confirmPassword) newErrors.confirmPassword = "Please confirm your password.";
    else if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match.";
    if (!selectedPackageId) newErrors.package = "Please select a plan.";
    if (!phone) newErrors.phone = "Phone is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPhoneNumber = (phone: string): string | null => {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('971')) {
      // Dubai number, prepend +
      return `+${cleaned}`;
    } else if (cleaned.startsWith('92')) {
      // Pakistan number, prepend + (testing only, no error)
      return `+${cleaned}`;
    }

    // Invalid number for Dubai, return null
    return null;
  };
  const handleSignUp = async () => {
    if (!validateFields()) return;


    const formattedPhone = formatPhoneNumber(phone);

    // Show error only if user entered Dubai number incorrectly
    if (!formattedPhone && phone.startsWith('971')) {
      setErrors({ ...errors, phone: 'Phone number must start with Dubai code +971.' });
      showAlert('Invalid Phone', 'Phone number must start with Dubai code +971.');
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        name,
        email: email.trim().toLowerCase(),
        password,
        package_id: selectedPackageId,
        phone: formattedPhone,
      });

      if (!result.success) {
        const apiError = result.error;

        // ✅ FIELD ERRORS (email, phone, etc.)
        if (apiError?.errors) {
          const newErrors: any = {};

          Object.keys(apiError.errors).forEach((key) => {
            newErrors[key] = apiError.errors[key][0];
          });

          setErrors(newErrors);

          // show first error in alert
          const firstKey = Object.keys(apiError.errors)[0];
          showAlert("Registration Failed", apiError.errors[firstKey][0]);
        } else {
          // ✅ GENERAL ERRORS (OTP, server, etc.)
          showAlert(
            "Registration Failed",
            apiError?.message || "Something went wrong"
          );
        }

        return;
      }

      // ✅ SUCCESS
      navigation.navigate("Verify", {
        data: {
          name,
          email: email.trim().toLowerCase(),
          password,
          package_id: selectedPackageId,
          phone: formattedPhone,
        },
      });

    } catch (error) {
      console.error("Registration component error:", error);
      showAlert("Error", "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlanInfoClick = (plan: Models.Package) => {
    setCurrentPlanDetails(plan);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/w6zCFKrx5n.png" }} style={styles.backgroundTop} />
        <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/66UXWNnDCx.png" }} style={styles.backgroundBottom} />
        <View style={styles.content}>
          {/* <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/2s2Butmi2c.png" }} style={styles.logo} /> */}
          <View style={styles.headerContainer}><Text style={styles.welcomeText}>Create Account</Text><Text style={styles.subtitleText}>Sign up to get started!</Text></View>

          <View style={styles.inputSection}>

            {/* Name Input */}
            <View style={styles.inputWrapper}>
              <View style={[styles.inputContainer, errors.name ? styles.inputError : null]}>
                <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/o1cmtzYQO9.png" }} style={styles.inputIcon} />
                <TextInput style={styles.textInput} placeholder="Name" placeholderTextColor="rgba(0, 0, 0, 0.37)" onChangeText={text => { setName(text); if (errors.name) setErrors({ ...errors, name: undefined }); }} editable={!loading} />
              </View>
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
                <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/bTCs4R8GxF.png" }} style={styles.inputIcon} />
                <TextInput style={styles.textInput} placeholder="Email" placeholderTextColor="rgba(0, 0, 0, 0.37)" onChangeText={text => { setEmail(text); if (errors.email) setErrors({ ...errors, email: undefined }); }} keyboardType="email-address" autoCapitalize="none" editable={!loading} />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Phone Input */}

            <View style={styles.inputWrapper}>
              <View style={[styles.inputContainer, errors.phone ? styles.inputError : null]}>
                <Ionicons name="call" size={18} color="#878686" style={styles.inputIcon} />
                <TextInput style={styles.textInput} placeholder="971xxxxxxxxx" placeholderTextColor="rgba(0, 0, 0, 0.37)" onChangeText={text => { setPhone(text); if (errors.phone) setErrors({ ...errors, phone: undefined }); }} keyboardType="phone-pad" editable={!loading} />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
              <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
                <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/cWMbeoqwoW.png" }} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Password"
                  placeholderTextColor="rgba(0, 0, 0, 0.37)"
                  onChangeText={text => { setPassword(text); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/GKQN4AKuf9.png" }} style={styles.eyeIcon} />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputWrapper}>
              <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null]}>
                <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/i0ijcQGGGc.png" }} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Confirm Password"
                  placeholderTextColor="rgba(0, 0, 0, 0.37)"
                  onChangeText={text => { setConfirmPassword(text); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined }); }}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/0uBggjLtw6.png" }} style={styles.eyeIcon} />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </View>
          </View>

          <View style={styles.plansContainer}>
            {packagesLoading ? (
              <>
                <PackageSkeletonCard isLast={false} />
                <PackageSkeletonCard isLast={false} />
                <PackageSkeletonCard isLast={true} />
              </>
            ) : (
              packages.map((pkg, index) => (
                <TouchableOpacity key={pkg.id} style={[styles.planCard, selectedPackageId === pkg.id && styles.selectedPlanCard, index !== packages.length - 1 && { marginRight: 10 }]} onPress={() => setSelectedPackageId(pkg.id)} disabled={packagesLoading}>
                  <View style={styles.planHeader}>
                    <TouchableOpacity
                      style={styles.infoButton}
                      onPress={() => handlePlanInfoClick(pkg)}
                    >
                      <Text style={styles.infoButtonText}>i</Text>
                    </TouchableOpacity>

                    <Text
                      style={[
                        styles.planName,
                        selectedPackageId === pkg.id && styles.selectedPlanName,
                        { marginTop: 5, textAlign: "left", width: "100%" }
                      ]}
                    >
                      {pkg.name}
                    </Text>
                  </View>
                  <View style={styles.priceAndCurrencyContainer}>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[styles.planPriceNumber, selectedPackageId === pkg.id && styles.selectedPlanPrice]}
                    >
                      {Number(pkg.price).toLocaleString()}
                    </Text>
                    <Text style={[styles.planCurrencyText, selectedPackageId === pkg.id && styles.selectedPlanPrice]}>AED</Text></View>
                </TouchableOpacity>
              ))
            )}
          </View>
          {errors.package && <Text style={styles.errorText}>{errors.package}</Text>}

          <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp} disabled={loading}>{loading ? <ActivityIndicator color="#000000" /> : <Text style={styles.signUpButtonText}>Sign up</Text>}</TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}><Text style={styles.loginText}>Already have an account? <Text style={styles.loginLink}>Login</Text></Text></TouchableOpacity>

          {/* Social Logins
          <Text style={styles.orText}>Or sign up with</Text>
          <View style={styles.socialContainer}>
            <TouchableOpacity style={styles.socialButton}><Image source={{ uri: "https://static.codia.ai/image/2025-10-20/3MFdSJwDmX.png" }} style={styles.socialIcon} /><Text style={styles.socialText}>Google</Text></TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}><Image source={{ uri: "https://static.codia.ai/image/2025-10-20/eMqVbppD5O.png" }} style={styles.socialIcon} /><Text style={styles.socialText}>Facebook</Text></TouchableOpacity>
          </View> */}
        </View>
      </ScrollView>
      <PlanDetailsModal visible={isModalVisible} onClose={() => setModalVisible(false)} plan={currentPlanDetails} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  scrollContainer: { flexGrow: 1, paddingBottom: 20 },
  backgroundTop: { position: "absolute", top: 0, left: 0, width: width, height: height * 0.52, resizeMode: "cover" },
  backgroundBottom: { position: "absolute", bottom: 0, left: 0, width: width, height: height * 0.47, resizeMode: "cover" },
  content: { flex: 1, paddingHorizontal: 25, paddingTop: 60, alignItems: "center" },
  logo: { width: 150, height: 65, marginBottom: 35, resizeMode: "contain" },
  headerContainer: { alignItems: "center", marginBottom: 30 },
  welcomeText: { fontFamily: "Borg9", fontSize: 20, color: "#FFFFFF", marginBottom: 8, marginTop: 20, textAlign: "center" },
  subtitleText: { fontFamily: "Baloo Thambi 2", fontSize: 16, color: "#FFFFFF", textAlign: "center", lineHeight: 22 },
  inputSection: { width: "100%", marginBottom: 15 },
  inputWrapper: { marginBottom: 15, width: '100%' },
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F0F0F0", borderRadius: 18, paddingHorizontal: 18, height: 50, borderWidth: 1.5, borderColor: 'transparent' },
  inputError: { borderColor: '#FF5A5F' },
  inputIcon: { width: 18, height: 18, marginRight: 12, resizeMode: "contain" },
  textInput: { flex: 1, fontSize: 15, color: "#000000" },
  eyeIcon: { width: 20, height: 14, resizeMode: "contain" }, // Removed marginRight to better fit touchable area
  errorText: { color: '#FF5A5F', fontSize: 13, marginTop: 5, marginLeft: 10, fontFamily: 'Baloo Thambi 2' },
  plansContainer: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 20, paddingHorizontal: 10 },
  planCard: { flex: 1, maxWidth: (width - 25 * 2 - 10 * 2) / 3, height: 105, borderRadius: 15, borderWidth: 1, borderColor: "#CADB2A", paddingVertical: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "space-around", backgroundColor: "transparent" },
  selectedPlanCard: { backgroundColor: "#CADB2A" },
  planHeader: {
    width: "100%",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    position: "relative",
  },
  planName: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  selectedPlanName: { color: "#000000" },
  infoButton: { position: "absolute", top: -8, right: 0, backgroundColor: "#CADB2A", borderRadius: 10, width: 20, height: 20, justifyContent: "center", alignItems: "center", zIndex: 1, borderWidth: 1, borderColor: "#000000" },
  infoButtonText: { color: "#000000", fontSize: 12, fontWeight: "bold" },
  priceAndCurrencyContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 5,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  planPriceNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  planCurrencyText: { fontSize: 12, fontWeight: "bold", color: "#FFFFFF", marginLeft: 3, top: 2 },
  selectedPlanPrice: { color: "#000000" },
  signUpButton: { backgroundColor: "#CADB2A", borderRadius: 18, paddingVertical: 18, width: "100%", alignItems: "center", marginBottom: 15 },
  signUpButtonText: { fontSize: 17, fontWeight: "700", color: "#000000" },
  loginText: { fontSize: 16, color: "#FFFFFF", textAlign: "center", marginBottom: 15, fontFamily: "Baloo Thambi 2" },
  loginLink: { color: "#CADB2A" },
  orText: { fontSize: 16, color: "#FFFFFF", textAlign: "center", marginBottom: 15, fontFamily: "Baloo Thambi 2" },
  socialContainer: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingBottom: 20 },
  socialButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#F0F0F0", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 18, width: "48%", justifyContent: "center" },
  socialIcon: { width: 25, height: 25, marginRight: 8, resizeMode: "contain" },
  socialText: { fontSize: 15, color: "#000000", fontWeight: "500" },
});

const modalStyles = StyleSheet.create({
  centeredView: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: { paddingTop: 40, width: width * 0.9, backgroundColor: "#000000", borderRadius: 20, padding: 25, alignItems: "flex-start", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, borderColor: "#CADB2A", borderWidth: 1, position: "relative" },
  closeButton: {
    position: "absolute",
    top: 15,
    right: 15,
    padding: 8,
    zIndex: 999,
    elevation: 10,
    backgroundColor: "#111",
    borderRadius: 20,
  },
  closeIcon: {
    width: 22,
    height: 22,
    tintColor: "#CADB2A",
    resizeMode: "contain",
  },
  planName: { fontSize: 28, fontWeight: "bold", color: "#FFFFFF", marginBottom: 15, marginTop: 10 },
  priceBannerContainer: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  priceBannerGradient: { paddingVertical: 5, paddingRight: 10, borderRadius: 10, alignItems: "center", justifyContent: "center", minWidth: 60, height: 40 },
  priceBannerText: { fontSize: 28, fontWeight: "bold", color: "#FFFFFF" },
  priceBannerCurrency: { fontSize: 15, fontWeight: "bold", color: "#CADB2A", marginTop: 15 },
  description: { fontSize: 16, color: "#FFFFFF", marginBottom: 20, lineHeight: 22, fontWeight: "500" },
  featuresContainer: { width: "100%" },
  featureItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#CADB2A", marginRight: 10, marginTop: 7 },
  featureText: { flex: 1, fontSize: 15, color: "#FFFFFF", lineHeight: 20 },
});

export default SignUpScreen;