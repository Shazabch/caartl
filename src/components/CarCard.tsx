import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Models from '../data/modal';
import { parseAuctionDateInDubai } from '../lib/dubaiTime';
import { useAuth } from '../context/AuthContext';

interface CarCardProps {
  car: Models.Vehicle;
  onPress: (car: Models.Vehicle) => void;
  variant?: 'negotiation' | 'live' | 'upcoming' | 'listed';
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  hideBadges?: boolean;
  hidePrice?: boolean;
}

export const CarCard: React.FC<CarCardProps> = ({
  car,
  onPress,
  variant,
  isFavorite = false,
  onToggleFavorite,
  hideBadges = false,
  hidePrice = false,
}) => {
  const { user } = useAuth();
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (variant === 'negotiation' || variant === 'listed') return;

    const calculateTimeLeft = () => {
      const targetString = variant === 'upcoming'
        ? car.auction_start_date
        : car.auction_end_date;

      const targetDate = parseAuctionDateInDubai(targetString);
      if (!targetDate) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const now = new Date();
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
    };

    const timer = setInterval(calculateTimeLeft, 1000);
    calculateTimeLeft();

    return () => clearInterval(timer);
  }, [car.auction_end_date, car.auction_start_date, variant]);

  const countdownData = [
    { value: countdown.days.toString(), label: 'Days' },
    { value: countdown.hours.toString().padStart(2, '0'), label: 'Hours' },
    { value: countdown.minutes.toString().padStart(2, '0'), label: 'Min' },
    { value: countdown.seconds.toString().padStart(2, '0'), label: 'Sec' },
  ];

  const brandName = car.brand?.name || '';
  const modelName = car.vehicle_model?.name || '';
  const variantName = car.variant || '';
  const fullTitle = `${brandName} ${modelName} ${variantName}`.trim();

  let leftPriceLabel = 'Starting Bid';
  let leftPriceValue = Number(car.starting_bid_amount).toLocaleString();
  let rightPriceLabel = 'Buy Now';
  let rightPriceValue = car.price ? Number(car.price).toLocaleString() : 'N/A';
  let showLeftPrice = true;

  if (variant === 'live') {
    leftPriceLabel = 'Current Bid';
    const latestBidAmount = car.latest_bid?.bid_amount;
    const val = Number(car.current_bid ?? latestBidAmount ?? car.starting_bid_amount);
    leftPriceValue = val.toLocaleString();
    rightPriceLabel = 'Seller Expectation';
  }
  else if (variant === 'upcoming') {
    showLeftPrice = false;
    rightPriceLabel = 'Seller Expectation';
  }
  else if (variant === 'negotiation') {
    leftPriceLabel = 'Highest Bid';
    leftPriceValue = car.current_bid ? Number(car.current_bid).toLocaleString() : 'N/A';
    rightPriceLabel = 'Seller Expectation';
  }
  else if (variant === 'listed') {
    showLeftPrice = false;
    rightPriceLabel = 'Asking Price';
    rightPriceValue = car.price ? Number(car.price).toLocaleString() : Number(car.starting_bid_amount).toLocaleString();
  }

  const isMyBidHighest = car.latest_bid?.user_id === user?.id;

  const transmission = car.transmission_id === 1 ? 'Manual' : (car.transmission_id === 2 ? 'Automatic' : (car.transmission_id === 3 ? 'CVT' : null));

  let imageUrl = 'https://c.animaapp.com/mg9397aqkN2Sch/img/tesla.png';
  if (car.cover_image) {
    if (typeof car.cover_image === 'string') {
      imageUrl = car.cover_image;
    } else if (typeof car.cover_image === 'object' && (car.cover_image as any).path) {
      imageUrl = (car.cover_image as any).path;
    }
  } else if (car.images && Array.isArray(car.images) && car.images.length > 0) {
    const coverObj = car.images.find((img: any) => img.is_cover === 1);
    if (coverObj && coverObj.path) {
      imageUrl = coverObj.path;
    } else {
      imageUrl = car.images[0].path;
    }
  } else if (car.brand?.image_source) {
    imageUrl = car.brand.image_source;
  }

  // 🟢 Conditional Styles based on variant
  const isAuctionType = variant === 'live' || variant === 'upcoming' || variant === 'negotiation';
  const cardStyle = [
    styles.card,
    !isAuctionType && styles.cardListed // Apply background/border only if NOT auction type
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity activeOpacity={0.95} onPress={() => onPress(car)}>
        <View style={cardStyle}>
          <Image source={{ uri: imageUrl }} style={styles.image} />

          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']} style={styles.gradient} />

          {onToggleFavorite && (
            <TouchableOpacity
              style={styles.favButton}
              onPress={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              <MaterialCommunityIcons
                name={isFavorite ? "heart" : "heart-outline"}
                size={20}
                color={isFavorite ? "#ff4444" : "#ffffff"}
              />
            </TouchableOpacity>
          )}

          {variant !== 'negotiation' && variant !== 'listed' && (
            <View style={styles.countdownContainer}>
              {countdownData.map((item, index) => (
                <View key={index} style={styles.countdownItem}>
                  <Text style={styles.countdownValue}>{item.value}</Text>
                  <Text style={styles.countdownLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.bottomContent}>
            <View style={styles.infoRow}>
              <View style={styles.titleContainer}>
                <Text style={styles.title} numberOfLines={2}>{fullTitle}</Text>
                <Text style={styles.subtitle}>{car.year}</Text>
              </View>

              {!hidePrice && (
                <View style={styles.priceContainer}>
                  {showLeftPrice && (
                    <>
                      <View style={styles.priceColumn}>
                        <View style={styles.priceBadge}>
                          <Text style={styles.priceBadgeText}>{leftPriceLabel}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.priceValue, (isMyBidHighest && leftPriceLabel === 'Current Bid') && { color: '#2ecc71' }]}>AED {leftPriceValue}</Text>
                          {(isMyBidHighest && leftPriceLabel === 'Current Bid') && <Feather name="arrow-up" size={12} color="#2ecc71" style={{ marginLeft: 2 }} />}
                        </View>
                      </View>
                      <View style={styles.divider} />
                    </>
                  )}

                  <View style={styles.priceColumn}>
                    <View style={styles.priceBadge}>
                      <Text style={styles.priceBadgeText}>{rightPriceLabel}</Text>
                    </View>
                    <Text style={styles.priceValue}>AED {rightPriceValue}</Text>
                  </View>
                </View>
              )}
            </View>

            {!hideBadges && (
              <View style={styles.badgeRow}>
                {variant === 'live' && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {car.bids_count ? `${car.bids_count} Bids` : '0 Bids'}
                    </Text>
                  </View>
                )}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{car.condition}</Text>
                </View>
                {transmission && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{transmission}</Text>
                  </View>
                )}
                {car.mileage ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{car.mileage} km</Text>
                  </View>
                ) : null}
                {car.engine_cc ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{car.engine_cc} cc</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 15 },
  card: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    // Default transparent/no border for Auctions
  },
  // 🟢 Specific style for 'Listed' vehicles
  cardListed: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
  },
  image: { width: '100%', height: '100%' },
  gradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  favButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  countdownContainer: { position: 'absolute', top: 12, left: 14, flexDirection: 'row', gap: 4 },
  countdownItem: { width: 40, height: 40, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  countdownValue: { fontFamily: 'Lato', fontWeight: '700', fontSize: 16, color: '#ffffff' },
  countdownLabel: { fontFamily: 'Lato', fontSize: 10, color: '#ffffff' },

  titleContainer: { flex: 1, paddingRight: 10, justifyContent: 'center' },
  title: { fontFamily: 'Poppins', fontWeight: '700', fontSize: 14, color: '#ffffff', lineHeight: 20, textAlign: 'left' },
  subtitle: { fontFamily: 'Poppins', fontSize: 14, color: '#d3d3d3', marginTop: 4, textAlign: 'left', fontWeight: '500' },

  bottomContent: { position: 'absolute', bottom: 12, left: 16, right: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },

  priceContainer: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  priceColumn: { alignItems: 'center' },
  priceBadge: { backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 2 },
  priceBadgeText: { fontFamily: 'Poppins', fontSize: 10, color: '#ffffff', fontWeight: '600' },
  priceValue: { fontFamily: 'Lato', fontWeight: '800', fontSize: 14, color: '#ffffff' },
  divider: { width: 1, height: 38, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 3 },

  badgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, },
  badgeText: { fontFamily: 'Poppins', fontSize: 10, color: '#ffffff', textTransform: 'capitalize' },
});