import { DrawerActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// Imports
import { Feather } from '@expo/vector-icons';
import { BottomNav } from '../../components/BottomNavigation';
import { CarCard } from '../../components/CarCard';
import { FilterPopup } from '../../components/FilterPopup';
import { ShimmerCarCard } from '../../components/ShimmerCarCard';
import { TopBar } from '../../components/TopBar';
import { useAlert } from '../../context/AlertContext';
import * as Models from '../../data/modal';
import { parseAuctionDateInDubai } from '../../lib/dubaiTime';
import { RootStackParamList } from '../../navigation/AppNavigator';
import apiService from '../../services/ApiService';

type HomeNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FilterState {
  condition?: string;
  make?: string;
  model?: string;
  make_id?: number;
  vehicle_model_id?: number;
  year?: number;
  min_price?: number;
  max_price?: number;
}

export const HomescreenLight = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const { showAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'negotiations'>('live');
  const [searchText, setSearchText] = useState('');
  const[filterVisible, setFilterVisible] = useState(false);

  // Filter State
  const [activeFilters, setActiveFilters] = useState<FilterState>({});

  // Data State
  const [auctions, setAuctions] = useState<Models.Vehicle[]>([]);
  const [negotiations, setNegotiations] = useState<Models.Vehicle[]>([]);

  // Loading & Pagination State
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const[refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const[hasMore, setHasMore] = useState(true);

  // ------------------------------------------------------------------
  // API Call - Auctions (Live & Upcoming)
  // ------------------------------------------------------------------
  const fetchAuctions = async (pageNumber: number, isRefresh = false, searchVal = searchText, filters = activeFilters) => {
    if (loadingMore && !isRefresh) return;
    if (pageNumber === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const queryParams = { search: searchVal, ...filters };
      const result = await apiService.getAuctions(10, pageNumber, queryParams as any);

      if (result.success && result.data.data) {
        const newVehicles = result.data.data.data;
        const currentPage = result.data.data.current_page;
        const lastPage = result.data.data.last_page;
        setHasMore(currentPage < lastPage);

        if (isRefresh || pageNumber === 1) {
          setAuctions(newVehicles);
        } else {
          setAuctions(prev => [...prev, ...newVehicles]);
        }
      } else {
        if (pageNumber === 1) setAuctions([]);
      }
    } catch (error) {
      console.error("Error fetching auctions:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  // ------------------------------------------------------------------
  // API Call - Negotiations (Accepted Bids)
  // ------------------------------------------------------------------
  const fetchNegotiations = async () => {
    setLoading(true);
    try {
      const result = await apiService.apiCall<{ data: any[] }>('/user/biddings?status=accepted');

      if (result.success && Array.isArray(result.data.data)) {
        
        // 🟢 Sort by latest updated_at or created_at (Descending)
        const sortedData = result.data.data.sort((a: any, b: any) => {
            const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
            const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
            return dateB - dateA;
        });

        const negotiationVehicles = sortedData.map((bid: any) => {
          const vehicle = { ...bid.vehicle }; 
          if (bid.bid_amount) {
            vehicle.current_bid = bid.bid_amount;
          }
          return vehicle;
        });
        setNegotiations(negotiationVehicles);
      } else {
        setNegotiations([]);
      }
    } catch (error) {
      console.error("Error fetching negotiations:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ------------------------------------------------------------------
  // Main Fetch Controller
  // ------------------------------------------------------------------
  const loadData = (isRefresh = false) => {
    if (activeTab === 'negotiations') {
      fetchNegotiations();
    } else {
      fetchAuctions(1, isRefresh, searchText, activeFilters);
    }
  };

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadData();
  }, [activeTab]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadData(true);
  };

  const handleLoadMore = () => {
    if (activeTab !== 'negotiations' && !loadingMore && !loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchAuctions(nextPage, false, searchText, activeFilters);
    }
  };

  const handleSearchSubmit = () => {
    if (activeTab === 'negotiations') return; // Handled locally
    setPage(1);
    setHasMore(true);
    fetchAuctions(1, true, searchText, activeFilters);
  };

  const applyFilters = (newFilters: FilterState) => {
    setActiveFilters(newFilters);
    
    if (activeTab === 'negotiations') return; // Handled locally
    
    setPage(1);
    setHasMore(true);
    setAuctions([]);
    fetchAuctions(1, true, searchText, newFilters);
  };

  const clearAllFilters = () => {
    setSearchText('');
    const emptyFilters = {};
    setActiveFilters(emptyFilters);
    
    if (activeTab === 'negotiations') return; // Handled locally
    
    setPage(1);
    setHasMore(true);
    fetchAuctions(1, true, '', emptyFilters);
  };

  const removeFilter = (key: keyof FilterState) => {
    const newFilters = { ...activeFilters };
    delete newFilters[key];
    if (key === 'make') delete newFilters['make_id'];
    if (key === 'model') delete newFilters['vehicle_model_id'];
    applyFilters(newFilters);
  };

  const handleMenuPress = () => navigation.dispatch(DrawerActions.openDrawer());

  const handleTabPress = (tabId: 'live' | 'upcoming' | 'negotiations') => {
    if (activeTab !== tabId) {
      setAuctions([]);
      setNegotiations([]);
      setActiveTab(tabId);
    }
  };

  const handleCarPress = (car: Models.Vehicle) => {
    if (activeTab === 'live') {
      navigation.navigate('LiveAuction', { carId: car.id, viewType: 'live' });
    } else if (activeTab === 'upcoming') {
      navigation.navigate('LiveAuction', { carId: car.id, viewType: 'upcoming' });
    } else if (activeTab === 'negotiations') {
      navigation.navigate('LiveAuction', { carId: car.id, viewType: 'negotiation' });
    } else {
      navigation.navigate('CarDetailPage', { carId: car.id });
    }
  };

  // ------------------------------------------------------------------
  // Render Helper with LOCAL FILTERING for Negotiations
  // ------------------------------------------------------------------
  const getDisplayData = () => {
    let dataToDisplay =[];

    // 1. Separate basic list
    if (activeTab === 'negotiations') {
      dataToDisplay = negotiations;
    } else {
      const now = new Date();
      dataToDisplay = auctions.filter(car => {
        const start = parseAuctionDateInDubai(car.auction_start_date);
        const end = parseAuctionDateInDubai(car.auction_end_date);

        if (!start || !end) return false;

        if (activeTab === 'live') return now >= start && now <= end;
        if (activeTab === 'upcoming') return now < start;
        return true;
      });
    }

    // 2. 🟢 Apply Local Filters exclusively for Negotiations 
    // (Because API filters only work on auctions)
    if (activeTab === 'negotiations') {
      const { condition, make_id, vehicle_model_id, year, min_price, max_price } = activeFilters;
      const hasSearch = searchText.trim().length > 0;
      const searchLower = searchText.trim().toLowerCase();

      dataToDisplay = dataToDisplay.filter(car => {
        // --- Search Match ---
        if (hasSearch) {
          const titleMatch = car.title?.toLowerCase().includes(searchLower);
          const brandMatch = car.brand?.name?.toLowerCase().includes(searchLower);
          const modelMatch = car.vehicle_model?.name?.toLowerCase().includes(searchLower);
          if (!titleMatch && !brandMatch && !modelMatch) return false;
        }

        // --- Filters Match ---
        if (make_id && car.brand_id !== make_id) return false;
        if (vehicle_model_id && car.vehicle_model_id !== vehicle_model_id) return false;
        if (year && car.year !== year) return false;
        if (condition && car.condition?.toLowerCase() !== condition) return false;

        // --- Price Match ---
        const price = Number(car.current_bid || car.price || car.starting_bid_amount || 0);
        if (min_price && price < min_price) return false;
        if (max_price && price > max_price) return false;

        return true;
      });
    }

    return dataToDisplay;
  };

  const displayData = getDisplayData();

  const activeFilterKeys = Object.entries(activeFilters).filter(([key, val]) => {
    return val !== null && val !== undefined && val !== '' && !key.includes('_id');
  });
  const hasActiveFilters = searchText.length > 0 || activeFilterKeys.length > 0;

  return (
    <View style={styles.container}>
      <TopBar onMenuPress={handleMenuPress} />


      {/* Always show search, filters, and tabs. Only shimmer the card list area below. */}
      <FlatList
        data={loading ?[] : displayData}
        keyExtractor={(item) => item.id?.toString?.() ?? Math.random().toString()}
        renderItem={({ item }) => (
          <CarCard
            car={item}
            onPress={handleCarPress}
            variant={activeTab === 'negotiations' ? 'negotiation' : activeTab}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}

        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#cadb2a" />
        }

        ListHeaderComponent={
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Circle cx="11" cy="11" r="8" stroke="#8c9199" strokeWidth="2" /><Path d="M21 21L16.65 16.65" stroke="#8c9199" strokeWidth="2" strokeLinecap="round" /></Svg>
                <TextInput
                  placeholder="Search..."
                  placeholderTextColor="#8c9199"
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                />
                <TouchableOpacity onPress={() => setFilterVisible(true)}>
                  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none"><Path d="M14 17H5" stroke="#8c9199" strokeWidth={2} strokeLinecap="round" /><Path d="M19 7h-9" stroke="#8c9199" strokeWidth={2} strokeLinecap="round" /><Circle cx={17} cy={17} r={3} stroke="#8c9199" strokeWidth={2} /><Circle cx={7} cy={7} r={3} stroke="#8c9199" strokeWidth={2} /></Svg>
                </TouchableOpacity>
              </View>
            </View>

            {/* 🟢 Active Filters Section */}
            {hasActiveFilters && (
              <View style={styles.activeFiltersContainer}>
                <TouchableOpacity onPress={clearAllFilters} style={styles.clearAllButton}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  {searchText ? (
                    <View style={styles.filterChip}>
                      <Text style={styles.filterChipText}>"{searchText}"</Text>
                      <TouchableOpacity onPress={() => { setSearchText(''); handleSearchSubmit(); }}>
                        <Feather name="x" size={14} color="#000" style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {activeFilterKeys.map(([key, value]) => {
                    let label = key.replace('_', ' ');
                    label = label.charAt(0).toUpperCase() + label.slice(1);
                    let displayValue = value;
                    if (key === 'condition' && typeof value === 'string') {
                      displayValue = value.charAt(0).toUpperCase() + value.slice(1);
                    }

                    return (
                      <View key={key} style={styles.filterChip}>
                        <Text style={styles.filterChipText}>{label}: {displayValue}</Text>
                        <TouchableOpacity onPress={() => removeFilter(key as keyof FilterState)}>
                          <Feather name="x" size={14} color="#000" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.tabContainer}>
              {['live', 'upcoming', 'negotiations'].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
                  onPress={() => handleTabPress(tab as any)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {loading && (
              <View style={{ marginTop: 10, paddingBottom: 100 }}>
                {[1, 2, 3, 4].map((_, idx) => (
                  <ShimmerCarCard key={idx} />
                ))}
              </View>
            )}
          </>
        }

        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color="#cadb2a" style={{ marginVertical: 20 }} /> : <View style={{ height: 100 }} />
        }

        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                 {activeTab === 'negotiations' ? 'No Negotiations Found.' : 'No Auctions Found.'}
              </Text>
            </View>
          ) : null
        }
      />

      <FilterPopup
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        onApply={applyFilters}
        currentFilters={activeFilters}
      />

      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  listContent: { paddingTop: 80, paddingHorizontal: 26 },
  searchContainer: { marginBottom: 15 },
  searchBar: { height: 49, backgroundColor: '#edeeef', borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, justifyContent: 'space-between' },
  searchInput: { flex: 1, fontFamily: 'Poppins', fontSize: 14, color: '#000000', marginHorizontal: 12 },

  // Filter Chips Styles
  activeFiltersContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, height: 30 },
  clearAllButton: { marginRight: 10, paddingVertical: 5 },
  clearAllText: { color: '#cadb2a', fontSize: 12, fontFamily: 'Poppins', fontWeight: '600', textDecorationLine: 'underline' },
  filterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#cadb2a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginRight: 8 },
  filterChipText: { color: '#000', fontSize: 11, fontFamily: 'Poppins', fontWeight: '600' },

  tabContainer: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  tabButton: { height: 37, borderRadius: 5, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  tabButtonActive: { backgroundColor: '#cadb2a' },
  tabText: { fontFamily: 'Poppins', fontWeight: '500', fontSize: 14, color: '#ffffff' },
  activeTabText: { color: '#010101' },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyStateText: { color: '#8c9199', fontFamily: 'Poppins', fontSize: 16 },
});