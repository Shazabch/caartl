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
import { useNavigation, useRoute, useStateForPath } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import apiService from "../services/ApiService";
import * as Models from "../data/modal";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { OtpInput } from 'react-native-otp-entry';

const { width, height } = Dimensions.get("window");


type VerifyScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Verify'>;

interface VerifyErrors {
  code?: string;
}

const VerifyScreen: React.FC = () => {
  const navigation = useNavigation<VerifyScreenNavigationProp>();
  const route = useRoute<any>();
  const data = route?.params?.data || {};
  const { register, verifyPhone, resendOtp } = useAuth();
  const { showAlert } = useAlert();

  const [code, setCode] = useState<string>("");

  const [errors, setErrors] = useState<VerifyErrors>({});
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const validateFields = (): boolean => {
    const newErrors: VerifyErrors = {};
    if (!code) newErrors.code = "Code is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerify = async () => {
    if (!validateFields()) return;
    setLoading(true);
    try {
      const success = await verifyPhone(data.phone, code);
      if (!success) {
        showAlert("Verification Failed", "Invalid code. Please try again.");
      } else {
        showAlert("Verification Success", "Phone number verified successfully.");

      }
    } catch (error) {
      console.error("Verification component error:", error);
      showAlert("Error", "An unexpected error occurred during verification.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setCountdown(60);
    // Add your resend OTP logic here
    const success = await resendOtp(data.phone);
    if (!success) {
      showAlert("Resend Failed", "Failed to resend OTP. Please try again.");
    } else {
      showAlert("Resend Success", "OTP has been sent to your phone number.");
    }
    return;
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/w6zCFKrx5n.png" }} style={styles.backgroundTop} />
        <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/66UXWNnDCx.png" }} style={styles.backgroundBottom} />
        <View style={styles.content}>
          <Image source={{ uri: "https://static.codia.ai/image/2025-10-20/2s2Butmi2c.png" }} style={styles.logo} />
          <View style={styles.headerContainer}>
            <Text style={styles.welcomeText}>Verify Phone Number</Text>
            <Text style={styles.subtitleText}>Enter the code sent to your phone|email</Text>
          </View>

          <View style={styles.inputSection}>

            {/* Name Input */}
            <View style={styles.inputWrapper}>
              <OtpInput
                numberOfDigits={6}
                onTextChange={(text) => setCode(text)}
                focusColor={"#CADB2A"}
                type="numeric"
                theme={{
                  containerStyle: {
                    justifyContent: 'center',
                    gap: 10,
                  },
                  pinCodeContainerStyle: {
                    backgroundColor: "#F0F0F0",
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                  },
                  pinCodeTextStyle: {
                    fontFamily: "Baloo Thambi 2",
                    fontSize: 18,
                    color: "#000000",
                  },
                  focusStickStyle: { backgroundColor: "#CADB2A" },
                  focusedPinCodeContainerStyle: { backgroundColor: "#F0F0F0" },
                }}
              />

              {errors.code && <Text style={styles.errorText}>{errors.code}</Text>}
            </View>

          </View>


          <TouchableOpacity style={styles.signUpButton} onPress={handleVerify} disabled={loading}>{loading ? <ActivityIndicator color="#000000" /> : <Text style={styles.signUpButtonText}>Verify</Text>}</TouchableOpacity>
          <TouchableOpacity onPress={handleResend} disabled={loading || countdown > 0}>
            <Text style={styles.loginText}>
              Did not receive a code?{" "}
              {countdown > 0 ? (
                <Text style={styles.loginText}>Resend in {countdown}s</Text>
              ) : (
                <Text style={styles.loginLink}>Resend</Text>
              )}
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
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
  welcomeText: { fontFamily: "Borg9", fontSize: 20, color: "#FFFFFF", marginBottom: 8, textAlign: "center" },
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
  planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", position: "relative", marginBottom: 5 },
  planName: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  selectedPlanName: { color: "#000000" },
  infoButton: { position: "absolute", top: -8, right: 0, backgroundColor: "#CADB2A", borderRadius: 10, width: 20, height: 20, justifyContent: "center", alignItems: "center", zIndex: 1, borderWidth: 1, borderColor: "#000000" },
  infoButtonText: { color: "#000000", fontSize: 12, fontWeight: "bold" },
  priceAndCurrencyContainer: { flexDirection: "row", alignItems: "baseline", marginBottom: 5 },
  planPriceNumber: { fontSize: 20, fontWeight: "bold", color: "#FFFFFF" },
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
  centeredView: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.7)" },
  modalView: { width: width * 0.9, backgroundColor: "#000000", borderRadius: 20, padding: 25, alignItems: "flex-start", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, borderColor: "#CADB2A", borderWidth: 1, position: "relative" },
  closeButton: { position: "absolute", top: 15, right: 15, padding: 5, zIndex: 1, backgroundColor: "#000000", borderRadius: 15 },
  closeIcon: { width: 20, height: 20, tintColor: "#CADB2A", resizeMode: "contain" },
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

export default VerifyScreen;