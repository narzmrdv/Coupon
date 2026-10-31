import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bonusApi } from '@/entities/bonus/api/bonusApi';
import { wp, hp, fontSize } from '@/shared/lib/responsive';
import { AirplaneBackground } from '@/shared/ui/AirplaneBackground';

// ─── Image assets ─────────────────────────────────────────────────────────────
const IMG_BOX       = require('../../../assets/gift_box.png');
const IMG_BOX_SHINE = require('../../../assets/shine_gift_box.png');
const IMG_BOX_OPEN  = require('../../../assets/gift_box_open.png');
const IMG_BOX_LID   = require('../../../assets/gift_box_lid.png');

// ─── Constants ────────────────────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOX_COST    = 5;
const BOX_SIZE    = wp(220);
const HISTORY_KEY = '@mystery_box_history_v1';

const CONFETTI_COLORS = ['#FF6B6B','#4ECDC4','#FCD34D','#A78BFA','#F472B6','#34D399','#F59E0B','#60A5FA'];

const CONFETTI_GRID_PALETTES: string[][] = [
  ['#FCD34D','#F59E0B','#FBBF24','#FDE68A','#F97316'],
  ['#60A5FA','#3B82F6','#93C5FD','#DBEAFE','#2563EB'],
  ['#34D399','#059669','#6EE7B7','#A7F3D0','#10B981'],
  ['#F472B6','#DB2777','#F9A8D4','#FBCFE8','#EC4899'],
  ['#A78BFA','#7C3AED','#C4B5FD','#DDD6FE','#8B5CF6'],
  ['#FB923C','#EA580C','#FDBA74','#FED7AA','#F97316'],
];

const CONFETTI_POSITIONS = [
  { t: 1,  l: 6,  s: 5,  r: '15deg'  },
  { t: 0,  l: 17, s: 4,  r: '-20deg' },
  { t: 7,  l: 1,  s: 4,  r: '35deg'  },
  { t: 7,  l: 13, s: 6,  r: '-10deg' },
  { t: 14, l: 7,  s: 5,  r: '25deg'  },
  { t: 13, l: 20, s: 4,  r: '-30deg' },
  { t: 3,  l: 24, s: 3,  r: '10deg'  },
  { t: 18, l: 2,  s: 3,  r: '-5deg'  },
];

function ConfettiIcon({ palette }: { palette: string[] }) {
  return (
    <View style={styles.confettiIconWrap}>
      {CONFETTI_POSITIONS.map((pos, j) => (
        <View
          key={j}
          style={{
            position: 'absolute',
            top: pos.t,
            left: pos.l,
            width: pos.s,
            height: pos.s,
            backgroundColor: palette[j % palette.length],
            borderRadius: j % 3 === 0 ? pos.s / 2 : 1,
            transform: [{ rotate: pos.r }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Starburst — широкие треугольные лучи ─────────────────────────────────────
const RAY_COUNT          = 16;
const RAY_D              = Math.hypot(SCREEN_W, SCREEN_H) * 1.35;
const RAY_LEN            = RAY_D / 2;
const RAY_HALF_BASE_MAIN = RAY_D * 0.09;
const RAY_HALF_BASE_SEC  = RAY_D * 0.042;

function StarBurst({ spin }: { spin?: Animated.Value }) {
  const spinDeg = spin?.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: RAY_D,
        height: RAY_D,
        top:  SCREEN_H * 0.46 - RAY_D / 2,
        left: SCREEN_W / 2   - RAY_D / 2,
        transform: spinDeg ? [{ rotate: spinDeg }] : [],
      }}
      pointerEvents="none"
    >
      {Array.from({ length: RAY_COUNT }).map((_, i) => {
        const angle  = (i / RAY_COUNT) * 360;
        const isMain = i % 2 === 0;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: RAY_D,
              height: RAY_D,
              alignItems: 'center',
              justifyContent: 'flex-start',
              transform: [{ rotate: `${angle}deg` }],
            }}
          >
            {/* Треугольный луч: широкий у края, острый конец к центру */}
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: isMain ? RAY_HALF_BASE_MAIN : RAY_HALF_BASE_SEC,
                borderRightWidth: isMain ? RAY_HALF_BASE_MAIN : RAY_HALF_BASE_SEC,
                borderTopWidth: RAY_LEN,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: isMain
                  ? 'rgba(247, 210, 72, 0.65)'
                  : 'rgba(253, 238, 140, 0.30)',
              }}
            />
          </View>
        );
      })}
    </Animated.View>
  );
}

