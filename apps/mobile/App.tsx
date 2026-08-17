import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LoginScreen } from './src/screens/LoginScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { TutorScreen } from './src/screens/TutorScreen';
import { type Learner, getStoredLearner } from './src/lib/learner';

const DEMO_LESSON_SLUG = 'variables-and-types';

type Tab = 'lesson' | 'tutor';

export default function App() {
  const [learner, setLearner] = useState<Learner | null | undefined>(undefined); // undefined = not checked yet
  const [tab, setTab] = useState<Tab>('lesson');

  useEffect(() => {
    getStoredLearner().then(setLearner);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {learner === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : learner === null ? (
        <LoginScreen onLoggedIn={setLearner} />
      ) : (
        <View style={styles.flex}>
          <View style={styles.tabBar}>
            <Pressable onPress={() => setTab('lesson')} style={styles.tabButton}>
              <Text style={[styles.tabLabel, tab === 'lesson' && styles.tabLabelActive]}>Lesson</Text>
            </Pressable>
            <Pressable onPress={() => setTab('tutor')} style={styles.tabButton}>
              <Text style={[styles.tabLabel, tab === 'tutor' && styles.tabLabelActive]}>Talk to your tutor</Text>
            </Pressable>
          </View>
          {tab === 'lesson' ? (
            <LessonScreen learner={learner} slug={DEMO_LESSON_SLUG} />
          ) : (
            <TutorScreen learner={learner} />
          )}
        </View>
      )}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e8ddc9' },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabLabel: { color: '#8b6f47', fontWeight: '600' },
  tabLabelActive: { color: '#141414' },
});
