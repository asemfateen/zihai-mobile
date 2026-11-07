import React, { useState, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, PanResponder, GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

interface Point {
  x: number;
  y: number;
  time: number;
}

interface Stroke {
  path: string;
}

export const StrokeCanvas: React.FC = () => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  
  const currentPoints = useRef<Point[]>([]);
  const lastHapticTime = useRef<number>(0);

  // Helper: calculate distance between two points
  const getDistance = (p1: Point, p2: Point) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const now = Date.now();
        
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        const newPoint: Point = { x: locationX, y: locationY, time: now };
        currentPoints.current = [newPoint];
        setCurrentPath(`M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const now = Date.now();
        const currentPointsArr = currentPoints.current;
        
        if (currentPointsArr.length === 0) return;
        
        const prevPoint = currentPointsArr[currentPointsArr.length - 1];
        const newPoint: Point = { x: locationX, y: locationY, time: now };
        
        const dist = getDistance(prevPoint, newPoint);
        if (dist < 2) return; // ignore tiny movements

        const timeDiff = now - prevPoint.time;
        const speed = timeDiff > 0 ? dist / timeDiff : 0;

        // Model organic brush stroke thickness based on drag velocity
        // Slow drag = thick ink (width 8), Fast drag = thin ink (width 2)
        const thickness = Math.max(2, Math.min(8, 8 - speed * 3.5));

        // Subtly trigger continuous micro-haptic ticks as ink flows
        if (now - lastHapticTime.current > 60) {
          Haptics.selectionAsync();
          lastHapticTime.current = now;
        }

        // Draw smooth quadratic bezier curve segments or simple line sections
        const midX = (prevPoint.x + newPoint.x) / 2;
        const midY = (prevPoint.y + newPoint.y) / 2;

        setCurrentPath(prev => 
          `${prev} Q ${prevPoint.x.toFixed(1)} ${prevPoint.y.toFixed(1)}, ${midX.toFixed(1)} ${midY.toFixed(1)}`
        );
        
        currentPoints.current.push(newPoint);
      },
      onPanResponderRelease: () => {
        if (currentPath) {
          setStrokes(prev => [...prev, { path: currentPath }]);
          setCurrentPath('');
        }
        currentPoints.current = [];
      }
    })
  ).current;

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStrokes([]);
    setCurrentPath('');
  };

  const handleUndo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStrokes(prev => prev.slice(0, -1));
  };

  return (
    <View style={styles.container}>
      {/* Drawing area */}
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {strokes.map((stroke, idx) => (
            <Path
              key={idx}
              d={stroke.path}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath !== '' && (
            <Path
              d={currentPath}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
      </View>

      {/* Button controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleUndo} disabled={strokes.length === 0}>
          <Text style={[styles.controlBtnText, strokes.length === 0 && styles.disabledText]}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleClear} disabled={strokes.length === 0 && currentPath === ''}>
          <Text style={[styles.controlBtnText, strokes.length === 0 && currentPath === '' && styles.disabledText]}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  canvasContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    justifyContent: 'center',
    width: '100%',
  },
  controlBtn: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 20,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  controlBtnText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#3f3f46',
  },
});