// ─── Error boundary ───────────────────────────────────────────────────────────
class ScreenBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null; stack: string | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null, stack: null };
  }
  static getDerivedStateFromError(e: Error) { return { error: e.message || 'Ошибка', stack: null }; }
  componentDidCatch(_e: Error, info: React.ErrorInfo) {
    this.setState({ stack: info.componentStack?.slice(0, 300) ?? null });
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#EF4444', marginBottom: 8, textAlign: 'center' }}>Ошибка экрана</Text>
          <Text style={{ fontSize: 12, color: '#334155', textAlign: 'center' }}>{this.state.error}</Text>
          {this.state.stack && <Text style={{ fontSize: 9, color: '#94A3B8', marginTop: 8 }}>{this.state.stack}</Text>}
          <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 12 }}>Нажмите «Назад» на устройстве</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Types & data ─────────────────────────────────────────────────────────────
interface BoxPrize { emoji: string; title: string; desc: string; weight: number; }

const PRIZES: BoxPrize[] = [
  { emoji: '🪙', title: '0.05 TVA',        desc: 'Бонус зачислен на ваш баланс',          weight: 30 },
  { emoji: '🪙', title: '0.1 TVA',         desc: 'Бонус зачислен на ваш баланс',          weight: 25 },
  { emoji: '🪙', title: '0.5 TVA',         desc: 'Бонус зачислен на ваш баланс',          weight: 15 },
  { emoji: '🪙', title: '1 TVA',           desc: 'Бонус зачислен на ваш баланс',          weight: 10 },
  { emoji: '🏷️', title: 'Скидка 5%',      desc: 'Промокод отправлен в «Мои купоны»',     weight: 8  },
  { emoji: '🏷️', title: 'Скидка 10%',     desc: 'Промокод отправлен в «Мои купоны»',     weight: 5  },
  { emoji: '💰', title: 'Кэшбэк 15%',     desc: 'Применён к вашему аккаунту',            weight: 4  },
  { emoji: '👑', title: 'VIP статус 3 дня',desc: 'Больше бонусов и привилегий!',         weight: 2  },
  { emoji: '🎫', title: 'Доп. билет',      desc: 'Lucky Ticket добавлен в ваш аккаунт',  weight: 1  },
];

const POSSIBLE_PRIZES = [
  { label: '0.01 – 1 TVA' },
  { label: 'Скидка 2-29%' },
  { label: 'Доп. билет Lucky Ticket' },
  { label: 'Кэшбэк до 15%' },
  { label: 'VIP статус на 3 дня' },
  { label: 'Промокод на тур' },
];

function pickPrize(): BoxPrize {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) { r -= p.weight; if (r <= 0) return p; }
  return PRIZES[0];
}

interface BoxHistory { title: string; emoji: string; date: string; }
type Phase = 'idle' | 'ready' | 'opening' | 'revealed';

const REVEALED_CONFETTI = [
  { t:  '3%', l:  '5%', s: 10, c: '#FF6B6B', r:  15 },
  { t:  '5%', l: '88%', s:  8, c: '#4ECDC4', r: -20 },
  { t: '10%', l: '18%', s: 12, c: '#FCD34D', r:  30 },
  { t:  '8%', l: '73%', s:  7, c: '#A78BFA', r: -10 },
  { t: '16%', l:  '3%', s:  9, c: '#F472B6', r:  25 },
  { t: '14%', l: '92%', s: 11, c: '#34D399', r: -35 },
  { t: '22%', l: '40%', s:  6, c: '#F59E0B', r:  18 },
  { t: '28%', l: '62%', s: 10, c: '#60A5FA', r: -22 },
  { t: '33%', l: '12%', s:  8, c: '#FF6B6B', r:  40 },
  { t: '30%', l: '82%', s:  9, c: '#FCD34D', r: -15 },
  { t: '38%', l: '52%', s:  7, c: '#4ECDC4', r:  28 },
  { t: '42%', l:  '1%', s: 11, c: '#A78BFA', r: -30 },
  { t:  '2%', l: '50%', s:  7, c: '#F59E0B', r:  10 },
  { t: '12%', l: '31%', s:  9, c: '#34D399', r: -25 },
  { t: '20%', l: '78%', s:  6, c: '#F472B6', r:  45 },
  { t: '26%', l: '25%', s: 10, c: '#60A5FA', r: -12 },
  { t: '36%', l: '65%', s:  8, c: '#FF6B6B', r:  32 },
  { t: '45%', l: '38%', s:  6, c: '#FCD34D', r: -18 },
  { t:  '7%', l: '60%', s:  5, c: '#A78BFA', r:   8 },
  { t: '18%', l: '47%', s:  7, c: '#4ECDC4', r: -40 },
  { t: '32%', l: '90%', s:  9, c: '#F59E0B', r:  22 },
  { t: '40%', l: '15%', s:  6, c: '#34D399', r:  -8 },
];

