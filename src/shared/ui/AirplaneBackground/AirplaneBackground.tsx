import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { Plane } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Генерируем позиции для самолётиков по сетке (чтобы не накладывались)
const generateAirplanes = () => {
  const airplanes = [];
  const cols = 4; // Колонки
  const rows = 8; // Ряды
  const cellWidth = SCREEN_WIDTH / cols;
  const cellHeight = SCREEN_HEIGHT / rows;

  let id = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Небольшое случайное смещение внутри ячейки
      const offsetX = (Math.random() - 0.5) * (cellWidth * 0.4);
      const offsetY = (Math.random() - 0.5) * (cellHeight * 0.4);

      airplanes.push({
        id: id++,
        x: col * cellWidth + cellWidth / 2 + offsetX - 12,
        y: row * cellHeight + cellHeight / 2 + offsetY,
        rotation: Math.random() * 360,
        scale: 0.8 + Math.random() * 0.4,
        opacity: 0.08 + Math.random() * 0.06,
        animationDelay: Math.random() * 2000,
      });
    }
  }
  return airplanes;
};

interface AirplaneBackgroundProps {
  color?: string;
  animated?: boolean;
}

export const AirplaneBackground: React.FC<AirplaneBackgroundProps> = ({
  color = '#0EA5E9',
  animated = true,
}) => {
  const airplanes = useRef(generateAirplanes()).current;
  const animatedValues = useRef(
    airplanes.map(() => ({
      translateY: new Animated.Value(0),
      rotate: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!animated) return;

    const animations = animatedValues.map((values, index) => {
      const airplane = airplanes[index];

      // Плавное движение вверх-вниз
      const floatAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(values.translateY, {
            toValue: 10,
            duration: 2000 + airplane.animationDelay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(values.translateY, {
            toValue: -10,
            duration: 2000 + airplane.animationDelay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      // Небольшое покачивание
      const rotateAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(values.rotate, {
            toValue: 5,
            duration: 3000 + airplane.animationDelay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(values.rotate, {
            toValue: -5,
            duration: 3000 + airplane.animationDelay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );

      return Animated.parallel([floatAnimation, rotateAnimation]);
    });

    animations.forEach((anim) => anim.start());

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [animated]);

  return (
    <View style={styles.container} pointerEvents="none">
      {airplanes.map((airplane, index) => {
        const animatedStyle = animated
          ? {
              transform: [
                { translateY: animatedValues[index].translateY },
                {
                  rotate: animatedValues[index].rotate.interpolate({
                    inputRange: [-5, 5],
                    outputRange: [`${airplane.rotation - 5}deg`, `${airplane.rotation + 5}deg`],
                  }),
                },
                { scale: airplane.scale },
              ],
            }
          : {
              transform: [{ rotate: `${airplane.rotation}deg` }, { scale: airplane.scale }],
            };

        return (
          <Animated.View
            key={airplane.id}
            style={[
              styles.airplane,
              {
                left: airplane.x,
                top: airplane.y,
                opacity: airplane.opacity,
              },
              animatedStyle,
            ]}>
            <Plane size={24} color={color} strokeWidth={1.5} />
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  airplane: {
    position: 'absolute',
  },
});
