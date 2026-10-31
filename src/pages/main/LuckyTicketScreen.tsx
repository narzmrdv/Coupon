import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  PanResponder, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Clock } from 'lucide-react-native';
import { Svg, Defs, Mask, Rect, Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showRewardedAd } from '@/shared/lib/admob/admobService';
import { bonusApi } from '@/entities/bonus/api/bonusApi';
import { useBonus } from '@/shared/lib/hooks';
import { wp, hp, fontSize } from '@/shared/lib/responsive';
import { AirplaneBackground } from '@/shared/ui/AirplaneBackground';

const SCRATCH_W = 260;
const SCRATCH_H = 150;
const HOLE_R = 14;
const HISTORY_KEY = '@lucky_ticket_history_v1';

const PRIZES = [
  { amount: 0, label: '0 TVA', won: false, weight: 40 },
  { amount: 0.001, label: '0.001 TVA', won: true, weight: 30 },
  { amount: 0.005, label: '0.005 TVA', won: true, weight: 20 },
  { amount: 0.01, label: '0.01 TVA', won: true, weight: 10 },
];

function pickPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PRIZES[0];
}

type Phase = 'idle' | 'watching' | 'scratching' | 'revealed';

interface TicketHistory {
  amount: number;
  date: string;
  won: boolean;
}

