import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ResizeMode, Video } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  FlatList, Gesture,
  GestureDetector,
  GestureHandlerRootView,
  Pressable
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import CustomAlert from '../components/ui/CustomAlert';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import * as Models from '../data/modal';
import { RootStackParamList } from '../navigation/AppNavigator';
import apiService from '../services/ApiService';

type LiveAuctionRouteProp = RouteProp<RootStackParamList, 'LiveAuction'>;
type LiveAuctionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LiveAuction'>;

const { width, height } = Dimensions.get('window');
const STORAGE_BASE_URL = 'https://api.caartl.com/storage/';
const TAB_BAR_HEIGHT = 60;

// ==========================================
// 1. CUSTOM ZOOMABLE IMAGE COMPONENT
// ==========================================
const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);

const ZoomableImage = ({ uri, onRequestScrollToggle, isRotated = false }: { uri: string, onRequestScrollToggle: (locked: boolean) => void, isRotated?: boolean }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetZoom = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    runOnJS(setIsZoomed)(false);
    runOnJS(onRequestScrollToggle)(false);
  };

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      runOnJS(setIsZoomed)(true);
      runOnJS(onRequestScrollToggle)(true);
    })
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
      if (scale.value < 1) scale.value = 1;
      if (scale.value > 5) scale.value = 5;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.1) {
        resetZoom();
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1.1) {
        const maxTranslateX = (width * (scale.value - 1)) / 2;
        const maxTranslateY = (height * 0.8 * (scale.value - 1)) / 2;
        translateX.value = Math.min(Math.max(savedTranslateX.value + e.translationX, -maxTranslateX), maxTranslateX);
        translateY.value = Math.min(Math.max(savedTranslateY.value + e.translationY, -maxTranslateY), maxTranslateY);
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.1) {
        resetZoom();
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
        runOnJS(setIsZoomed)(true);
        runOnJS(onRequestScrollToggle)(true);
      }
    });

  const composed = isZoomed
    ? Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture)
    : Gesture.Simultaneous(pinchGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => {
    const t: any[] = [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ];
    if (isRotated) {
      t.push({ rotate: '90deg' });
    }
    return { transform: t };
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <AnimatedExpoImage
          source={{ uri }}
          style={[
            isRotated ? { width: height * 0.8, height: width } : { width: '100%', height: '80%' },
            animatedStyle
          ]}
          contentFit="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
};

// ==========================================
// 2. MODAL COMPONENTS
// ==========================================

const ImagePreviewModal = ({ visible, images = [], initialIndex = 0, onClose, isWhiteBackground = false, isRotated = false }: any) => {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  useEffect(() => {
    if (visible && images.length > 0) {
      setCurrentIndex(initialIndex);
      setScrollEnabled(true);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex, images]);

  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(idx);
  };

  const handleScrollToggle = (locked: boolean) => {
    setScrollEnabled(!locked);
  };

  return (
    <Modal visible={visible} transparent={true} onRequestClose={onClose} animationType="fade">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.previewContainer, isWhiteBackground && styles.previewContainerWhite]}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={onClose}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            zIndex={20}
          >
            <Feather name="x" size={30} color={isWhiteBackground ? "#000" : "#fff"} />
          </TouchableOpacity>

          <FlatList
            ref={flatListRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={scrollEnabled}
            keyExtractor={(_, index) => index.toString()}
            onMomentumScrollEnd={onScroll}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            initialScrollIndex={initialIndex}
            waitFor={scrollEnabled ? undefined : undefined}
            renderItem={({ item }) => (
              <View style={{ width: width, height: height, justifyContent: 'center' }}>
                <ZoomableImage
                  uri={item}
                  onRequestScrollToggle={handleScrollToggle}
                  isRotated={isRotated}
                />
              </View>
            )}
          />

          {images.length > 1 && (
            <View style={styles.previewPagination}>
              {images.map((_: any, i: number) => (
                <View key={i} style={[styles.dot, i === currentIndex && styles.activeDot]} />
              ))}
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const VideoPlayerModal = ({ visible, videoUrl, onClose }: any) => (
  <Modal visible={visible} transparent={true} onRequestClose={onClose} animationType="slide">
    <View style={styles.videoModalContainer}>
      <TouchableOpacity style={styles.videoCloseBtn} onPress={onClose}><Feather name="x" size={30} color="#fff" /></TouchableOpacity>
      {videoUrl ? (
        <Video
          source={{ uri: videoUrl }}
          rate={1.0}
          volume={1.0}
          isMuted={false}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          useNativeControls
          style={styles.fullscreenVideo}
          onError={(e) => console.log("Video Error:", e)}
        />
      ) : (
        <ActivityIndicator size="large" color="#cadb2a" />
      )}
    </View>
  </Modal>
);

const InspectionAccordion = ({ title, children, isOpen, onPress }: any) => (
  <View style={styles.accordionContainer}>
    <TouchableOpacity style={styles.accordionHeader} onPress={onPress}>
      <Text style={styles.accordionTitle}>{title}</Text>
      <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#cadb2a" />
    </TouchableOpacity>
    {isOpen && <View style={styles.accordionContent}>{children}</View>}
  </View>
);

const getPaintBadgeColor = (condition: string) => {
  const parts = condition.split(':');
  let colorName = '#333';
  let label = condition;

  if (parts.length > 1) {
    const colorKey = parts[0].trim().toLowerCase();
    label = parts[1].trim();

    switch (colorKey) {
      case 'red': colorName = '#ff4444'; break;
      case 'blue': colorName = '#4488ff'; break;
      case 'green': colorName = '#2ecc71'; break;
      case 'orange': colorName = '#e67e22'; break;
      case 'yellow': colorName = '#f1c40f'; break;
      case 'pink': colorName = '#e91e63'; break;
      case 'purple': colorName = '#9b59b6'; break;
      default: colorName = '#555';
    }
  } else if (condition.toLowerCase().includes('original')) {
    colorName = '#27ae60';
  }

  return { backgroundColor: colorName, label };
};

const getSeverityBorderColor = (severity: string) => {
  const s = (severity || "").toLowerCase();
  if (s.includes('minor')) return '#4488ff';
  if (s.includes('moderate')) return '#e67e22';
  if (s.includes('major') || s.includes('severe')) return '#ff4444';
  return '#333';
};

const formatEndedDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T'));
  return `Auction Ended ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const formatStartDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T'));
  return `Auction Starts ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const parseAuctionDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const parsed = new Date(String(dateStr).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// ==========================================
// MAIN SCREEN
// ==========================================
export default function LiveCarAuctionScreen() {
  const navigation = useNavigation<LiveAuctionScreenNavigationProp>();
  const route = useRoute<LiveAuctionRouteProp>();
  const carId = route.params?.carId;
  const viewType = route.params?.viewType || 'live';

  const { showAlert } = useAlert();
  const { isGuest, isUnapproved } = useAuth();
  const [showLoginAlert, setShowLoginAlert] = useState(false);
  const [showApprovalAlert, setShowApprovalAlert] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fullData, setFullData] = useState<Models.AuctionDetailsResponse['data'] | null>(null);
  const [biddingData, setBiddingData] = useState<Models.BiddingInfoResponse['data'] | null>(null);
  const [negotiationBid, setNegotiationBid] = useState<any | null>(null);

  const [bookingStatus, setBookingStatus] = useState<'none' | 'pending_payment' | 'intransfer' | 'delivered'>('none');
  const [bookingData, setBookingData] = useState<any>(null);

  const [damageTypes, setDamageTypes] = useState<any[]>([]);
  const biddingDataRef = useRef<Models.BiddingInfoResponse['data'] | null>(null);

  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const [myBid, setMyBid] = useState<number>(0);
  const [isBidSheetVisible, setIsBidSheetVisible] = useState(false);

  const [isAutoBidSheetVisible, setIsAutoBidSheetVisible] = useState(false);
  const [maxBid, setMaxBid] = useState<number>(0);

  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPreviewMap, setIsPreviewMap] = useState(false);

  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [loadedBannerCount, setLoadedBannerCount] = useState(3);
  const [bannerSlideWidth, setBannerSlideWidth] = useState(width);
  const [activeInspectionIndex, setActiveInspectionIndex] = useState(0);
  const lastBannerIndexRef = useRef(0);

  const [showFaultsList, setShowFaultsList] = useState(false);

  const [expandedDamageCategories, setExpandedDamageCategories] = useState<{ [key: string]: boolean }>({});
  const [activeAccordion, setActiveAccordion] = useState<string | null>('Engine & Transmission');

  const [activeTab, setActiveTab] = useState('Car Details');
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionYCoords = useRef<{ [key: string]: number }>({});
  const isManualScroll = useRef(false);

  const [showStickyTimer, setShowStickyTimer] = useState(false);
  const timerBarHeight = useSharedValue(0);
  const timerBarOpacity = useSharedValue(0);

  const timerBarAnimatedStyle = useAnimatedStyle(() => ({
    height: timerBarHeight.value,
    opacity: timerBarOpacity.value,
  }));

  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useSharedValue(0);

  const toastAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: withTiming(toastOpacity.value === 1 ? 0 : 20) }]
  }));

  const showToast = (message: string) => {
    setToastMessage(message);
    toastOpacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(2000, withTiming(0, { duration: 300 }))
    );
  };

  const liveAuctionStatus = useMemo<'live' | 'upcoming' | 'ended' | 'unknown'>(() => {
    if (viewType !== 'live') return 'unknown';

    const sourceVehicle = biddingData?.vehicle || fullData?.vehicle;
    const startDate = parseAuctionDate(sourceVehicle?.auction_start_date);
    const endDate = parseAuctionDate(sourceVehicle?.auction_end_date);

    if (!startDate || !endDate) return 'unknown';

    const now = new Date();
    if (now < startDate) return 'upcoming';
    if (now >= endDate) return 'ended';
    return 'live';
  }, [viewType, biddingData?.vehicle, fullData?.vehicle]);

  const ensureLiveAuctionOpen = (action: 'navigate' | 'bid'): boolean => {
    if (viewType !== 'live') return true;

    if (liveAuctionStatus === 'ended') {
      showAlert('Auction Ended', 'This auction has already ended. Bidding is no longer available.');
      if (action === 'bid') {
        setIsBidSheetVisible(false);
        setIsAutoBidSheetVisible(false);
      }
      return false;
    }

    if (liveAuctionStatus === 'upcoming') {
      showAlert('Auction Not Started', 'This auction has not started yet. You cannot place bids right now.');
      if (action === 'bid') {
        setIsBidSheetVisible(false);
        setIsAutoBidSheetVisible(false);
      }
      return false;
    }

    return true;
  };

  useEffect(() => {
    if (showStickyTimer && viewType === 'live' && liveAuctionStatus === 'live' && bookingStatus === 'none' && !isBidSheetVisible && !isAutoBidSheetVisible) {
      timerBarHeight.value = withTiming(200, { duration: 300 });
      timerBarOpacity.value = withTiming(1, { duration: 300 });
    } else {
      timerBarHeight.value = withTiming(0, { duration: 200 });
      timerBarOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [showStickyTimer, viewType, liveAuctionStatus, bookingStatus, isBidSheetVisible, isAutoBidSheetVisible]);

  const getDamageBadgeColor = (damageType: string) => {
    const found = damageTypes.find(d => d.name.toLowerCase() === damageType.toLowerCase());
    return found ? found.color : '#ff4444';
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const detailsRes = await apiService.getAuctionDetails(carId);
        if (detailsRes.success && detailsRes.data.data) {
          setFullData(detailsRes.data.data);
        }

        if (viewType === 'negotiation') {
          const negRes = await apiService.apiCall<{ data: any[] }>(`/user/biddings?vehicle_id=${carId}&status=accepted`);
          if (negRes.success && negRes.data.data && negRes.data.data.length > 0) {
            setNegotiationBid(negRes.data.data[0]);
          }
        }

        const bookRes = await apiService.getBookingByVehicle(carId);
        if (bookRes.success && bookRes.data.data && bookRes.data.data.data.length > 0) {
          const latestBooking = bookRes.data.data.data[0];
          setBookingData(latestBooking);
          setBookingStatus(latestBooking.status);
        }

        const dmgRes = await apiService.apiCall<any>('/admin/inspection-reports/damage-types');
        if (dmgRes.success && Array.isArray(dmgRes.data.data)) {
          setDamageTypes(dmgRes.data.data);
        }

      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [carId, viewType]);

  const toggleDamageCategory = (category: string) => {
    setExpandedDamageCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const fetchLiveBidData = useCallback(async () => {
    try {
      const result = await apiService.getBiddingInfo(carId);
      if (result.success && result.data.data) {
        const data = result.data.data;
        setBiddingData(data);
        biddingDataRef.current = data;
        if (!isBidSheetVisible && !isAutoBidSheetVisible) {
          if (data.minimum_next_bid) {
            setMyBid(data.minimum_next_bid);
            setMaxBid(data.minimum_next_bid);
          } else {
            const current = data.highest_bid || 0;
            const increment = Number(data.vehicle.bid_control || 100);
            setMyBid(current + increment);
            setMaxBid(current + increment);
          }
        }
      }
    } catch (error) {
      console.error("Live fetch error:", error);
    }
  }, [carId, isBidSheetVisible, isAutoBidSheetVisible]);

  useEffect(() => {
    if (viewType === 'live') {
      fetchLiveBidData();
      const interval = setInterval(fetchLiveBidData, 3000);
      return () => clearInterval(interval);
    }
  }, [carId, viewType, fetchLiveBidData]);

  useEffect(() => {
    if (viewType === 'negotiation') return;

    const timer = setInterval(() => {
      const vehicleData = biddingDataRef.current?.vehicle || fullData?.vehicle;
      if (!vehicleData) return;

      const now = new Date();
      const shouldCountToStart = viewType === 'upcoming' || (viewType === 'live' && liveAuctionStatus === 'upcoming');
      const targetDateStr = shouldCountToStart ? vehicleData.auction_start_date : vehicleData.auction_end_date;
      const targetDate = new Date(targetDateStr.replace(' ', 'T'));
      const difference = +targetDate - +now;

      if (difference > 0) {
        setCountdown({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }

      if (viewType === 'live' && biddingDataRef.current?.bids && biddingDataRef.current.bids.length > 0) {
        const lastBidTime = new Date(biddingDataRef.current.bids[0].updated_at);
        const elapsed = +now - +lastBidTime;
        if (elapsed >= 0) {
          const totalSeconds = Math.floor(elapsed / 1000);
          const m = Math.floor(totalSeconds / 60);
          const s = totalSeconds % 60;
          setElapsedTime(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [viewType, fullData, biddingData, liveAuctionStatus]);

  const handleLayout = (e: LayoutChangeEvent, section: string) => {
    sectionYCoords.current[section] = e.nativeEvent.layout.y;
  };

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    isManualScroll.current = true;
    requestAnimationFrame(() => {
      const y = sectionYCoords.current[tab];
      if (y !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: y - TAB_BAR_HEIGHT + 10, animated: true });
      }
    });
    setTimeout(() => { isManualScroll.current = false; }, 400);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isManualScroll.current) return;
    const scrollY = event.nativeEvent.contentOffset.y;
    setShowStickyTimer(scrollY > 150);

    const triggerPoint = scrollY + TAB_BAR_HEIGHT + 150;
    let currentTab = dynamicTabs[0];
    for (const tab of dynamicTabs) {
      const sectionY = sectionYCoords.current[tab];
      if (sectionY !== undefined && triggerPoint >= sectionY) {
        currentTab = tab;
      }
    }
    if (currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  };

  const handleIncrement = () => setMyBid(prev => prev + Number(biddingData?.vehicle.bid_control || 100));
  const handleDecrement = () => {
    const minNext = biddingData?.minimum_next_bid || 0;
    if (myBid - Number(biddingData?.vehicle.bid_control || 100) >= minNext) setMyBid(prev => prev - Number(biddingData?.vehicle.bid_control || 100));
  };

  const handleAutoBidIncrement = () => setMaxBid(prev => prev + Number(biddingData?.vehicle.bid_control || 100));
  const handleAutoBidDecrement = () => {
    const minNext = biddingData?.minimum_next_bid || 0;
    if (maxBid - Number(biddingData?.vehicle.bid_control || 100) >= minNext) setMaxBid(prev => prev - Number(biddingData?.vehicle.bid_control || 100));
  };

  const handlePlaceBid = async () => {
    if (isGuest) { setShowLoginAlert(true); return; }
    if (isUnapproved) { setShowApprovalAlert(true); return; }
    if (!ensureLiveAuctionOpen('bid')) return;
    if (!biddingData?.vehicle) return;
    setSubmitting(true);
    try {
      const result = await apiService.placeBid(biddingData.vehicle.id, { current_bid: myBid, max_bid: myBid });
      if (result.success) {
        showToast('Bid placed successfully!');
        fetchLiveBidData();
        setIsBidSheetVisible(false);
      } else {
        showAlert('Error', result.data.message || 'Failed to place bid.');
      }
    } catch (error) {
      showAlert('Error', 'Network error while bidding.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoBid = async () => {
    if (isGuest) { setShowLoginAlert(true); return; }
    if (isUnapproved) { setShowApprovalAlert(true); return; }
    if (!ensureLiveAuctionOpen('bid')) return;
    if (!biddingData?.vehicle) return;
    setSubmitting(true);
    try {
      const result = await apiService.placeBid(biddingData.vehicle.id, {
        current_bid: biddingData.minimum_next_bid || biddingData.highest_bid || 0,
        max_bid: maxBid,
        is_auto: true
      });
      if (result.success) {
        showToast('Auto bid placed successfully!');
        fetchLiveBidData();
        setIsAutoBidSheetVisible(false);
      } else {
        showAlert('Error', result.data.message || 'Failed to place auto bid.');
      }
    } catch (error) {
      showAlert('Error', 'Network error while bidding.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookNow = () => {
    if (fullData?.vehicle) {
      navigation.navigate('BookCar', { vehicle: fullData.vehicle });
    } else {
      showAlert("Error", "Vehicle data not available for booking.");
    }
  };

  const handleViewBooking = () => {
    navigation.navigate('ViewBooking', { vehicleId: carId });
  };

  const openBidSheet = () => {
    if (!ensureLiveAuctionOpen('navigate')) return;
    setIsBidSheetVisible(true);
  };

  const openAutoBidSheet = () => {
    if (!ensureLiveAuctionOpen('navigate')) return;
    setIsAutoBidSheetVisible(true);
  };

  const handleImageOpen = (imagesList: string[], index: number, isMap: boolean = false) => {
    setPreviewImages(imagesList);
    setPreviewIndex(index);
    setIsPreviewMap(isMap);
  };

  const handleVideoOpen = (uri: string) => {
    setCurrentVideoUrl(uri);
    setVideoModalVisible(true);
  };

  const getHeaderTitle = () => {
    if (viewType === 'negotiation') return 'Negotiation';
    if (viewType === 'upcoming') return 'Upcoming Auction';
    return 'Live Auction';
  };

  const latestInspection = useMemo(() => {
    if (!fullData?.inspections && !fullData?.vehicle?.inspections) return null;
    const list = fullData.inspections || fullData.vehicle.inspections || [];
    return list.length > 0 ? list[list.length - 1] : null;
  }, [fullData]);

  // 🟢 Helper to get media specifically for the inspection sections
  const getMediaForLabel = useCallback((label: string) => {
    if (!latestInspection?.fields) return null;
    // Find field by matching the name without spaces or special characters
    const normalize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const field = latestInspection.fields.find((f: any) => normalize(f.name) === normalize(label));
    if (field && field.files && field.files.length > 0) {
      return field.files[0];
    }
    return null;
  }, [latestInspection]);

  // For older CarDetails specific logic
  const getFieldMedia = (fieldName: string) => getMediaForLabel(fieldName);

  const allFieldImages = useMemo(() => {
    if (!latestInspection?.fields) return [];
    const images: string[] = [];
    latestInspection.fields.forEach((field: any) => {
      field.files?.forEach((file: any) => {
        if (file.file_type !== 'video') {
          const path = file.path.startsWith('http') ? file.path : `${STORAGE_BASE_URL}${file.path}`;
          images.push(path);
        }
      });
    });
    return images;
  }, [latestInspection]);

  const carDetailItems = useMemo(() => {
    if (!fullData?.vehicle) return [];
    const v = fullData.vehicle;
    const i = latestInspection;
    const val = (value: any) => (value !== null && value !== undefined && value !== '') ? value : 'N/A';

    return [
      { label: 'Make', value: v.brand?.name },
      { label: 'Model', value: v.vehicle_model?.name },
      { label: 'Trim', value: val(v.trim || i?.trim) },
      { label: 'Year', value: v.year },
      { label: 'Odometer Reading (KM/M)', value: `${val(i?.odometer || v.mileage)} KM` },
      { label: 'Registered Emirates', value: val(i?.registerEmirates || v.register_emirates), media: getFieldMedia('registerEmirates') },
      { label: 'Engine CC', value: v.engine_cc },
      { label: 'No. of Cylinders', value: v.no_of_cylinder },
      { label: 'Horsepower (in BHP)', value: v.horsepower },
      { label: 'Body Type', value: val(i?.body_type || v.body_type_id === 1 ? 'Sports' : 'Sedan') },
      { label: 'Specs', value: val(v.specs || i?.specs) },
      { label: 'Transmission Type', value: val(i?.transmission || (v.transmission_id === 1 ? 'Automatic' : 'Manual')) },
      { label: 'Color', value: val(i?.color || v.color), media: getFieldMedia('color') },
      { label: 'Service History', value: val(i?.serviceHistory) },
      { label: 'No. of Keys', value: val(i?.noOfKeys) },
      { label: 'Warranty Available', value: val(i?.warrantyAvailable) },
      { label: 'Service Contract Available', value: val(i?.serviceContractAvailable), fullWidth: true },
    ];
  }, [fullData, latestInspection]);

  // 🟢 Updated inspectionSections to include media checking for every single field
  const inspectionSections = useMemo(() => {
    if (!latestInspection) return [];

    const i = latestInspection;
    const getVal = (key: string) => i[key] || "N/A";
    const getArr = (key: string) => Array.isArray(i[key]) && i[key].length > 0 ? i[key].join(", ") : "No visible fault";

    const getColor = (val: string) => {
      const v = String(val).toLowerCase();
      if (v.includes('no leak') || v.includes('no visible') || v.includes('available') || v.includes('original') || v.includes('good')) return '#cadb2a';
      if (v.includes('minor') || v.includes('moderate')) return '#ffaa00';
      if (v.includes('worn') || v.includes('major') || v.includes('severe') || v.includes('fail')) return '#ff4444';
      return '#fff';
    };

    return [
      {
        title: "Engine & Transmission",
        rows: [
          [{ label: "Engine Oil", value: getVal('engineOil'), media: getMediaForLabel('Engine Oil') }, { label: "Gear Oil", value: getVal('gearOil'), media: getMediaForLabel('Gear Oil') }],
          [{ label: "Engine Noise", value: getVal('engineNoise'), media: getMediaForLabel('Engine Noise') }, { label: "Engine Smoke", value: getVal('engineSmoke'), media: getMediaForLabel('Engine Smoke') }],
          [{ label: "Gear Shifting", value: getVal('gearshifting'), media: getMediaForLabel('Gear Shifting') }, { label: "4WD System", value: getVal('fourWdSystemCondition'), media: getMediaForLabel('4WD System') }],
        ],
        comment: i.remarks || "No remarks."
      },
      {
        title: "Steering, Suspension & Brakes",
        rows: [
          [{ label: "Brake Pads", value: getVal('brakePads'), media: getMediaForLabel('Brake Pads') }, { label: "Brake Discs", value: getArr('brakeDiscs'), media: getMediaForLabel('Brake Discs') }],
          [{ label: "Suspension", value: getVal('suspension'), media: getMediaForLabel('Suspension') }, { label: "Shock Absorber", value: getArr('shockAbsorberOperation'), media: getMediaForLabel('Shock Absorber') }],
          [{ label: "Steering Operation", value: getVal('steeringOperation'), media: getMediaForLabel('Steering Operation') }, { label: "Wheel Alignment", value: getVal('wheelAlignment'), media: getMediaForLabel('Wheel Alignment') }],
        ],
        comment: i.comment_section1 || "No remarks."
      },
      {
        title: "Wheel & Tyre",
        rows: [
          [{ label: "Spare Tire", value: getVal('spareTire'), media: getMediaForLabel('Spare Tire') }, { label: "Front Left Tire", value: getVal('frontLeftTire'), media: getMediaForLabel('Front Left Tire') }],
          [{ label: "Front Right Tire", value: getVal('frontRightTire'), media: getMediaForLabel('Front Right Tire') }, { label: "Rear Left Tire", value: getVal('rearLeftTire'), media: getMediaForLabel('Rear Left Tire') }],
          [{ label: "Rear Right Tire", value: getVal('rearRightTire'), media: getMediaForLabel('Rear Right Tire') }, { label: "Tire Size", value: getVal('tiresSize'), media: getMediaForLabel('Tire Size') }],
          [{ label: "Wheels Type", value: getVal('wheelsType'), media: getMediaForLabel('Wheels Type') }, { label: "Front Rim Size", value: getVal('rimsSizeFront'), media: getMediaForLabel('Front Rim Size') }],
          [{ label: "Rear Rim Size", value: getVal('rimsSizeRear'), media: getMediaForLabel('Rear Rim Size') }, { label: "", value: "", media: null }],
        ],
        comment: i.commentTire || "No remarks."
      },
      {
        title: "Interior & Electricals",
        rows: [
          [{ label: "Speedometer Cluster", value: getVal('speedmeterCluster'), media: getMediaForLabel('Speedometer Cluster') }, { label: "Head Lining", value: getVal('headLining'), media: getMediaForLabel('Head Lining') }],
          [{ label: "Seat Controls", value: getVal('seatControls'), media: getMediaForLabel('Seat Controls') }, { label: "Central Lock", value: getVal('centralLockOperation'), media: getMediaForLabel('Central Lock') }],
          [{ label: "Windows Control", value: getVal('windowsControl'), media: getMediaForLabel('Windows Control') }, { label: "Cruise Control", value: getVal('cruiseControl'), media: getMediaForLabel('Cruise Control') }],
          [{ label: "Sunroof Condition", value: getVal('sunroofCondition'), media: getMediaForLabel('Sunroof Condition') }, { label: "AC Cooling", value: getVal('acCooling'), media: getMediaForLabel('AC Cooling') }],
          [{ label: "Seats Material", value: getVal('seats'), media: getMediaForLabel('Seats Material') }, { label: "Cooled Seats", value: getVal('cooledSeats'), media: getMediaForLabel('Cooled Seats') }],
          [{ label: "Heated Seats", value: getVal('heatedSeats'), media: getMediaForLabel('Heated Seats') }, { label: "Power Seats", value: getVal('powerSeats'), media: getMediaForLabel('Power Seats') }],
          [{ label: "Seats Condition", value: getArr('seatsCondition'), media: getMediaForLabel('Seats Condition') }, { label: "", value: "", media: null }],
        ],
        comment: i.comment_section2 || "No remarks."
      },
      {
        title: "Car Specs",
        rows: [
          [{ label: "Parking Sensors", value: getVal('parkingSensors'), media: getMediaForLabel('Parking Sensors') }, { label: "Keyless Start", value: getVal('keylessStart'), media: getMediaForLabel('Keyless Start') }],
          [{ label: "360 Camera", value: getVal('viveCamera'), media: getMediaForLabel('360 Camera') }, { label: "Blind Spot Monitor", value: getVal('blindSpot'), media: getMediaForLabel('Blind Spot Monitor') }],
          [{ label: "Sunroof Type", value: getVal('sunroofType'), media: getMediaForLabel('Sunroof Type') }, { label: "Heads-Up Display", value: getVal('headsDisplay'), media: getMediaForLabel('Heads-Up Display') }],
          [{ label: "Premium Sound System", value: getVal('premiumSound'), media: getMediaForLabel('Premium Sound System') }, { label: "Carbon Fiber Interior", value: getVal('carbonFiber'), media: getMediaForLabel('Carbon Fiber Interior') }],
          [{ label: "Side Steps", value: getVal('sideSteps'), media: getMediaForLabel('Side Steps') }, { label: "Convertible Top", value: getVal('convertible'), media: getMediaForLabel('Convertible Top') }],
        ],
        paintCondition: i.paintCondition || []
      }
    ].map(section => ({
      ...section,
      rows: section.rows.map(row => row.map(cell => ({ ...cell, color: getColor(cell.value) })))
    }));

  }, [latestInspection, getMediaForLabel]);

  const groupedDamages = useMemo(() => {
    if (!latestInspection?.damages) return {};
    const groups: { [key: string]: any[] } = {};
    latestInspection.damages.forEach((dmg: any) => {
      let category = 'Other';
      const part = (dmg.body_part || '').toLowerCase();
      if (part.includes('door') || part.includes('fender') || part.includes('panel') || part.includes('pillar')) category = 'Doors & Panels';
      else if (part.includes('glass') || part.includes('shield') || part.includes('mirror') || part.includes('light') || part.includes('lamp')) category = 'Glass & Lights';
      else if (part.includes('bumper') || part.includes('hood') || part.includes('trunk') || part.includes('grille')) category = 'Bumpers & Hood';
      else if (part.includes('wheel') || part.includes('tire') || part.includes('rim')) category = 'Wheels & Tires';
      else if (part.includes('roof')) category = 'Roof';
      if (!groups[category]) groups[category] = [];
      groups[category].push(dmg);
    });
    return groups;
  }, [latestInspection]);

  const imageList = useMemo(() => {
    const vehicleData = fullData?.vehicle;
    if (!vehicleData) return [];

    const list = vehicleData.images?.map((img: any) => img.path) || [];
    if (vehicleData.cover_image && typeof vehicleData.cover_image !== 'string') {
      if (!list.includes(vehicleData.cover_image.path)) list.unshift(vehicleData.cover_image.path);
    }
    return list;
  }, [fullData?.vehicle]);

  useEffect(() => {
    setActiveBannerIndex(0);
    setLoadedBannerCount(Math.min(3, imageList.length));
    lastBannerIndexRef.current = 0;
  }, [imageList]);

  // Keep preload requests in sync with the progressive load window.
  useEffect(() => {
    const preloadTargets = imageList.slice(0, loadedBannerCount);
    if (preloadTargets.length > 0) {
      ExpoImage.prefetch(preloadTargets).catch(() => {});
    }
  }, [imageList, loadedBannerCount]);

  const updateBannerLoadWindow = useCallback((index: number) => {
    setLoadedBannerCount((prev) => {
      // Load in chunks of 3. Example: starts with 3, at index 1 -> 6.
      if (index >= prev - 2) {
        return Math.min(imageList.length, prev + 3);
      }
      return prev;
    });
  }, [imageList.length]);

  const handleBannerScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const measuredWidth = bannerSlideWidth || e.nativeEvent.layoutMeasurement.width || width;
    const rawIndex = measuredWidth > 0 ? e.nativeEvent.contentOffset.x / measuredWidth : 0;
    const idx = Math.max(0, Math.min(imageList.length - 1, Math.round(rawIndex)));
    if (idx !== lastBannerIndexRef.current) {
      lastBannerIndexRef.current = idx;
      setActiveBannerIndex(idx);
      updateBannerLoadWindow(idx);
    }
  }, [bannerSlideWidth, imageList.length, updateBannerLoadWindow]);

  if (loading || !fullData?.vehicle) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#cadb2a" /></View>;
  }

  const vehicle = fullData.vehicle;

  let currentPrice = 0;
  let sellerExpectation = 0;
  let hasLeadingBid = false;

  if (viewType === 'negotiation' && negotiationBid) {
    currentPrice = negotiationBid.bid_amount;
    sellerExpectation = Number(negotiationBid.vehicle.price || 0);
  } else {
    currentPrice = biddingData?.highest_bid ? Number(biddingData.highest_bid) : Number(vehicle.starting_bid_amount);
    sellerExpectation = Number(vehicle.price || 0);
    hasLeadingBid = !!(biddingData?.bids && biddingData.bids.length > 0);
  }

  const dynamicTabs = ['Car Details'];
  if (latestInspection) dynamicTabs.push('Inspection');
  dynamicTabs.push('Remarks');

  const renderStatusCard = () => {
    if (bookingStatus !== 'none') {
      if (bookingStatus === 'pending_payment') {
        return (
          <View style={styles.statusCard}>
            <View style={styles.offerRow}>
              <View style={styles.offerItem}>
                <Text style={styles.offerLabel}>Seller Expectation</Text>
                <Text style={styles.offerValue}>AED {sellerExpectation.toLocaleString()}</Text>
              </View>
              <View style={styles.offerItem}>
                <Text style={styles.offerLabel}>My Bid (Highest)</Text>
                <Text style={[styles.offerValue, { color: '#cadb2a' }]}>AED {currentPrice.toLocaleString()}</Text>
              </View>
            </View>
            <Feather name="clock" size={40} color="#ffaa00" style={{ marginBottom: 10 }} />
            <Text style={styles.statusTitle}>Booking Confirmation Pending</Text>
            <Text style={styles.statusSubText}>You have successfully booked this vehicle. Waiting for admin confirmation.</Text>
          </View>
        );
      }
      if (bookingStatus === 'intransfer') {
        return (
          <View style={styles.statusCard}>
            <View style={styles.offerRow}>
              <View style={styles.offerItem}>
                <Text style={styles.offerLabel}>Seller Expectation</Text>
                <Text style={styles.offerValue}>AED {sellerExpectation.toLocaleString()}</Text>
              </View>
              <View style={styles.offerItem}>
                <Text style={styles.offerLabel}>My Bid (Highest)</Text>
                <Text style={[styles.offerValue, { color: '#cadb2a' }]}>AED {currentPrice.toLocaleString()}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="truck-delivery" size={40} color="#00a8ff" style={{ marginBottom: 10 }} />
            <Text style={styles.statusTitle}>Vehicle In-Transfer</Text>
            <Text style={styles.statusSubText}>Your vehicle is currently being transferred. Tracking info will be updated soon.</Text>
          </View>
        );
      }
      if (bookingStatus === 'delivered') {
        return (
          <View style={styles.statusCard}>
            <View style={styles.offerRow}>
              <View style={styles.offerItem}>
                <Text style={styles.offerLabel}>Seller Expectation</Text>
                <Text style={styles.offerValue}>AED {sellerExpectation.toLocaleString()}</Text>
              </View>
              <View style={styles.offerItem}>
                <Text style={styles.offerLabel}>My Bid</Text>
                <Text style={[styles.offerValue, { color: '#cadb2a' }]}>AED {currentPrice.toLocaleString()}</Text>
              </View>
            </View>
            <Feather name="check-circle" size={40} color="#cadb2a" style={{ marginBottom: 10 }} />
            <Text style={styles.statusTitle}>Vehicle Delivered</Text>
            <Text style={styles.statusSubText}>Your vehicle has been successfully delivered. Enjoy your ride!</Text>
          </View>
        );
      }
    }
    if (viewType === 'upcoming') {
      return (
        <View style={styles.countdownGrid}>
          <View style={styles.countBox}><Text style={styles.countNum}>{countdown.days}</Text><Text style={styles.countLabel}>Days</Text></View>
          <View style={styles.countBox}><Text style={styles.countNum}>{String(countdown.hours).padStart(2, '0')}</Text><Text style={styles.countLabel}>Hrs</Text></View>
          <View style={styles.countBox}><Text style={styles.countNum}>{String(countdown.minutes).padStart(2, '0')}</Text><Text style={styles.countLabel}>Min</Text></View>
          <View style={styles.countBox}><Text style={styles.countNum}>{String(countdown.seconds).padStart(2, '0')}</Text><Text style={styles.countLabel}>Sec</Text></View>
        </View>
      );
    }
    if (viewType === 'live') {
      return (
        <View style={styles.countdownGrid}>
          <View style={styles.countBox}><Text style={styles.countNum}>{countdown.days}</Text><Text style={styles.countLabel}>Days</Text></View>
          <View style={styles.countBox}><Text style={styles.countNum}>{String(countdown.hours).padStart(2, '0')}</Text><Text style={styles.countLabel}>Hrs</Text></View>
          <View style={styles.countBox}><Text style={styles.countNum}>{String(countdown.minutes).padStart(2, '0')}</Text><Text style={styles.countLabel}>Min</Text></View>
          <View style={styles.countBox}><Text style={styles.countNum}>{String(countdown.seconds).padStart(2, '0')}</Text><Text style={styles.countLabel}>Sec</Text></View>
        </View>
      );
    } else {
      return (
        <View style={styles.offerCard}>
          <Text style={styles.offerTitle}>Your Offer has been Accepted</Text>
          <View style={styles.offerRow}>
            <View style={styles.offerItem}>
              <Text style={styles.offerLabel}>Seller Expectation</Text>
              <Text style={styles.offerValue}>AED {sellerExpectation.toLocaleString()}</Text>
            </View>
            <View style={styles.offerItem}>
              <Text style={styles.offerLabel}>My Bid (Highest)</Text>
              <Text style={[styles.offerValue, { color: '#cadb2a' }]}>AED {currentPrice.toLocaleString()}</Text>
            </View>
          </View>
          <Text style={styles.finalPriceText}>AED {currentPrice.toLocaleString()}</Text>
          <Text style={styles.offerSubText}>You may continue to book your car now</Text>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#000000', '#1a1a00', '#26270c']} style={styles.gradient}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          stickyHeaderIndices={[2]}
          showsVerticalScrollIndicator={false}
        >

          {/* Index 0: Top Wrapper */}
          <View>
            <View style={styles.topInfoRow}>
              {viewType === 'upcoming' ? (
                <Text style={styles.leadingText}>{formatStartDate(vehicle.auction_start_date)}</Text>
              ) : viewType === 'live' && bookingStatus === 'none' && liveAuctionStatus === 'live' ? (
                <>
                  <Text style={styles.leadingText}><MaterialCommunityIcons name="gavel" size={14} color="#cadb2a" /> {hasLeadingBid ? 'Last Leading Bid' : 'No Bids Yet'}</Text>
                  <View style={styles.smallTimerBadge}><Text style={styles.smallTimerText}>{elapsedTime}</Text></View>
                </>
              ) : (
                <Text style={styles.leadingText}>{formatEndedDate(vehicle.auction_end_date)}</Text>
              )}
            </View>

            {/* Banner Slider */}
            <View
              style={{ height: 250, marginBottom: 15 }}
              onLayout={(e) => {
                const measured = e.nativeEvent.layout.width;
                if (measured > 0 && measured !== bannerSlideWidth) {
                  setBannerSlideWidth(measured);
                }
              }}
            >
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleBannerScroll}
                scrollEventThrottle={16}
                onMomentumScrollEnd={handleBannerScroll}
                onScrollEndDrag={handleBannerScroll}
              >
                {imageList.map((img, index) => (
                  <TouchableOpacity key={index} onPress={() => handleImageOpen(imageList, index, false)}>
                    {index < loadedBannerCount ? (
                      <Image source={{ uri: img }} style={[styles.bannerImage, { width: bannerSlideWidth }]} />
                    ) : (
                      <View style={[styles.bannerImagePlaceholder, { width: bannerSlideWidth }]}>
                        <ActivityIndicator size="small" color="#cadb2a" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']} style={styles.imageOverlay}>
                <View style={styles.bannerContent}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', }}>
                    <View style={{ flex: 1, paddingRight: 5 }}>
                      <Text style={styles.carBrand}>{vehicle.brand?.name}</Text>
                      <Text style={styles.carModel} numberOfLines={2} adjustsFontSizeToFit>
                        {vehicle.vehicle_model?.name} {vehicle.year}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.bannerPriceLabel, { textAlign: 'right' }]}>Highest / Current</Text>
                        <Text style={styles.bannerPriceValue}>AED {currentPrice.toLocaleString()}</Text>
                      </View>
                      <View style={[styles.bannerDivider, { marginHorizontal: 10, height: 25 }]} />
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.bannerPriceLabel, { textAlign: 'right' }]}>Seller Exp.</Text>
                        <Text style={styles.bannerPriceValue}>AED {sellerExpectation.toLocaleString()}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </LinearGradient>
              <View style={styles.paginationContainer}>
                {imageList.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeBannerIndex && styles.activeDot]} />
                ))}
              </View>
            </View>

            {vehicle.description && (
              <View style={[styles.sectionContainer, { paddingTop: 0 }]}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.descriptionText}>{vehicle.description}</Text>
              </View>
            )}
          </View>

          {/* Index 1: Dynamic Status Card */}
          {renderStatusCard()}

          {/* Index 2: Sticky Tabs */}
          <View style={styles.stickyTabContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
              {dynamicTabs.map((tab) => (
                <Pressable
                  key={tab}
                  style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
                  onPress={() => handleTabPress(tab)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Index 3+: Sections */}

          {/* 🟢 Car Details Section */}
          <View onLayout={(e) => handleLayout(e, 'Car Details')} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Car Details</Text>

            <View style={styles.carDetailsGrid}>
              {carDetailItems.map((item, idx) => (
                <View key={idx} style={[styles.carDetailItem, item.fullWidth && { width: '100%' }]}>
                  <Text style={styles.carDetailLabel}>{item.label}</Text>
                  <View style={styles.carDetailValueRow}>
                    <Text style={styles.carDetailValue}>{item.value || 'N/A'}</Text>

                    {item.media && (
                      <TouchableOpacity
                        onPress={() => {
                          const path = item.media.path.startsWith('http') ? item.media.path : `${STORAGE_BASE_URL}${item.media.path}`;
                          if (item.media.file_type === 'video') handleVideoOpen(path);
                          else handleImageOpen([path], 0, false);
                        }}
                        style={{ marginLeft: 8 }}
                      >
                        <Feather name="camera" size={16} color="#00a8ff" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 🟢 Damage Map Section (With Toggle) */}
          {latestInspection?.damage_file_path && (
            <View style={styles.sectionContainer}>
              <View style={styles.featureHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Damage Assessment</Text>
                  <Text style={{ color: '#888', fontSize: 12 }}>({latestInspection.damages?.length || 0} Points)</Text>
                </View>

                {/* Checkbox Toggle */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => setShowFaultsList(!showFaultsList)}
                >
                  <Feather name={showFaultsList ? "check-square" : "square"} size={18} color="#cadb2a" />
                  <Text style={{ color: '#ccc', marginLeft: 8, fontSize: 12, fontFamily: 'Poppins' }}>View Faults List</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: '#666', fontSize: 11, marginBottom: 10 }}>Interactive damage visualization</Text>

              <TouchableOpacity onPress={() => handleImageOpen([latestInspection.damage_file_path], 0, true)} style={styles.damageMapContainer}>
                <Image source={{ uri: latestInspection.damage_file_path }} style={styles.damageMapImage} resizeMode="contain" />
              </TouchableOpacity>

              {/* Conditional List based on Checkbox */}
              {showFaultsList && latestInspection.damages && latestInspection.damages.length > 0 && (
                <View style={{ marginTop: 15 }}>
                  {Object.entries(groupedDamages).map(([cat, items]) => {
                    const isExpanded = expandedDamageCategories[cat];
                    const displayedItems = isExpanded ? items : items.slice(0, 4);
                    return (
                      <View key={cat} style={{ marginBottom: 25 }}>
                        <Text style={[styles.subSectionTitle, { color: '#cadb2a', marginBottom: 12 }]}>{cat}</Text>
                        <View style={styles.damagesTableContainer}>
                          <View style={styles.damagesTableHeader}>
                            <Text style={[styles.damagesTableCell, styles.damagesTableHeaderText, { flex: 2.5 }]}>Part</Text>
                            <Text style={[styles.damagesTableCell, styles.damagesTableHeaderText, { flex: 2.5 }]}>Fault Type</Text>
                            <Text style={[styles.damagesTableCell, styles.damagesTableHeaderText, { flex: 1.5, textAlign: 'center' }]}>Severity</Text>
                          </View>
                          {displayedItems.map((dmg: any, idx: number) => {
                            const borderColor = getSeverityBorderColor(dmg.severity);
                            const severityColor = getDamageBadgeColor(dmg.type);
                            return (
                              <View key={idx} style={[styles.damagesTableRow, idx === displayedItems.length - 1 && { borderBottomWidth: 0 }]}>
                                <Text style={[styles.damagesTableCell, { flex: 2.5, color: '#fff' }]} numberOfLines={2}>{dmg.body_part}</Text>
                                <View style={[styles.damagesTableCell, { flex: 2.5, flexDirection: 'row', alignItems: 'center' }]}>
                                  <View style={[styles.damageBadge, { backgroundColor: severityColor, marginBottom: 0 }]}>
                                    <Feather name="alert-circle" size={10} color="#fff" />
                                    <Text style={styles.damageText} numberOfLines={1}>{dmg.type}</Text>
                                  </View>
                                </View>
                                <Text style={[styles.damagesTableCell, { flex: 1.5, color: borderColor, fontWeight: 'bold', textAlign: 'center' }]}>{dmg.severity}</Text>
                              </View>
                            );
                          })}
                        </View>
                        {items.length > 4 && (
                          <TouchableOpacity style={styles.showMoreBtn} onPress={() => toggleDamageCategory(cat)}>
                            <Text style={styles.showMoreText}>{isExpanded ? `Show Less` : `Show More (${items.length - 4})`}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* 🟢 Inspection Report Sections */}
          {latestInspection && (
            <View onLayout={(e) => handleLayout(e, 'Inspection')} style={styles.sectionContainer}>

              {/* Accordions */}
              {inspectionSections.map((section, index) => (
                <InspectionAccordion
                  key={index}
                  title={section.title}
                  isOpen={activeAccordion === section.title}
                  onPress={() => setActiveAccordion(activeAccordion === section.title ? null : section.title)}
                >
                  {section.rows.map((row, rIdx) => (
                    <View key={rIdx} style={styles.inspGridRow}>
                      {row.map((cell, cIdx) => (
                        <View key={cIdx} style={styles.inspGridItem}>
                          <Text style={styles.inspLabel}>{cell.label}</Text>

                          {/* 🟢 Value and Camera Button Row */}
                          {cell.label !== "" && (
                            <View style={styles.inspValueRow}>
                              <Text style={[styles.inspValue, { color: cell.color, flexShrink: 1 }]}>{cell.value}</Text>

                              {/* Show Camera if media exists for this specific field */}
                              {cell.media && (
                                <TouchableOpacity
                                  onPress={() => {
                                    const path = cell.media.path.startsWith('http') ? cell.media.path : `${STORAGE_BASE_URL}${cell.media.path}`;
                                    if (cell.media.file_type === 'video') handleVideoOpen(path);
                                    else handleImageOpen([path], 0, false);
                                  }}
                                  style={styles.fieldCameraBtn}
                                >
                                  <Feather name="camera" size={14} color="#000" />
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}

                  {/* Paint Condition for Car Specs */}
                  {/* @ts-ignore */}
                  {section.paintCondition && section.paintCondition.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                        <Text style={styles.inspLabel}>Paint Condition</Text>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                        {/* @ts-ignore */}
                        {section.paintCondition.map((pc: string, i: number) => {
                          const { backgroundColor, label } = getPaintBadgeColor(pc);
                          return <View key={i} style={[styles.tag, { backgroundColor }]}><Text style={[styles.tagText, { color: '#fff', fontWeight: 'bold' }]}>{label}</Text></View>;
                        })}
                      </View>
                    </View>
                  )}

                  {section.comment && (
                    <View style={styles.inspCommentBox}>
                      <Text style={styles.inspCommentLabel}>Comments:</Text>
                      <Text style={styles.inspCommentText}>{section.comment}</Text>
                    </View>
                  )}
                </InspectionAccordion>
              ))}



              {/* 🟢 Final Conclusion */}
              {latestInspection.final_conclusion ? (
                <View style={styles.finalConclusionContainer}>
                  <View style={styles.finalConclusionHeader}>
                    <MaterialCommunityIcons name="clipboard-check-outline" size={20} color="#000" />
                    <Text style={styles.finalConclusionTitle}>FINAL CONCLUSION</Text>
                  </View>
                  <Text style={styles.finalConclusionText}>{latestInspection.final_conclusion}</Text>
                </View>
              ) : null}

            </View>
          )}

          {/* 🟢 Remarks Section */}
          <View onLayout={(e) => handleLayout(e, 'Remarks')} style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconBadge}>
                <Feather name="message-square" size={16} color="#000" />
              </View>
              <Text style={styles.sectionTitleNew}>Remarks</Text>
            </View>
            <View style={styles.remarksContainer}>
              <Text style={styles.remarksText}>{vehicle.remarks || "No remarks."}</Text>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Sticky Bid Section */}
        <Animated.View style={[styles.stickyTimerBarWrapper, timerBarAnimatedStyle]}>
          <View style={styles.stickyBidSection}>
            <View style={styles.stickyAccentRow}>
              <View style={styles.stickyAccentLine} />
              <View style={styles.stickyAccentChip}>
                <View style={styles.stickyAccentDotOuter}>
                  <View style={styles.stickyAccentDot} />
                </View>
                <Text style={styles.stickyAccentText}>LIVE</Text>
              </View>
              <View style={styles.stickyAccentLine} />
            </View>

            <View style={styles.stickyPriceRow}>
              <View style={styles.stickyPriceBox}>
                <Text style={styles.stickyPriceLabel}>Seller Expectation</Text>
                <Text style={styles.stickyPriceValue}>AED {sellerExpectation.toLocaleString()}</Text>
              </View>
              <View style={[styles.stickyPriceBox, styles.stickyPriceBoxHighlight]}>
                <Text style={styles.stickyPriceLabel}>Current Bid</Text>
                <Text style={[styles.stickyPriceValue, { color: '#cadb2a' }]}>AED {currentPrice.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.stickyTimerRow}>
              <View style={styles.timerBox}>
                <Text style={styles.timerNumber}>{String(countdown.days).padStart(2, '0')}</Text>
                <Text style={styles.timerLabel}>Days</Text>
              </View>
              <Text style={styles.timerColon}>:</Text>
              <View style={styles.timerBox}>
                <Text style={styles.timerNumber}>{String(countdown.hours).padStart(2, '0')}</Text>
                <Text style={styles.timerLabel}>Hours</Text>
              </View>
              <Text style={styles.timerColon}>:</Text>
              <View style={styles.timerBox}>
                <Text style={styles.timerNumber}>{String(countdown.minutes).padStart(2, '0')}</Text>
                <Text style={styles.timerLabel}>Mins</Text>
              </View>
              <Text style={styles.timerColon}>:</Text>
              <View style={styles.timerBox}>
                <Text style={styles.timerNumber}>{String(countdown.seconds).padStart(2, '0')}</Text>
                <Text style={styles.timerLabel}>Secs</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Footer, Modals and Alerts */}
        {bookingStatus !== 'none' ? (
          <View style={styles.negotiationFooter}>
            <View style={styles.footerBtnRow}>
              <TouchableOpacity style={styles.footerBtnOutline} onPress={() => navigation.navigate('BiddingDetail', { vehicleId: carId })}>
                <Text style={styles.footerBtnTextOutline}>View Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerBtnFilled} onPress={handleViewBooking}>
                <Text style={styles.footerBtnTextFilled}>View Booking</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.footerDateText}>{formatEndedDate(vehicle.auction_end_date)}</Text>
          </View>
        ) : viewType === 'live' ? (
          liveAuctionStatus !== 'live' ? (
            <View style={styles.negotiationFooter}>
              <Text style={styles.footerDateText}>
                {liveAuctionStatus === 'upcoming'
                  ? formatStartDate(vehicle.auction_start_date)
                  : formatEndedDate(vehicle.auction_end_date)}
              </Text>
            </View>
          ) : !isBidSheetVisible && !isAutoBidSheetVisible ? (
            <View style={styles.bidNowContainer}>
              <View style={styles.bidFooterButtonRow}>
                <TouchableOpacity style={styles.autoBidBtn} onPress={openAutoBidSheet}>
                  <Text style={styles.autoBidText}>Auto Bid</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.placeBidBtn} onPress={openBidSheet}>
                  <MaterialCommunityIcons name="gavel" size={18} color="#000" style={{ marginRight: 6 }} />
                  <Text style={styles.placeBidText}>Place Bid</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : isBidSheetVisible ? (
            <View style={styles.bottomSheet}>
              <TouchableOpacity style={styles.bottomArrowContainer} onPress={() => setIsBidSheetVisible(false)} >
                <Feather name="arrow-down" size={24} color="#cadb2a" />
              </TouchableOpacity>
              <Text style={styles.winningOfferTitle}>Place Your Winning Bid</Text>
              <View style={styles.bidControlRow}>
                <TouchableOpacity style={styles.circleBtnRed} onPress={handleDecrement}><Feather name="minus" size={24} color="#fff" /></TouchableOpacity>
                <View><Text style={styles.bidAmountText}>{myBid.toLocaleString()}</Text><Text style={styles.currencyText}>AED</Text></View>
                <TouchableOpacity style={styles.circleBtnGreen} onPress={handleIncrement}><Feather name="plus" size={24} color="#fff" /></TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.sheetPlaceBidBtn} onPress={handlePlaceBid} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#000" /> : <><Text style={styles.sheetPlaceBidBtnText}>Place Bid</Text><MaterialCommunityIcons name="gavel" size={20} color="#000" style={{ marginLeft: 8 }} /></>}
              </TouchableOpacity>
              <Text style={styles.minIncText}>Min increment: AED {vehicle.bid_control || 100}</Text>
            </View>
          ) : isAutoBidSheetVisible ? (
            <View style={styles.bottomSheet}>
              <TouchableOpacity style={styles.bottomArrowContainer} onPress={() => setIsAutoBidSheetVisible(false)} >
                <Feather name="arrow-down" size={24} color="#cadb2a" />
              </TouchableOpacity>
              <Text style={styles.winningOfferTitle}>Set Your Maximum Bid</Text>
              <View style={styles.bidControlRow}>
                <TouchableOpacity style={styles.circleBtnRed} onPress={handleAutoBidDecrement}><Feather name="minus" size={24} color="#fff" /></TouchableOpacity>
                <View><Text style={styles.bidAmountText}>{maxBid.toLocaleString()}</Text><Text style={styles.currencyText}>AED</Text></View>
                <TouchableOpacity style={styles.circleBtnGreen} onPress={handleAutoBidIncrement}><Feather name="plus" size={24} color="#fff" /></TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.sheetPlaceBidBtn} onPress={handleAutoBid} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#000" /> : <><Text style={styles.sheetPlaceBidBtnText}>Set Auto Bid</Text><MaterialCommunityIcons name="auto-fix" size={20} color="#000" style={{ marginLeft: 8 }} /></>}
              </TouchableOpacity>
              <Text style={styles.minIncText}>System will auto-bid up to your max amount</Text>
            </View>
          ) : null
        ) : viewType === 'upcoming' ? (
          <View style={styles.negotiationFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="bell" size={20} color="#cadb2a" style={{ marginRight: 10 }} />
              <Text style={{ color: '#fff', fontFamily: 'Poppins', fontSize: 13 }}>
                Auction starts on {new Date(vehicle.auction_start_date).toDateString()}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.negotiationFooter}>
            <View style={styles.footerBtnRow}>
              <TouchableOpacity style={styles.footerBtnOutline} onPress={() => navigation.navigate('BiddingDetail', { vehicleId: carId })}>
                <Text style={styles.footerBtnTextOutline}>View Detail</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerBtnFilled} onPress={handleBookNow}>
                <Text style={styles.footerBtnTextFilled}>Book Now</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.adminFeeText}>*Admin fee <Text style={styles.adminFeeBold}>AED 1,499</Text> will be charged</Text>
            <View style={styles.lateInfoRow}>
              <Feather name="info" size={12} color="#ff6b6b" style={{ marginRight: 4 }} />
              <Text style={styles.lateInfoText}>Late Payment & Storage Charges may apply</Text>
            </View>
            <Text style={styles.footerDateText}>{formatEndedDate(vehicle.auction_end_date)}</Text>
          </View>
        )}

        <ImagePreviewModal
          visible={!!previewImages.length}
          images={previewImages}
          initialIndex={previewIndex}
          onClose={() => setPreviewImages([])}
          isWhiteBackground={isPreviewMap}
          isRotated={isPreviewMap}
        />

        <VideoPlayerModal
          visible={videoModalVisible}
          videoUrl={currentVideoUrl}
          onClose={() => setVideoModalVisible(false)}
        />

        <Animated.View style={[styles.toastContainer, toastAnimatedStyle]}>
          <Feather name="check-circle" size={18} color="#cadb2a" style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>

        <CustomAlert
          visible={showLoginAlert}
          title="Please Login"
          message="Create an account or login to Caartl to place bids."
          onClose={() => setShowLoginAlert(false)}
        />

        <CustomAlert
          visible={showApprovalAlert}
          title="Account Pending Approval"
          message="Your account is pending approval. Please complete your payment to activate your account and place bids."
          onClose={() => setShowApprovalAlert(false)}
        />

      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  gradient: { flex: 1 },
  scrollView: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10 },
  headerBtn: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', fontFamily: 'Poppins' },

  topInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  leadingText: { color: '#ccc', fontSize: 14, fontFamily: 'Poppins', fontWeight: '500' },
  smallTimerBadge: { backgroundColor: '#cadb2a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  smallTimerText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  bannerImage: { height: 250, resizeMode: 'cover' },
  bannerImagePlaceholder: { height: 250, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },

  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 15, paddingTop: 60, justifyContent: 'flex-end' },
  bannerContent: { flexDirection: 'column', gap: 4, marginBottom: 12 },
  carBrand: { color: '#cadb2a', fontSize: 14, fontWeight: 'bold', fontFamily: 'Poppins' },
  carModel: { color: '#fff', fontSize: 22, fontWeight: 'bold', fontFamily: 'Poppins' },
  bannerPriceLabel: { color: '#aaa', fontSize: 10, fontFamily: 'Poppins', marginBottom: 2 },
  bannerPriceValue: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: 'Lato' },
  bannerDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 15 },

  countdownGrid: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 25 },
  countBox: { width: 65, height: 65, backgroundColor: '#111', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  countNum: { color: '#fff', fontSize: 20, fontWeight: 'bold', fontFamily: 'Lato' },
  countLabel: { color: '#888', fontSize: 11, fontFamily: 'Poppins' },

  stickyTabContainer: { backgroundColor: '#111', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222', zIndex: 100 },
  tabContent: { paddingHorizontal: 16 },
  tabItem: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 10, borderRadius: 20, backgroundColor: '#000' },
  activeTabItem: { backgroundColor: '#cadb2a', borderWidth: 2, borderColor: '#000' },
  tabText: { color: '#fff', fontSize: 13, fontFamily: 'Poppins' },
  activeTabText: { color: '#111', fontWeight: 'bold' },

  sectionContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
  sectionTitle: { color: '#cadb2a', fontSize: 16, fontWeight: 'bold', fontFamily: 'Poppins', marginBottom: 10 },
  subSectionTitle: { color: '#aaa', fontSize: 13, fontWeight: '600', fontFamily: 'Poppins', marginBottom: 8, marginTop: 5 },

  carDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    padding: 8,
  },
  carDetailItem: { width: '50%', padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  carDetailLabel: { color: '#888', fontSize: 12, fontFamily: 'Poppins', marginBottom: 4 },
  carDetailValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  carDetailValue: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: 'Poppins' },

  inspGridRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#222', paddingVertical: 8 },
  inspGridItem: { width: '50%', paddingRight: 5 },
  inspLabel: { color: '#888', fontSize: 12, fontFamily: 'Poppins', marginBottom: 2 },

  // 🟢 NEW: Styles for the inline camera row
  inspValueRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  fieldCameraBtn: { backgroundColor: '#cadb2a', padding: 4, borderRadius: 4, marginLeft: 8 },

  inspValue: { fontSize: 14, fontWeight: 'bold', fontFamily: 'Poppins' },
  inspCommentBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#222' },
  inspCommentLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  inspCommentText: { color: '#ccc', fontSize: 12, fontStyle: 'italic' },

  damageMapContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  damageMapImage: { width: '100%', height: 250 },

  featureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badgeIcon: { backgroundColor: '#cadb2a', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  featureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cadb2a', marginRight: 15 },
  featureText: { color: '#fff', fontSize: 14, fontFamily: 'Poppins', flex: 1 },
  showMoreBtn: { alignItems: 'center', marginTop: 15 },
  showMoreText: { color: '#888', fontSize: 14, fontFamily: 'Poppins' },

  infoBlock: { marginBottom: 15, marginTop: 15 },
  tag: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginRight: 5, marginBottom: 5 },
  tagText: { fontSize: 12, fontFamily: 'Poppins' },
  mediaBtnRight: { marginLeft: 12, padding: 4 },
  damagesTableContainer: { backgroundColor: 'transparent', overflow: 'hidden' },
  damagesTableHeader: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: '#333' },
  damagesTableHeaderText: { color: '#aaa', fontSize: 11, fontWeight: 'bold' },
  damagesTableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: '#222', alignItems: 'center' },
  damagesTableCell: { fontSize: 12, fontFamily: 'Poppins', paddingHorizontal: 4 },
  damageBadge: { borderRadius: 4, paddingVertical: 3, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  damageText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
  descriptionText: { color: '#ccc', fontSize: 14, fontFamily: 'Poppins', lineHeight: 20 },
  commentBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#111', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  bidNowContainer: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 12, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222' },
  bidFooterButtonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  autoBidBtn: { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#cadb2a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  autoBidText: { color: '#cadb2a', fontSize: 15, fontWeight: 'bold', fontFamily: 'Poppins' },
  placeBidBtn: { flex: 1, backgroundColor: '#cadb2a', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  placeBidText: { color: '#000', fontSize: 15, fontWeight: 'bold', fontFamily: 'Poppins' },
  bottomSheet: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderWidth: 1, borderColor: '#cadb2a', position: 'absolute', bottom: 0, width: '100%' },
  bottomArrowContainer: { alignItems: 'center', marginTop: -40, marginBottom: 15, alignSelf: 'center', backgroundColor: '#000', padding: 8, borderRadius: 50, borderWidth: 1, borderColor: '#cadb2a' },
  winningOfferTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 18 },
  bidControlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  circleBtnRed: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#ff4444', justifyContent: 'center', alignItems: 'center' },
  circleBtnGreen: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#cadb2a', justifyContent: 'center', alignItems: 'center' },
  bidAmountText: { color: '#fff', fontSize: 32, fontWeight: 'bold', fontFamily: 'Lato', textAlign: 'center' },
  currencyText: { fontSize: 12, color: '#888', textAlign: 'center' },
  sheetPlaceBidBtn: { backgroundColor: '#cadb2a', height: 55, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  sheetPlaceBidBtnText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  minIncText: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 10 },
  previewContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  previewContainerWhite: { backgroundColor: '#fff' },
  videoModalContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  videoCloseBtn: { position: 'absolute', top: 50, right: 30, zIndex: 20, padding: 10 },
  fullscreenVideo: { width: width, height: height * 0.8 },
  previewPagination: { flexDirection: 'row', justifyContent: 'center', position: 'absolute', bottom: 40, width: '100%' },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', position: 'absolute', bottom: 10, width: '100%' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  activeDot: { backgroundColor: '#cadb2a', width: 20 },
  previewCloseBtn: { position: 'absolute', top: 50, right: 30, zIndex: 20, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  footerDateText: { color: '#666', fontSize: 12, marginTop: 10, fontFamily: 'Poppins', fontStyle: 'italic' },
  offerCard: { marginHorizontal: 16, marginBottom: 20, padding: 16, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#cadb2a' },
  offerTitle: { color: '#cadb2a', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, fontFamily: 'Poppins' },
  offerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  offerItem: { width: '48%', backgroundColor: '#000', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#222', alignItems: 'center' },
  offerLabel: { color: '#888', fontSize: 10, marginBottom: 4, fontFamily: 'Poppins' },
  stickyTimerBarWrapper: { overflow: 'hidden' },
  stickyBidSection: { backgroundColor: '#000', paddingVertical: 16, paddingHorizontal: 16 },
  stickyAccentRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stickyAccentLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(202, 219, 42, 0.38)',
  },
  stickyAccentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(202, 219, 42, 0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginHorizontal: 10,
  },
  stickyAccentDotOuter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(202, 219, 42, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  stickyAccentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cadb2a',
  },
  stickyAccentText: {
    color: '#cadb2a',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Poppins',
    letterSpacing: 0.7,
  },
  stickyPriceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  stickyPriceBox: { flex: 1, backgroundColor: '#111', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  stickyPriceBoxHighlight: { borderColor: '#cadb2a' },
  stickyPriceLabel: { color: '#888', fontSize: 11, fontFamily: 'Poppins', marginBottom: 4 },
  stickyPriceValue: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: 'Lato' },
  stickyTimerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  timerBox: { backgroundColor: '#111', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', minWidth: 55, borderWidth: 1, borderColor: '#333' },
  timerNumber: { color: '#fff', fontSize: 18, fontWeight: 'bold', fontFamily: 'Lato' },
  timerLabel: { color: '#888', fontSize: 10, fontFamily: 'Poppins', marginTop: 2 },
  timerColon: { color: '#cadb2a', fontSize: 18, fontWeight: 'bold', marginHorizontal: 6 },
  offerValue: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  finalPriceText: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 10, fontFamily: 'Lato' },
  offerSubText: { color: '#888', fontSize: 12, textAlign: 'center', fontFamily: 'Poppins' },
  negotiationFooter: { flexDirection: 'column', alignItems: 'center', padding: 16, paddingBottom: 12, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222' },
  footerBtnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  footerBtnOutline: { flex: 1, borderWidth: 1, borderColor: '#fff', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginRight: 10 },
  footerBtnTextOutline: { color: '#fff', fontSize: 14, fontWeight: 'bold', fontFamily: 'Poppins' },
  footerBtnFilled: { flex: 1, backgroundColor: '#ff4444', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  footerBtnTextFilled: { color: '#fff', fontSize: 14, fontWeight: 'bold', fontFamily: 'Poppins' },
  adminFeeText: { color: '#888', fontSize: 10, marginTop: 12, fontFamily: 'Poppins' },
  adminFeeBold: { color: '#fff', fontWeight: 'bold' },
  lateInfoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  lateInfoText: { color: '#ff6b6b', fontSize: 10, textDecorationLine: 'underline', fontFamily: 'Poppins' },
  accordionContainer: { marginBottom: 10, borderWidth: 1, borderColor: '#222', borderRadius: 8, overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#111' },
  accordionTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', fontFamily: 'Poppins' },
  accordionContent: { padding: 15, backgroundColor: '#000' },
  statusCard: { backgroundColor: '#111', marginHorizontal: 16, marginBottom: 20, borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  statusTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', fontFamily: 'Poppins', marginBottom: 8, textAlign: 'center' },
  statusSubText: { color: '#aaa', fontSize: 13, fontFamily: 'Poppins', textAlign: 'center', lineHeight: 20 },
  commentContainer: { marginTop: 10 },

  finalConclusionContainer: {
    backgroundColor: '#111',
    borderLeftWidth: 4,
    borderLeftColor: '#cadb2a',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  finalConclusionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#cadb2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  finalConclusionTitle: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Poppins',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  finalConclusionText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Poppins',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIconBadge: {
    backgroundColor: '#cadb2a',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitleNew: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Poppins',
  },
  remarksContainer: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  remarksText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Poppins',
  },

  toastContainer: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: '#cadb2a',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  toastText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '600',
  },

  fieldImageWrapper: {
    width: 110,
    height: 110,
    borderRadius: 8,
    backgroundColor: '#222',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  fieldImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldImageLabel: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'Poppins',
    textAlign: 'center',
  },
});