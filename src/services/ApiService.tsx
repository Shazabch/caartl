// src/services/ApiService.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Models from '../data/modal';

export interface AuctionFilters {
  search?: string;
  make?: string;
  model?: string;
  make_id?: number;
  vehicle_model_id?: number;
  year?: number;
  condition?: string;
  min_price?: number;
  max_price?: number;
}

class ApiService {
  baseURL: string;

  constructor() {
    this.baseURL = 'https://api.caartl.com/api';
  }

  async getToken() {
    try {
      return await AsyncStorage.getItem('userToken');
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<Models.ApiResult<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const token = await this.getToken();
    const isFormData = !!options.body && typeof options.body === 'object' && typeof (options.body as any).append === 'function';

    const defaultOptions: RequestInit = {
      headers: {
        'Accept': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    if (!isFormData) {
      (defaultOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    const finalOptions: RequestInit = {
      ...defaultOptions,
      ...options,
      headers: { ...defaultOptions.headers, ...options.headers },
    };

    try {
      const response = await fetch(url, finalOptions);

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, status: 401, data: { message: 'Unauthorized' } as any };
        }
      }

      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error) {
      console.error(`API call error to ${endpoint}:`, error);
      return {
        success: false,
        status: 0,
        data: { message: 'Network error or invalid response format.' } as any,
      };
    }
  }

  // ... (Existing GET methods) ...

  async getLocations(): Promise<Models.ApiResult<{ data: Models.ServiceLocation[] }>> {
    return this.apiCall('/services-locations?type=location');
  }

  async getServices(): Promise<Models.ApiResult<{ data: Models.ServiceLocation[] }>> {
    return this.apiCall('/services-locations?type=service');
  }

  async getVehicleDetails(id: number): Promise<Models.ApiResult<{ status: string, data: Models.Vehicle }>> {
    return this.apiCall(`/admin/vehicles/show/${id}`);
  }

  // ... (Auth methods) ...

  async register(userData: any): Promise<Models.ApiResult<Models.RegisterResponse>> {
    return this.apiCall('/register', { method: 'POST', body: JSON.stringify(userData) });
  }

  async verifyPhone(phone: string, otp: string): Promise<Models.ApiResult<any>> {
    return this.apiCall('/verify-phone-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp })
    });
  }

  async resendOtp(phone: string): Promise<Models.ApiResult<any>> {
    return this.apiCall('/resend-phone-otp', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
  }

  async login(credentials: any): Promise<Models.ApiResult<Models.LoginResponse>> {
    return this.apiCall('/login', { method: 'POST', body: JSON.stringify(credentials) });
  }

  async logout(): Promise<Models.ApiResult<Models.LogoutResponse>> {
    return this.apiCall('/logout', { method: 'POST' });
  }

  async getUserProfile(): Promise<Models.ApiResult<Models.UserProfileResponse>> {
    return this.apiCall('/profile');
  }

  async updateUserProfile(userData: { name: string; email: string; phone: string; bio: string } | FormData): Promise<Models.ApiResult<Models.UpdateProfileResponse>> {
    const isFormPayload = !!userData && typeof userData === 'object' && typeof (userData as any).append === 'function';
    const body = isFormPayload ? userData as FormData : JSON.stringify(userData);
    return this.apiCall('/user/profile/update', { method: 'POST', body });
  }

  async changePassword(payload: { current_password: string; new_password: string; confirm_password: string }): Promise<Models.ApiResult<any>> {
    return this.apiCall('/user/profile/change-password', { method: 'POST', body: JSON.stringify(payload) });
  }

  async toggleFavorite(vehicleId: number): Promise<Models.ApiResult<Models.ToggleFavoriteResponse>> {
    return this.apiCall('/favorites/toggle', { method: 'POST', body: JSON.stringify({ vehicle_id: vehicleId }) });
  }

  async getFavorites(): Promise<Models.ApiResult<Models.FavoritesListResponse>> {
    return this.apiCall('/favorites');
  }



  // ... (Auction/Bid methods) ...

  async getAuctions(
    perPage: number = 10,
    page: number = 1,
    filters: AuctionFilters = {}
  ): Promise<Models.ApiResult<Models.ApiResponse<Models.PaginatedResponse<Models.Vehicle>>>> {
    let query = `/auctions?per_page=${perPage}&page=${page}`;
    if (filters.search) query += `&search=${encodeURIComponent(filters.search)}`;
    if (filters.make) query += `&make=${encodeURIComponent(filters.make)}`;
    else if (filters.make_id) query += `&make_id=${filters.make_id}`;
    if (filters.model) query += `&model=${encodeURIComponent(filters.model)}`;
    else if (filters.vehicle_model_id) query += `&vehicle_model_id=${filters.vehicle_model_id}`;
    if (filters.year) query += `&year=${filters.year}`;
    if (filters.condition) query += `&condition=${filters.condition}`;
    if (filters.min_price) query += `&min_price=${filters.min_price}`;
    if (filters.max_price) query += `&max_price=${filters.max_price}`;
    return this.apiCall(query);
  }

  async getListedVehicles(
    page: number = 1,
    filters: AuctionFilters = {}
  ): Promise<Models.ApiResult<Models.ApiResponse<Models.PaginatedResponse<Models.Vehicle>>>> {
    let query = `/auctions/listed?page=${page}`;
    if (filters.search) query += `&search=${encodeURIComponent(filters.search)}`;
    if (filters.make_id) query += `&make_id=${filters.make_id}`;
    if (filters.vehicle_model_id) query += `&vehicle_model_id=${filters.vehicle_model_id}`;
    if (filters.year) query += `&year=${filters.year}`;
    if (filters.condition) query += `&condition=${filters.condition}`;
    if (filters.min_price) query += `&min_price=${filters.min_price}`;
    if (filters.max_price) query += `&max_price=${filters.max_price}`;
    return this.apiCall(query);
  }

  async getAuctionDetails(id: number): Promise<Models.ApiResult<Models.AuctionDetailsResponse>> {
    return this.apiCall(`/auctions/show/${id}`);
  }

  async getInspectionReport(inspectionId: number): Promise<Models.ApiResult<Models.InspectionResponse>> {
    return this.apiCall(`/admin/inspection-reports/show/${inspectionId}`);
  }

  async getUserBiddings(): Promise<Models.ApiResult<{ status: string, data: Models.Bid[] }>> {
    return this.apiCall('/user/biddings');
  }

  async getAcceptedBids(): Promise<Models.ApiResult<{ status: string, data: Models.Bid[] }>> {
    return this.apiCall('/user/biddings?status=accepted');
  }

  async getUserBiddingHistory(vehicleId: number): Promise<Models.ApiResult<{ status: string, data: Models.Bid[] }>> {
    return this.apiCall(`/user/biddings?vehicle_id=${vehicleId}`);
  }

  async getBiddingInfo(auctionId: number): Promise<Models.ApiResult<Models.BiddingInfoResponse>> {
    return this.apiCall(`/biddings/${auctionId}`);
  }

  async placeBid(auctionId: number, bidData: { current_bid: number; max_bid: number }): Promise<Models.ApiResult<Models.PlaceBidResponse>> {
    return this.apiCall(`/place-bid/${auctionId}`, { method: 'POST', body: JSON.stringify(bidData) });
  }

  async getBidHistory(auctionId: number): Promise<Models.ApiResult<Models.ApiResponse<Models.Bid[]>>> {
    return this.apiCall(`/bid-history/${auctionId}`);
  }

  async getMyBookings(page = 1): Promise<Models.ApiResult<Models.ApiResponse<Models.PaginatedResponse<Models.Booking>>>> {
    return this.apiCall(`/get-bookings?page=${page}`);
  }

  async getBookingByVehicle(vehicleId: number): Promise<Models.ApiResult<any>> {
    return this.apiCall(`/get-bookings?vehicle_id=${vehicleId}`);
  }

  async bookNow(bookingData: FormData): Promise<Models.ApiResult<any>> {
    const url = `${this.baseURL}/bookings/book-now`;
    const token = await this.getToken();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: bookingData,
      });
      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error) {
      console.error('API call error to /bookings/book-now:', error);
      return { success: false, status: 0, data: { message: 'Network error.' } };
    }
  }

  async inquireCar(formData: FormData): Promise<Models.ApiResult<any>> {
    const url = `${this.baseURL}/buy-car`;
    const token = await this.getToken();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });
      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error) {
      console.error('API call error to /buy-car:', error);
      return { success: false, status: 0, data: { message: 'Network error.' } };
    }
  }

  async sellCar(formData: FormData): Promise<Models.ApiResult<any>> {
    const url = `${this.baseURL}/sell-car`;
    const token = await this.getToken();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });
      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error) {
      console.error('API call error to /sell-car:', error);
      return { success: false, status: 0, data: { message: 'Network error.' } };
    }
  }

  async submitAppointment(formData: FormData): Promise<Models.ApiResult<any>> {
    const url = `${this.baseURL}/appointment/submit`;
    const token = await this.getToken();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });
      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error) {
      console.error('API call error to /appointment/submit:', error);
      return { success: false, status: 0, data: { message: 'Network error.' } };
    }
  }

  // 🟢 NEW: Submit Contact
  async submitContact(formData: FormData): Promise<Models.ApiResult<any>> {
    const url = `${this.baseURL}/contact/submit`;
    const token = await this.getToken();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });
      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error) {
      console.error('API call error to /contact/submit:', error);
      return { success: false, status: 0, data: { message: 'Network error.' } };
    }
  }


  async saveNotificationToken(deviceToken: string, userId?: number): Promise<Models.ApiResult<any>> {
    const body: any = { device_token: deviceToken };
    if (userId) {
      body.user_id = userId;
    }

    return this.apiCall('/notifications/save-token', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async getNotifications(page: number = 1): Promise<Models.ApiResult<Models.ApiResponse<Models.PaginatedResponse<Models.ApiNotification>>>> {
    return this.apiCall(`/user/notifications?page=${page}`);
  }

  async markNotificationAsRead(id: string): Promise<Models.ApiResult<any>> {
    return this.apiCall(`/user/notifications/${id}/read`, { method: 'POST' });
    // Note: Usually marking read is POST/PUT, but based on your URL structure it might be GET. 
    // If your backend expects POST, change method to 'POST'.
  }

  async markAllNotificationsAsRead(): Promise<Models.ApiResult<any>> {
    return this.apiCall('/user/notifications/read-all', { method: 'POST' });
  }



  // ... (Other methods) ...

  async getInvoices(page: number = 1): Promise<Models.ApiResult<Models.ApiResponse<Models.PaginatedResponse<Models.Invoice>>>> {
    return this.apiCall(`/invoices?page=${page}`);
  }

  async uploadPaymentSlip(formData: FormData): Promise<Models.ApiResult<any>> {
    const url = `${this.baseURL}/invoices/upload-payment-slip`;
    const token = await this.getToken();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(Platform.OS !== 'web' && { 'Content-Type': 'multipart/form-data' }),
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });
      const data = await response.json();
      return { success: response.ok, status: response.status, data };
    } catch (error) {
      console.error('API call error to /invoices/upload-payment-slip:', error);
      return { success: false, status: 0, data: { message: 'Network error.' } };
    }
  }

  async getPreferences(): Promise<Models.ApiResult<{ data: Models.UserPreference[] }>> {
    return this.apiCall('/preferences/index');
  }

  async createPreference(data: any): Promise<Models.ApiResult<any>> {
    return this.apiCall('/preferences/create', { method: 'POST', body: JSON.stringify(data) });
  }

  async getPreferenceDetail(id: number): Promise<Models.ApiResult<{ data: Models.UserPreference }>> {
    return this.apiCall(`/preferences/show/${id}`);
  }

  async updatePreference(id: number, data: any): Promise<Models.ApiResult<any>> {
    return this.apiCall(`/preferences/update/${id}`, { method: 'POST', body: JSON.stringify(data) });
  }

  async deletePreference(id: number): Promise<Models.ApiResult<any>> {
    return this.apiCall(`/preferences/delete/${id}`, { method: 'DELETE' });
  }

  async getPackages(): Promise<Models.ApiResult<Models.ApiResponse<Models.PaginatedResponse<Models.Package>>>> {
    return this.apiCall('/admin/packages');
  }

  async getMakes(search: string = '') {
    let query = '/all-makes';
    if (search) query += `?search=${encodeURIComponent(search)}`;
    return this.apiCall<{ status: string, data: Models.Brand[] }>(query);
  }

  async getModels(makeId: number) {
    return this.apiCall<{ status: string, data: Models.VehicleModel[] }>(`/models/${makeId}`);
  }

  async getYears() {
    return this.apiCall<{ status: string, data: number[] }>('/years');
  }

  async storeUserData(user: Models.User, token: string) {
    try {
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      return true;
    } catch (error) {
      console.error('Error storing user data:', error);
      return false;
    }
  }

  async getUserData(): Promise<Models.User | null> {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) { return null; }
  }
}

export default new ApiService();