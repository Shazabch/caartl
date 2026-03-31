import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Models from '../data/modal';
import apiService from '../services/ApiService';

interface AuthContextType {
    userToken: string | null;
    user: Models.User | null;
    isLoading: boolean;
    isGuest: boolean;
    isApproved: boolean;
    isUnapproved: boolean;
    login: (credentials: any) => Promise<boolean>;
    register: (userData: any) => Promise<{ success: boolean; error?: any }>;
    logout: () => void;
    updateUser: (user: Models.User | null) => Promise<void>;
    guestLogin: () => Promise<void>;
    verifyPhone: (phone: string, code: string) => Promise<boolean>;
    resendOtp: (phone: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userToken, setUserToken] = useState<string | null>(null);
    const [user, setUser] = useState<Models.User | null>(null);

    // Normalize user approval status
    const normalizeUser = (inputUser: Models.User | null): Models.User | null => {
        if (!inputUser) return null;
        const hasApproval = typeof inputUser.is_approved === 'number';
        const resolvedApproval = hasApproval
            ? inputUser.is_approved
            : inputUser.status === 'pending'
                ? 0
                : 1;
        return { ...inputUser, is_approved: resolvedApproval };
    };

    // Restore token and user from AsyncStorage
    useEffect(() => {
        const bootstrapAsync = async () => {
            let token: string | null = null;
            let userData: Models.User | null = null;
            try {
                token = await AsyncStorage.getItem('userToken');
                const userDataString = await AsyncStorage.getItem('userData');

                if (userDataString) {
                    userData = JSON.parse(userDataString);
                }

                if (token) {
                    const result = await apiService.getUserProfile();

                    if (result.success && result.data.data) {
                        userData = normalizeUser(result.data.data);
                        await AsyncStorage.setItem('userData', JSON.stringify(userData));
                    } else if (result.status === 401) {
                        console.log("Token expired or invalid. Logging out.");
                        token = null;
                        userData = null;
                        await AsyncStorage.multiRemove(['userToken', 'userData']);
                    } else {
                        console.log("Network error or server down. Keeping local session active.");
                    }
                }
            } catch (e) {
                console.error('Restoring auth state failed', e);
                token = null;
                userData = null;
            } finally {
                setUserToken(token);
                setUser(userData);
                setIsLoading(false);
            }
        };

        bootstrapAsync();
    }, []);

    // Login
    const login = async (credentials: any) => {
        const result = await apiService.login(credentials);
        if (result.success && result.data.access_token) {
            const { access_token, user } = result.data;
            const normalizedUser = normalizeUser(user);
            if (!normalizedUser) return false;

            setUserToken(access_token);
            setUser(normalizedUser);
            await apiService.storeUserData(normalizedUser, access_token);
            return true;
        }
        return false;
    };

    // Register
    const register = async (userData: any) => {
        try {
            const result = await apiService.register(userData);

            if (result.success) {
                const { token, user } = result.data;
                const normalizedUser = normalizeUser(user);
                if (!normalizedUser) return { success: false, error: 'Invalid user data' };

                setUserToken(token);
                setUser(normalizedUser);
                await apiService.storeUserData(normalizedUser, token);

                return { success: true };
            }

            return { success: false, error: result.data };
        } catch (error: any) {
            return {
                success: false,
                error: error?.response?.data || { message: "Something went wrong. Please try again." },
            };
        }
    };

    // Verify phone
    const verifyPhone = async (phone: string, code: string) => {
        const result = await apiService.verifyPhone(phone, code);
        if (result.success) {
            const { token, user } = result.data;
            const normalizedUser = normalizeUser(user);
            if (!normalizedUser) return false;

            setUserToken(token);
            setUser(normalizedUser);
            await apiService.storeUserData(normalizedUser, token);
            return true;
        }
        return false;
    };

    // Resend OTP
    const resendOtp = async (phone: string) => {
        const result = await apiService.resendOtp(phone);
        return result.success;
    };

    // Logout
    const logout = async () => {
        await apiService.logout();
        setUserToken(null);
        setUser(null);
        await AsyncStorage.multiRemove(['userToken', 'userData']);
    };

    // Update user (nullable-safe)
    const updateUser = async (newUser: Models.User | null) => {
        setUser(newUser);
        if (newUser) {
            await AsyncStorage.setItem('userData', JSON.stringify(newUser));
        } else {
            await AsyncStorage.removeItem('userData');
        }
    };

    // Guest login
    const guestLogin = async () => {
        const guestUser: Models.User = {
            id: 0,
            agent_id: null,
            is_approved: 0,
            name: 'Guest',
            email: '',
            email_verified_at: null,
            phone_verified_at: null,
            bio: null,
            phone: '',
            photo: null,
            target: null,
            created_at: '',
            updated_at: '',
            roles: ['guest'],
            role: 'guest',
            permissions: [],
            package_id: null,
        };
        setUserToken(null);
        setUser(guestUser);
        await AsyncStorage.setItem('userData', JSON.stringify(guestUser));
        await AsyncStorage.removeItem('userToken');
    };

    // Computed flags
    const isGuest = user?.id === 0;
    const isApproved = !!user && user.id !== 0 && user.is_approved === 1;
    const isUnapproved = !!user && user.id !== 0 && user.is_approved === 0;

    const value: AuthContextType = {
        userToken,
        user,
        isLoading,
        isGuest,
        isApproved,
        isUnapproved,
        login,
        register,
        logout,
        updateUser,
        guestLogin,
        verifyPhone,
        resendOtp,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);