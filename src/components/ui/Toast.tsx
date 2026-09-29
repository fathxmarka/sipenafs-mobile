import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
}

export function Toast({ visible, message, type = 'info', duration = 3500, onDismiss }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          speed: 12,
          bounciness: 4,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, message]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible && message === '') return null;

  const getTheme = () => {
    switch (type) {
      case 'success':
        return {
          bg: '#ECFDF5',
          border: '#10B981',
          text: '#065F46',
          icon: 'checkmark-circle' as const,
          iconColor: '#10B981',
        };
      case 'error':
        return {
          bg: '#FEF2F2',
          border: '#EF4444',
          text: '#991B1B',
          icon: 'alert-circle' as const,
          iconColor: '#EF4444',
        };
      case 'warning':
        return {
          bg: '#FFFBEB',
          border: '#F59E0B',
          text: '#92400E',
          icon: 'warning' as const,
          iconColor: '#F59E0B',
        };
      default:
        return {
          bg: '#EFF6FF',
          border: '#3B82F6',
          text: '#1E40AF',
          icon: 'information-circle' as const,
          iconColor: '#3B82F6',
        };
    }
  };

  const theme = getTheme();

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          backgroundColor: theme.bg,
          borderColor: theme.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Ionicons name={theme.icon} size={22} color={theme.iconColor} style={styles.icon} />
      <Text style={[styles.text, { color: theme.text }]} numberOfLines={3}>
        {message}
      </Text>
      <TouchableOpacity onPress={handleDismiss} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={18} color={theme.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 65 : 50,
    left: 20,
    right: 20,
    zIndex: 99999,
    elevation: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  closeButton: {
    marginLeft: 8,
    padding: 2,
  },
});