// ─── Main BoxContent ───────────────────────────────────────────────────────────
const BoxContent = () => {
  const navigation = useNavigation();

  const [userBalance, setUserBalance] = useState(0);
  const [phase, setPhase]             = useState<Phase>('idle');
  const [prize, setPrize]             = useState<BoxPrize | null>(null);
  const [history, setHistory]         = useState<BoxHistory[]>([]);

  // ── Animations (native driver) ────────────────────────────────────────────
  const idleFloat      = useRef(new Animated.Value(0)).current;
  const shinePulse     = useRef(new Animated.Value(1)).current;
  const boxShakeX      = useRef(new Animated.Value(0)).current;
  const boxBeatScale   = useRef(new Animated.Value(1)).current;   // beat (bigger↔smaller)
  const lidTY          = useRef(new Animated.Value(0)).current;
  const lidTX          = useRef(new Animated.Value(0)).current;
  const lidRot         = useRef(new Animated.Value(0)).current;
  const lidOpacity     = useRef(new Animated.Value(1)).current;
  const prizeScale     = useRef(new Animated.Value(0)).current;
  const prizeTY        = useRef(new Animated.Value(40)).current;
  const prizeOpacity   = useRef(new Animated.Value(0)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;
  const starSpin       = useRef(new Animated.Value(0)).current;   // starburst rotation during opening

  // ── Confetti burst ────────────────────────────────────────────────────────
  const confettiPieces = useRef(
    Array.from({ length: 28 }, (_, i) => {
      const angle  = (i / 28) * Math.PI * 2;
      const radius = 80 + (i % 5) * 40;
      return {
        x:     new Animated.Value(0),
        y:     new Animated.Value(0),
        op:    new Animated.Value(0),
        sc:    new Animated.Value(0),
        rot:   new Animated.Value(0),
        color: CONFETTI_COLORS[i % 8],
        size:  8 + (i % 5) * 2,
        tx:    Math.cos(angle) * radius,
        ty:    Math.sin(angle) * radius - 60,
        delay: Math.floor(i / 7) * 50,
        rotDeg: (i % 2 === 0 ? 1 : -1) * (2 + (i % 4)),
      };
    })
  ).current;

  const lidRotInterp = lidRot.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-60deg', '0deg', '60deg'] });

  const idleAnim    = useRef<Animated.CompositeAnimation | null>(null);
  const shineAnim   = useRef<Animated.CompositeAnimation | null>(null);
  const beatAnim    = useRef<Animated.CompositeAnimation | null>(null);
  const starSpinAnim = useRef<Animated.CompositeAnimation | null>(null);
  const isMounted   = useRef(true);

  // ── helpers ───────────────────────────────────────────────────────────────
  const refreshBalance = useCallback(async () => {
    try {
      const data = await bonusApi.getBalance();
      if (isMounted.current) setUserBalance(Number(data?.available) || 0);
    } catch {}
  }, []);

  const startIdleFloat = useCallback(() => {
    idleFloat.setValue(0);
    idleAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(idleFloat, { toValue: -8, duration: 1100, useNativeDriver: true }),
        Animated.timing(idleFloat, { toValue:  0, duration: 1100, useNativeDriver: true }),
      ])
    );
    idleAnim.current.start();
  }, [idleFloat]);

  const startShinePulse = useCallback(() => {
    shinePulse.setValue(1);
    shineAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shinePulse, { toValue: 1.07, duration: 750, useNativeDriver: true }),
        Animated.timing(shinePulse, { toValue: 1.00, duration: 750, useNativeDriver: true }),
      ])
    );
    shineAnim.current.start();
  }, [shinePulse]);

  const stopAllLoops = useCallback(() => {
    idleAnim.current?.stop();
    shineAnim.current?.stop();
    beatAnim.current?.stop();
    starSpinAnim.current?.stop();
  }, []);

  const resetAnimValues = useCallback(() => {
    [boxShakeX, lidTY, lidTX, lidRot, lidOpacity,
     prizeScale, prizeTY, prizeOpacity, sparkleOpacity].forEach(a => a.stopAnimation());
    boxShakeX.setValue(0);    lidTY.setValue(0);      lidTX.setValue(0);
    lidRot.setValue(0);       lidOpacity.setValue(1);
    prizeScale.setValue(0);   prizeTY.setValue(40);
    prizeOpacity.setValue(0); sparkleOpacity.setValue(0);
    boxBeatScale.setValue(1); starSpin.setValue(0);
    confettiPieces.forEach(p => { p.x.setValue(0); p.y.setValue(0); p.op.setValue(0); p.sc.setValue(0); p.rot.setValue(0); });
  }, []);

  const saveHistory = useCallback((p: BoxPrize) => {
    const entry: BoxHistory = { title: p.title, emoji: p.emoji, date: new Date().toISOString() };
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, 20);
      void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const launchConfettiBurst = useCallback(() => {
    confettiPieces.forEach((p) => {
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.op, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(p.sc, { toValue: 1, tension: 260, friction: 9, useNativeDriver: true }),
          Animated.timing(p.x,  { toValue: p.tx, duration: 1000, useNativeDriver: true }),
          Animated.timing(p.y,  { toValue: p.ty, duration: 1000, useNativeDriver: true }),
          Animated.timing(p.rot, { toValue: p.rotDeg, duration: 1000, useNativeDriver: true }),
        ]),
        Animated.timing(p.op, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    });
  }, [confettiPieces]);

  // ── lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    AsyncStorage.getItem(HISTORY_KEY).then(raw => {
      if (raw && isMounted.current) setHistory(JSON.parse(raw) as BoxHistory[]);
    });
    const t = setTimeout(() => { if (isMounted.current) void refreshBalance(); }, 50);
    startIdleFloat();
    return () => {
      isMounted.current = false;
      clearTimeout(t);
      stopAllLoops();
      resetAnimValues();
    };
  }, [refreshBalance, startIdleFloat, stopAllLoops, resetAnimValues]);

  // ── actions ───────────────────────────────────────────────────────────────
  const handleBuyBox = () => {
    if (phase !== 'idle' || userBalance < BOX_COST) return;
    const won = pickPrize();
    setPrize(won);
    stopAllLoops();
    idleFloat.setValue(0);
    setPhase('ready');
    startShinePulse();
  };

  const runOpeningAnimation = useCallback((currentPrize: BoxPrize) => {
    stopAllLoops();
    shinePulse.setValue(1);
    resetAnimValues();
    setPhase('opening');

    // Beat loop — пульсирует всё время открытия
    boxBeatScale.setValue(1);
    beatAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(boxBeatScale, { toValue: 1.12, duration: 170, useNativeDriver: true }),
        Animated.timing(boxBeatScale, { toValue: 0.94, duration: 170, useNativeDriver: true }),
        Animated.timing(boxBeatScale, { toValue: 1.07, duration: 130, useNativeDriver: true }),
        Animated.timing(boxBeatScale, { toValue: 1.0,  duration: 200, useNativeDriver: true }),
      ])
    );
    beatAnim.current.start();

    // Медленное вращение лучей во время открытия
    starSpin.setValue(0);
    starSpinAnim.current = Animated.loop(
      Animated.timing(starSpin, { toValue: 1, duration: 10000, useNativeDriver: true })
    );
    starSpinAnim.current.start();

    Animated.sequence([
      // 1. SHAKE (9 steps × 75ms = 675ms)
      Animated.sequence([
        Animated.timing(boxShakeX, { toValue: -16, duration: 75, useNativeDriver: true }),
        Animated.timing(boxShakeX, { toValue:  16, duration: 75, useNativeDriver: true }),
        Animated.timing(boxShakeX, { toValue: -14, duration: 75, useNativeDriver: true }),
        Animated.timing(boxShakeX, { toValue:  14, duration: 75, useNativeDriver: true }),
        Animated.timing(boxShakeX, { toValue: -10, duration: 75, useNativeDriver: true }),
        Animated.timing(boxShakeX, { toValue:  10, duration: 75, useNativeDriver: true }),
        Animated.timing(boxShakeX, { toValue:  -6, duration: 75, useNativeDriver: true }),
        Animated.timing(boxShakeX, { toValue:   6, duration: 75, useNativeDriver: true }),
        Animated.timing(boxShakeX, { toValue:   0, duration: 75, useNativeDriver: true }),
      ]),
      // 2. LID FLIES (1000ms)
      Animated.parallel([
        Animated.timing(lidTY,      { toValue: -320, duration: 1000, useNativeDriver: true }),
        Animated.timing(lidTX,      { toValue: -120, duration: 1000, useNativeDriver: true }),
        Animated.timing(lidRot,     { toValue:   -1, duration: 1000, useNativeDriver: true }),
        Animated.timing(lidOpacity, { toValue:    0, duration:  800, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(sparkleOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]),
      ]),
      // 3. PRIZE FLIES OUT (900ms)
      Animated.parallel([
        Animated.spring(prizeScale,   { toValue: 1,   tension: 55, friction: 6, useNativeDriver: true }),
        Animated.timing(prizeTY,      { toValue: -50, duration: 900, useNativeDriver: true }),
        Animated.timing(prizeOpacity, { toValue:   1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      beatAnim.current?.stop();
      starSpinAnim.current?.stop();
      boxBeatScale.setValue(1);
      if (!finished || !isMounted.current) return;
      launchConfettiBurst();
      setPhase('revealed');
      void refreshBalance();
      saveHistory(currentPrize);
    });
  }, [stopAllLoops, resetAnimValues, refreshBalance, saveHistory, launchConfettiBurst,
      boxShakeX, boxBeatScale, lidTY, lidTX, lidRot, lidOpacity, sparkleOpacity,
      prizeScale, prizeTY, prizeOpacity, shinePulse, starSpin]);

  const handleTapBox = () => {
    if (phase !== 'ready' || !prize) return;
    runOpeningAnimation(prize);
  };

  const handleSkip = () => {
    if (!prize) return;
    beatAnim.current?.stop();
    starSpinAnim.current?.stop();
    stopAllLoops();
    [boxShakeX, lidTY, lidTX, lidRot, lidOpacity,
     prizeScale, prizeTY, prizeOpacity, sparkleOpacity].forEach(a => a.stopAnimation());
    boxBeatScale.setValue(1);
    launchConfettiBurst();
    setPhase('revealed');
    void refreshBalance();
    saveHistory(prize);
  };

  const handleReset = () => {
    resetAnimValues();
    setPhase('idle');
    setPrize(null);
    startIdleFloat();
  };

  const canBuy = phase === 'idle' && userBalance >= BOX_COST;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AirplaneBackground />

      {/* Тёмный фон для ready/opening */}
      {(phase === 'ready' || phase === 'opening') && (
        <View style={[StyleSheet.absoluteFillObject, styles.darkBg]} pointerEvents="none" />
      )}

      {/* Лучи звезды — позади всего, на тёмном фоне */}
      {phase === 'ready'   && <StarBurst />}
      {phase === 'opening' && <StarBurst spin={starSpin} />}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={wp(28)} color={phase === 'ready' || phase === 'opening' ? '#FFFFFF' : '#1E293B'} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, (phase === 'ready' || phase === 'opening') && styles.headerLight]}>
            Mystery Box TVA
          </Text>
          <Text style={[styles.headerSub, (phase === 'ready' || phase === 'opening') && styles.headerSubLight]}>
            {phase === 'ready' ? 'Ваша коробка готова!' : 'Откройте коробку и получите случайный бонус!'}
          </Text>
        </View>
        <View style={styles.balanceBadge}>
          <Text style={styles.balanceText}>{Number(userBalance).toFixed(2)}</Text>
          <Text style={styles.balanceUnit}>TVA</Text>
        </View>
      </View>

      {/* ── READY / OPENING — centred layout ── */}
      {(phase === 'ready' || phase === 'opening') && (
        <View style={styles.fullCentred}>

          <View style={styles.centredBoxArea}>

            {/* Sparkles (opening) */}
            {phase === 'opening' && (
              <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: sparkleOpacity }]} pointerEvents="none">
                {['✨','⭐','🌟','💫','🎊','⭐','✨','🌟','💫','🎉'].map((e, i) => (
                  <Text key={i} style={[styles.sparkle, {
                    top:  `${5 + i * 9}%` as any,
                    left: `${3 + i * 9}%` as any,
                    fontSize: 16 + (i % 3) * 6,
                  }]}>{e}</Text>
                ))}
              </Animated.View>
            )}

            {/* Confetti burst */}
            <View style={styles.confettiAnchor} pointerEvents="none">
              {confettiPieces.map((p, i) => (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    borderRadius: i % 3 === 0 ? p.size / 2 : 2,
                    opacity: p.op,
                    transform: [
                      { translateX: p.x },
                      { translateY: p.y },
                      { scale: p.sc },
                      { rotate: p.rot.interpolate({ inputRange: [Math.min(0, p.rotDeg), Math.max(0, p.rotDeg)], outputRange: [`${Math.min(0, p.rotDeg) * 90}deg`, `${Math.max(0, p.rotDeg) * 90}deg`] }) },
                    ],
                  }}
                />
              ))}
            </View>

            {/* READY: glowing box */}
            {phase === 'ready' && (
              <TouchableOpacity onPress={handleTapBox} activeOpacity={0.9} style={{ zIndex: 3 }}>
                <Animated.View style={{ transform: [{ scale: shinePulse }] }}>
                  <Image source={IMG_BOX_SHINE} style={styles.boxImage} resizeMode="contain" />
                </Animated.View>
              </TouchableOpacity>
            )}

            {/* OPENING: open box + flying lid + prize */}
            {phase === 'opening' && (
              <Animated.View
                style={{
                  transform: [{ translateX: boxShakeX }, { scale: boxBeatScale }],
                  zIndex: 3,
                }}
              >
                <View style={styles.openBoxContainer}>
                  {/* Тело открытой коробки */}
                  <Image
                    source={IMG_BOX_OPEN}
                    style={styles.openBoxImage}
                    resizeMode="contain"
                  />
                  {/* Крышка в полный размер коробки, чтобы совпадала с пропорциями */}
                  <Animated.View
                    style={[
                      styles.lidWrapper,
                      {
                        transform: [
                          { translateY: lidTY },
                          { translateX: lidTX },
                          { rotate: lidRotInterp },
                        ],
                        opacity: lidOpacity,
                      },
                    ]}
                  >
                    <Image source={IMG_BOX_LID} style={styles.lidImage} resizeMode="contain" />
                  </Animated.View>
                  {/* Приз вылетает из коробки */}
                  <Animated.View
                    style={[
                      styles.prizeEmerge,
                      {
                        transform: [{ scale: prizeScale }, { translateY: prizeTY }],
                        opacity: prizeOpacity,
                      },
                    ]}
                  >
                    <Text style={styles.prizeEmergeEmoji}>{prize?.emoji}</Text>
                  </Animated.View>
                </View>
              </Animated.View>
            )}
          </View>

          {/* Hint (ready only) */}
          {phase === 'ready' && (
            <View style={styles.tapHintBox}>
              <Text style={styles.tapHintText}>Нажмите на коробку,{'\n'}чтобы открыть её</Text>
              <Text style={styles.tapArrow}>↓</Text>
            </View>
          )}

          {/* Skip */}
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.75}>
            <Text style={styles.skipBtnText}>Пропустить анимацию</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── IDLE — scroll ── */}
      {phase === 'idle' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.idleBoxArea}>
            <Animated.View style={{ transform: [{ translateY: idleFloat }] }}>
              <TouchableOpacity activeOpacity={canBuy ? 0.85 : 1} onPress={canBuy ? handleBuyBox : undefined}>
                <Image source={IMG_BOX} style={styles.boxImage} resizeMode="contain" />
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Text style={styles.possibleTitle}>Возможные призы:</Text>
          <View style={styles.possibleGrid}>
            {POSSIBLE_PRIZES.map((p, i) => (
              <View key={i} style={styles.possibleItem}>
                <ConfettiIcon palette={CONFETTI_GRID_PALETTES[i % CONFETTI_GRID_PALETTES.length]} />
                <Text style={styles.possibleLabel}>{p.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.costBox}>
            <Text style={styles.costLabel}>Стоимость коробки:</Text>
            <View style={styles.costValue}>
              <Text style={styles.costEmoji}>✈️</Text>
              <Text style={styles.costAmount}>{BOX_COST} TVA</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.mainBtn, !canBuy && styles.mainBtnDisabled]}
            onPress={handleBuyBox}
            disabled={!canBuy}
            activeOpacity={0.85}
          >
            <Text style={styles.mainBtnText}>{canBuy ? '🎁  Открыть коробку' : `Нужно ${BOX_COST} TVA`}</Text>
          </TouchableOpacity>

          {userBalance < BOX_COST && (
            <Text style={styles.notEnoughText}>Баланс: {Number(userBalance).toFixed(3)} TVA</Text>
          )}

          {history.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Последние открытия</Text>
              {history.slice(0, 5).map((item, i) => (
                <View key={i} style={styles.historyItem}>
                  <Text style={styles.historyEmoji}>{item.emoji}</Text>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyLabel}>{item.title}</Text>
                    <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString('ru')}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <View style={{ height: hp(100) }} />
        </ScrollView>
      )}

      {/* ── REVEALED — flex: карточка выше, кнопки прижаты к низу ── */}
      {phase === 'revealed' && prize && (
        <View style={styles.revealedContainer}>

          {/* Конфетти вверху — компактная зона */}
          <View style={styles.revealedConfettiArea} pointerEvents="none">
            {REVEALED_CONFETTI.map((c, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  top: c.t as any,
                  left: c.l as any,
                  width: c.s,
                  height: c.s,
                  backgroundColor: c.c,
                  borderRadius: i % 4 === 0 ? c.s / 2 : 2,
                  transform: [{ rotate: `${c.r}deg` }],
                  opacity: 0.88,
                }}
              />
            ))}
            {confettiPieces.map((p, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  alignSelf: 'center',
                  top: '30%',
                  width: p.size, height: p.size,
                  backgroundColor: p.color,
                  borderRadius: i % 3 === 0 ? p.size / 2 : 2,
                  opacity: p.op,
                  transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.sc }],
                }}
              />
            ))}
          </View>

          {/* Карточка — сразу после конфетти, выше чем раньше */}
          <View style={styles.revealCard}>
            <Text style={styles.congratsText}>Поздравляем! 🎉</Text>
            <Text style={styles.youGotText}>Вы получили:</Text>
            <View style={styles.prizeIconBox}>
              <Text style={styles.prizeRevealEmoji}>{prize.emoji}</Text>
            </View>
            <Text style={styles.prizeTitle}>{prize.title}</Text>
            <Text style={styles.prizeDesc}>{prize.desc}</Text>
          </View>

          {/* Спейсер — занимает оставшееся место, прижимает кнопки к низу */}
          <View style={{ flex: 1 }} />

          {/* Кнопки — всегда внизу */}
          <View style={styles.revealedButtons}>
            <TouchableOpacity style={styles.mainBtn} onPress={handleReset} activeOpacity={0.85}>
              <Text style={styles.mainBtnText}>Отлично! ✨</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.openMoreBtn} onPress={handleReset} activeOpacity={0.7}>
              <Text style={styles.openMoreText}>
                Открыть ещё  <Text style={{ color: '#0EA5E9' }}>({BOX_COST} TVA)</Text>
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      )}
    </SafeAreaView>
  );
};

