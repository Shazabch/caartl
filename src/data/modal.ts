// src/data/models.ts

// ===================================
// CORE & SHARED MODELS
// ===================================

export interface Brand {
    id: number;
    name: string;
    image_source: string;
}

export interface VehicleModel {
    id: number;
    name: string;
}

export interface Feature {
    id: number;
    name: string;
}

// 🟢 UPDATED: Added service_type and paid_check
export interface ServiceLocation {
    id: number;
    service_name: string | null;
    service_amount: string | null;
    location: string | null;
    type: 'service' | 'location';
    created_at: string;
    updated_at: string;
    service_type?: string | null; // Fixed Fees vs Value Added
    paid_check?: string | null;   // 1 = Free/Discounted
}

export interface User {
    id: number;
    agent_id: number | null;
    is_approved: number;
    status?: string; // pending/active from register response
    name: string;
    email: string;
    email_verified_at: string | null;
    phone_verified_at: string | null;
    bio: string | null;
    phone: string | null;
    photo: string | null;
    target: string | null;
    created_at: string;
    updated_at: string;
    roles?: string[];
    role?: string;
    permissions?: string[];
    package_id?: number | null;
}

// ===================================
// INSPECTION MODELS
// ===================================

export interface Damage {
    id: number;
    type: string;
    body_part: string;
    severity: string;
    remark: string | null;
    x: number;
    y: number;
}

export interface InspectionReport {
    id: number;
    vehicle_id: number;
    inspected_at: string;
    damage_file_path: string | null;
    file_path: string | null;
    engineCondition: string | null;
    transmissionCondition: string | null;
    acCooling: string | null;
    suspension: string | null;
    paintCondition: string[] | null;
    engineOil: string | null;
    steeringOperation: string | null;
    damages: Damage[];
    [key: string]: any;
}

export interface InspectionResponse {
    status: string;
    data: InspectionReport;
}

// ===================================
// AUCTION & VEHICLE MODELS
// ===================================