export const LuckyTicketScreen = () => {
  const navigation = useNavigation();
  const { fetchBalance } = useBonus();
  const [phase, setPhase] = useState<Phase>('idle');
  const [prize, setPrize] = useState(PRIZES[0]);
  const [holes, setHoles] = useState<Array<{ x: number; y: number }>>([]);
  const [showOkButton, setShowOkButton] = useState(false);
  const [history, setHistory] = useState<TicketHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const okButtonShownRef = useRef(false);
  // Refs to avoid stale closure inside PanResponder (created once)
  const phaseRef = useRef<Phase>('idle');
  const prizeRef = useRef(PRIZES[0]);
  phaseRef.current = phase;
  prizeRef.current = prize;
  // For correct touch coordinates — measure view position on screen
  const scratchViewRef = useRef<View>(null);
  const scratchOffset = useRef({ x: 0, y: 0 });
  const pendingHolesRef = useRef<Array<{ x: number; y: number }>>([]);
  const flushRafRef = useRef<number | null>(null);
  const holeCountRef = useRef(0);
  const fetchBalanceRef = useRef(fetchBalance);
  fetchBalanceRef.current = fetchBalance;
  const fingerBounceAnim = useRef(new Animated.Value(0)).current;
  const fingerOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      if (raw) setHistory(JSON.parse(raw) as TicketHistory[]);
    });
  }, []);

  const saveHistory = (entry: TicketHistory) => {
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, 20);
      void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleWatchAd = async () => {
    setPhase('watching');
    try {
      const adResult = await showRewardedAd();
      if (adResult.earned) {
        try {
          await bonusApi.earnAdViewBonus();
        } catch {}
      }
      const picked = pickPrize();
      setPrize(picked);
      setHoles([]);
      setShowOkButton(false);
      okButtonShownRef.current = false;
      lastPos.current = null;
      setPhase('scratching');
    } catch {
      setPhase('idle');
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: ({ nativeEvent }) => {
        addHole(nativeEvent.pageX - scratchOffset.current.x, nativeEvent.pageY - scratchOffset.current.y);
      },
      onPanResponderMove: ({ nativeEvent }) => {
        addHole(nativeEvent.pageX - scratchOffset.current.x, nativeEvent.pageY - scratchOffset.current.y);
      },
    })
  ).current;

  function addHole(x: number, y: number) {
    if (phaseRef.current !== 'scratching') return;
    if (lastPos.current) {
      const dx = x - lastPos.current.x;
      const dy = y - lastPos.current.y;
      if (dx * dx + dy * dy < 64) return; // 8 px between holes — smooth
    }
    lastPos.current = { x, y };
    pendingHolesRef.current.push({ x, y });
    if (flushRafRef.current !== null) return; // RAF already queued
    flushRafRef.current = requestAnimationFrame(() => {
      flushRafRef.current = null;
      const batch = pendingHolesRef.current.splice(0);
      if (!batch.length) return;
      holeCountRef.current += batch.length;
      setHoles(prev => [...prev, ...batch]);
      if (!okButtonShownRef.current) {
        const covered = holeCountRef.current * Math.PI * HOLE_R * HOLE_R;
        if (covered / (SCRATCH_W * SCRATCH_H) > 0.80) {
          okButtonShownRef.current = true;
          setShowOkButton(true);
          void fetchBalanceRef.current();
          saveHistory({ amount: prizeRef.current.amount, date: new Date().toISOString(), won: prizeRef.current.won });
        }
      }
    });
  }

  const handleReset = () => {
    if (flushRafRef.current !== null) {
      cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = null;
    }
    pendingHolesRef.current = [];
    holeCountRef.current = 0;
    setPhase('idle');
    setHoles([]);
    setShowOkButton(false);
    okButtonShownRef.current = false;
    lastPos.current = null;
  };

  const fingerVisible = phase === 'scratching' && holes.length === 0;
  useEffect(() => {
    if (fingerVisible) {
      fingerBounceAnim.setValue(0);
      fingerOpacityAnim.setValue(1);
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(fingerBounceAnim, { toValue: -10, duration: 550, useNativeDriver: true }),
          Animated.timing(fingerBounceAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      Animated.timing(fingerOpacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [fingerVisible]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AirplaneBackground />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={wp(28)} color="#1E293B" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>✈️ TVA LUCKY TICKET</Text>
          <Text style={styles.headerSub}>Смотри рекламу и получай бонусы!</Text>
        </View>
        <TouchableOpacity onPress={() => setShowHistory(!showHistory)} style={styles.historyBtn}>
          <Clock size={wp(22)} color="#0EA5E9" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} scrollEnabled={phase !== 'scratching'}>
        {showHistory ? (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>История билетов</Text>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>У вас ещё нет билетов</Text>
            ) : (
              history.map((item, i) => (
                <View key={i} style={styles.historyItem}>
                  <View style={styles.historyIconBox}>
                    <Text style={styles.historyTicketEmoji}>🎫</Text>
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyAmount}>{item.amount} TVA</Text>
                    <Text style={styles.historyDesc}>
                      {item.won ? 'Бонус зачислен' : 'Попробуйте ещё раз'}
                    </Text>
                  </View>
                  <Text style={styles.historyDate}>
                    {new Date(item.date).toLocaleDateString('ru')}
                  </Text>
                </View>
              ))
            )}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Смотри рекламу каждый день{'\n'}и получай больше билетов!
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.backToGameBtn}>
              <Text style={styles.backToGameText}>← К игре</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Ticket card */}
            <View style={styles.ticketCard}>
              <View style={styles.ticketTop}>
                <Text style={styles.ticketBrand}>TVA</Text>
                <Text style={styles.ticketSub}>LUCKY TICKET</Text>
              </View>

              {phase === 'scratching' ? (
                <View style={styles.scratchOuter}>
                  <View
                    ref={scratchViewRef}
                    style={styles.scratchWrapper}
                    onLayout={() => {
                      scratchViewRef.current?.measure((_x, _y, _w, _h, px, py) => {
                        scratchOffset.current = { x: px, y: py };
                      });
                    }}
                    {...panResponder.panHandlers}
                  >
                    {/* Prize visible under overlay */}
                    <View style={styles.prizeContent}>
                      <Text style={styles.prizeAmount}>{prize.label}</Text>
                      <Text style={styles.prizeDesc}>
                        {prize.won ? 'Ваш бонус' : 'Попробуйте ещё раз'}
                      </Text>
                    </View>
                    {/* Scratch overlay */}
                    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                      <Svg width={SCRATCH_W} height={SCRATCH_H}>
                        <Defs>
                          <Mask id="scratchMask">
                            <Rect width={SCRATCH_W} height={SCRATCH_H} fill="white" />
                            {holes.map((h, idx) => (
                              <Circle key={idx} cx={h.x} cy={h.y} r={HOLE_R} fill="black" />
                            ))}
                          </Mask>
                        </Defs>
                        <Rect
                          x={0} y={0}
                          width={SCRATCH_W} height={SCRATCH_H}
                          fill="#B8C2CC"
                          mask="url(#scratchMask)"
                          rx={10}
                        />
                      </Svg>
                    </View>
                  </View>
                  {/* Finger hint — outside scratchWrapper's overflow:hidden so it renders on top */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.fingerHint,
                      { opacity: fingerOpacityAnim, transform: [{ translateY: fingerBounceAnim }] },
                    ]}
                  >
                    <Text style={styles.fingerEmoji}>👇</Text>
                    <Text style={styles.fingerText}>Стирай!</Text>
                  </Animated.View>
                </View>
              ) : (
                <View style={styles.ticketPlaceholder}>
                  <Text style={styles.ticketEmoji}>✈️</Text>
                  <Text style={styles.ticketPlaceholderText}>Ваш билет ждёт вас</Text>
                </View>
              )}

              {/* Barcode */}
              <View style={styles.barcode}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.barcodeBar,
                      { height: i % 4 === 0 ? hp(30) : hp(22), opacity: 0.3 + (i % 3) * 0.1 },
                    ]}
                  />
                ))}
              </View>
            </View>

            <Text style={styles.bottomHint}>Сотри защитный слой{'\n'}и узнай свой бонус!</Text>

            {phase === 'idle' && (
              <TouchableOpacity style={styles.watchAdBtn} onPress={handleWatchAd} activeOpacity={0.85}>
                <Text style={styles.watchAdIcon}>▶️</Text>
                <Text style={styles.watchAdText}>Смотреть рекламу</Text>
              </TouchableOpacity>
            )}

            {phase === 'watching' && (
              <View style={[styles.watchAdBtn, { opacity: 0.8 }]}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.watchAdText}>Загрузка...</Text>
              </View>
            )}

            {showOkButton && (
              <TouchableOpacity style={styles.okBtn} onPress={handleReset} activeOpacity={0.85}>
                <Text style={styles.okBtnText}>Отлично!</Text>
              </TouchableOpacity>
            )}

            {/* Tips */}
            <View style={styles.tipsRow}>
              <View style={styles.tip}>
                <Text style={styles.tipEmoji}>▶️</Text>
                <Text style={styles.tipText}>1 билет = 1 просмотр рекламы</Text>
              </View>
              <View style={styles.tip}>
                <Text style={styles.tipEmoji}>🎫</Text>
                <Text style={styles.tipText}>До 5 билетов в день</Text>
              </View>
            </View>
          </>
        )}
        <View style={{ height: hp(100) }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(12),
    paddingVertical: hp(10),
  },
  backBtn: { padding: wp(4) },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: fontSize(16), fontWeight: '700', color: '#1E293B' },
  headerSub: { fontSize: fontSize(12), color: '#64748B', fontWeight: '500' },
  historyBtn: { padding: wp(8) },
  scroll: { paddingHorizontal: wp(16), paddingTop: hp(8), alignItems: 'center' },

  // Ticket
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp(20),
    width: wp(300),
    overflow: 'hidden',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  ticketTop: {
    backgroundColor: '#EFF6FF',
    paddingVertical: hp(14),
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#BAE6FD',
    borderStyle: 'dashed',
  },
  ticketBrand: { fontSize: fontSize(28), fontWeight: '800', color: '#0EA5E9', letterSpacing: 3 },
  ticketSub: { fontSize: fontSize(13), fontWeight: '600', color: '#60A5FA', letterSpacing: 2 },
  ticketPlaceholder: {
    height: hp(150),
    alignItems: 'center',
    justifyContent: 'center',
    gap: hp(8),
  },
  ticketEmoji: { fontSize: 48 },
  ticketPlaceholderText: { fontSize: fontSize(14), color: '#94A3B8', fontWeight: '500' },

  // Scratch
  scratchOuter: {
    width: SCRATCH_W,
    alignSelf: 'center',
    marginVertical: hp(12),
  },
  scratchWrapper: {
    width: SCRATCH_W,
    height: SCRATCH_H,
    alignSelf: 'center',
    borderRadius: wp(10),
    overflow: 'hidden',
  },
  fingerHint: {
    position: 'absolute',
    top: SCRATCH_H / 2 - 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  fingerEmoji: { fontSize: 36 },
  fingerText: {
    fontSize: fontSize(12),
    color: '#1E293B',
    fontWeight: '700',
    marginTop: 2,
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowRadius: 6,
  },
  prizeContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    gap: hp(6),
  },
  prizeAmount: { fontSize: fontSize(32), fontWeight: '800', color: '#0EA5E9' },
  prizeDesc: { fontSize: fontSize(14), color: '#64748B', fontWeight: '600' },
  scratchHint: { fontSize: fontSize(14), color: '#94A3B8', fontWeight: '500' },

  // Barcode
  barcode: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp(12),
    paddingHorizontal: wp(16),
    gap: wp(2),
  },
  barcodeBar: {
    width: wp(2.5),
    backgroundColor: '#334155',
    borderRadius: 1,
  },

  bottomHint: {
    textAlign: 'center',
    fontSize: fontSize(15),
    color: '#334155',
    fontWeight: '600',
    marginVertical: hp(20),
    lineHeight: fontSize(22),
  },

  // Buttons
  watchAdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    borderRadius: wp(16),
    paddingVertical: hp(16),
    paddingHorizontal: wp(32),
    gap: wp(8),
    width: '100%',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  watchAdIcon: { fontSize: 18 },
  watchAdText: { fontSize: fontSize(17), fontWeight: '700', color: '#FFFFFF' },
  okBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: wp(16),
    paddingVertical: hp(16),
    paddingHorizontal: wp(48),
    width: '100%',
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  okBtnText: { fontSize: fontSize(17), fontWeight: '700', color: '#FFFFFF' },

  // Tips
  tipsRow: {
    flexDirection: 'row',
    gap: wp(12),
    marginTop: hp(20),
    width: '100%',
  },
  tip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: wp(12),
    padding: wp(12),
    alignItems: 'center',
    gap: hp(6),
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  tipEmoji: { fontSize: 20 },
  tipText: {
    fontSize: fontSize(11),
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: fontSize(16),
  },

  // History
  historyContainer: { width: '100%' },
  historyTitle: {
    fontSize: fontSize(20),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(16),
  },
  historyEmpty: { fontSize: fontSize(15), color: '#94A3B8', textAlign: 'center', marginTop: hp(32) },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: wp(14),
    padding: wp(14),
    marginBottom: hp(10),
    gap: wp(12),
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  historyIconBox: {
    width: wp(40),
    height: wp(40),
    borderRadius: wp(12),
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTicketEmoji: { fontSize: 20 },
  historyInfo: { flex: 1 },
  historyAmount: { fontSize: fontSize(16), fontWeight: '700', color: '#1E293B' },
  historyDesc: { fontSize: fontSize(12), color: '#64748B', fontWeight: '500' },
  historyDate: { fontSize: fontSize(12), color: '#94A3B8' },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: wp(12),
    padding: wp(14),
    marginVertical: hp(16),
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  infoText: {
    fontSize: fontSize(13),
    color: '#0EA5E9',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: fontSize(20),
  },
  backToGameBtn: { alignItems: 'center', paddingVertical: hp(12) },
  backToGameText: { fontSize: fontSize(15), color: '#0EA5E9', fontWeight: '600' },
});