export const MysteryBoxScreen = () => (
  <ScreenBoundary>
    <BoxContent />
  </ScreenBoundary>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },

  darkBg: { backgroundColor: '#0C2461', opacity: 0.94 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: wp(12), paddingVertical: hp(10), zIndex: 10,
  },
  backBtn: { padding: wp(4) },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: fontSize(17), fontWeight: '700', color: '#1E293B' },
  headerLight: { color: '#FFFFFF' },
  headerSub: { fontSize: fontSize(11), color: '#64748B', fontWeight: '500', textAlign: 'center' },
  headerSubLight: { color: '#93C5FD' },
  balanceBadge: {
    backgroundColor: '#EFF6FF', borderRadius: wp(10),
    paddingHorizontal: wp(10), paddingVertical: hp(5),
    borderWidth: 1, borderColor: '#BAE6FD', alignItems: 'center', minWidth: wp(60),
  },
  balanceText: { fontSize: fontSize(13), fontWeight: '800', color: '#0EA5E9' },
  balanceUnit: { fontSize: fontSize(9), color: '#64748B', fontWeight: '600' },

  // ── Ready/Opening centred layout ──
  fullCentred: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: wp(24), paddingBottom: hp(24),
  },
  centredBoxArea: {
    width: BOX_SIZE * 1.3,
    height: BOX_SIZE * 1.3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(12),
  },
  confettiAnchor: {
    position: 'absolute',
    top: BOX_SIZE * 0.65,
    left: BOX_SIZE * 0.65,
    width: 0, height: 0,
  },
  tapHintBox: { alignItems: 'center', marginBottom: hp(16) },
  tapHintText: { fontSize: fontSize(15), color: '#BAE6FD', fontWeight: '600', textAlign: 'center', lineHeight: fontSize(23) },
  tapArrow: { fontSize: 22, color: '#60A5FA', marginTop: hp(6) },
  skipBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: wp(14),
    paddingVertical: hp(14), paddingHorizontal: wp(40),
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
  },
  skipBtnText: { fontSize: fontSize(15), fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },

  // ── Box images ──
  boxImage: { width: BOX_SIZE, height: BOX_SIZE },

  // Контейнер открытой коробки
  openBoxContainer: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    position: 'relative',
  },
  openBoxImage: {
    position: 'absolute',
    top: 0, left: 0,
    width: BOX_SIZE,
    height: BOX_SIZE,
  },
  // Крышка: точная высота = BOX_SIZE × (311/425) — убирает ложное вертикальное центрирование
  lidWrapper: {
    position: 'absolute',
    top: -25,
    left: 0,
    width: BOX_SIZE,
    height: BOX_SIZE * 311 / 425,
    zIndex: 5,
  },
  lidImage: {
    width: BOX_SIZE,
    height: BOX_SIZE * 311 / 425,
  },
  prizeEmerge: {
    position: 'absolute',
    top: BOX_SIZE * 0.05,
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  prizeEmergeEmoji: { fontSize: 76 },
  sparkle: { position: 'absolute' },

  // ── Idle layout ──
  idleBoxArea: {
    height: BOX_SIZE + hp(30),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(8),
  },

  // ── Scroll content ──
  scroll: { paddingHorizontal: wp(16), paddingTop: hp(4), alignItems: 'center' },

  // ── Revealed ──
  revealedContainer: {
    flex: 1,
    paddingHorizontal: wp(16),
  },
  revealedConfettiArea: { width: '100%', height: hp(110), position: 'relative' },
  revealedButtons: {
    paddingBottom: hp(28),
  },
  revealCard: {
    backgroundColor: '#FFFFFF', borderRadius: wp(24), padding: wp(24),
    alignItems: 'center', width: '100%', marginBottom: hp(16),
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
    borderWidth: 1, borderColor: '#E0F2FE',
  },
  congratsText: { fontSize: fontSize(26), fontWeight: '800', color: '#1E293B', marginBottom: hp(4) },
  youGotText: { fontSize: fontSize(14), color: '#64748B', fontWeight: '500', marginBottom: hp(12) },
  prizeIconBox: {
    width: wp(110), height: wp(110), borderRadius: wp(55),
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    marginBottom: hp(12),
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  prizeRevealEmoji: { fontSize: 64 },
  prizeTitle: { fontSize: fontSize(30), fontWeight: '800', color: '#0EA5E9', marginBottom: hp(6) },
  prizeDesc: { fontSize: fontSize(13), color: '#64748B', textAlign: 'center', fontWeight: '500' },

  // ── Possible prizes ──
  possibleTitle: { fontSize: fontSize(15), fontWeight: '700', color: '#1E293B', alignSelf: 'flex-start', marginBottom: hp(10) },
  possibleGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: hp(16), justifyContent: 'space-between', rowGap: wp(10) },
  possibleItem: {
    backgroundColor: '#FFFFFF', borderRadius: wp(12), padding: wp(12),
    alignItems: 'center', width: '30%',
    borderWidth: 1, borderColor: '#E0F2FE',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  confettiIconWrap: {
    width: 32, height: 24,
    position: 'relative',
    marginBottom: hp(6),
  },
  possibleLabel: { fontSize: fontSize(11), color: '#64748B', textAlign: 'center', fontWeight: '500', lineHeight: fontSize(15) },

  costBox: { alignItems: 'center', marginBottom: hp(16), width: '100%' },
  costLabel: { fontSize: fontSize(13), color: '#64748B', fontWeight: '500', marginBottom: hp(6) },
  costValue: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: wp(24), paddingVertical: hp(10), borderRadius: wp(20), borderWidth: 1, borderColor: '#BAE6FD' },
  costEmoji: { fontSize: 18, marginRight: wp(6) },
  costAmount: { fontSize: fontSize(18), fontWeight: '700', color: '#0EA5E9' },

  // ── Buttons ──
  mainBtn: {
    backgroundColor: '#0EA5E9', borderRadius: wp(16), paddingVertical: hp(16),
    width: '100%', alignItems: 'center',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6, marginBottom: hp(8),
  },
  mainBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  mainBtnText: { fontSize: fontSize(17), fontWeight: '700', color: '#FFFFFF' },
  openMoreBtn: { paddingVertical: hp(10), alignSelf: 'center' },
  openMoreText: { fontSize: fontSize(14), color: '#64748B', fontWeight: '600' },
  notEnoughText: { fontSize: fontSize(13), color: '#EF4444', textAlign: 'center', marginBottom: hp(8) },

  // ── History ──
  historySection: { width: '100%', marginTop: hp(16) },
  historyTitle: { fontSize: fontSize(16), fontWeight: '700', color: '#1E293B', marginBottom: hp(10) },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: wp(12), padding: wp(12), marginBottom: hp(8), borderWidth: 1, borderColor: '#E0F2FE' },
  historyEmoji: { fontSize: 24, marginRight: wp(12) },
  historyInfo: { flex: 1 },
  historyLabel: { fontSize: fontSize(14), fontWeight: '700', color: '#1E293B' },
  historyDate: { fontSize: fontSize(12), color: '#94A3B8' },
});
