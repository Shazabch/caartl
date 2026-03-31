import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import type { RootStackParamList } from '../navigation/AppNavigator';

const { width, height } = Dimensions.get('window');

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface LoginErrors {
  email?: string;
  password?: string;
}

const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login, guestLogin } = useAuth();
  const { showAlert } = useAlert();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 👈 1. Added state for visibility
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});

  const validateFields = () => {
    const newErrors: LoginErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      newErrors.email = 'Email address is required.';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateFields()) {
      return;
    }

    setLoading(true);
    try {
      const success = await login({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (!success) {
        showAlert('Login Failed', 'The email or password you entered is incorrect. Please try again.');
      }
    } catch (error) {
      console.error("Login component error:", error);
      showAlert('Network Error', 'Could not connect to the server. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  // 🟢 ADD: Guest login handler
  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await guestLogin();
      navigation.navigate('DrawerRoot');
    } catch (error) {
      showAlert('Error', 'Could not continue as guest.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground source={{ uri: 'https://static.codia.ai/image/2025-10-20/hFdUGzMbu5.png' }} style={styles.topBackground} resizeMode="cover" />
      <ImageBackground source={{ uri: 'https://static.codia.ai/image/2025-10-20/W7Czw6Ls88.png' }} style={styles.bottomBackground} resizeMode="cover" />

      <View style={styles.content}>
        <Image source={{ uri: 'https://static.codia.ai/image/2025-10-20/3PcrpRUpQR.png' }} style={styles.logo} resizeMode="contain" />

        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Welcome Back</Text>
          <Text style={styles.welcomeSubtitle}>Login to your account using email{'\n'}or social networks!</Text>
        </View>

        {/* Email Input */}
        <View style={styles.inputWrapper}>
          <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
            <Image source={{ uri: 'https://static.codia.ai/image/2025-10-20/0cbxiA4x1a.png' }} style={styles.inputIcon} resizeMode="contain" />
            <TextInput
              style={styles.textInput}
              placeholder="Email"
              placeholderTextColor="rgba(0, 0, 0, 0.37)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              editable={!loading}
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        {/* Password Input */}
        <View style={styles.inputWrapper}>
          <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
            <Image source={{ uri: 'https://static.codia.ai/image/2025-10-20/ehk1tymwRT.png' }} style={styles.passwordIcon} resizeMode="contain" />
            <TextInput
              style={styles.textInput}
              placeholder="Password"
              placeholderTextColor="rgba(0, 0, 0, 0.37)"
              secureTextEntry={!showPassword} // 👈 2. Toggle secureTextEntry based on state
              autoCapitalize="none"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              editable={!loading}
            />

            {/* 3. Wrapped Image in TouchableOpacity to handle click */}
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Image
                source={{ uri: 'https://static.codia.ai/image/2025-10-20/csxGWWJ4GP.png' }}
                style={styles.eyeIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        {/* <TouchableOpacity style={styles.forgotPasswordContainer} disabled={loading}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity> */}


        <TouchableOpacity style={[styles.loginButton, loading && styles.loginButtonDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#000000" /> : <Text style={styles.loginButtonText}>Login</Text>}
        </TouchableOpacity>

        {/* 🟢 ADD: Guest login button */}
        <TouchableOpacity style={[styles.loginButton, { backgroundColor: '#222', marginTop: 10 }]} onPress={handleGuestLogin} disabled={loading}>
          <Text style={[styles.loginButtonText, { color: '#fff' }]}>Continue as Guest</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signUpContainer} onPress={() => navigation.navigate('Register')} disabled={loading}>
          <Text style={styles.signUpText}>First Time Here? <Text style={styles.signUpLink}>Sign up</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  topBackground: { position: 'absolute', top: 0, left: 0, width: width, height: height * 0.5 },
  bottomBackground: { position: 'absolute', bottom: 0, left: 0, width: width, height: height * 0.45 },
  content: { flex: 1, paddingHorizontal: 30, paddingTop: 70, alignItems: 'center' },
  logo: { width: 150, height: 65, marginBottom: 25 },
  welcomeContainer: { alignItems: 'center', marginBottom: 30 },
  welcomeTitle: { fontFamily: 'Borg9', fontSize: 20, color: '#FFFFFF', marginBottom: 6 },
  welcomeSubtitle: { fontFamily: 'Baloo Thambi 2', fontSize: 16, lineHeight: 22, color: '#FFFFFF', textAlign: 'center' },
  inputWrapper: { width: '100%', marginBottom: 15, },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 16, paddingHorizontal: 18, width: '100%', height: 55, borderWidth: 1.5, borderColor: 'transparent' },
  inputError: { borderColor: '#FF5A5F' },
  inputIcon: { width: 22, height: 18, marginRight: 15 },
  passwordIcon: { width: 14, height: 18, marginRight: 18 },
  eyeIcon: { width: 20, height: 14, marginLeft: 'auto' },
  textInput: { flex: 1, fontSize: 15, fontWeight: '500', color: '#000000' },
  errorText: { color: '#FF5A5F', fontSize: 13, marginTop: 5, marginLeft: 10, fontFamily: 'Baloo Thambi 2' },
  forgotPasswordContainer: { alignSelf: 'flex-end', marginBottom: 18 },
  forgotPasswordText: { fontFamily: 'Baloo Thambi 2', fontSize: 16, color: '#FFFFFF' },
  loginButton: { backgroundColor: '#CADB2A', borderRadius: 18, paddingVertical: 15, width: '100%', height: 55, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  loginButtonDisabled: { backgroundColor: '#A0A0A0', opacity: 0.6 },
  loginButtonText: { fontSize: 16, fontWeight: '700', color: '#000000' },
  signUpContainer: { marginTop: 20 },
  signUpText: { fontFamily: 'Baloo Thambi 2', fontSize: 16, color: '#FFFFFF', textAlign: 'center' },
  signUpLink: { color: '#CADB2A' },
});

export default LoginScreen;