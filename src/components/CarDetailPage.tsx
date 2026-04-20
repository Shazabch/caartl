import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    LayoutChangeEvent,
    Linking,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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
    withTiming,
} from "react-native-reanimated";

import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import * as Models from '../data/modal';
import { formatAuctionDateInDubai } from '../lib/dubaiTime';
import { RootStackParamList } from '../navigation/AppNavigator';
import apiService from '../services/ApiService';
import CustomAlert from './ui/CustomAlert';

type CarDetailRouteProp = RouteProp<RootStackParamList, 'CarDetailPage'>;
type CarDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CarDetailPage'>;

const { width, height } = Dimensions.get('window');
const STORAGE_BASE_URL = 'https://api.caartl.com/storage/';
const TAB_BAR_HEIGHT = 60;
const WHATSAPP_NUMBER = '971521706875';

// ==========================================
// 1. ZOOMABLE IMAGE
// ==========================================
const ZoomableImage = ({ uri, onRequestScrollToggle }: { uri: string, onRequestScrollToggle: (locked: boolean) => void }) => {
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.Image
          source={{ uri }}
          style={[{ width: '100%', height: '80%', resizeMode: 'contain' }, animatedStyle]}
        />
      </Animated.View>
    </GestureDetector>
  );
};

// ==========================================
// 2. GALLERY MODAL
// ==========================================
const ImagePreviewModal = ({ visible, images = [], initialIndex = 0, onClose, isWhiteBackground = false }: any) => {
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
  return `Auction Ended ${formatAuctionDateInDubai(dateStr)}`;
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const CarDetailPage = () => {
  const navigation = useNavigation<CarDetailNavigationProp>();
  const route = useRoute<CarDetailRouteProp>();
  const { carId } = route.params;

  const { user, isGuest, isUnapproved } = useAuth();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [showLoginAlert, setShowLoginAlert] = useState(false);
  const [showApprovalAlert, setShowApprovalAlert] = useState(false);

  const [fullData, setFullData] = useState<Models.AuctionDetailsResponse['data'] | null>(null);
  const [bookingStatus, setBookingStatus] = useState<'none' | 'pending_payment' | 'intransfer' | 'delivered'>('none');
  const [damageTypes, setDamageTypes] = useState<any[]>([]);

  // UI States
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [activeInspectionIndex, setActiveInspectionIndex] = useState(0);
  const [expandedDamageCategories, setExpandedDamageCategories] = useState<{ [key: string]: boolean }>({});
  const [activeAccordion, setActiveAccordion] = useState<string | null>('Engine & Transmission');
  const [activeTab, setActiveTab] = useState('Car Details');
  const [showFaultsList, setShowFaultsList] = useState(false);

  // Media States
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPreviewMap, setIsPreviewMap] = useState(false);

  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

  // Inquire Modal
  const [inquireVisible, setInquireVisible] = useState(false);
  const [inqName, setInqName] = useState('');
  const [inqEmail, setInqEmail] = useState('');
  const [inqPhone, setInqPhone] = useState('');
  const [inqAddress, setInqAddress] = useState('');
  const [inqComment, setInqComment] = useState('');

  const [submittingInquiry, setSubmittingInquiry] = useState(false);

  // Scroll
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionYCoords = useRef<{ [key: string]: number }>({});
  const isManualScroll = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const detailsRes = await apiService.getAuctionDetails(carId);
        if (detailsRes.success && detailsRes.data.data) {
          setFullData(detailsRes.data.data);
        }

        const bookRes = await apiService.getBookingByVehicle(carId);
        if (bookRes.success && bookRes.data.data && bookRes.data.data.data.length > 0) {
          const latestBooking = bookRes.data.data.data[0];
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
  }, [carId]);

  useEffect(() => {
    if (user) {
      setInqName(user.name);
      setInqEmail(user.email);
      setInqPhone(user.phone || '');
    }
  }, [user]);

  const getDamageBadgeColor = (damageType: string) => {
    const found = damageTypes.find(d => d.name.toLowerCase() === damageType.toLowerCase());
    return found ? found.color : '#ff4444';
  };

  const toggleDamageCategory = (category: string) => {
    setExpandedDamageCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleLayout = (e: LayoutChangeEvent, section: string) => {
    sectionYCoords.current[section] = e.nativeEvent.layout.y;
  };

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    isManualScroll.current = true;
    requestAnimationFrame(() => {
      const y = sectionYCoords.current[tab];
      if (y !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: y - TAB_BAR_HEIGHT - 10, animated: true });
      }
    });
    setTimeout(() => { isManualScroll.current = false; }, 400);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isManualScroll.current) return;
    const scrollY = event.nativeEvent.contentOffset.y;
    const triggerPoint = scrollY + TAB_BAR_HEIGHT + 100;
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

  const handleBookNow = () => {
    if (isGuest) {
      setShowLoginAlert(true);
      return;
    }
    if (isUnapproved) {
      setShowApprovalAlert(true);
      return;
    }
    if (fullData?.vehicle) {
      navigation.navigate('BookCar', { vehicle: fullData.vehicle });
    } else {
      showAlert("Error", "Vehicle data not available.");
    }
  };

  const handleViewBooking = () => {
    navigation.navigate('ViewBooking', { vehicleId: carId });
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

  const handleSubmitInquiry = async () => {
    if (!inqName) {
      showAlert("Required", "Please enter your Name.");
      return;
    }
    setSubmittingInquiry(true);
    const carName = fullData?.vehicle ? `${fullData.vehicle.brand?.name || ''} ${fullData.vehicle.vehicle_model?.name || ''} ${fullData.vehicle.year || ''}` : 'Vehicle';
    const message = `Hello, I am interested in this car:
*${carName}* (ID: ${carId})

*My Details:*
Name: ${inqName}
Email: ${inqEmail || 'N/A'}
Phone: ${inqPhone || 'N/A'}
Address: ${inqAddress || 'N/A'}

*Comment:*
${inqComment}`;

    const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        setInquireVisible(false);
      } else {
        showAlert("Error", "WhatsApp is not installed on this device.");
      }
    } catch (error) {
      console.error("WhatsApp Error", error);
      showAlert("Error", "Could not open WhatsApp.");
    } finally {
      setSubmittingInquiry(false);
    }
  };

  // --- 🟢 ALL HOOKS CALLED BEFORE CONDITIONAL RETURN ---

  const latestInspection = useMemo(() => {
    if (!fullData?.inspections && !fullData?.vehicle?.inspections) return null;
    const list = fullData.inspections || fullData.vehicle.inspections || [];
    return list.length > 0 ? list[list.length - 1] : null;
  }, [fullData]);

  const getFieldMedia = (fieldName: string) => {
    if (!latestInspection?.fields) return null;
    const field = latestInspection.fields.find((f: any) => f.name.toLowerCase() === fieldName.toLowerCase());
    if (field && field.files && field.files.length > 0) {
      return field.files[0];
    }
    return null;
  };

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

  // 🟢 Car Detail Items Memo
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

  // 🟢 Inspection Sections Memo
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
          [{ label: "Engine Oil", value: getVal('engineOil') }, { label: "Gear Oil", value: getVal('gearOil') }],
          [{ label: "Engine Noise", value: getVal('engineNoise') }, { label: "Engine Smoke", value: getVal('engineSmoke') }],
          [{ label: "Gear Shifting", value: getVal('gearshifting') }, { label: "4WD System", value: getVal('fourWdSystemCondition') }],
        ],
        comment: i.remarks || "No remarks."
      },
      {
        title: "Steering, Suspension & Brakes",
        rows: [
          [{ label: "Brake Pads", value: getVal('brakePads') }, { label: "Brake Discs", value: getArr('brakeDiscs') }],
          [{ label: "Suspension", value: getVal('suspension') }, { label: "Shock Absorber", value: getArr('shockAbsorberOperation') }],
          [{ label: "Steering Operation", value: getVal('steeringOperation') }, { label: "Wheel Alignment", value: getVal('wheelAlignment') }],
        ],
        comment: i.comment_section1 || "No remarks."
      },
      {
        title: "Wheel & Tyre",
        rows: [
          [{ label: "Spare Tire", value: getVal('spareTire') }, { label: "Front Left Tire", value: getVal('frontLeftTire') }],
          [{ label: "Front Right Tire", value: getVal('frontRightTire') }, { label: "Rear Left Tire", value: getVal('rearLeftTire') }],
          [{ label: "Rear Right Tire", value: getVal('rearRightTire') }, { label: "Tire Size", value: getVal('tiresSize') }],
          [{ label: "Wheels Type", value: getVal('wheelsType') }, { label: "Front Rim Size", value: getVal('rimsSizeFront') }],
          [{ label: "Rear Rim Size", value: getVal('rimsSizeRear') }, { label: "", value: "" }],
        ],
        comment: i.commentTire || "No remarks."
      },
      {
        title: "Interior & Electricals",
        rows: [
          [{ label: "Speedometer Cluster", value: getVal('speedmeterCluster') }, { label: "Head Lining", value: getVal('headLining') }],
          [{ label: "Seat Controls", value: getVal('seatControls') }, { label: "Central Lock", value: getVal('centralLockOperation') }],
          [{ label: "Windows Control", value: getVal('windowsControl') }, { label: "Cruise Control", value: getVal('cruiseControl') }],
          [{ label: "Sunroof Condition", value: getVal('sunroofCondition') }, { label: "AC Cooling", value: getVal('acCooling') }],
          [{ label: "Seats Material", value: getVal('seats') }, { label: "Cooled Seats", value: getVal('cooledSeats') }],
          [{ label: "Heated Seats", value: getVal('heatedSeats') }, { label: "Power Seats", value: getVal('powerSeats') }],
        ],
        comment: i.comment_section2 || "No remarks."
      },
      {
        title: "Car Specs",
        rows: [
          [{ label: "Parking Sensors", value: getVal('parkingSensors') }, { label: "Keyless Start", value: getVal('keylessStart') }],
          [{ label: "360 Camera", value: getVal('viveCamera') }, { label: "Blind Spot Monitor", value: getVal('blindSpot') }],
          [{ label: "Sunroof Type", value: getVal('sunroofType') }, { label: "Heads-Up Display", value: getVal('headsDisplay') }],
          [{ label: "Premium Sound System", value: getVal('premiumSound') }, { label: "Carbon Fiber Interior", value: getVal('carbonFiber') }],
          [{ label: "Side Steps", value: getVal('sideSteps') }, { label: "Convertible Top", value: getVal('convertible') }],
        ],
        paintCondition: i.paintCondition || []
      }
    ].map(section => ({
      ...section,
      rows: section.rows.map(row => row.map(cell => ({ ...cell, color: getColor(cell.value) })))
    }));

  }, [latestInspection]);

  // 🟢 CONDITIONAL LOADING RETURN (After all hooks)
  if (loading || !fullData?.vehicle) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#cadb2a" /></View>;
  }

  const vehicle = fullData.vehicle;
  const offerPrice = Number(vehicle.price || vehicle.starting_bid_amount || 0);

  const imageList = vehicle.images?.map((img: any) => img.path) || [];
  if (vehicle.cover_image && typeof vehicle.cover_image !== 'string') {
    if (!imageList.includes(vehicle.cover_image.path)) imageList.unshift(vehicle.cover_image.path);
  } else if (vehicle.brand?.image_source && imageList.length === 0) {
    imageList.push(vehicle.brand.image_source);
  }

  const dynamicTabs = ['Car Details'];
  if (latestInspection) dynamicTabs.push('Inspection');
  dynamicTabs.push('Remarks');

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#000000', '#1a1a00', '#26270c']} style={styles.gradient}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vehicle Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
        >

          {/* Index 0: Top Wrapper */}
          <View>
            {/* BANNER SLIDER WITH OVERLAY */}
            <View style={{ height: 250, marginBottom: 15 }}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                  setActiveBannerIndex(idx);
                }}
              >
                {imageList.map((img, index) => (
                  <TouchableOpacity key={index} onPress={() => handleImageOpen(imageList, index, false)}>
                    <Image source={{ uri: img }} style={{ width: width, height: 250, resizeMode: 'cover' }} />
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
                        <Text style={[styles.bannerPriceLabel, { textAlign: 'right' }]}>Offer Price</Text>
                        <Text style={styles.bannerPriceValue}>AED {offerPrice.toLocaleString()}</Text>
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

            {/* Status Card */}
            {bookingStatus !== 'none' && (
              <View style={styles.statusCard}>
                <Feather
                  name={bookingStatus === 'pending_payment' ? 'clock' : (bookingStatus === 'intransfer' ? 'truck' : 'check-circle')}
                  size={40}
                  color={bookingStatus === 'pending_payment' ? '#ffaa00' : (bookingStatus === 'intransfer' ? '#00a8ff' : '#cadb2a')}
                  style={{ marginBottom: 10 }}
                />
                <Text style={styles.statusTitle}>
                  {bookingStatus === 'pending_payment' ? 'Payment Pending' : (bookingStatus === 'intransfer' ? 'Vehicle In-Transfer' : 'Vehicle Delivered')}
                </Text>
                <Text style={styles.statusSubText}>
                  {bookingStatus === 'pending_payment' ? 'Complete payment to confirm your booking.' : (bookingStatus === 'intransfer' ? 'Your vehicle is currently being transferred.' : 'Your vehicle has been successfully delivered.')}
                </Text>
              </View>
            )}
          </View>

          {/* Index 1: Sticky Tabs */}
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

          {/* Index 2+: Sections */}

          {/* 🟢 Car Details Section (Renamed & Grid) */}
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
                        <View style={styles.damagesGrid}>
                          {displayedItems.map((dmg: any, idx: number) => {
                            const borderColor = getSeverityBorderColor(dmg.severity);
                            const severityColor = getDamageBadgeColor(dmg.type);
                            return (
                              <View key={idx} style={[styles.damageGridItem, { borderColor: borderColor, borderWidth: 0.1 }]}>
                                <View style={[styles.damageBadge, { backgroundColor: severityColor }]}>
                                  <Feather name="alert-circle" size={12} color="#fff" />
                                  <Text style={styles.damageText} numberOfLines={1}>{dmg.type}</Text>
                                </View>
                                <Text style={styles.damageBodyPart} numberOfLines={2}>{dmg.body_part}</Text>
                                <Text style={[styles.damageSubText, { color: '#aaa' }]}>{dmg.severity}</Text>
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

          {latestInspection && (
            <View onLayout={(e) => handleLayout(e, 'Inspection')} style={styles.sectionContainer}>
              {/* 🟢 Inspection Report Accordions (New Layout) */}
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
                          <Text style={[styles.inspValue, { color: cell.color }]}>{cell.value}</Text>
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

              {/* 🟢 Final Conclusion (Improved Styling) */}
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

          {/* 🟢 Remarks Section (Renamed & Styled) */}
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

        {/* Footer: Action Buttons */}
        {bookingStatus === 'none' ? (
          <View style={styles.negotiationFooter}>
            {user?.id !== 0 && user?.name !== 'Guest' ? (
              <TouchableOpacity style={styles.footerBtnFilled} onPress={handleBookNow}>
                <Text style={styles.footerBtnTextFilled}>Buy Now</Text>
              </TouchableOpacity>
            ) : null}

            {/* Inquire Now Button */}
            <TouchableOpacity
              style={styles.footerBtnOutline}
              onPress={() => setInquireVisible(true)}
            >
              <Text style={styles.footerBtnTextOutline}>Inquire Now</Text>
            </TouchableOpacity>

            <Text style={styles.adminFeeText}>*Admin fee <Text style={styles.adminFeeBold}>AED 1,499</Text> will be charged</Text>
          </View>
        ) : (
          <View style={styles.negotiationFooter}>
            <TouchableOpacity style={styles.footerBtnOutline} onPress={handleViewBooking}>
              <Text style={styles.footerBtnTextOutline}>View Booking</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Gallery Modal */}
        <ImagePreviewModal
          visible={!!previewImages.length}
          images={previewImages}
          initialIndex={previewIndex}
          onClose={() => setPreviewImages([])}
          isWhiteBackground={isPreviewMap}
        />

        <VideoPlayerModal
          visible={videoModalVisible}
          videoUrl={currentVideoUrl}
          onClose={() => setVideoModalVisible(false)}
        />

        {/* Inquiry Modal */}
        <Modal visible={inquireVisible} transparent animationType="slide" onRequestClose={() => setInquireVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Inquire about {vehicle.brand?.name} {vehicle.vehicle_model?.name}</Text>
                <TouchableOpacity onPress={() => setInquireVisible(false)}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 10 }}>
                <Text style={styles.label}>Name</Text>
                <TextInput style={styles.input} value={inqName} onChangeText={setInqName} placeholderTextColor="#666" placeholder="Your Name" />

                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={inqEmail} onChangeText={setInqEmail} keyboardType="email-address" placeholderTextColor="#666" placeholder="Your Email" />

                <Text style={styles.label}>Phone</Text>
                <TextInput style={styles.input} value={inqPhone} onChangeText={setInqPhone} keyboardType="phone-pad" placeholderTextColor="#666" placeholder="Your Phone" />

                <Text style={styles.label}>Address (Optional)</Text>
                <TextInput style={styles.input} value={inqAddress} onChangeText={setInqAddress} placeholderTextColor="#666" placeholder="Your Address" />

                <Text style={styles.label}>Comment (Optional)</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  value={inqComment}
                  onChangeText={setInqComment}
                  placeholderTextColor="#666"
                  placeholder="Any questions?"
                  multiline
                />

                <TouchableOpacity
                  style={[styles.submitBtn, { flexDirection: 'row', justifyContent: 'center' }]}
                  onPress={handleSubmitInquiry}
                  disabled={submittingInquiry}
                >
                  {submittingInquiry ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <FontAwesome5 name="whatsapp" size={18} color="#000" style={{ marginRight: 8 }} />
                      <Text style={styles.submitBtnText}>Send via WhatsApp</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Login Alerts */}
        <CustomAlert
          visible={showLoginAlert}
          title="Please Login"
          message="Create an account or login to Caartl to book this vehicle."
          onClose={() => setShowLoginAlert(false)}
        />

        <CustomAlert
          visible={showApprovalAlert}
          title="Account Pending Approval"
          message="Your account is pending approval. Please complete your payment to activate your account and book vehicles."
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10 },
  headerBtn: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', fontFamily: 'Poppins' },

  // Banner
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 15, paddingTop: 60, justifyContent: 'flex-end' },
  bannerContent: { flexDirection: 'column', gap: 4, marginBottom: 12 },
  carBrand: { color: '#cadb2a', fontSize: 14, fontWeight: 'bold', fontFamily: 'Poppins' },
  carModel: { color: '#fff', fontSize: 22, fontWeight: 'bold', fontFamily: 'Poppins' },
  bannerPriceLabel: { color: '#aaa', fontSize: 10, fontFamily: 'Poppins', marginBottom: 2 },
  bannerPriceValue: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: 'Lato' },
  bannerDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 15 },

  // Preview
  previewContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  previewContainerWhite: { backgroundColor: '#fff' },
  previewCloseBtn: { position: 'absolute', top: 50, right: 30, zIndex: 20, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  previewPagination: { flexDirection: 'row', justifyContent: 'center', position: 'absolute', bottom: 40, width: '100%' },

  paginationContainer: { flexDirection: 'row', justifyContent: 'center', position: 'absolute', bottom: 10, width: '100%' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  activeDot: { backgroundColor: '#cadb2a', width: 20 },

  // Tabs
  stickyTabContainer: { backgroundColor: '#111', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222', zIndex: 100 },
  tabContent: { paddingHorizontal: 16 },
  tabItem: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 10, borderRadius: 20, backgroundColor: '#000' },
  activeTabItem: { backgroundColor: '#cadb2a', borderWidth: 2, borderColor: '#000' },
  tabText: { color: '#fff', fontSize: 13, fontFamily: 'Poppins' },
  activeTabText: { color: '#111', fontWeight: 'bold' },

  // Sections
  sectionContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
  sectionTitle: { color: '#cadb2a', fontSize: 16, fontWeight: 'bold', fontFamily: 'Poppins', marginBottom: 10 },
  subSectionTitle: { color: '#aaa', fontSize: 13, fontWeight: '600', fontFamily: 'Poppins', marginBottom: 8, marginTop: 5 },
  descriptionText: { color: '#ccc', fontSize: 14, fontFamily: 'Poppins', lineHeight: 20 },

  // 🟢 Car Details Grid Styles
  carDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#222', padding: 8 },
  carDetailItem: { width: '50%', padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  carDetailLabel: { color: '#888', fontSize: 12, fontFamily: 'Poppins', marginBottom: 4 },
  carDetailValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  carDetailValue: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: 'Poppins' },

  // 🟢 Inspection Grid Styles
  inspGridRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#222', paddingVertical: 8 },
  inspGridItem: { width: '50%', paddingRight: 5 },
  inspLabel: { color: '#888', fontSize: 12, fontFamily: 'Poppins', marginBottom: 2 },
  inspValue: { fontSize: 14, fontWeight: 'bold', fontFamily: 'Poppins' },
  inspCommentBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#222' },
  inspCommentLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  inspCommentText: { color: '#ccc', fontSize: 12, fontStyle: 'italic' },

  // Map
  damageMapContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 15 },
  damageMapImage: { width: '100%', height: 200 },
  featureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },

  // Accordion
  accordionContainer: { marginBottom: 10, backgroundColor: '#111', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, alignItems: 'center', backgroundColor: '#1a1a1a' },
  accordionTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', fontFamily: 'Poppins' },
  accordionContent: { padding: 15, backgroundColor: '#000' },

  // Damages
  damagesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  damageGridItem: { width: '48%', backgroundColor: '#181818', borderRadius: 8, padding: 10, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  damageBadge: { borderRadius: 4, paddingVertical: 3, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', marginBottom: 6, width: '100%', justifyContent: 'center' },
  damageText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginLeft: 4, textAlign: 'center' },
  damageBodyPart: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  damageSubText: { color: '#ccc', fontSize: 10, textAlign: 'center', marginTop: 2 },
  showMoreBtn: { alignItems: 'center', marginTop: 15 },
  showMoreText: { color: '#888', fontSize: 14, fontFamily: 'Poppins' },

  // 🟢 Final Conclusion Styles
  finalConclusionContainer: { backgroundColor: '#111', borderLeftWidth: 4, borderLeftColor: '#cadb2a', padding: 16, borderRadius: 8, marginTop: 20, borderWidth: 1, borderColor: '#333' },
  finalConclusionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: '#cadb2a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' },
  finalConclusionTitle: { color: '#000', fontSize: 12, fontWeight: 'bold', fontFamily: 'Poppins', marginLeft: 6, textTransform: 'uppercase' },
  finalConclusionText: { color: '#fff', fontSize: 14, lineHeight: 22, fontFamily: 'Poppins' },

  // 🟢 Remarks Styles
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionIconBadge: { backgroundColor: '#cadb2a', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  sectionTitleNew: { color: '#fff', fontSize: 18, fontWeight: 'bold', fontFamily: 'Poppins' },
  remarksContainer: { backgroundColor: '#111', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  remarksText: { color: '#ccc', fontSize: 14, lineHeight: 20, fontFamily: 'Poppins' },

  // Status & Footer
  statusCard: { backgroundColor: '#111', marginHorizontal: 16, marginBottom: 20, borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  statusTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', fontFamily: 'Poppins', marginBottom: 8, textAlign: 'center' },
  statusSubText: { color: '#aaa', fontSize: 13, fontFamily: 'Poppins', textAlign: 'center', lineHeight: 20 },
  negotiationFooter: { flexDirection: 'column', alignItems: 'center', padding: 16, paddingBottom: 12, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222' },
  footerBtnFilled: { width: '100%', backgroundColor: '#cadb2a', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  footerBtnTextFilled: { color: '#000', fontSize: 16, fontWeight: 'bold', fontFamily: 'Poppins' },
  footerBtnOutline: { width: '100%', borderWidth: 1, borderColor: '#cadb2a', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, marginTop: 10 },
  footerBtnTextOutline: { color: '#cadb2a', fontSize: 16, fontWeight: 'bold', fontFamily: 'Poppins' },
  adminFeeText: { color: '#888', fontSize: 10, marginTop: 12, fontFamily: 'Poppins' },
  adminFeeBold: { color: '#fff', fontWeight: 'bold' },
  commentBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#111', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  commentContainer: { marginTop: 10 },
  tag: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginRight: 5, marginBottom: 5 },
  tagText: { fontSize: 12, fontFamily: 'Poppins' },

  // Modal
  videoModalContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  videoCloseBtn: { position: 'absolute', top: 50, right: 30, zIndex: 20, padding: 10 },
  fullscreenVideo: { width: width, height: height * 0.8 },

  // Inquiry Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111', borderRadius: 16, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: '#cadb2a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', fontFamily: 'Poppins', flex: 1 },
  label: { color: '#cadb2a', fontSize: 14, fontFamily: 'Poppins', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#333' },
  submitBtn: { backgroundColor: '#cadb2a', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold', fontFamily: 'Poppins' },
});