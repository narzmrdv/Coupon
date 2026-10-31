import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useLanguage } from '@/shared/lib/hooks';
import { fontSize, hp, wp } from '@/shared/lib/responsive';

interface CalendarDatePickerProps {
  visible: boolean;
  value: Date | null;
  /** Days before this are disabled. Defaults to today. */
  minDate?: Date;
  title: string;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

const toLocale = (language: 'en' | 'ru' | 'uk') =>
  language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : 'en-US';

const stripTime = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// A known Monday (2023-01-02) used purely as an anchor to read localized
// weekday abbreviations in Monday-first order via Intl.
const MONDAY_ANCHOR = new Date(2023, 0, 2);

export const CalendarDatePicker: React.FC<CalendarDatePickerProps> = ({
  visible,
  value,
  minDate,
  title,
  onSelect,
  onClose,
}) => {
  const { language, t } = useLanguage();
  const locale = toLocale(language);
  const today = useMemo(() => stripTime(new Date()), []);
  const floor = minDate ? stripTime(minDate) : today;

  const [viewDate, setViewDate] = useState(() => stripTime(value ?? floor));

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(MONDAY_ANCHOR);
      d.setDate(MONDAY_ANCHOR.getDate() + i);
      return formatter.format(d);
    });
  }, [locale]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewDate),
    [locale, viewDate],
  );

  const weeks = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Monday
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: totalDays }, (_, i) => new Date(year, month, i + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewDate]);

  const canGoPrevMonth =
    viewDate.getFullYear() > floor.getFullYear() ||
    (viewDate.getFullYear() === floor.getFullYear() && viewDate.getMonth() > floor.getMonth());

  const goPrevMonth = () => {
    if (!canGoPrevMonth) return;
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const goNextMonth = () => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.monthRow}>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!canGoPrevMonth}
              onPress={goPrevMonth}
              style={[styles.navButton, !canGoPrevMonth && styles.navButtonDisabled]}>
              <ChevronLeft size={20} color={canGoPrevMonth ? '#1E293B' : '#CBD5E1'} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={goNextMonth} style={styles.navButton}>
              <ChevronRight size={20} color="#1E293B" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label, index) => (
              <Text key={index} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          {weeks.map((week, rowIndex) => (
            <View key={rowIndex} style={styles.weekRow}>
              {week.map((day, colIndex) => {
                if (!day) return <View key={colIndex} style={styles.dayCell} />;
                const disabled = day < floor;
                const selected = value ? isSameDay(day, value) : false;
                const isToday = isSameDay(day, today);
                return (
                  <TouchableOpacity
                    key={colIndex}
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => onSelect(day)}
                    style={styles.dayCell}>
                    <View
                      style={[
                        styles.dayCircle,
                        selected && styles.dayCircleSelected,
                        isToday && !selected && styles.dayCircleToday,
                      ]}>
                      <Text
                        style={[
                          styles.dayText,
                          disabled && styles.dayTextDisabled,
                          selected && styles.dayTextSelected,
                        ]}>
                        {day.getDate()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>{t.common.cancel}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: wp(20),
  },
  card: {
    width: '100%',
    maxWidth: wp(360),
    borderRadius: wp(22),
    backgroundColor: '#FFFFFF',
    padding: wp(18),
  },
  title: {
    fontSize: fontSize(16),
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: hp(14),
    textAlign: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp(12),
  },
  navButton: {
    width: wp(34),
    height: wp(34),
    borderRadius: wp(17),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  navButtonDisabled: { opacity: 0.5 },
  monthLabel: {
    fontSize: fontSize(15),
    fontWeight: '700',
    color: '#1E293B',
    textTransform: 'capitalize',
  },
  weekdayRow: { flexDirection: 'row', marginBottom: hp(4) },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize(11),
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: wp(34),
    height: wp(34),
    borderRadius: wp(17),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: { backgroundColor: '#0EA5E9' },
  dayCircleToday: { borderWidth: 1.5, borderColor: '#0EA5E9' },
  dayText: { fontSize: fontSize(14), fontWeight: '600', color: '#1E293B' },
  dayTextDisabled: { color: '#CBD5E1' },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '800' },
  cancelButton: {
    marginTop: hp(14),
    paddingVertical: hp(12),
    alignItems: 'center',
    borderRadius: wp(14),
    backgroundColor: '#F1F5F9',
  },
  cancelText: { fontSize: fontSize(14), fontWeight: '700', color: '#475569' },
});
