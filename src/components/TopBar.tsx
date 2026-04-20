import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAlert } from '../context/AlertContext';
import * as Models from '../data/modal';
import { parseAuctionDateInDubai } from '../lib/dubaiTime';
import type { NotificationItem, RootStackParamList } from '../navigation/AppNavigator';
import ApiService from '../services/ApiService';

interface TopBarProps {
  onMenuPress?: () => void;
  onNotificationPress?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuPress, onNotificationPress }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { showAlert } = useAlert();
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const isOutbidNotification = (item: NotificationItem) => {
    return item.data?.type === 'outbid' && !!item.data?.vehicle_id;
  };

  const resolveAuctionState = async (vehicleId: number): Promise<'live' | 'upcoming' | 'ended' | 'unknown'> => {
    try {
      const result = await ApiService.getAuctionDetails(vehicleId);
      const vehicle = result.data?.data?.vehicle;

      if (!result.success || !vehicle?.auction_start_date || !vehicle?.auction_end_date) {
        return 'unknown';
      }

      const startDate = parseAuctionDateInDubai(vehicle.auction_start_date);
      const endDate = parseAuctionDateInDubai(vehicle.auction_end_date);
      if (!startDate || !endDate) return 'unknown';

      const now = new Date();
      if (now < startDate) return 'upcoming';
      if (now >= endDate) return 'ended';
      return 'live';
    } catch {
      return 'unknown';
    }
  };

  // 🟢 Helper: Calculate "Time Ago"
  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return past.toLocaleDateString(); // Fallback to date
  };

  // 🟢 Helper: Map API Data to UI Title/Message
 const mapNotificationToItem = (apiNotif: Models.ApiNotification): NotificationItem => {
  // Default values
  let title = apiNotif.data.title || 'Notification';
  let message = apiNotif.data.message || 'You have a new update.';

  // Specific Logic based on notification Type if title/message are missing in data
  if (!apiNotif.data.title && apiNotif.type.includes('BookingStatusChangedNotification')) {
    const status = apiNotif.data.status?.replace('_', ' ') || 'updated';
    title = `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    message = `Your booking for ${apiNotif.data.vehicle_title || 'vehicle'} is now ${status}.`;
  } else if (!apiNotif.data.title && apiNotif.type.includes('PaymentSlipUploadedNotification')) {
    title = 'Payment Slip Uploaded';
    message = apiNotif.data.message || `Payment slip uploaded for invoice #${apiNotif.data.invoice_id}`;
  }

  return {
    id: apiNotif.id,
    title: title,
    message: message,
    time: getRelativeTime(apiNotif.created_at),
    isRead: !!apiNotif.read_at,
    data: apiNotif.data,
    auctionState: 'unknown'
  };
};

  // 🟢 Fetch Notifications
  const fetchNotifications = async () => {
    if (notifications.length === 0) setLoading(true);
    
    try {
      const response = await ApiService.getNotifications();
      if (response.success && response.data.data.data) {
        const mappedData = response.data.data.data.map(mapNotificationToItem);
        const enrichedData = await Promise.all(
          mappedData.map(async (item) => {
            if (!isOutbidNotification(item)) return item;
            const auctionState = await resolveAuctionState(Number(item.data.vehicle_id));
            return { ...item, auctionState };
          })
        );
        setNotifications(enrichedData);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    },[])
  );

  const handleBellPress = () => {
    setShowDropdown(prev => !prev);
    if (!showDropdown) {
        fetchNotifications(); 
    }
    if (onNotificationPress) {
      onNotificationPress();
    }
  };

  const handleNotificationItemPress = async (item: NotificationItem) => {
    // 1. Optimistic UI update
    setNotifications(prev =>
      prev.map(entry => (entry.id === item.id ? { ...entry, isRead: true } : entry))
    );

    // 2. Call API
    try {
      await ApiService.markNotificationAsRead(item.id);
    } catch (error) {
      console.log("Error marking read", error);
    }

    // 3. Navigation logic
    if (item.data) {
      const { vehicle_id, bid_id, invoice_id, type } = item.data;

      // Navigate to Auction/Vehicle Detail
      if (vehicle_id) {
          // 🟢 UPDATED LOGIC: If bid_approved, open in negotiation view
          if (type === 'bid_approved') {
               console.log("Navigating to LiveAuction (Negotiation)", vehicle_id);
               navigation.navigate('LiveAuction', { carId: Number(vehicle_id), viewType: 'negotiation' });
               setShowDropdown(false);
          } 
          // If other bid related -> LiveAuction
          else if (bid_id || type === 'outbid' || type === 'bid_placed') {
               const parsedVehicleId = Number(vehicle_id);
               const auctionState = item.auctionState && item.auctionState !== 'unknown'
                 ? item.auctionState
                 : await resolveAuctionState(parsedVehicleId);

               if (auctionState === 'ended') {
                 showAlert('Auction Ended', 'This auction has already ended, so bidding is no longer available.');
                 navigation.navigate('CarDetailPage', { carId: parsedVehicleId });
               } else if (auctionState === 'upcoming') {
                 navigation.navigate('LiveAuction', { carId: parsedVehicleId, viewType: 'upcoming' });
               } else {
                 console.log("Navigating to LiveAuction", parsedVehicleId);
                 navigation.navigate('LiveAuction', { carId: parsedVehicleId, viewType: 'live' });
               }
               setShowDropdown(false);
          } 
          // Default -> CarDetailPage
          else {
               console.log("Navigating to CarDetailPage", vehicle_id);
               navigation.navigate('CarDetailPage', { carId: Number(vehicle_id) });
               setShowDropdown(false);
          }
      } 
      else if (invoice_id) {
           console.log("Navigate to Invoice", invoice_id);
           setShowDropdown(false);
           // navigation.navigate('InvoiceDetail', { invoiceId: invoice_id }); 
      }
    }
  };

  const handleReadAll = async () => {
    setNotifications(prev => prev.map(entry => ({ ...entry, isRead: true })));
    try {
      await ApiService.markAllNotificationsAsRead();
    } catch (error) {
        console.log("Error marking all read", error);
    }
  };

  const handleViewAll = () => {
    setShowDropdown(false);
    navigation.navigate('Notifications', { notifications });
  };

  const unreadNotifications = notifications.filter(item => !item.isRead);
  const readNotifications = notifications.filter(item => item.isRead);

  const displayUnread = unreadNotifications.slice(0, 3);
  const displayRead = readNotifications.slice(0, 5 - displayUnread.length);

  return (
    <>
      {showDropdown && (
        <Pressable style={styles.dropdownBackdrop} onPress={() => setShowDropdown(false)} />
      )}

      <View style={styles.header}>
        {onMenuPress ? (
          <TouchableOpacity onPress={onMenuPress} activeOpacity={0.7} style={styles.headerButton}>
            <Svg width="26" height="24" viewBox="0 0 26 24" fill="none">
              <Path d="M0 2C0 0.895431 0.895431 0 2 0H20C21.1046 0 22 0.895431 22 2C22 3.10457 21.1046 4 20 4H2C0.895431 4 0 3.10457 0 2Z" fill="white" />
              <Path d="M0 12C0 10.8954 0.895431 10 2 10H16C17.1046 10 18 10.8954 18 12C18 13.1046 17.1046 14 16 14H2C0.895431 14 0 13.1046 0 12Z" fill="white" />
              <Path d="M0 22C0 20.8954 0.895431 20 2 20H20C21.1046 20 22 20.895431 22 22C22 23.1046 21.1046 24 20 24H2C0.895431 24 0 23.1046 0 22Z" fill="white" />
            </Svg>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 42 }} />
        )}

        <Text style={styles.logo}>caartI</Text>

        <TouchableOpacity onPress={handleBellPress} activeOpacity={0.7} style={styles.headerButton}>
          <View>
            <Svg width="24" height="28" viewBox="0 0 24 28" fill="none">
              <Path d="M12 0C10.9 0 10 0.9 10 2C10 2.6 10.3 3.1 10.7 3.4C7.1 4.4 4.5 7.6 4.5 11.5V17L2 19.5V21H22V19.5L19.5 17V11.5C19.5 7.6 16.9 4.4 13.3 3.4C13.7 3.1 14 2.6 14 2C14 0.9 13.1 0 12 0ZM12 28C13.7 28 15 26.7 15 25H9C9 26.7 10.3 28 12 28Z" fill="white" />
            </Svg>
            {unreadNotifications.length > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}</Text>
                </View>
            )}
          </View>
        </TouchableOpacity>

        {showDropdown && (
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Notifications</Text>
            
            {loading ? (
                <ActivityIndicator size="small" color="#cadb2a" style={{marginVertical: 20}} />
            ) : (
                <>
                    {displayUnread.length > 0 && (
                    <Text style={styles.sectionTitle}>Unread</Text>
                    )}
                    {displayUnread.map(item => (
                    <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.9}
                        style={[styles.dropdownItem, styles.unreadItem]}
                        onPress={() => handleNotificationItemPress(item)}
                    >
                        <View style={styles.dropdownItemRow}>
                        <View style={styles.dropdownItemTitleRow}>
                            <View style={styles.unreadDot} />
                            <Text style={styles.dropdownItemTitle} numberOfLines={1}>{item.title}</Text>
                            {isOutbidNotification(item) && item.auctionState === 'ended' && (
                              <View style={styles.closedBadge}>
                                <Text style={styles.closedBadgeText}>Auction Closed</Text>
                              </View>
                            )}
                        </View>
                        <Text style={styles.dropdownItemTime}>{item.time}</Text>
                        </View>
                        <Text style={styles.dropdownItemMessage} numberOfLines={2}>{item.message}</Text>
                    </TouchableOpacity>
                    ))}

                    {displayRead.length > 0 && (
                    <Text style={styles.sectionTitle}>Recent</Text>
                    )}
                    {displayRead.map(item => (
                    <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.9}
                        style={[styles.dropdownItem, styles.readItem]}
                        onPress={() => handleNotificationItemPress(item)}
                    >
                        <View style={styles.dropdownItemRow}>
                        <View style={styles.dropdownItemTitleRow}>
                          <Text style={styles.dropdownItemTitle} numberOfLines={1}>{item.title}</Text>
                          {isOutbidNotification(item) && item.auctionState === 'ended' && (
                            <View style={styles.closedBadge}>
                              <Text style={styles.closedBadgeText}>Auction Closed</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.dropdownItemTime}>{item.time}</Text>
                        </View>
                        <Text style={styles.dropdownItemMessage} numberOfLines={2}>{item.message}</Text>
                    </TouchableOpacity>
                    ))}

                    {notifications.length === 0 && (
                    <Text style={styles.emptyText}>No notifications yet.</Text>
                    )}
                </>
            )}

            <View style={styles.dropdownFooter}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.footerButton}
                onPress={handleReadAll}
              >
                <Text style={styles.footerButtonText}>Read All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.footerButton, styles.viewAllButton]}
                onPress={handleViewAll}
              >
                <Text style={styles.viewAllButtonText}>View All</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25.5,
    paddingTop: 10,
    paddingBottom: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerButton: {
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ff4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdown: {
    position: 'absolute',
    top: 54,
    right: 16,
    width: 280,
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    paddingVertical: 10,
    paddingHorizontal: 10,
    zIndex: 1001,
  },
  sectionTitle: {
    color: '#888',
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dropdownTitle: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: '#1d1d1d',
    marginBottom: 8,
  },
  unreadItem: {
    borderColor: '#2b2b2b',
  },
  readItem: {
    opacity: 0.6,
  },
  dropdownItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cadb2a',
    marginRight: 6,
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dropdownItemTitle: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  dropdownItemTime: {
    color: '#888',
    fontFamily: 'Poppins',
    fontSize: 11,
  },
  dropdownItemMessage: {
    color: '#aaa',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  closedBadge: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ff4444',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    flexShrink: 0,
  },
  closedBadgeText: {
    color: '#ff7777',
    fontFamily: 'Poppins',
    fontSize: 9,
    fontWeight: '700',
  },
  emptyText: {
    color: '#666',
    fontFamily: 'Poppins',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 10,
  },
  dropdownFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  footerButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1b1b1b',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
  },
  footerButtonText: {
    color: '#ddd',
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '600',
  },
  viewAllButton: {
    backgroundColor: '#cadb2a',
    borderColor: '#cadb2a',
  },
  viewAllButtonText: {
    color: '#000',
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '700',
  },
  logo: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 24,
    color: '#cadb2a',
    letterSpacing: -0.41,
  },
});