export interface VehicleImage {
    id: number;
    vehicle_id: number;
    path: string;
    is_cover: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface Vehicle {
    id: number;
    title: string;
    slug: string;
    brand_id: number;
    vehicle_model_id: number;
    variant: string | null;
    year: number;
    body_type_id: number;
    fuel_type_id: number;
    transmission_id: number;
    mileage: number;
    engine_cc: number;
    horsepower: number;
    torque: number | null;
    seats: number | null;
    doors: number | null;
    color: string | null;
    interior_color: string | null;
    drive_type: string | null;
    vin: string;
    registration_no: string;
    price: string;
    negotiable: boolean;
    condition: 'new' | 'used' | string;
    description: string | null;
    status: 'published' | 'draft' | string;
    is_featured: boolean;
    view_count: number | null;
    sold_at: string | null;
    top_speed: string | null;
    is_auction: boolean;
    current_bid: number | null;
    engine_type: string | null;
    auction_start_date: string;
    auction_end_date: string;
    auction_location: string | null;
    shipping_information: string | null;
    reserve_status: string | null;
    auction_id: string | null;
    live_auction: boolean | null;
    no_of_cylinder: string | null;
    register_emirates: string | null;
    starting_bid_amount: number;
    zero_to_sixty: string | null;
    quater_mile: string | null;
    is_hot: number;
    inspected_by: string | null;
    pre_owned: number;
    remarks: string | null;
    trim: string | null;
    bid_control: number;
    created_at: string;
    updated_at: string;
    bids_count: number;
    brand: Brand;
    vehicle_model: VehicleModel;
    features?: Feature[];
    images?: VehicleImage[];
    cover_image?: VehicleImage | string | null;
    pivot?: {
        user_id: number;
        vehicle_id: number;
        created_at: string;
        updated_at: string;
    };
    inspections?: InspectionReport[];
}

// ===================================
// BIDDING & PACKAGES
// ===================================

export interface Booking {
    id: number;
    vehicle_id: number;
    user_id: number;
    total_amount: string;
    status: 'pending_payment' | 'intransfer' | 'completed' | 'cancelled' | string;
    created_at: string;
    vehicle: Vehicle;
}

export interface Bid {
    id: number;
    vehicle_id: number;
    user_id: number;
    bid_amount: number;
    bid_time: string;
    status: 'pending' | 'accepted' | 'rejected' | string;
    created_at: string;
    updated_at: string;
    current_bid: number | null;
    max_bid: number;
    user: {
        id: number;
        name: string;
    };
    vehicle?: Vehicle;
}

export interface Package {
    id: number;
    name: string;
    description: string;
    price: string;
    duration_days: number;
    features: string[];
    created_at: string;
    updated_at: string;
}

// ===================================
// API RESPONSE WRAPPERS
// ===================================

export interface LoginResponse {
    status: string;
    access_token: string;
    token_type: string;
    expires_in: number;
    user: User;
}

export interface RegisterResponse {
    status: string;
    message: string;
    token: string;
    user: User;
}

export interface UserProfileResponse {
    status: string;
    data: User;
}

export interface UpdateProfileResponse {
    status: string;
    message: string;
    data: User;
}

export interface LogoutResponse {
    status: string;
    message: string;
}

export interface ToggleFavoriteResponse {
    status: string;
    message: string;
    is_favorited: boolean;
}

export interface FavoritesListResponse {
    status: string;
    data: Vehicle[];
}

export interface AuctionDetailsResponse {
    status: string;
    data: {
        vehicle: Vehicle;
        main_image: string | null;
        tags: any[];
        exterior_features: Feature[];
        interior_features: Feature[];
        all_exterior_features: Feature[];
        all_interior_features: Feature[];
        inspections: InspectionReport[];
    };
}

export interface BiddingInfoResponse {
    status: string;
    data: {
        vehicle: Vehicle;
        total_bids: number;
        highest_bid: number;
        bids: Bid[];
        minimum_next_bid: number;
    };
}

export interface PlaceBidResponse {
    status: string;
    message: string;
    data: {
        id: number;
        vehicle_id: number;
        user_id: number;
        bid_amount: string;
        max_bid: string;
        created_at: string;
        updated_at: string;
    };
}

// ===================================
// GENERIC API WRAPPERS
// ===================================

export interface PaginatedResponse<T> {
    current_page: number;
    data: T[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: { url: string | null; label: string; active: boolean; }[];
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}

export interface ApiResponse<T> {
    status: string;
    data: T;
    message?: string;
}

export interface ApiResult<T> {
    success: boolean;
    status: number;
    data: T;
}

export interface UserPreference {
    id: number;
    user_id: number;
    name: string;
    price_from: string | number | null;
    price_to: string | number | null;
    year_form: string | number | null; // Matches API typo 'form' instead of 'from'
    year_to: string | number | null;
    mileage_form: string | number | null; // Matches API typo
    mileage_to: string | number | null;
    make: string | string[] | null; // Can be string "Toyota" or array
    model: string | null;
    body_type: string | null;
    specs: any; // Can be object or array
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Invoice {
    id: number;
    type: string; // 'booking' | 'package'
    booking_id: number | null;
    user_id: number;
    pdf_link: string | null;
    payment_slip: string | null;
    status: 'pending' | 'paid' | 'verified' | 'delivered' | string;
    created_at: string;
    updated_at: string;
    booking?: {
        id: number;
        total_amount: string;
        vehicle?: Vehicle;
    };
    user?: User;
}

// ===================================
// NOTIFICATIONS
// ===================================
export interface NotificationData {
    // Existing fields
    booking_id?: number;
    vehicle_id?: number;
    status?: string;
    vehicle_title?: string;
    invoice_id?: number;
    user_id?: number;
    user_name?: string;
    user_email?: string;
    type?: string;
    message?: string;

    // 🟢 Added new fields based on API response
    title?: string;
    bid_id?: number;
    link?: string;
    name?: string;
    email?: string;

    [key: string]: any;
}

export interface ApiNotification {
    id: number;
    type: string;
    read_at: string | null;
    created_at: string;
    updated_at: string;
    data: NotificationData; // your existing NotificationData type
}